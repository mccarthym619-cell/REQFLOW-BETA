import { STATUS_LABELS, STATUS_COLORS } from '@req-tracker/shared';
import type { RequestStatus } from '@req-tracker/shared';

const colorClasses: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const color = STATUS_COLORS[status] ?? 'gray';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[color] ?? colorClasses.gray}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
