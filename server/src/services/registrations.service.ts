import { getDb } from '../database/connection';
import { createAuditEntry } from './audit.service';
import { createNotification } from './notifications.service';
import { createUser } from './users.service';
import { AppError } from '../middleware/errorHandler';
import type { UserRole } from '@req-tracker/shared';

export interface RegistrationRequest {
  id: number;
  email: string;
  display_name: string;
  command_id: number | null;
  command_name: string | null;
  justification: string | null;
  status: 'pending' | 'approved' | 'denied';
  reviewed_by: number | null;
  reviewed_at: string | null;
  assigned_role: string | null;
  denial_reason: string | null;
  created_at: string;
  updated_at: string;
}

export function createRegistration(payload: { email: string; display_name: string; command_id?: number; justification?: string }): RegistrationRequest {
  const db = getDb();

  // Check if user already exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(payload.email);
  if (existing) throw new AppError(400, 'EMAIL_EXISTS', 'An account with this email already exists');

  // Check for pending registration
  const pendingReg = db.prepare("SELECT id FROM registration_requests WHERE email = ? AND status = 'pending'").get(payload.email);
  if (pendingReg) throw new AppError(400, 'PENDING_REGISTRATION', 'A registration request for this email is already pending');

  const result = db.prepare(`
    INSERT INTO registration_requests (email, display_name, command_id, justification)
    VALUES (?, ?, ?, ?)
  `).run(payload.email, payload.display_name, payload.command_id ?? null, payload.justification ?? null);

  // Notify all admins
  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' AND is_active = 1").all() as { id: number }[];
  for (const admin of admins) {
    createNotification({
      userId: admin.id,
      type: 'registration_request',
      title: 'New Registration Request',
      message: `${payload.display_name} (${payload.email}) has requested access`,
      actionUrl: '/admin/users',
    });
  }

  return getRegistrationById(result.lastInsertRowid as number)!;
}

export function getRegistrationById(id: number): RegistrationRequest | undefined {
  const db = getDb();
  const row = db.prepare(`
    SELECT r.*, c.name as command_name
    FROM registration_requests r
    LEFT JOIN commands c ON c.id = r.command_id
    WHERE r.id = ?
  `).get(id) as RegistrationRequest | undefined;
  return row;
}

export function getPendingRegistrations(): RegistrationRequest[] {
  const db = getDb();
  return db.prepare(`
    SELECT r.*, c.name as command_name
    FROM registration_requests r
    LEFT JOIN commands c ON c.id = r.command_id
    WHERE r.status = 'pending'
    ORDER BY r.created_at
  `).all() as RegistrationRequest[];
}

export function getAllRegistrations(): RegistrationRequest[] {
  const db = getDb();
  return db.prepare(`
    SELECT r.*, c.name as command_name
    FROM registration_requests r
    LEFT JOIN commands c ON c.id = r.command_id
    ORDER BY r.created_at DESC
  `).all() as RegistrationRequest[];
}

export function approveRegistration(regId: number, role: UserRole, performedBy: number): RegistrationRequest {
  const db = getDb();
  const reg = getRegistrationById(regId);
  if (!reg) throw new AppError(404, 'NOT_FOUND', 'Registration request not found');
  if (reg.status !== 'pending') throw new AppError(400, 'INVALID_STATE', 'Registration is not pending');

  // Create the user
  const user = createUser({
    email: reg.email,
    display_name: reg.display_name,
    role,
    command_id: reg.command_id ?? undefined,
  }, performedBy);

  // Update registration status
  db.prepare(`
    UPDATE registration_requests SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now'), assigned_role = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(performedBy, role, regId);

  createAuditEntry({
    entityType: 'registration',
    entityId: regId,
    action: 'approved',
    performedBy,
    metadata: { email: reg.email, assigned_role: role, user_id: user.id },
  });

  return getRegistrationById(regId)!;
}

export function denyRegistration(regId: number, reason: string, performedBy: number): RegistrationRequest {
  const db = getDb();
  const reg = getRegistrationById(regId);
  if (!reg) throw new AppError(404, 'NOT_FOUND', 'Registration request not found');
  if (reg.status !== 'pending') throw new AppError(400, 'INVALID_STATE', 'Registration is not pending');

  db.prepare(`
    UPDATE registration_requests SET status = 'denied', reviewed_by = ?, reviewed_at = datetime('now'), denial_reason = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(performedBy, reason, regId);

  createAuditEntry({
    entityType: 'registration',
    entityId: regId,
    action: 'denied',
    performedBy,
    metadata: { email: reg.email, reason },
  });

  return getRegistrationById(regId)!;
}
