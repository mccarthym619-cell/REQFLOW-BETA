import { getDb } from '../database/connection';
import { createAuditEntry } from './audit.service';
import { createNotification } from './notifications.service';
import { getRequestById } from './requests.service';
import { AppError } from '../middleware/errorHandler';
import type { RequestApprovalStep } from '@req-tracker/shared';

export function getApprovalSteps(requestId: number): RequestApprovalStep[] {
  const db = getDb();
  return db.prepare(`
    SELECT ras.*, acs.step_name,
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

function getActiveStep(requestId: number): RequestApprovalStep | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT ras.*, acs.step_name
    FROM request_approval_steps ras
    JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
    WHERE ras.request_id = ? AND ras.status = 'active'
  `).get(requestId) as RequestApprovalStep | undefined;
}

export function approveStep(requestId: number, userId: number, notes?: string): void {
  const db = getDb();
  const request = getRequestById(requestId);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');
  if (request.status !== 'pending_approval') throw new AppError(400, 'INVALID_STATE', 'Request is not pending approval');

  const activeStep = getActiveStep(requestId);
  if (!activeStep) throw new AppError(400, 'INVALID_STATE', 'No active approval step');
  if (activeStep.assigned_to !== userId) throw new AppError(403, 'FORBIDDEN', 'You are not the assigned approver for this step');

  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  db.transaction(() => {
    // Mark current step approved
    db.prepare(`
      UPDATE request_approval_steps SET status = 'approved', acted_on_by = ?, acted_on_at = ?, decision_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(userId, now, notes ?? null, activeStep.id);

    createAuditEntry({
      entityType: 'approval_step',
      entityId: activeStep.id,
      requestId,
      action: 'approved',
      oldValue: 'active',
      newValue: 'approved',
      performedBy: userId,
      metadata: { step_name: activeStep.step_name, notes },
    });

    // Check for next step
    const nextStep = db.prepare(`
      SELECT ras.*, acs.step_name FROM request_approval_steps ras
      JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
      WHERE ras.request_id = ? AND ras.step_order > ? AND ras.status = 'pending'
      ORDER BY ras.step_order
      LIMIT 1
    `).get(requestId, activeStep.step_order) as RequestApprovalStep | undefined;

    if (nextStep) {
      // Activate next step
      db.prepare("UPDATE request_approval_steps SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(nextStep.id);
      db.prepare("UPDATE requests SET current_step_order = ?, updated_at = datetime('now') WHERE id = ?").run(nextStep.step_order, requestId);

      // Notify next approver
      if (nextStep.assigned_to) {
        createNotification({
          userId: nextStep.assigned_to,
          requestId,
          type: 'approval_needed',
          title: 'Approval Required',
          message: `Request ${request.reference_number} "${request.title}" requires your approval (${nextStep.step_name})`,
          actionUrl: `/requests/${requestId}`,
        });
      }
    } else {
      // All steps complete - request is fully approved
      db.prepare("UPDATE requests SET status = 'approved', current_step_order = NULL, updated_at = datetime('now') WHERE id = ?").run(requestId);

      createAuditEntry({
        entityType: 'request',
        entityId: requestId,
        requestId,
        action: 'status_changed',
        oldValue: 'pending_approval',
        newValue: 'approved',
        performedBy: userId,
      });

      // Notify requester
      createNotification({
        userId: request.submitted_by,
        requestId,
        type: 'status_changed',
        title: 'Request Approved',
        message: `Your request ${request.reference_number} "${request.title}" has been fully approved`,
        actionUrl: `/requests/${requestId}`,
      });
    }

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

export function rejectStep(requestId: number, userId: number, notes?: string): void {
  const db = getDb();
  const request = getRequestById(requestId);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');
  if (request.status !== 'pending_approval') throw new AppError(400, 'INVALID_STATE', 'Request is not pending approval');

  const activeStep = getActiveStep(requestId);
  if (!activeStep) throw new AppError(400, 'INVALID_STATE', 'No active approval step');
  if (activeStep.assigned_to !== userId) throw new AppError(403, 'FORBIDDEN', 'You are not the assigned approver for this step');

  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  db.transaction(() => {
    // Mark step rejected
    db.prepare(`
      UPDATE request_approval_steps SET status = 'rejected', acted_on_by = ?, acted_on_at = ?, decision_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(userId, now, notes ?? null, activeStep.id);

    // Skip remaining steps
    db.prepare("UPDATE request_approval_steps SET status = 'skipped', updated_at = datetime('now') WHERE request_id = ? AND status = 'pending'").run(requestId);

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

export function returnStep(requestId: number, userId: number, notes?: string): void {
  const db = getDb();
  const request = getRequestById(requestId);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');
  if (request.status !== 'pending_approval') throw new AppError(400, 'INVALID_STATE', 'Request is not pending approval');

  const activeStep = getActiveStep(requestId);
  if (!activeStep) throw new AppError(400, 'INVALID_STATE', 'No active approval step');
  if (activeStep.assigned_to !== userId) throw new AppError(403, 'FORBIDDEN', 'You are not the assigned approver for this step');

  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  db.transaction(() => {
    // Mark step returned
    db.prepare(`
      UPDATE request_approval_steps SET status = 'returned', acted_on_by = ?, acted_on_at = ?, decision_notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(userId, now, notes ?? null, activeStep.id);

    // Reset remaining pending steps
    db.prepare("UPDATE request_approval_steps SET status = 'pending', updated_at = datetime('now') WHERE request_id = ? AND status = 'pending'").run(requestId);

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
