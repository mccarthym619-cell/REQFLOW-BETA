import type { Priority } from '@req-tracker/shared';

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  low: { label: 'Low', className: 'text-gray-500 dark:text-gray-400' },
  normal: { label: 'Normal', className: 'text-blue-600 dark:text-blue-400' },
  high: { label: 'High', className: 'text-orange-600 dark:text-orange-400 font-medium' },
  urgent: { label: 'Urgent', className: 'text-red-600 dark:text-red-400 font-bold' },
  critical: { label: 'Critical', className: 'text-red-700 dark:text-red-400 font-bold' },
  essential: { label: 'Essential', className: 'text-orange-600 dark:text-orange-400 font-medium' },
  enhancing: { label: 'Enhancing', className: 'text-blue-500 dark:text-blue-400' },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = priorityConfig[priority] ?? priorityConfig.normal;
  return <span className={`text-xs ${config.className}`}>{config.label}</span>;
}
