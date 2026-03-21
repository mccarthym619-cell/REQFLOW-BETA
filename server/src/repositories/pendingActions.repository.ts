import { getDb } from '../database/connection';
import type { PendingAction } from '@req-tracker/shared';

export function getPendingActionsForUser(userId: number): PendingAction[] {
  const db = getDb();
  return db.prepare(`
    SELECT pa.*,
           r.reference_number as request_reference,
           r.title as request_title,
           r.status as request_status,
           ras.step_order,
           acs.step_name,
           acs.required_permission,
           u_sub.display_name as submitted_by_name,
           u_assigned.display_name as assigned_to_name,
           d.name as department_name,
           c.name as command_name
    FROM pending_actions pa
    JOIN requests r ON r.id = pa.request_id
    JOIN request_approval_steps ras ON ras.id = pa.step_id
    JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
    JOIN users u_sub ON u_sub.id = r.submitted_by
    JOIN users u_assigned ON u_assigned.id = pa.assigned_to
    LEFT JOIN departments d ON d.id = r.department_id
    LEFT JOIN commands c ON c.id = (SELECT command_id FROM departments WHERE id = r.department_id)
    WHERE pa.assigned_to = ?
      AND pa.status = 'WAITING'
    ORDER BY pa.due_by ASC NULLS LAST, pa.assigned_at ASC
  `).all(userId) as PendingAction[];
}

export function createPendingAction(data: {
  request_id: number;
  step_id: number;
  assigned_to: number;
  due_by?: string | null;
}): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT OR IGNORE INTO pending_actions (request_id, step_id, assigned_to, due_by)
    VALUES (?, ?, ?, ?)
  `).run(data.request_id, data.step_id, data.assigned_to, data.due_by ?? null);
  return result.lastInsertRowid as number;
}

export function bulkCreatePendingActions(actions: Array<{
  request_id: number;
  step_id: number;
  assigned_to: number;
  due_by?: string | null;
}>): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO pending_actions (request_id, step_id, assigned_to, due_by)
    VALUES (?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const a of actions) {
      insert.run(a.request_id, a.step_id, a.assigned_to, a.due_by ?? null);
    }
  })();
}

/**
 * Close all pending actions for a given request + step.
 * Called when any eligible user acts on the step.
 */
export function closePendingActionsForStep(requestId: number, stepId: number): number {
  const db = getDb();
  const result = db.prepare(`
    UPDATE pending_actions
    SET status = 'ACTED'
    WHERE request_id = ?
      AND step_id = ?
      AND status = 'WAITING'
  `).run(requestId, stepId);
  return result.changes;
}

/**
 * Close all pending actions for a request (e.g., on rejection or cancellation).
 */
export function closeAllPendingActionsForRequest(requestId: number): number {
  const db = getDb();
  const result = db.prepare(`
    UPDATE pending_actions
    SET status = 'ACTED'
    WHERE request_id = ?
      AND status = 'WAITING'
  `).run(requestId);
  return result.changes;
}

export function getOverduePendingActions(): PendingAction[] {
  const db = getDb();
  return db.prepare(`
    SELECT pa.*,
           r.reference_number as request_reference,
           r.title as request_title,
           r.status as request_status,
           ras.step_order,
           acs.step_name,
           acs.required_permission,
           u_sub.display_name as submitted_by_name,
           u_assigned.display_name as assigned_to_name
    FROM pending_actions pa
    JOIN requests r ON r.id = pa.request_id
    JOIN request_approval_steps ras ON ras.id = pa.step_id
    JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
    JOIN users u_sub ON u_sub.id = r.submitted_by
    JOIN users u_assigned ON u_assigned.id = pa.assigned_to
    WHERE pa.status = 'WAITING'
      AND pa.due_by IS NOT NULL
      AND pa.due_by < datetime('now')
    ORDER BY pa.due_by ASC
  `).all() as PendingAction[];
}

export function updateNotifiedAt(id: number): void {
  const db = getDb();
  db.prepare(
    "UPDATE pending_actions SET notified_at = datetime('now') WHERE id = ?"
  ).run(id);
}

export function getPendingActionCountForUser(userId: number): number {
  const db = getDb();
  const row = db.prepare(`
    SELECT COUNT(*) as count
    FROM pending_actions
    WHERE assigned_to = ? AND status = 'WAITING'
  `).get(userId) as { count: number };
  return row.count;
}
