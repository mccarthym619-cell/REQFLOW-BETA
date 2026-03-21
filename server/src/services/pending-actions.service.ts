import { getDb } from '../database/connection';
import {
  bulkCreatePendingActions,
  closePendingActionsForStep,
  closeAllPendingActionsForRequest,
  getPendingActionsForUser,
  getPendingActionCountForUser,
} from '../repositories/pendingActions.repository';
import { resolveNextSteps, StepResolution } from './routing.service';
import { logger } from '../config/logger';

interface DispatchContext {
  requestId: number;
  stepResolutions: StepResolution[];
  slaDefaultHours?: number;
}

/**
 * Dispatch pending actions for the next step(s) in a request's approval chain.
 * Creates pending_action rows for all eligible users and optionally sends notifications.
 */
export function dispatchPendingActions(ctx: DispatchContext): void {
  const db = getDb();

  // Get default SLA hours from system settings
  let slaHours = ctx.slaDefaultHours;
  if (slaHours === undefined) {
    const setting = db.prepare(
      "SELECT value FROM system_settings WHERE key = 'sla_default_hours'"
    ).get() as { value: string } | undefined;
    slaHours = setting ? parseInt(setting.value, 10) : 72;
  }

  for (const resolution of ctx.stepResolutions) {
    // Calculate due_by from step's sla_hours or default
    const stepSlaHours = resolution.step.sla_hours ?? slaHours;
    const dueBy = stepSlaHours
      ? new Date(Date.now() + stepSlaHours * 60 * 60 * 1000).toISOString()
      : null;

    // Get the request_approval_step ID for this chain step
    const ras = db.prepare(`
      SELECT id FROM request_approval_steps
      WHERE request_id = ? AND chain_step_id = ?
    `).get(ctx.requestId, resolution.step.id) as { id: number } | undefined;

    if (!ras) {
      logger.warn({
        requestId: ctx.requestId,
        chainStepId: resolution.step.id,
      }, 'No request_approval_step found for chain step');
      continue;
    }

    // Create pending action rows for each eligible user
    const actions = resolution.eligibleUsers.map(user => ({
      request_id: ctx.requestId,
      step_id: ras.id,
      assigned_to: user.user_id,
      due_by: dueBy,
    }));

    if (actions.length > 0) {
      bulkCreatePendingActions(actions);
      logger.info({
        requestId: ctx.requestId,
        stepId: ras.id,
        eligibleCount: actions.length,
        permission: resolution.requiredPermission,
      }, 'Dispatched pending actions');
    }
  }
}

/**
 * Close pending actions when a step is acted upon.
 */
export function onStepActed(requestId: number, stepId: number): void {
  const closed = closePendingActionsForStep(requestId, stepId);
  logger.info({ requestId, stepId, closedCount: closed }, 'Closed pending actions for step');
}

/**
 * Close all pending actions for a request (rejection, cancellation, etc.)
 */
export function onRequestClosed(requestId: number): void {
  const closed = closeAllPendingActionsForRequest(requestId);
  logger.info({ requestId, closedCount: closed }, 'Closed all pending actions for request');
}

/**
 * Get pending actions for a user's dashboard.
 */
export { getPendingActionsForUser, getPendingActionCountForUser };
