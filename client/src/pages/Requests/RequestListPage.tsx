import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { EmptyState } from '../../components/shared/EmptyState';
import { Plus } from 'lucide-react';
import { hasPermission, STANDARD_FIELDS } from '@req-tracker/shared';
import { formatRelative } from '../../utils/dateFormat';
import { useRequests } from '../../api/queries/useRequests';
import type { RequestStatus, UserRole } from '@req-tracker/shared';

const commandOptions = STANDARD_FIELDS.find(f => f.field_name === 'command')?.options ?? [];

export function RequestListPage() {
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') ?? '';
  const command = searchParams.get('command') ?? '';
  const search = searchParams.get('search') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const canCreate = hasPermission((currentUser?.role ?? 'standard') as UserRole, 'requests.create');

  const { data, isLoading } = useRequests({ status: status || undefined, command: command || undefined, search: search || undefined, page });
  const requests = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const statuses: (RequestStatus | '')[] = ['', 'draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'returned', 'completed'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Requests</h1>
        {canCreate && (
          <Link to="/requests/new" className="btn-primary">
            <Plus className="w-4 h-4" /> New Request
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setSearchParams(prev => { if (s) prev.set('status', s); else prev.delete('status'); prev.delete('page'); return prev; })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              status === s ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {s === '' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
        <select
          value={command}
          onChange={(e) => setSearchParams(prev => {
            if (e.target.value) prev.set('command', e.target.value);
            else prev.delete('command');
            prev.delete('page');
            return prev;
          })}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
        >
          <option value="">All Commands</option>
          {commandOptions.map(cmd => (
            <option key={cmd} value={cmd}>{cmd}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : requests.length === 0 ? (
        <EmptyState
          title="No requests found"
          description={status || search || command ? 'Try adjusting your filters' : canCreate ? 'Create your first request to get started' : 'No requests to display'}
          action={canCreate ? (
            <Link to="/requests/new" className="btn-primary">
              <Plus className="w-4 h-4" /> New Request
            </Link>
          ) : undefined}
        />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Reference</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Template</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Submitted By</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {requests.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/requests/${req.id}`} className="text-sm font-mono text-blue-600 hover:underline">
                        {req.reference_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/requests/${req.id}`} className="text-sm text-gray-900 dark:text-gray-100 hover:text-blue-600">
                        {req.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{req.template_name}</td>
                    <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3"><PriorityBadge priority={req.priority} /></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{req.submitter_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatRelative(req.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 20 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{total} total requests</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSearchParams(prev => { prev.set('page', String(page - 1)); return prev; })}
                  disabled={page <= 1}
                  className="btn-secondary btn-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setSearchParams(prev => { prev.set('page', String(page + 1)); return prev; })}
                  disabled={page * 20 >= total}
                  className="btn-secondary btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
