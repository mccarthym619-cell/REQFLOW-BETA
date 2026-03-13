import { getDb } from '../database/connection';
import { createAuditEntry } from './audit.service';

export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM system_settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export function updateSettings(updates: Record<string, string>, performedBy: number): Record<string, string> {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO system_settings (key, value, updated_by, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')
  `);

  db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      const old = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
      stmt.run(key, value, performedBy);

      createAuditEntry({
        entityType: 'user',
        entityId: performedBy,
        action: 'updated',
        fieldName: `setting:${key}`,
        oldValue: old?.value,
        newValue: value,
        performedBy,
      });
    }
  })();

  return getAllSettings();
}
