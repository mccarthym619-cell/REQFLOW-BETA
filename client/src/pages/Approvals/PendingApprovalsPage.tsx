import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { EmptyState } from '../../components/shared/EmptyState';
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function PendingApprovalsPage() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPending(); }, []);

  async function loadPending() {
    try {
      const res = await api.get('/dashboard/my-pending');
      setPending(res.data.data);
    } catch (err) {
      console.error('Failed to load pending:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(requestId: number, action: 'approve' | 'reject' | 'return') {
    const notes = action !== 'approve' ? prompt(`Reason for ${action}:`) : '';
    if (action !== 'approve' && notes === null) return;
    try {
      await api.post(`/requests/${requestId}/approvals/${action}`, { notes });
      await loadPending();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Action failed');
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pending Approvals</h1>

      {pending.length === 0 ? (
        <EmptyState title="No pending approvals" description="You're all caught up!" />
      ) : (
        <div className="space-y-3">
          {pending.map((item: any) => (
            <div key={item.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <Link to={`/requests/${item.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                    {item.reference_number}
                  </Link>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.submitter_name} | {item.template_name} | Step: {item.step_name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Created {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <PriorityBadge priority={item.priority} />
                  <StatusBadge status={item.status} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => handleAction(item.id, 'approve')} className="btn-success btn-sm">
                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={() => handleAction(item.id, 'return')} className="btn-warning btn-sm">
                  <RotateCcw className="w-3.5 h-3.5" /> Return
                </button>
                <button onClick={() => handleAction(item.id, 'reject')} className="btn-danger btn-sm">
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
                <Link to={`/requests/${item.id}`} className="btn-secondary btn-sm ml-auto">
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
