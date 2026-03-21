import { getDb } from '../database/connection';
import { createAuditEntry } from './audit.service';
import { createNotification } from './notifications.service';
import { getRequestById } from './requests.service';
import { isUserEligibleForStep } from './routing.service';
import { onStepActed, onRequestClosed, dispatchPendingActions } from './pending-actions.service';
import { resolveNextSteps } from './routing.service';
import { AppError } from '../middleware/errorHandler';
import { formatDateForDb } from '../utils/dateFormat';
import type { RequestApprovalStep } from '@req-tracker/shared';

export function getApprovalSteps(requestId: number): RequestApprovalStep[] {
  const db = getDb();
  return db.prepare(`
    SELECT ras.*, acs.step_name, acs.execution_mode, acs.parallel_group,
      acs.required_permission, acs.target_department_id,
      u1.display_name as assigned_to_name,
      u2.display_name as acted_on_by_name
    FROM request_approval_steps ras
    JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
    LEFT JOIN users u1 ON u1.id = ras.assigned_to
    LEFT JOIN users u2 ON u2.id = ras.acted_on_by
    WHERE ras.request_id = ?
    ORDER BY ras.step_order
  `).all(requestId) as RequestApprovalStep[];
}

/**
 * Find the active step that a user can act on.
 * Uses the routing engine to check permission eligibility rather than
 * just checking assigned_to.
 */
function getActiveStepForUser(requestId: number, userId: number): RequestApprovalStep | undefined {
  const db = getDb();

  // Get all active steps for this request
  const activeSteps = db.prepare(`
    SELECT ras.*, acs.step_name, acs.execution_mode, acs.parallel_group
    FROM request_approval_steps ras
    JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
    WHERE ras.request_id = ? AND ras.status = 'active'
  `).all(requestId) as RequestApprovalStep[];

  // Check each active step to see if this user is eligible
  for (const step of activeSteps) {
    // First check: is the user directly assigned?
    if (step.assigned_to === userId) return step;

    // Second check: does the user have the right permission via the routing engine?
    if (isUserEligibleForStep(userId, requestId, step.id)) return step;
  }

  return undefined;
}

/**
 * After a step in a parallel group is completed, check if all steps in the
 * group are done. If so, activate the next step/group and dispatch pending_actions.
 */
function advanceAfterStepCompletion(
  db: ReturnType<typeof getDb>,
  requestId: number,
  completedStep: RequestApprovalStep & { execution_mode?: string; parallel_group?: number | null },
  request: any
): void {
  // Check if this step was part of a parallel group
  const parallelGroup = (completedStep as any).parallel_group;
  if (parallelGroup != null) {
    const remainingActive = db.prepare(`
      SELECT COUNT(*) as cnt FROM request_approval_steps ras
      JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
      WHERE ras.request_id = ? AND acs.parallel_group = ? AND ras.status = 'active'
    `).get(requestId, parallelGroup) as { cnt: number };

    if (remainingActive.cnt > 0) {
      return; // Other parallel steps still pending
    }
  }

  // Find the next pending step(s) to activate
  const nextStep = db.prepare(`
    SELECT ras.*, acs.step_name, acs.execution_mode, acs.parallel_group
    FROM request_approval_steps ras
    JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
    WHERE ras.request_id = ? AND ras.step_order > ? AND ras.status = 'pending'
    ORDER BY ras.step_order
    LIMIT 1
  `).get(requestId, completedStep.step_order) as (RequestApprovalStep & { execution_mode: string; parallel_group: number | null }) | undefined;

  if (nextStep) {
    const nextGroup = nextStep.parallel_group;
    const isParallel = nextStep.execution_mode === 'parallel' && nextGroup != null;

    if (isParallel) {
      // Activate ALL steps in the next parallel group
      const stepsToActivate = db.prepare(`
        SELECT ras.id, ras.assigned_to, ras.chain_step_id, acs.step_name
        FROM request_approval_steps ras
        JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
        WHERE ras.request_id = ? AND acs.parallel_group = ? AND ras.status = 'pending'
      `).all(requestId, nextGroup) as { id: number; assigned_to: number | null; chain_step_id: number; step_name: string }[];

      for (const s of stepsToActivate) {
        db.prepare("UPDATE request_approval_steps SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(s.id);
      }

      // Dispatch pending_actions for all activated steps using routing engine
      const stepResolutions = resolveNextSteps(
        { id: requestId, submitted_by: request.submitted_by, department_id: request.department_id, current_step_order: completedStep.step_order, returned_from_step: null },
        request.template_id
      );
      if (!('complete' in stepResolutions)) {
        dispatchPendingActions({ requestId, stepResolutions });
      }
    } else {
      // Activate single sequential step
      db.prepare("UPDATE request_approval_steps SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(nextStep.id);

      // Dispatch pending_actions using routing engine
      const stepResolutions = resolveNextSteps(
        { id: requestId, submitted_by: request.submitted_by, department_id: request.department_id, current_step_order: completedStep.step_order, returned_from_step: null },
        request.template_id
      );
      if (!('complete' in stepResolutions)) {
        dispatchPendingActions({ requestId, stepResolutions });
      }
    }

    db.prepare("UPDATE requests SET current_step_order = ?, updated_at = datetime('now') WHERE id = ?").run(nextStep.step_order, requestId);
  } else {
    // All steps complete — request is fully approved
    db.prepare("UPDATE requests SET status = 'approved', current_step_order = NULL, updated_at = datetime('now') WHERE id = ?").run(requestId);

    createAuditEntry({
      entityType: 'request',
      entityId: requestId,
      requestId,
      action: 'status_changed',
      oldValue: 'pending_approval',
      newValue: 'approved',
      performedBy: (completedStep as any).acted_on_by ?? 0,
    });

    createNotification({
      userId: request.submitted_by,
      requestId,
      type: 'status_changed',
      title: 'Request Approved',
      message: `Your request ${request.reference_number} "${request.title}" has been fully approved`,
      actionUrl: `/requests/${requestId}`,
    });
  }
}

export function approveStep(requestId: number, userId: number, notes?: string, ip?: string, userAgent?: string): void {
  const db = getDb();
  const request = getRequestById(requestId);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');
  if (request.status !== 'pending_approval') throw new AppError(400, 'INVALID_STATE', 'Request is not pending approval');

  const now = formatDateForDb();

  db.transaction(() => {
    const activeStep = getActiveStepForUser(requestId, userId);
    if (!activeStep) throw new AppError(403, 'FORBIDDEN', 'You do not have an active approval step for this request');

    // Optimistic lock: only update if still active
    const result = db.prepare(`
      UPDATE request_approval_steps SET status = 'approved', acted_on_by = ?, acted_on_at = ?, decision_notes = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'active'
    `).run(userId, now, notes ?? null, activeStep.id);
    if (result.changes === 0) throw new AppError(409, 'CONFLICT', 'Approval step was already acted upon');

    // Close pending_actions for this step
    onStepActed(requestId, activeStep.id);

    createAuditEntry({
      entityType: 'approval_step',
      entityId: activeStep.id,
      requestId,
      action: 'approved',
      oldValue: 'active',
      newValue: 'approved',
      performedBy: userId,
      ipAddress: ip,
      userAgent,
      metadata: { step_name: activeStep.step_name, notes },
    });

    // Advance to next step/group (handles parallel group completion check + pending_actions dispatch)
    advanceAfterStepCompletion(db, requestId, activeStep, request);

    // Notify requester of step completion
    createNotification({
      userId: request.submitted_by,
      requestId,
      type: 'status_changed',
      title: 'Approval Step Completed',
      message: `${activeStep.step_name} has been approved for your request ${request.reference_number}`,
      actionUrl: `/requests/${requestId}`,
    });
  })();
}

export function rejectStep(requestId: number, userId: number, notes?: string, ip?: string, userAgent?: string): void {
  const db = getDb();
  const request = getRequestById(requestId);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');
  if (request.status !== 'pending_approval') throw new AppError(400, 'INVALID_STATE', 'Request is not pending approval');

  const now = formatDateForDb();

  db.transaction(() => {
    const activeStep = getActiveStepForUser(requestId, userId);
    if (!activeStep) throw new AppError(403, 'FORBIDDEN', 'You do not have an active approval step for this request');

    // Optimistic lock
    const result = db.prepare(`
      UPDATE request_approval_steps SET status = 'rejected', acted_on_by = ?, acted_on_at = ?, decision_notes = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'active'
    `).run(userId, now, notes ?? null, activeStep.id);
    if (result.changes === 0) throw new AppError(409, 'CONFLICT', 'Approval step was already acted upon');

    // Skip remaining active and pending steps
    db.prepare("UPDATE request_approval_steps SET status = 'skipped', updated_at = datetime('now') WHERE request_id = ? AND status IN ('pending', 'active') AND id != ?").run(requestId, activeStep.id);

    // Mark request rejected
    db.prepare("UPDATE requests SET status = 'rejected', current_step_order = NULL, updated_at = datetime('now') WHERE id = ?").run(requestId);

    // Close ALL pending_actions for this request
    onRequestClosed(requestId);

    createAuditEntry({
      entityType: 'approval_step', entityId: activeStep.id, requestId,
      action: 'rejected', oldValue: 'active', newValue: 'rejected',
      performedBy: userId, ipAddress: ip, userAgent,
      metadata: { step_name: activeStep.step_name, notes },
    });
    createAuditEntry({
      entityType: 'request', entityId: requestId, requestId,
      action: 'status_changed', oldValue: 'pending_approval', newValue: 'rejected',
      performedBy: userId, ipAddress: ip, userAgent,
    });

    const rejector = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as { display_name: string };
    createNotification({
      userId: request.submitted_by, requestId,
      type: 'status_changed', title: 'Request Rejected',
      message: `Your request ${request.reference_number} was rejected by ${rejector.display_name} at ${activeStep.step_name}${notes ? `. Reason: ${notes}` : ''}`,
      actionUrl: `/requests/${requestId}`,
    });
  })();
}

export function returnStep(requestId: number, userId: number, notes?: string, ip?: string, userAgent?: string): void {
  const db = getDb();
  const request = getRequestById(requestId);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');
  if (request.status !== 'pending_approval') throw new AppError(400, 'INVALID_STATE', 'Request is not pending approval');

  const now = formatDateForDb();

  db.transaction(() => {
    const activeStep = getActiveStepForUser(requestId, userId);
    if (!activeStep) throw new AppError(403, 'FORBIDDEN', 'You do not have an active approval step for this request');

    // Optimistic lock
    const result = db.prepare(`
      UPDATE request_approval_steps SET status = 'returned', acted_on_by = ?, acted_on_at = ?, decision_notes = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'active'
    `).run(userId, now, notes ?? null, activeStep.id);
    if (result.changes === 0) throw new AppError(409, 'CONFLICT', 'Approval step was already acted upon');

    // Reset remaining active (parallel siblings) and pending steps
    db.prepare("UPDATE request_approval_steps SET status = 'pending', updated_at = datetime('now') WHERE request_id = ? AND status IN ('pending', 'active') AND id != ?").run(requestId, activeStep.id);

    // Mark request returned + store the returning step for resume on re-submit
    db.prepare(`
      UPDATE requests SET status = 'returned', current_step_order = NULL,
        returned_from_step = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(activeStep.step_order, requestId);

    // Close ALL pending_actions for this request
    onRequestClosed(requestId);

    createAuditEntry({
      entityType: 'approval_step', entityId: activeStep.id, requestId,
      action: 'returned', oldValue: 'active', newValue: 'returned',
      performedBy: userId, ipAddress: ip, userAgent,
      metadata: { step_name: activeStep.step_name, notes },
    });
    createAuditEntry({
      entityType: 'request', entityId: requestId, requestId,
      action: 'status_changed', oldValue: 'pending_approval', newValue: 'returned',
      performedBy: userId, ipAddress: ip, userAgent,
    });

    const returner = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as { display_name: string };
    createNotification({
      userId: request.submitted_by, requestId,
      type: 'request_returned', title: 'Request Returned for Revision',
      message: `${returner.display_name} returned your request ${request.reference_number} for revision${notes ? `. Note: ${notes}` : ''}`,
      actionUrl: `/requests/${requestId}`,
    });
  })();
}
