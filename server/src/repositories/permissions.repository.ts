import { getDb } from '../database/connection';
import type { UserPermission, ApprovalPermission } from '@req-tracker/shared';

export function getPermissionsByUser(userId: number): UserPermission[] {
  const db = getDb();
  return db.prepare(`
    SELECT up.*,
           c.name as command_name,
           d.name as department_name
    FROM user_permissions up
    JOIN commands c ON c.id = up.command_id
    LEFT JOIN departments d ON d.id = up.department_id
    WHERE up.user_id = ?
    ORDER BY c.name, d.sort_order
  `).all(userId) as UserPermission[];
}

export function getPermissionsByCommandAndDepartment(
  commandId: number,
  departmentId: number | null,
  permission: ApprovalPermission
): UserPermission[] {
  const db = getDb();

  // Find users who have the permission in:
  // 1. The specific command + department
  // 2. The specific command + NULL department (all depts in command)
  return db.prepare(`
    SELECT up.*,
           c.name as command_name,
           d.name as department_name,
           u.display_name as user_name
    FROM user_permissions up
    JOIN commands c ON c.id = up.command_id
    JOIN users u ON u.id = up.user_id
    LEFT JOIN departments d ON d.id = up.department_id
    WHERE up.command_id = ?
      AND (up.department_id = ? OR up.department_id IS NULL)
      AND up.permission = ?
      AND u.is_active = 1
    ORDER BY u.display_name
  `).all(commandId, departmentId, permission) as UserPermission[];
}

/**
 * Find eligible users for an approval step, including parent command cascade.
 * NSWG-8 (parent) permissions automatically apply to all subordinate commands.
 * When cascading, parent command permissions are NOT department-specific.
 */
export function findEligibleUsers(opts: {
  requestCommandId: number;
  targetDepartmentId: number | null;
  permission: ApprovalPermission;
  excludeUserId?: number;
  maxAmount?: number;
}): UserPermission[] {
  const db = getDb();

  // Check if the request command is a subordinate (not parent)
  const requestCommand = db.prepare(
    'SELECT id, is_parent FROM commands WHERE id = ?'
  ).get(opts.requestCommandId) as { id: number; is_parent: number } | undefined;

  // Get parent command ID for cascade
  const parentCommand = db.prepare(
    'SELECT id FROM commands WHERE is_parent = 1'
  ).get() as { id: number } | undefined;

  const isSubordinateCommand = requestCommand && !requestCommand.is_parent;
  const parentCommandId = parentCommand?.id;

  // Build query: match on request's command + target department,
  // plus cascade from parent command (not department-specific)
  let query: string;
  let params: any[];

  if (isSubordinateCommand && parentCommandId) {
    // Subordinate command: also include parent command users
    // Parent command cascade is NOT department-specific
    query = `
      SELECT DISTINCT up.*,
             c.name as command_name,
             d.name as department_name,
             u.display_name as user_name
      FROM user_permissions up
      JOIN commands c ON c.id = up.command_id
      JOIN users u ON u.id = up.user_id
      LEFT JOIN departments d ON d.id = up.department_id
      WHERE up.permission = ?
        AND u.is_active = 1
        AND (
          -- Direct match: request's command + target department (or NULL = all depts)
          (up.command_id = ? AND (up.department_id = ? OR up.department_id IS NULL))
          OR
          -- Cascade from parent command (not department-specific)
          (up.command_id = ?)
        )
      ORDER BY u.display_name
    `;
    params = [opts.permission, opts.requestCommandId, opts.targetDepartmentId, parentCommandId];
  } else {
    // Parent command or no parent: only match on request's command
    query = `
      SELECT DISTINCT up.*,
             c.name as command_name,
             d.name as department_name,
             u.display_name as user_name
      FROM user_permissions up
      JOIN commands c ON c.id = up.command_id
      JOIN users u ON u.id = up.user_id
      LEFT JOIN departments d ON d.id = up.department_id
      WHERE up.permission = ?
        AND up.command_id = ?
        AND (up.department_id = ? OR up.department_id IS NULL)
        AND u.is_active = 1
      ORDER BY u.display_name
    `;
    params = [opts.permission, opts.requestCommandId, opts.targetDepartmentId];
  }

  let results = db.prepare(query).all(...params) as UserPermission[];

  // Exclude submitter
  if (opts.excludeUserId) {
    results = results.filter(r => r.user_id !== opts.excludeUserId);
  }

  // Exclude users whose delegation limit is exceeded
  if (opts.maxAmount !== undefined) {
    results = results.filter(r =>
      r.delegation_limit === null || r.delegation_limit >= opts.maxAmount!
    );
  }

  // Deduplicate by user_id (a user might match via multiple permission rows)
  const seen = new Set<number>();
  return results.filter(r => {
    if (seen.has(r.user_id)) return false;
    seen.add(r.user_id);
    return true;
  });
}

export function getAllPermissions(): UserPermission[] {
  const db = getDb();
  return db.prepare(`
    SELECT up.*,
           c.name as command_name,
           d.name as department_name,
           u.display_name as user_name
    FROM user_permissions up
    JOIN commands c ON c.id = up.command_id
    JOIN users u ON u.id = up.user_id
    LEFT JOIN departments d ON d.id = up.department_id
    ORDER BY u.display_name, c.name
  `).all() as UserPermission[];
}

export function createPermission(data: {
  user_id: number;
  command_id: number;
  department_id?: number | null;
  permission: ApprovalPermission;
  delegation_limit?: number | null;
}): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO user_permissions (user_id, command_id, department_id, permission, delegation_limit)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    data.user_id,
    data.command_id,
    data.department_id ?? null,
    data.permission,
    data.delegation_limit ?? null
  );
  return result.lastInsertRowid as number;
}

export function updatePermission(id: number, data: {
  delegation_limit?: number | null;
}): boolean {
  const db = getDb();
  const result = db.prepare(
    'UPDATE user_permissions SET delegation_limit = ? WHERE id = ?'
  ).run(data.delegation_limit ?? null, id);
  return result.changes > 0;
}

export function deletePermission(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM user_permissions WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getPermissionById(id: number): UserPermission | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT up.*,
           c.name as command_name,
           d.name as department_name,
           u.display_name as user_name
    FROM user_permissions up
    JOIN commands c ON c.id = up.command_id
    JOIN users u ON u.id = up.user_id
    LEFT JOIN departments d ON d.id = up.department_id
    WHERE up.id = ?
  `).get(id) as UserPermission | undefined;
}
