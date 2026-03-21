import { getDb } from '../database/connection';
import type { Department } from '@req-tracker/shared';

export function getAllDepartments(): Department[] {
  const db = getDb();
  return db.prepare(`
    SELECT d.*, c.name as command_name
    FROM departments d
    JOIN commands c ON c.id = d.command_id
    WHERE d.is_active = 1
    ORDER BY c.name, d.sort_order
  `).all() as Department[];
}

export function getDepartmentsByCommand(commandId: number): Department[] {
  const db = getDb();
  return db.prepare(`
    SELECT d.*, c.name as command_name
    FROM departments d
    JOIN commands c ON c.id = d.command_id
    WHERE d.command_id = ? AND d.is_active = 1
    ORDER BY d.sort_order
  `).all(commandId) as Department[];
}

export function getDepartmentById(id: number): Department | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT d.*, c.name as command_name
    FROM departments d
    JOIN commands c ON c.id = d.command_id
    WHERE d.id = ?
  `).get(id) as Department | undefined;
}

export function createDepartment(data: {
  command_id: number;
  name: string;
  code: string;
  sort_order?: number;
}): number {
  const db = getDb();
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM departments WHERE command_id = ?'
  ).get(data.command_id) as { max_order: number };

  const result = db.prepare(`
    INSERT INTO departments (command_id, name, code, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(
    data.command_id,
    data.name,
    data.code,
    data.sort_order ?? maxOrder.max_order + 1
  );
  return result.lastInsertRowid as number;
}

export function updateDepartment(id: number, data: {
  name?: string;
  code?: string;
  sort_order?: number;
  is_active?: boolean;
}): boolean {
  const db = getDb();
  const sets: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.code !== undefined) { sets.push('code = ?'); values.push(data.code); }
  if (data.sort_order !== undefined) { sets.push('sort_order = ?'); values.push(data.sort_order); }
  if (data.is_active !== undefined) { sets.push('is_active = ?'); values.push(data.is_active ? 1 : 0); }

  if (sets.length === 0) return false;

  values.push(id);
  const result = db.prepare(`UPDATE departments SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deactivateDepartment(id: number): boolean {
  const db = getDb();
  const result = db.prepare('UPDATE departments SET is_active = 0 WHERE id = ?').run(id);
  return result.changes > 0;
}
