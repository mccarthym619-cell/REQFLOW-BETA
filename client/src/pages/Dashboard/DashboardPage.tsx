import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { FileText, CheckSquare, AlertTriangle, Clock, Package } from 'lucide-react';
import { STATUS_LABELS } from '@req-tracker/shared';
import type { RequestStatus } from '@req-tracker/shared';
import { formatDistanceToNow } from 'date-fns';

export function DashboardPage() {
  const { currentUser } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [awaitingCompletion, setAwaitingCompletion] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isN4 = currentUser?.role === 'n4' || currentUser?.role === 'admin';

  useEffect(() => {
    loadDashboard();
  }, [currentUser?.id]);

  async function loadDashboard() {
    try {
      const fetches: Promise<any>[] = [
        api.get('/dashboard/summary'),
        api.get('/dashboard/my-pending'),
        api.get('/dashboard/recent-activity?limit=15'),
      ];
      if (isN4) {
        fetches.push(api.get('/dashboard/awaiting-completion'));
      }
      const results = await Promise.all(fetches);
      setSummary(results[0].data.data);
      setPending(results[1].data.data);
      setActivity(results[2].data.data);
      if (isN4 && results[3]) {
        setAwaitingCompletion(results[3].data.data);
      } else {
        setAwaitingCompletion([]);
      }
    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  const statuses: RequestStatus[] = ['draft', 'pending_approval', 'approved', 'rejected', 'completed'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>

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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{summary?.pending_my_action ?? 0}</p>
            <p className="text-sm text-gray-500">Awaiting Your Action</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{summary?.sla_at_risk ?? 0}</p>
            <p className="text-sm text-gray-500">SLA At Risk</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{summary?.total_requests ?? 0}</p>
            <p className="text-sm text-gray-500">Total Requests</p>
          </div>
        </div>
      </div>

      {/* Awaiting Purchase Completion — N4 / Admin only */}
      {isN4 && awaitingCompletion.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Awaiting Purchase Completion</h2>
            <span className="ml-auto text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
              {awaitingCompletion.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-72 overflow-y-auto">
            {awaitingCompletion.map((item: any) => (
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Actions */}
        <div className="card">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Pending Your Action</h2>
          </div>
          {pending.length === 0 ? (
            <p className="p-4 text-sm text-gray-500 text-center">No pending actions</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {pending.map((item: any) => (
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

        {/* Recent Activity */}
        <div className="card">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h2>
          </div>
          {activity.length === 0 ? (
            <p className="p-4 text-sm text-gray-500 text-center">No recent activity</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-96 overflow-y-auto">
              {activity.map((item: any) => (
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
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
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
