import { getDb } from '../database/connection';

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Generate a reference number in the format:
 * [Command]-[RequestType]-[###]-[DD MMM YYYY]
 *
 * Command: stripped of hyphens/spaces (e.g., NSWG-8 -> NSWG8)
 * RequestType: as selected
 * ###: 3-digit sequential number, per command
 * DD MMM YYYY: submit date (e.g., 09 MAR 2026)
 */
export function generateReferenceNumber(command: string, requestType: string, submitDate?: Date): string {
  const db = getDb();
  const date = submitDate ?? new Date();

  // Strip hyphens and spaces from command for the reference key
  const commandKey = command.replace(/[-\s]/g, '');

  // Increment the per-command sequence counter
  db.prepare(`
    INSERT INTO sequence_counters (prefix, current_value) VALUES (?, 1)
    ON CONFLICT(prefix) DO UPDATE SET current_value = current_value + 1
  `).run(commandKey);

  const row = db.prepare('SELECT current_value FROM sequence_counters WHERE prefix = ?').get(commandKey) as { current_value: number };
  const seq = String(row.current_value).padStart(3, '0');

  // Format date as DD MMM YYYY
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();

  return `${commandKey}-${requestType}-${seq}-${day} ${month} ${year}`;
}

/**
 * Generate a temporary draft reference number.
 * Used when a request is first created (before command/request type are known).
 */
export function generateDraftReferenceNumber(): string {
  const db = getDb();
  db.prepare(`
    INSERT INTO sequence_counters (prefix, current_value) VALUES ('DRAFT', 1)
    ON CONFLICT(prefix) DO UPDATE SET current_value = current_value + 1
  `).run();

  const row = db.prepare("SELECT current_value FROM sequence_counters WHERE prefix = 'DRAFT'").get() as { current_value: number };
  return `DRAFT-${String(row.current_value).padStart(5, '0')}`;
}
