import { getDb } from '../database/connection';
import { createAuditEntry } from './audit.service';
import { createNotification } from './notifications.service';
import { getRequestById } from './requests.service';
import { AppError } from '../middleware/errorHandler';
import { formatDateForDb } from '../utils/dateFormat';
import type { RequestApprovalStep } from '@req-tracker/shared';

export function getApprovalSteps(requestId: number): RequestApprovalStep[] {
  const db = getDb();
  return db.prepare(`
    SELECT ras.*, acs.step_name, acs.execution_mode, acs.parallel_group,
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
 * Find the active step assigned to a specific user.
 * With parallel groups, multiple steps can be active simultaneously.
 */
function getActiveStepForUser(requestId: number, userId: number): RequestApprovalStep | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT ras.*, acs.step_name, acs.execution_mode, acs.parallel_group
    FROM request_approval_steps ras
    JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
    WHERE ras.request_id = ? AND ras.status = 'active' AND ras.assigned_to = ?
  `).get(requestId, userId) as RequestApprovalStep | undefined;
}

/**
 * After a step in a parallel group is completed, check if all steps in the
 * group are done. If so, activate the next step/group.
 */
function advanceAfterStepCompletion(db: ReturnType<typeof getDb>, requestId: number, completedStep: RequestApprovalStep & { execution_mode?: string; parallel_group?: number | null }, request: any): void {
  // Check if this step was part of a parallel group
  const parallelGroup = (completedStep as any).parallel_group;
  if (parallelGroup != null) {
    // Check if other steps in the same parallel group are still active
    const remainingActive = db.prepare(`
      SELECT COUNT(*) as cnt FROM request_approval_steps ras
      JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
      WHERE ras.request_id = ? AND acs.parallel_group = ? AND ras.status = 'active'
    `).get(requestId, parallelGroup) as { cnt: number };

    if (remainingActive.cnt > 0) {
      // Other parallel steps still pending — don't advance yet
      return;
    }
  }

  // Find the next pending step(s) to activate
  const nextStep = db.prepare(`
    SELECT ras.*, acs.step_name, acs.execution_mode, acs.parallel_group FROM request_approval_steps ras
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
        SELECT ras.id, ras.assigned_to, acs.step_name FROM request_approval_steps ras
        JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
        WHERE ras.request_id = ? AND acs.parallel_group = ? AND ras.status = 'pending'
      `).all(requestId, nextGroup) as { id: number; assigned_to: number | null; step_name: string }[];

      for (const s of stepsToActivate) {
        db.prepare("UPDATE request_approval_steps SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(s.id);
        if (s.assigned_to) {
          createNotification({
            userId: s.assigned_to,
            requestId,
            type: 'approval_needed',
            title: 'Approval Required',
            message: `Request ${request.reference_number} requires your approval (${s.step_name})`,
            actionUrl: `/requests/${requestId}`,
          });
        }
      }
    } else {
      // Activate single sequential step
      db.prepare("UPDATE request_approval_steps SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(nextStep.id);
      if (nextStep.assigned_to) {
        createNotification({
          userId: nextStep.assigned_to,
          requestId,
          type: 'approval_needed',
          title: 'Approval Required',
          message: `Request ${request.reference_number} requires your approval (${nextStep.step_name})`,
          actionUrl: `/requests/${requestId}`,
        });
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

    // Advance to next step/group (handles parallel group completion check)
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

    // Optimistic lock: only update if still active
    const result = db.prepare(`
      UPDATE request_approval_steps SET status = 'rejected', acted_on_by = ?, acted_on_at = ?, decision_notes = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'active'
    `).run(userId, now, notes ?? null, activeStep.id);
    if (result.changes === 0) throw new AppError(409, 'CONFLICT', 'Approval step was already acted upon');

    // Skip remaining active (parallel siblings) and pending steps
    db.prepare("UPDATE request_approval_steps SET status = 'skipped', updated_at = datetime('now') WHERE request_id = ? AND status IN ('pending', 'active') AND id != ?").run(requestId, activeStep.id);

    // Mark request rejected
    db.prepare("UPDATE requests SET status = 'rejected', current_step_order = NULL, updated_at = datetime('now') WHERE id = ?").run(requestId);

    createAuditEntry({
      entityType: 'approval_step',
      entityId: activeStep.id,
      requestId,
      action: 'rejected',
      oldValue: 'active',
      newValue: 'rejected',
      performedBy: userId,
      ipAddress: ip,
      userAgent,
      metadata: { step_name: activeStep.step_name, notes },
    });

    createAuditEntry({
      entityType: 'request',
      entityId: requestId,
      requestId,
      action: 'status_changed',
      oldValue: 'pending_approval',
      newValue: 'rejected',
      performedBy: userId,
      ipAddress: ip,
      userAgent,
    });

    // Notify requester
    const rejector = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as { display_name: string };
    createNotification({
      userId: request.submitted_by,
      requestId,
      type: 'status_changed',
      title: 'Request Rejected',
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

    // Optimistic lock: only update if still active
    const result = db.prepare(`
      UPDATE request_approval_steps SET status = 'returned', acted_on_by = ?, acted_on_at = ?, decision_notes = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'active'
    `).run(userId, now, notes ?? null, activeStep.id);
    if (result.changes === 0) throw new AppError(409, 'CONFLICT', 'Approval step was already acted upon');

    // Reset remaining active (parallel siblings) and pending steps
    db.prepare("UPDATE request_approval_steps SET status = 'pending', updated_at = datetime('now') WHERE request_id = ? AND status IN ('pending', 'active') AND id != ?").run(requestId, activeStep.id);

    // Mark request returned
    db.prepare("UPDATE requests SET status = 'returned', current_step_order = NULL, updated_at = datetime('now') WHERE id = ?").run(requestId);

    createAuditEntry({
      entityType: 'approval_step',
      entityId: activeStep.id,
      requestId,
      action: 'returned',
      oldValue: 'active',
      newValue: 'returned',
      performedBy: userId,
      ipAddress: ip,
      userAgent,
      metadata: { step_name: activeStep.step_name, notes },
    });

    createAuditEntry({
      entityType: 'request',
      entityId: requestId,
      requestId,
      action: 'status_changed',
      oldValue: 'pending_approval',
      newValue: 'returned',
      performedBy: userId,
      ipAddress: ip,
      userAgent,
    });

    // Notify requester
    const returner = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as { display_name: string };
    createNotification({
      userId: request.submitted_by,
      requestId,
      type: 'request_returned',
      title: 'Request Returned for Revision',
      message: `${returner.display_name} returned your request ${request.reference_number} for revision${notes ? `. Note: ${notes}` : ''}`,
      actionUrl: `/requests/${requestId}`,
    });
  })();
}
