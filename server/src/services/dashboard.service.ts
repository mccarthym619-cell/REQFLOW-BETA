import { getDb } from '../database/connection';
import type { UserRole } from '@req-tracker/shared';
import { getPendingActionsForUser, getPendingActionCountForUser } from '../repositories/pendingActions.repository';

interface DashboardSummary {
  status_counts: Record<string, number>;
  total_requests: number;
  pending_my_action: number;
  sla_at_risk: number;
}

export function getDashboardSummary(userId: number, role: UserRole): DashboardSummary {
  const db = getDb();

  // All users can see all requests — show global status counts
  const statusRows = db.prepare(
    'SELECT status, COUNT(*) as count FROM requests GROUP BY status'
  ).all() as { status: string; count: number }[];

  const status_counts: Record<string, number> = {};
  let total_requests = 0;
  for (const row of statusRows) {
    status_counts[row.status] = row.count;
    total_requests += row.count;
  }

  // Pending my action — now powered by pending_actions table
  const pending_my_action = getPendingActionCountForUser(userId);

  // SLA at risk (within 24h of deadline or past)
  const sla_at_risk = (db.prepare(`
    SELECT COUNT(*) as count FROM requests
    WHERE status IN ('pending_approval', 'submitted')
    AND sla_deadline IS NOT NULL
    AND datetime(sla_deadline) <= datetime('now', '+24 hours')
  `).get() as { count: number }).count;

  return { status_counts, total_requests, pending_my_action, sla_at_risk };
}

export function getPendingActions(userId: number) {
  // Use the new pending_actions table instead of request_approval_steps
  return getPendingActionsForUser(userId);
}

export function getAwaitingPurchaseCompletion() {
  const db = getDb();
  return db.prepare(`
    SELECT r.*, t.name as template_name, u.display_name as submitter_name
    FROM requests r
    JOIN request_templates t ON t.id = r.template_id
    JOIN users u ON u.id = r.submitted_by
    WHERE r.status = 'approved'
    ORDER BY r.updated_at ASC
  `).all();
}

export function getRecentActivity(userId: number, role: UserRole, limit = 20) {
  const db = getDb();

  if (role === 'admin') {
    return db.prepare(`
      SELECT a.*, u.display_name as performer_name, r.reference_number, r.title as request_title
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.performed_by
      LEFT JOIN requests r ON r.id = a.request_id
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(limit);
  }

  return db.prepare(`
    SELECT a.*, u.display_name as performer_name, r.reference_number, r.title as request_title
    FROM audit_log a
    LEFT JOIN users u ON u.id = a.performed_by
    LEFT JOIN requests r ON r.id = a.request_id
    WHERE a.request_id IN (
      SELECT id FROM requests WHERE submitted_by = ?
      UNION
      SELECT request_id FROM request_approval_steps WHERE assigned_to = ?
      UNION
      SELECT request_id FROM pending_actions WHERE assigned_to = ?
    )
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(userId, userId, userId, limit);
}
