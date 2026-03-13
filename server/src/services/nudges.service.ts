import { getDb } from '../database/connection';
import { createAuditEntry } from './audit.service';
import { createNotification } from './notifications.service';
import { getRequestById } from './requests.service';
import { AppError } from '../middleware/errorHandler';
import type { Nudge } from '@req-tracker/shared';

export function sendNudge(requestId: number, userId: number): Nudge {
  const db = getDb();
  const request = getRequestById(requestId);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');
  if (request.submitted_by !== userId) throw new AppError(403, 'FORBIDDEN', 'Only the requester can nudge');
  if (request.status !== 'pending_approval') throw new AppError(400, 'INVALID_STATE', 'Request is not pending approval');

  // Get active approval step
  const activeStep = db.prepare(`
    SELECT ras.*, acs.step_name FROM request_approval_steps ras
    JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
    WHERE ras.request_id = ? AND ras.status = 'active'
  `).get(requestId) as { id: number; assigned_to: number; step_name: string; created_at: string; updated_at: string } | undefined;

  if (!activeStep) throw new AppError(400, 'INVALID_STATE', 'No active approval step to nudge');
  if (!activeStep.assigned_to) throw new AppError(400, 'INVALID_STATE', 'No approver assigned to this step');

  // Check nudge threshold (72h by default)
  const thresholdHours = parseInt(
    (db.prepare("SELECT value FROM system_settings WHERE key = 'nudge_threshold_hours'").get() as { value: string })?.value ?? '72',
    10
  );

  const stepActivatedAt = new Date(activeStep.updated_at).getTime();
  const hoursSinceActive = (Date.now() - stepActivatedAt) / (1000 * 60 * 60);

  if (hoursSinceActive < thresholdHours) {
    throw new AppError(400, 'TOO_EARLY', `Cannot nudge until ${thresholdHours} hours have passed since the step became active. Currently ${Math.floor(hoursSinceActive)} hours.`);
  }

  // Check cooldown (24h by default)
  const cooldownHours = parseInt(
    (db.prepare("SELECT value FROM system_settings WHERE key = 'nudge_cooldown_hours'").get() as { value: string })?.value ?? '24',
    10
  );

  const lastNudge = db.prepare(`
    SELECT * FROM nudges
    WHERE request_id = ? AND approval_step_id = ? AND nudged_by = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(requestId, activeStep.id, userId) as Nudge | undefined;

  if (lastNudge) {
    const hoursSinceLastNudge = (Date.now() - new Date(lastNudge.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastNudge < cooldownHours) {
      throw new AppError(400, 'COOLDOWN', `You can only nudge once every ${cooldownHours} hours. Please wait ${Math.ceil(cooldownHours - hoursSinceLastNudge)} more hours.`);
    }
  }

  // Create nudge
  const result = db.prepare(`
    INSERT INTO nudges (request_id, approval_step_id, nudged_by, nudged_user_id) VALUES (?, ?, ?, ?)
  `).run(requestId, activeStep.id, userId, activeStep.assigned_to);

  const nudge = db.prepare(`
    SELECT n.*, u1.display_name as nudged_by_name, u2.display_name as nudged_user_name
    FROM nudges n
    LEFT JOIN users u1 ON u1.id = n.nudged_by
    LEFT JOIN users u2 ON u2.id = n.nudged_user_id
    WHERE n.id = ?
  `).get(result.lastInsertRowid) as Nudge;

  createAuditEntry({
    entityType: 'nudge',
    entityId: nudge.id,
    requestId,
    action: 'nudged',
    performedBy: userId,
    metadata: { step_name: activeStep.step_name, nudged_user_id: activeStep.assigned_to },
  });

  // Notify the approver
  const requesterName = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as { display_name: string };
  const daysPending = Math.floor(hoursSinceActive / 24);

  createNotification({
    userId: activeStep.assigned_to,
    requestId,
    type: 'nudge_received',
    title: 'Action Requested',
    message: `${requesterName.display_name} is requesting action on ${request.reference_number} "${request.title}". This request has been awaiting your approval for ${daysPending} days.`,
    actionUrl: `/requests/${requestId}`,
  });

  return nudge;
}

export function acknowledgeNudge(nudgeId: number, userId: number, comment: string): Nudge {
  const db = getDb();
  const nudge = db.prepare(`
    SELECT n.*, u1.display_name as nudged_by_name, u2.display_name as nudged_user_name
    FROM nudges n
    LEFT JOIN users u1 ON u1.id = n.nudged_by
    LEFT JOIN users u2 ON u2.id = n.nudged_user_id
    WHERE n.id = ?
  `).get(nudgeId) as Nudge | undefined;

  if (!nudge) throw new AppError(404, 'NOT_FOUND', 'Nudge not found');
  if (nudge.nudged_user_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Only the nudged user can acknowledge');
  if (nudge.acknowledged_at) throw new AppError(400, 'ALREADY_ACKNOWLEDGED', 'Nudge already acknowledged');

  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  db.prepare('UPDATE nudges SET acknowledged_at = ?, acknowledge_comment = ? WHERE id = ?').run(now, comment, nudgeId);

  createAuditEntry({
    entityType: 'nudge',
    entityId: nudgeId,
    requestId: nudge.request_id,
    action: 'nudge_acknowledged',
    performedBy: userId,
    metadata: { comment },
  });

  // Notify the requester
  const acknowledgerName = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as { display_name: string };
  const request = getRequestById(nudge.request_id);

  createNotification({
    userId: nudge.nudged_by,
    requestId: nudge.request_id,
    type: 'nudge_acknowledged',
    title: 'Nudge Acknowledged',
    message: `${acknowledgerName.display_name} acknowledged your nudge on ${request?.reference_number}: "${comment}"`,
    actionUrl: `/requests/${nudge.request_id}`,
  });

  return db.prepare(`
    SELECT n.*, u1.display_name as nudged_by_name, u2.display_name as nudged_user_name
    FROM nudges n
    LEFT JOIN users u1 ON u1.id = n.nudged_by
    LEFT JOIN users u2 ON u2.id = n.nudged_user_id
    WHERE n.id = ?
  `).get(nudgeId) as Nudge;
}

export function getNudgesForRequest(requestId: number): Nudge[] {
  const db = getDb();
  return db.prepare(`
    SELECT n.*, u1.display_name as nudged_by_name, u2.display_name as nudged_user_name
    FROM nudges n
    LEFT JOIN users u1 ON u1.id = n.nudged_by
    LEFT JOIN users u2 ON u2.id = n.nudged_user_id
    WHERE n.request_id = ?
    ORDER BY n.created_at DESC
  `).all(requestId) as Nudge[];
}
