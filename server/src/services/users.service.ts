import { getDb } from '../database/connection';
import { createAuditEntry } from './audit.service';
import type { User, CreateUserPayload, UpdateUserPayload } from '@req-tracker/shared';

// Columns to select for public user queries (excludes password_hash)
const USER_COLUMNS = 'id, email, display_name, role, is_active, (password_hash IS NOT NULL) as has_password, created_at, updated_at';

function rowToUser(row: any): User {
  return { ...row, is_active: Boolean(row.is_active), has_password: Boolean(row.has_password) };
}

export interface UserWithPassword extends User {
  password_hash: string | null;
}

export function getAllUsers(): User[] {
  const db = getDb();
  const rows = db.prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY id`).all();
  return rows.map(rowToUser);
}

export function getUserById(id: number): User | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id);
  return row ? rowToUser(row) : undefined;
}

export function getUserByEmailWithPassword(email: string): UserWithPassword | undefined {
  const db = getDb();
  const row = db.prepare('SELECT *, (password_hash IS NOT NULL) as has_password FROM users WHERE email = ?').get(email) as any;
  if (!row) return undefined;
  return { ...row, is_active: Boolean(row.is_active), has_password: Boolean(row.has_password) };
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
    INSERT INTO users (email, display_name, role) VALUES (?, ?, ?)
  `).run(payload.email, payload.display_name, payload.role);

  const user = getUserById(result.lastInsertRowid as number)!;

  createAuditEntry({
    entityType: 'user',
    entityId: user.id,
    action: 'created',
    newValue: { email: user.email, display_name: user.display_name, role: user.role },
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
