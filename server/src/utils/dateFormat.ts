/**
 * Returns the current date/time formatted for SQLite storage.
 * Format: 'YYYY-MM-DD HH:mm:ss' (UTC, no timezone suffix)
 */
export function formatDateForDb(date?: Date): string {
  return (date ?? new Date()).toISOString().replace('T', ' ').split('.')[0];
}
