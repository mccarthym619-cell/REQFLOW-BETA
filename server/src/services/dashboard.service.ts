import { getDb } from '../database/connection';
import type { UserRole } from '@req-tracker/shared';

interface DashboardSummary {
  status_counts: Record<string, number>;
  total_requests: number;
  pending_my_action: number;
  sla_at_risk: number;
}

export function getDashboardSummary(userId: number, role: UserRole): DashboardSummary {
  const db = getDb();

  // Status counts
  let statusQuery: string;
  let statusParams: unknown[];

  const viewAllRoles: UserRole[] = ['admin', 'approver', 'n4', 'contracting', 'reviewer'];
  if (viewAllRoles.includes(role)) {
    statusQuery = 'SELECT status, COUNT(*) as count FROM requests GROUP BY status';
    statusParams = [];
  } else {
    statusQuery = 'SELECT status, COUNT(*) as count FROM requests WHERE submitted_by = ? GROUP BY status';
    statusParams = [userId];
  }

  const statusRows = db.prepare(statusQuery).all(...statusParams) as { status: string; count: number }[];
  const status_counts: Record<string, number> = {};
  let total_requests = 0;
  for (const row of statusRows) {
    status_counts[row.status] = row.count;
    total_requests += row.count;
  }

  // Pending my action
  const pending_my_action = (db.prepare(`
    SELECT COUNT(*) as count FROM request_approval_steps
    WHERE assigned_to = ? AND status = 'active'
  `).get(userId) as { count: number }).count;

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
  const db = getDb();
  return db.prepare(`
    SELECT r.*, t.name as template_name, u.display_name as submitter_name,
      ras.id as step_id, acs.step_name
    FROM request_approval_steps ras
    JOIN requests r ON r.id = ras.request_id
    JOIN request_templates t ON t.id = r.template_id
    JOIN users u ON u.id = r.submitted_by
    JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
    WHERE ras.assigned_to = ? AND ras.status = 'active'
    ORDER BY r.sla_deadline ASC NULLS LAST, r.created_at ASC
  `).all(userId);
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

  const globalViewRoles: UserRole[] = ['admin'];
  if (globalViewRoles.includes(role)) {
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
    )
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(userId, userId, limit);
}
