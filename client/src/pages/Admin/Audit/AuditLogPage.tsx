import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { format } from 'date-fns';
import type { AuditEntry } from '@req-tracker/shared';

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ entity_type: '', action: '' });

  useEffect(() => { loadAudit(); }, [page, filters]);

  async function loadAudit() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('per_page', '30');
      if (filters.entity_type) params.set('entity_type', filters.entity_type);
      if (filters.action) params.set('action', filters.action);

      const res = await api.get(`/audit?${params}`);
      setEntries(res.data.data);
      setTotal(res.data.meta.total);
    } catch (err) {
      console.error('Failed to load audit log:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>

      <div className="flex items-center gap-3">
        <select
          value={filters.entity_type}
          onChange={e => { setFilters(prev => ({ ...prev, entity_type: e.target.value })); setPage(1); }}
          className="input w-auto"
        >
          <option value="">All entities</option>
          <option value="request">Requests</option>
          <option value="template">Templates</option>
          <option value="user">Users</option>
          <option value="approval_step">Approval Steps</option>
          <option value="comment">Comments</option>
          <option value="nudge">Nudges</option>
        </select>
        <select
          value={filters.action}
          onChange={e => { setFilters(prev => ({ ...prev, action: e.target.value })); setPage(1); }}
          className="input w-auto"
        >
          <option value="">All actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="status_changed">Status Changed</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="returned">Returned</option>
          <option value="field_changed">Field Changed</option>
          <option value="commented">Commented</option>
          <option value="reviewed">Reviewed</option>
          <option value="completed">Completed</option>
          <option value="contract_awarded">Contract Awarded</option>
          <option value="nudged">Nudged</option>
          <option value="nudge_acknowledged">Nudge Acknowledged</option>
        </select>
        <span className="text-sm text-gray-500">{total} entries</span>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Entity</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Field</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {format(new Date(entry.created_at), 'MMM d, h:mm a')}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{entry.performer_name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {entry.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {entry.entity_type} #{entry.entity_id}
                      {entry.request_id && (
                        <Link to={`/requests/${entry.request_id}`} className="ml-1 text-blue-600 hover:underline">
                          (view)
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{entry.field_name ?? '--'}</td>
                    <td className="px-4 py-3 text-xs">
                      {entry.old_value && entry.new_value ? (
                        <span>
                          <span className="line-through text-red-500 dark:text-red-400">{tryParse(entry.old_value)}</span>
                          {' → '}
                          <span className="text-green-600 dark:text-green-400">{tryParse(entry.new_value)}</span>
                        </span>
                      ) : entry.new_value ? (
                        <span className="text-green-600 dark:text-green-400">{tryParse(entry.new_value)}</span>
                      ) : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary btn-sm">Previous</button>
            <span className="text-sm text-gray-500">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page * 30 >= total} className="btn-secondary btn-sm">Next</button>
          </div>
        </>
      )}
    </div>
  );
}

function tryParse(val: string): string {
  try {
    const parsed = JSON.parse(val);
    if (typeof parsed === 'object') return JSON.stringify(parsed);
    return String(parsed);
  } catch {
    return val;
  }
}
