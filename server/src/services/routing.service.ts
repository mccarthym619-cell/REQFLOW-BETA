import { getDb } from '../database/connection';
import { findEligibleUsers } from '../repositories/permissions.repository';
import type {
  ApprovalPermission,
  UserPermission,
  StepCondition,
  ApprovalChainStep,
} from '@req-tracker/shared';
import { logger } from '../config/logger';

export interface StepResolution {
  step: ApprovalChainStep;
  targetDepartmentId: number | null;
  requiredPermission: ApprovalPermission;
  eligibleUsers: UserPermission[];
  isFinal: boolean;
}

interface RequestContext {
  id: number;
  submitted_by: number;
  department_id: number | null;
  current_step_order: number | null;
  returned_from_step: number | null;
  amount?: number;
  field_values?: Record<string, string>;
}

/**
 * Resolve the next step(s) in the approval chain for a request.
 * Handles sequential and parallel execution modes, conditional steps,
 * and the RETURNED resume logic.
 */
export function resolveNextSteps(
  request: RequestContext,
  templateId: number
): StepResolution[] | { complete: true } {
  const db = getDb();

  // Get the request's command (from department or direct)
  let requestCommandId: number | null = null;
  if (request.department_id) {
    const dept = db.prepare(
      'SELECT command_id FROM departments WHERE id = ?'
    ).get(request.department_id) as { command_id: number } | undefined;
    requestCommandId = dept?.command_id ?? null;
  }
  if (!requestCommandId) {
    // Fallback: look up user's command
    const user = db.prepare('SELECT command_id FROM users WHERE id = ?').get(request.submitted_by) as { command_id: number } | undefined;
    requestCommandId = user?.command_id ?? null;
  }
  if (!requestCommandId) {
    logger.error({ requestId: request.id }, 'Cannot resolve command for request');
    return { complete: true };
  }

  // Get all active steps for this template, sorted by step_order
  const steps = db.prepare(`
    SELECT acs.*, d.name as target_department_name
    FROM approval_chain_steps acs
    LEFT JOIN departments d ON d.id = acs.target_department_id
    WHERE acs.template_id = ? AND acs.is_active = 1
    ORDER BY acs.step_order
  `).all(templateId) as ApprovalChainStep[];

  // Determine the starting step_order
  const startFrom = request.returned_from_step ?? (request.current_step_order ?? 0);

  const resolutions: StepResolution[] = [];
  let currentParallelGroup: number | null = null;

  for (const step of steps) {
    // Skip steps before the current position
    if (step.step_order <= startFrom) continue;

    // Evaluate conditional steps
    if (step.condition) {
      try {
        const condConfig = JSON.parse(step.condition) as StepCondition;
        if (!evaluateCondition(condConfig, request)) {
          continue; // Skip this step
        }
      } catch (e) {
        logger.warn({ stepId: step.id, condition: step.condition }, 'Failed to parse step condition');
      }
    }

    // Determine the required permission
    const requiredPermission = step.required_permission as ApprovalPermission | null;
    if (!requiredPermission) {
      // Legacy step without required_permission - skip
      logger.warn({ stepId: step.id }, 'Step missing required_permission');
      continue;
    }

    // Resolve target department
    const targetDeptId = step.target_department_id;

    // Find eligible users via the permission model
    const eligible = findEligibleUsers({
      requestCommandId,
      targetDepartmentId: targetDeptId,
      permission: requiredPermission,
      excludeUserId: request.submitted_by,
      maxAmount: request.amount,
    });

    if (eligible.length === 0) {
      logger.warn({
        stepId: step.id,
        permission: requiredPermission,
        targetDept: targetDeptId,
        command: requestCommandId,
      }, 'No eligible users found for step');
    }

    const isFinal = step.step_order === steps[steps.length - 1]?.step_order;

    const resolution: StepResolution = {
      step,
      targetDepartmentId: targetDeptId,
      requiredPermission,
      eligibleUsers: eligible,
      isFinal,
    };

    // Handle parallel groups
    if (step.execution_mode === 'parallel' && step.parallel_group !== null) {
      if (currentParallelGroup === null || currentParallelGroup === step.parallel_group) {
        currentParallelGroup = step.parallel_group;
        resolutions.push(resolution);
        continue; // Keep collecting parallel steps
      }
      // Different parallel group = start of new group, stop here
      break;
    }

    // Sequential step
    if (resolutions.length === 0) {
      // First sequential step found — return it
      resolutions.push(resolution);
      break;
    }
    // We already have parallel steps collected, stop here
    break;
  }

  if (resolutions.length === 0) {
    return { complete: true };
  }

  return resolutions;
}

/**
 * Evaluate a step condition against the request context.
 */
export function evaluateCondition(
  condition: StepCondition,
  request: RequestContext
): boolean {
  switch (condition.type) {
    case 'amount_threshold': {
      const amount = request.amount ?? 0;
      if (condition.min_amount !== undefined && amount < condition.min_amount) return false;
      if (condition.max_amount !== undefined && amount > condition.max_amount) return false;
      return true;
    }

    case 'field_check': {
      const fieldValue = request.field_values?.[condition.field];
      if (fieldValue === undefined) return false;

      switch (condition.operator) {
        case 'equals':
          return fieldValue === String(condition.value);
        case 'not_equals':
          return fieldValue !== String(condition.value);
        case 'in':
          return (condition.values ?? []).map(String).includes(fieldValue);
        case 'not_in':
          return !(condition.values ?? []).map(String).includes(fieldValue);
        case 'greater_than':
          return Number(fieldValue) > Number(condition.value);
        case 'less_than':
          return Number(fieldValue) < Number(condition.value);
        case 'greater_or_equal':
          return Number(fieldValue) >= Number(condition.value);
        case 'less_or_equal':
          return Number(fieldValue) <= Number(condition.value);
        default:
          return true;
      }
    }

    case 'compound': {
      if (condition.operator === 'AND') {
        return condition.rules.every(r => evaluateCondition(r, request));
      }
      return condition.rules.some(r => evaluateCondition(r, request));
    }

    default:
      return true;
  }
}

/**
 * Check if a user is eligible to act on a specific step of a request.
 */
export function isUserEligibleForStep(
  userId: number,
  requestId: number,
  stepId: number
): boolean {
  const db = getDb();

  // Get the request context
  const request = db.prepare(`
    SELECT r.id, r.submitted_by, r.department_id, r.current_step_order, r.returned_from_step,
           r.template_id
    FROM requests r
    WHERE r.id = ?
  `).get(requestId) as RequestContext & { template_id: number } | undefined;

  if (!request) return false;

  // Get the step
  const step = db.prepare(`
    SELECT acs.*
    FROM request_approval_steps ras
    JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
    WHERE ras.id = ?
  `).get(stepId) as ApprovalChainStep | undefined;

  if (!step) return false;

  const requiredPermission = step.required_permission as ApprovalPermission | null;
  if (!requiredPermission) return false;

  // Get command from request
  let requestCommandId: number | null = null;
  if (request.department_id) {
    const dept = db.prepare(
      'SELECT command_id FROM departments WHERE id = ?'
    ).get(request.department_id) as { command_id: number } | undefined;
    requestCommandId = dept?.command_id ?? null;
  }
  if (!requestCommandId) {
    const user = db.prepare('SELECT command_id FROM users WHERE id = ?').get(request.submitted_by) as { command_id: number } | undefined;
    requestCommandId = user?.command_id ?? null;
  }
  if (!requestCommandId) return false;

  const eligible = findEligibleUsers({
    requestCommandId,
    targetDepartmentId: step.target_department_id ?? null,
    permission: requiredPermission,
    excludeUserId: request.submitted_by,
  });

  return eligible.some(e => e.user_id === userId);
}
