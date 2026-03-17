import { Clock } from 'lucide-react';
import { formatDate } from '../../../utils/dateFormat';
import type { AuditEntry } from '@req-tracker/shared';

interface RequestTimelineTabProps {
  timeline: AuditEntry[];
  timezone: string;
}

export function RequestTimelineTab({ timeline, timezone }: RequestTimelineTabProps) {
  return (
    <div className="card p-6">
      {timeline.length === 0 ? (
        <p className="text-sm text-gray-500">No activity recorded.</p>
      ) : (
        <div className="space-y-4">
          {timeline.map(entry => (
            <div key={entry.id} className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  <span className="font-medium">{entry.performer_name}</span>
                  {' '}{entry.action.replace(/_/g, ' ')}
                  {entry.field_name && <span className="text-gray-500"> ({entry.field_name})</span>}
                </p>
                {entry.old_value && entry.new_value && entry.action === 'field_changed' && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Changed from <span className="line-through">{JSON.parse(entry.old_value)}</span> to <span className="font-medium">{JSON.parse(entry.new_value)}</span>
                  </p>
                )}
                {entry.old_value && entry.action === 'status_changed' && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {JSON.parse(entry.old_value)} &rarr; {entry.new_value ? JSON.parse(entry.new_value) : '—'}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(entry.created_at, 'MMM d, yyyy h:mm a', timezone)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
