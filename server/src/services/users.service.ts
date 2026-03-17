import { getDb } from '../database/connection';
import { createAuditEntry } from './audit.service';
import type { User, CreateUserPayload, UpdateUserPayload, Command } from '@req-tracker/shared';

// Columns to select for public user queries (excludes password_hash)
const USER_COLUMNS = `u.id, u.email, u.display_name, u.role, u.timezone, u.command_id, c.name as command_name, u.is_active, (u.password_hash IS NOT NULL) as has_password, u.created_at, u.updated_at`;

const USER_FROM = `FROM users u LEFT JOIN commands c ON c.id = u.command_id`;

function rowToUser(row: any): User {
  return { ...row, command_name: row.command_name ?? null, is_active: Boolean(row.is_active), has_password: Boolean(row.has_password) };
}

export interface UserWithPassword extends User {
  password_hash: string | null;
}

export function getAllCommands(): Command[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM commands WHERE is_active = 1 ORDER BY is_parent DESC, name').all() as any[];
  return rows.map(r => ({ ...r, is_parent: Boolean(r.is_parent), is_active: Boolean(r.is_active) }));
}

export interface UserListOptions {
  search?: string;
  role?: string;
  command_id?: number;
  is_active?: boolean;
  page?: number;
  perPage?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedUsers {
  data: User[];
  total: number;
  page: number;
  perPage: number;
}

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  display_name: 'u.display_name',
  email: 'u.email',
  role: 'u.role',
  command_name: 'c.name',
  created_at: 'u.created_at',
  id: 'u.id',
};

export function getAllUsers(options?: UserListOptions): User[] | PaginatedUsers {
  const db = getDb();

  // If no pagination params, return all (backward-compatible for dev toolbar etc.)
  if (!options?.page && !options?.perPage && !options?.search && !options?.role && options?.command_id === undefined && options?.is_active === undefined) {
    const rows = db.prepare(`SELECT ${USER_COLUMNS} ${USER_FROM} ORDER BY u.id`).all();
    return rows.map(rowToUser);
  }

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.search) {
    conditions.push('(u.display_name LIKE ? OR u.email LIKE ?)');
    const term = `%${options.search}%`;
    params.push(term, term);
  }
  if (options?.role) {
    conditions.push('u.role = ?');
    params.push(options.role);
  }
  if (options?.command_id !== undefined) {
    conditions.push('u.command_id = ?');
    params.push(options.command_id);
  }
  if (options?.is_active !== undefined) {
    conditions.push('u.is_active = ?');
    params.push(options.is_active ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count
  const countRow = db.prepare(`SELECT COUNT(*) as total ${USER_FROM} ${where}`).get(...params) as any;
  const total = countRow.total;

  // Sort
  const sortCol = ALLOWED_SORT_COLUMNS[options?.sort ?? ''] ?? 'u.id';
  const sortOrder = options?.order === 'desc' ? 'DESC' : 'ASC';

  // Pagination
  const page = Math.max(1, options?.page ?? 1);
  const perPage = Math.min(100, Math.max(1, options?.perPage ?? 50));
  const offset = (page - 1) * perPage;

  const rows = db.prepare(
    `SELECT ${USER_COLUMNS} ${USER_FROM} ${where} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`
  ).all(...params, perPage, offset);

  return { data: rows.map(rowToUser), total, page, perPage };
}

export function getUserById(id: number): User | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT ${USER_COLUMNS} ${USER_FROM} WHERE u.id = ?`).get(id);
  return row ? rowToUser(row) : undefined;
}

export function getUserByEmailWithPassword(email: string): UserWithPassword | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT u.*, c.name as command_name, (u.password_hash IS NOT NULL) as has_password ${USER_FROM} WHERE u.email = ?`).get(email) as any;
  if (!row) return undefined;
  return { ...row, command_name: row.command_name ?? null, is_active: Boolean(row.is_active), has_password: Boolean(row.has_password) };
}

export function setPasswordHash(userId: number, passwordHash: string): void {
  const db = getDb();
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(passwordHash, userId);
}

export function clearPasswordHash(userId: number, performedBy: number): void {
  const db = getDb();
  db.prepare("UPDATE users SET password_hash = NULL, updated_at = datetime('now') WHERE id = ?").run(userId);

  createAuditEntry({
    entityType: 'user',
    entityId: userId,
    action: 'password_reset',
    performedBy,
  });
}

export function createUser(payload: CreateUserPayload, performedBy: number): User {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO users (email, display_name, role, command_id) VALUES (?, ?, ?, ?)
  `).run(payload.email, payload.display_name, payload.role, payload.command_id ?? null);

  const user = getUserById(result.lastInsertRowid as number)!;

  createAuditEntry({
    entityType: 'user',
    entityId: user.id,
    action: 'created',
    newValue: { email: user.email, display_name: user.display_name, role: user.role, command_id: user.command_id },
    performedBy,
  });

  return user;
}

export function updateUser(id: number, payload: UpdateUserPayload, performedBy: number): User | undefined {
  const db = getDb();
  const existing = getUserById(id);
  if (!existing) return undefined;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (payload.email !== undefined) { updates.push('email = ?'); values.push(payload.email); }
  if (payload.display_name !== undefined) { updates.push('display_name = ?'); values.push(payload.display_name); }
  if (payload.role !== undefined) { updates.push('role = ?'); values.push(payload.role); }
  if (payload.timezone !== undefined) { updates.push('timezone = ?'); values.push(payload.timezone); }
  if (payload.command_id !== undefined) { updates.push('command_id = ?'); values.push(payload.command_id); }
  if (payload.is_active !== undefined) { updates.push('is_active = ?'); values.push(payload.is_active ? 1 : 0); }

  if (updates.length === 0) return existing;

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = getUserById(id)!;

  // Audit field changes
  for (const key of Object.keys(payload) as (keyof UpdateUserPayload)[]) {
    if (payload[key] !== undefined && String(payload[key]) !== String(existing[key as keyof User])) {
      createAuditEntry({
        entityType: 'user',
        entityId: id,
        action: 'field_changed',
        fieldName: key,
        oldValue: existing[key as keyof User],
        newValue: payload[key],
        performedBy,
      });
    }
  }

  return updated;
}

export interface BulkImportRow {
  email: string;
  display_name: string;
  role: string;
  command?: string;
}

export interface BulkImportResult {
  created: number;
  skipped: number;
  errors: { row: number; email: string; error: string }[];
}

const VALID_ROLES = ['admin', 'approver', 'n4', 'contracting', 'reviewer', 'requester', 'viewer'];

export function bulkImportUsers(rows: BulkImportRow[], performedBy: number): BulkImportResult {
  const db = getDb();
  const commands = getAllCommands();
  const result: BulkImportResult = { created: 0, skipped: 0, errors: [] };

  const importAll = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 for 1-indexed + header row

      if (!row.email || !row.display_name) {
        result.errors.push({ row: rowNum, email: row.email || '', error: 'Missing email or display_name' });
        continue;
      }

      if (!VALID_ROLES.includes(row.role)) {
        result.errors.push({ row: rowNum, email: row.email, error: `Invalid role: ${row.role}` });
        continue;
      }

      // Check if user already exists
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(row.email);
      if (existing) {
        result.skipped++;
        continue;
      }

      // Resolve command
      let commandId: number | null = null;
      if (row.command) {
        const cmd = commands.find(c => c.name.toLowerCase() === row.command!.toLowerCase() || c.code.toLowerCase() === row.command!.toLowerCase());
        if (!cmd) {
          result.errors.push({ row: rowNum, email: row.email, error: `Unknown command: ${row.command}` });
          continue;
        }
        commandId = cmd.id;
      }

      const insertResult = db.prepare(
        'INSERT INTO users (email, display_name, role, command_id) VALUES (?, ?, ?, ?)'
      ).run(row.email, row.display_name, row.role, commandId);

      createAuditEntry({
        entityType: 'user',
        entityId: insertResult.lastInsertRowid as number,
        action: 'created',
        newValue: { email: row.email, display_name: row.display_name, role: row.role, command_id: commandId },
        performedBy,
      });

      result.created++;
    }
  });

  importAll();
  return result;
}
