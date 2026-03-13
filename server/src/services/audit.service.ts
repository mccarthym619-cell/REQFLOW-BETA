import { getDb } from '../database/connection';
import type { AuditAction, EntityType, AuditEntry } from '@req-tracker/shared';

interface AuditEntryParams {
  entityType: EntityType;
  entityId: number;
  requestId?: number | null;
  action: AuditAction;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  performedBy: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export function createAuditEntry(params: AuditEntryParams): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_log (entity_type, entity_id, request_id, action, field_name, old_value, new_value, performed_by, ip_address, user_agent, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.entityType,
    params.entityId,
    params.requestId ?? null,
    params.action,
    params.fieldName ?? null,
    params.oldValue !== undefined ? JSON.stringify(params.oldValue) : null,
    params.newValue !== undefined ? JSON.stringify(params.newValue) : null,
    params.performedBy,
    params.ipAddress ?? null,
    params.userAgent ?? null,
    params.metadata ? JSON.stringify(params.metadata) : null,
  );
}

export function diffAndAuditFields(
  entityType: EntityType,
  entityId: number,
  requestId: number | null,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  performedBy: number
): void {
  for (const key of Object.keys(newValues)) {
    const oldVal = oldValues[key];
    const newVal = newValues[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      createAuditEntry({
        entityType,
        entityId,
        requestId,
        action: 'field_changed',
        fieldName: key,
        oldValue: oldVal,
        newValue: newVal,
        performedBy,
      });
    }
  }
}

export function getAuditLogForRequest(requestId: number): AuditEntry[] {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, u.display_name as performer_name
    FROM audit_log a
    LEFT JOIN users u ON u.id = a.performed_by
    WHERE a.request_id = ?
    ORDER BY a.created_at ASC, a.id ASC
  `).all(requestId) as AuditEntry[];
}

export function searchAuditLog(filters: {
  entityType?: string;
  action?: string;
  performedBy?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
}): { entries: AuditEntry[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.entityType) {
    conditions.push('a.entity_type = ?');
    params.push(filters.entityType);
  }
  if (filters.action) {
    conditions.push('a.action = ?');
    params.push(filters.action);
  }
  if (filters.performedBy) {
    conditions.push('a.performed_by = ?');
    params.push(filters.performedBy);
  }
  if (filters.startDate) {
    conditions.push('a.created_at >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('a.created_at <= ?');
    params.push(filters.endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 50;
  const offset = (page - 1) * perPage;

  const total = (db.prepare(`SELECT COUNT(*) as count FROM audit_log a ${where}`).get(...params) as { count: number }).count;

  const entries = db.prepare(`
    SELECT a.*, u.display_name as performer_name
    FROM audit_log a
    LEFT JOIN users u ON u.id = a.performed_by
    ${where}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, perPage, offset) as AuditEntry[];

  return { entries, total };
}
