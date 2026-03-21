import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { Clock, Package } from 'lucide-react';
import { STATUS_LABELS } from '@req-tracker/shared';
import type { RequestStatus } from '@req-tracker/shared';
import { formatRelative } from '../../utils/dateFormat';
import { useDashboardSummary, useDashboardPending, useDashboardActivity, useDashboardAwaitingCompletion } from '../../api/queries/useDashboard';

export function DashboardPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isStandard = currentUser?.role === 'standard';

  const summaryQuery = useDashboardSummary();
  const pendingQuery = useDashboardPending();
  const activityQuery = useDashboardActivity();
  const awaitingQuery = useDashboardAwaitingCompletion(isAdmin);

  const loading = summaryQuery.isLoading || pendingQuery.isLoading || activityQuery.isLoading;
  if (loading) return <LoadingSpinner />;

  const summary = summaryQuery.data;
  const pending = pendingQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const awaitingCompletion = awaitingQuery.data ?? [];

  const statuses: RequestStatus[] = ['draft', 'pending_approval', 'approved', 'rejected', 'completed'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>

      {/* Pending Your Action — top of page for standard users */}
      {isStandard && (
        <div className="card">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Pending Your Action</h2>
          </div>
          {pending.length === 0 ? (
            <p className="p-4 text-sm text-gray-500 text-center">No pending actions</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {pending.map(item => (
                <Link
                  key={item.id}
                  to={`/requests/${item.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.reference_number} - {item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.submitter_name} | {item.step_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <PriorityBadge priority={item.priority} />
                    <StatusBadge status={item.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statuses.map(status => (
          <Link
            key={status}
            to={`/requests?status=${status}`}
            className="card p-4 hover:shadow-md transition-shadow"
          >
            <p className="text-xs text-gray-500 uppercase tracking-wider">{STATUS_LABELS[status]}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {summary?.status_counts?.[status] ?? 0}
            </p>
          </Link>
        ))}
      </div>

      {/* Awaiting Purchase Completion — Admin only */}
      {isAdmin && awaitingCompletion.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Awaiting Purchase Completion</h2>
            <span className="ml-auto text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
              {awaitingCompletion.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-72 overflow-y-auto">
            {awaitingCompletion.map(item => (
              <Link
                key={item.id}
                to={`/requests/${item.id}`}
                className="flex items-center justify-between p-4 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {item.reference_number} - {item.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.submitter_name} | {item.template_name}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <PriorityBadge priority={item.priority} />
                  <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-1 rounded-full font-medium">
                    Approved
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 ${!isStandard ? 'lg:grid-cols-2' : ''} gap-6`}>
        {/* Pending Actions — hidden for standard users (shown at top instead) */}
        {!isStandard && (
          <div className="card">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Pending Your Action</h2>
            </div>
            {pending.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">No pending actions</p>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {pending.map(item => (
                  <Link
                    key={item.id}
                    to={`/requests/${item.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.reference_number} - {item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.submitter_name} | {item.step_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent Activity */}
        <div className="card">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h2>
          </div>
          {activity.length === 0 ? (
            <p className="p-4 text-sm text-gray-500 text-center">No recent activity</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-96 overflow-y-auto">
              {activity.map(item => (
                <div key={item.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        <span className="font-medium">{item.performer_name}</span>
                        {' '}{item.action.replace(/_/g, ' ')}{' '}
                        {item.reference_number && (
                          <Link to={`/requests/${item.request_id}`} className="text-blue-600 hover:underline">
                            {item.reference_number}
                          </Link>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatRelative(item.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
