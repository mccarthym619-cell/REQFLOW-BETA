import { formatInTimeZone } from 'date-fns-tz';
import { formatDistanceToNow } from 'date-fns';

/**
 * Parse a UTC date string from SQLite (which lacks a 'Z' suffix)
 * into a proper Date object interpreted as UTC.
 */
function parseUtc(utcDateStr: string): Date {
  const str = utcDateStr.endsWith('Z') ? utcDateStr : utcDateStr + 'Z';
  return new Date(str);
}

/**
 * Format a UTC date string in the user's timezone.
 */
export function formatDate(utcDateStr: string, pattern: string, timezone: string): string {
  return formatInTimeZone(parseUtc(utcDateStr), timezone, pattern);
}

/**
 * Format a UTC date string as relative time ("5 minutes ago").
 * Relative time is timezone-independent — it measures elapsed time between two UTC instants.
 */
export function formatRelative(utcDateStr: string): string {
  return formatDistanceToNow(parseUtc(utcDateStr), { addSuffix: true });
}
