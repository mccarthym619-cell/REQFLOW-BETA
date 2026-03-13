import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { CheckCircle, XCircle, RotateCcw, Clock, MessageSquare, ArrowLeft, Edit, Ban, Bell, Package, FileCheck, Award, Link, Paperclip } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { Request as ReqType, RequestApprovalStep, AuditEntry, Comment, Nudge, CustomFieldDefinition } from '@req-tracker/shared';

type Tab = 'details' | 'approval' | 'timeline' | 'comments';

export function RequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [request, setRequest] = useState<ReqType | null>(null);
  const [template, setTemplate] = useState<{ fields: CustomFieldDefinition[] } | null>(null);
  const [steps, setSteps] = useState<RequestApprovalStep[]>([]);
  const [timeline, setTimeline] = useState<AuditEntry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [loading, setLoading] = useState(true);
  const [actionNotes, setActionNotes] = useState('');
  const [commentText, setCommentText] = useState('');
  const [acting, setActing] = useState(false);

  // N4-specific state
  const [trackingComment, setTrackingComment] = useState('');
  // Reviewer-specific state
  const [reviewNotes, setReviewNotes] = useState('');
  // Contracting-specific state
  const [contractComment, setContractComment] = useState('');
  const [contractDocUrl, setContractDocUrl] = useState('');

  useEffect(() => { loadAll(); }, [id, currentUser?.id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [reqRes, stepsRes, timelineRes, commentsRes, nudgesRes] = await Promise.all([
        api.get(`/requests/${id}`),
        api.get(`/requests/${id}/approval-status`),
        api.get(`/requests/${id}/timeline`),
        api.get(`/requests/${id}/comments`),
        api.get(`/requests/${id}/nudges`),
      ]);
      setRequest(reqRes.data.data);
      setSteps(stepsRes.data.data);
      setTimeline(timelineRes.data.data);
      setComments(commentsRes.data.data);
      setNudges(nudgesRes.data.data);

      const tmplRes = await api.get(`/templates/${reqRes.data.data.template_id}`);
      setTemplate(tmplRes.data.data);
    } catch (err) {
      console.error('Failed to load request:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproval(action: 'approve' | 'reject' | 'return') {
    setActing(true);
    try {
      await api.post(`/requests/${id}/approvals/${action}`, { notes: actionNotes });
      setActionNotes('');
      await loadAll();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Action failed');
    } finally {
      setActing(false);
    }
  }

  async function handleComment() {
    if (!commentText.trim()) return;
    try {
      await api.post(`/requests/${id}/comments`, { body: commentText });
      setCommentText('');
      await loadAll();
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  }

  async function handleNudge() {
    try {
      await api.post(`/requests/${id}/nudge`);
      await loadAll();
      alert('Nudge sent successfully');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Nudge failed');
    }
  }

  async function handleAcknowledgeNudge(nudgeId: number) {
    const comment = prompt('Please explain the delay:');
    if (!comment) return;
    try {
      await api.post(`/requests/${id}/nudge/${nudgeId}/acknowledge`, { comment });
      await loadAll();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Acknowledge failed');
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel this request?')) return;
    try {
      await api.post(`/requests/${id}/cancel`);
      await loadAll();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Cancel failed');
    }
  }

  // N4: Purchase Complete
  async function handlePurchaseComplete() {
    setActing(true);
    try {
      await api.post(`/requests/${id}/complete`, { tracking_comment: trackingComment || undefined });
      setTrackingComment('');
      await loadAll();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Action failed');
    } finally {
      setActing(false);
    }
  }

  // Reviewer: Mark Reviewed
  async function handleReview() {
    setActing(true);
    try {
      await api.post(`/requests/${id}/review`, { notes: reviewNotes || undefined });
      setReviewNotes('');
      await loadAll();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Action failed');
    } finally {
      setActing(false);
    }
  }

  // Reviewer: Return with Comments
  async function handleReviewReturn() {
    if (!reviewNotes.trim()) {
      alert('Please provide notes explaining why the request is being returned.');
      return;
    }
    setActing(true);
    try {
      await api.post(`/requests/${id}/review-return`, { notes: reviewNotes });
      setReviewNotes('');
      await loadAll();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Action failed');
    } finally {
      setActing(false);
    }
  }

  // Contracting: Contract Awarded
  async function handleContractAwarded() {
    setActing(true);
    try {
      await api.post(`/requests/${id}/contract-awarded`, {
        comment: contractComment || undefined,
        document_url: contractDocUrl || undefined,
      });
      setContractComment('');
      setContractDocUrl('');
      await loadAll();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Action failed');
    } finally {
      setActing(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!request) return <p>Request not found</p>;

  const activeStep = steps.find(s => s.status === 'active');
  const isAssignedApprover = activeStep?.assigned_to === currentUser?.id;
  const isRequester = request.submitted_by === currentUser?.id;
  const canEdit = isRequester && (request.status === 'draft' || request.status === 'returned');
  const canNudge = isRequester && request.status === 'pending_approval';
  const pendingNudges = nudges.filter(n => !n.acknowledged_at && n.nudged_user_id === currentUser?.id);

  const userRole = currentUser?.role;
  const isN4 = userRole === 'n4' || userRole === 'admin';
  const isReviewer = userRole === 'reviewer';
  const isContracting = userRole === 'contracting';

  // N4 can complete when request is approved
  const canPurchaseComplete = isN4 && request.status === 'approved';
  // Reviewer can act on non-terminal requests
  const canReview = isReviewer && !['completed', 'cancelled', 'rejected', 'draft'].includes(request.status);
  // Contracting can act on non-terminal requests
  const canContractAward = isContracting && !['completed', 'cancelled', 'rejected', 'draft'].includes(request.status);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'approval', label: `Approval Pipeline (${steps.length})` },
    { key: 'timeline', label: `Timeline (${timeline.length})` },
    { key: 'comments', label: `Comments (${comments.length})` },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{request.reference_number}</h1>
            <StatusBadge status={request.status} />
            <PriorityBadge priority={request.priority} />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{request.title}</p>
          <p className="text-sm text-gray-400 mt-0.5">
            Submitted by {request.submitter_name} {request.submitted_at && `on ${format(new Date(request.submitted_at), 'MMM d, yyyy')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button onClick={() => navigate(`/requests/${id}/edit`)} className="btn-secondary btn-sm">
              <Edit className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {canNudge && (
            <button onClick={handleNudge} className="btn-warning btn-sm">
              <Bell className="w-3.5 h-3.5" /> Nudge
            </button>
          )}
          {isRequester && !['cancelled', 'completed', 'rejected'].includes(request.status) && (
            <button onClick={handleCancel} className="btn-danger btn-sm">
              <Ban className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Pending nudge acknowledgment banner */}
      {pendingNudges.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">You have been nudged to take action on this request.</p>
          {pendingNudges.map(n => (
            <div key={n.id} className="mt-2 flex items-center gap-3">
              <span className="text-xs text-yellow-700 dark:text-yellow-400">
                Nudged by {n.nudged_by_name} {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </span>
              <button onClick={() => handleAcknowledgeNudge(n.id)} className="btn-sm bg-yellow-200 text-yellow-900 hover:bg-yellow-300 dark:bg-yellow-800 dark:text-yellow-200 dark:hover:bg-yellow-700">
                Acknowledge
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Approval Action Panel (for assigned approver) */}
      {isAssignedApprover && request.status === 'pending_approval' && (
        <div className="card p-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3">
            This request requires your action ({activeStep?.step_name})
          </p>
          <textarea
            value={actionNotes}
            onChange={e => setActionNotes(e.target.value)}
            placeholder="Decision notes (optional for approval, recommended for rejection/return)"
            className="input mb-3"
            rows={2}
          />
          <div className="flex items-center gap-2">
            <button onClick={() => handleApproval('approve')} disabled={acting} className="btn-success btn-sm">
              <CheckCircle className="w-4 h-4" /> Approve
            </button>
            <button onClick={() => handleApproval('return')} disabled={acting} className="btn-warning btn-sm">
              <RotateCcw className="w-4 h-4" /> Return for Revision
            </button>
            <button onClick={() => handleApproval('reject')} disabled={acting} className="btn-danger btn-sm">
              <XCircle className="w-4 h-4" /> Reject
            </button>
          </div>
        </div>
      )}

      {/* N4: Purchase Complete Panel */}
      {canPurchaseComplete && (
        <div className="card p-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
          <p className="text-sm font-medium text-green-900 dark:text-green-300 mb-3">
            <Package className="w-4 h-4 inline mr-1.5" />
            This request is approved and ready for purchase completion
          </p>
          <textarea
            value={trackingComment}
            onChange={e => setTrackingComment(e.target.value)}
            placeholder="Tracking information, delivery comments, or other notes..."
            className="input mb-3"
            rows={2}
          />
          <button onClick={handlePurchaseComplete} disabled={acting} className="btn-success btn-sm">
            <Package className="w-4 h-4" /> {acting ? 'Processing...' : 'Purchase Complete'}
          </button>
        </div>
      )}

      {/* Reviewer: Review Actions Panel */}
      {canReview && (
        <div className="card p-4 border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20">
          <p className="text-sm font-medium text-purple-900 dark:text-purple-300 mb-3">
            <FileCheck className="w-4 h-4 inline mr-1.5" />
            Review this request
          </p>
          <textarea
            value={reviewNotes}
            onChange={e => setReviewNotes(e.target.value)}
            placeholder="Review notes (required for return, optional for marking reviewed)..."
            className="input mb-3"
            rows={2}
          />
          <div className="flex items-center gap-2">
            <button onClick={handleReview} disabled={acting} className="btn-success btn-sm">
              <FileCheck className="w-4 h-4" /> {acting ? 'Processing...' : 'Mark Reviewed'}
            </button>
            <button onClick={handleReviewReturn} disabled={acting} className="btn-warning btn-sm">
              <RotateCcw className="w-4 h-4" /> {acting ? 'Processing...' : 'Return with Comments'}
            </button>
          </div>
        </div>
      )}

      {/* Contracting: Contract Awarded Panel */}
      {canContractAward && (
        <div className="card p-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-3">
            <Award className="w-4 h-4 inline mr-1.5" />
            Contract status for this request
          </p>
          <textarea
            value={contractComment}
            onChange={e => setContractComment(e.target.value)}
            placeholder="Contract status comments..."
            className="input mb-3"
            rows={2}
          />
          <div className="mb-3">
            <label className="label text-sm text-amber-800 dark:text-amber-300">
              <Link className="w-3.5 h-3.5 inline mr-1" />
              Document URL (optional)
            </label>
            <input
              type="url"
              value={contractDocUrl}
              onChange={e => setContractDocUrl(e.target.value)}
              placeholder="https://sharepoint.example.com/contract-doc.pdf"
              className="input"
            />
          </div>
          <button onClick={handleContractAwarded} disabled={acting} className="btn-success btn-sm">
            <Award className="w-4 h-4" /> {acting ? 'Processing...' : 'Contract Awarded'}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="card p-6 space-y-4">
          {template?.fields?.map((field: CustomFieldDefinition) => {
            const value = request.field_values?.[field.field_name];
            const fileInfo = (request as any).file_fields?.[field.field_name];
            return (
              <div key={field.id} className="grid grid-cols-3 gap-4">
                <span className="text-sm font-medium text-gray-500">{field.field_label}</span>
                <span className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                  {field.field_type === 'file' && fileInfo ? (
                    <a
                      href={`/api/files/${fileInfo.file_id}/download`}
                      className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      {fileInfo.original_name}
                      <span className="text-xs text-gray-400 ml-1">
                        ({fileInfo.size_bytes < 1024 * 1024
                          ? `${(fileInfo.size_bytes / 1024).toFixed(1)} KB`
                          : `${(fileInfo.size_bytes / (1024 * 1024)).toFixed(1)} MB`
                        })
                      </span>
                    </a>
                  ) : field.field_type === 'multi_file' && Array.isArray(fileInfo) && fileInfo.length > 0 ? (
                    <div className="space-y-1.5">
                      {fileInfo.map((f: any) => (
                        <a
                          key={f.file_id}
                          href={`/api/files/${f.file_id}/download`}
                          className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Paperclip className="w-3.5 h-3.5 shrink-0" />
                          {f.original_name}
                          <span className="text-xs text-gray-400 ml-1">
                            ({f.size_bytes < 1024 * 1024
                              ? `${(f.size_bytes / 1024).toFixed(1)} KB`
                              : `${(f.size_bytes / (1024 * 1024)).toFixed(1)} MB`
                            })
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    value || <span className="text-gray-300 dark:text-gray-600">--</span>
                  )}
                </span>
              </div>
            );
          })}
          {(!template?.fields || template.fields.length === 0) && (
            <p className="text-sm text-gray-500">No custom fields defined for this template.</p>
          )}
        </div>
      )}

      {activeTab === 'approval' && (
        <div className="card p-6">
          {steps.length === 0 ? (
            <p className="text-sm text-gray-500">No approval chain configured for this request.</p>
          ) : (
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={step.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                      step.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                      step.status === 'returned' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
                      step.status === 'active' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:ring-blue-700' :
                      'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                    }`}>
                      {step.status === 'approved' ? <CheckCircle className="w-4 h-4" /> :
                       step.status === 'rejected' ? <XCircle className="w-4 h-4" /> :
                       step.status === 'returned' ? <RotateCcw className="w-4 h-4" /> :
                       step.step_order}
                    </div>
                    {i < steps.length - 1 && <div className="w-0.5 h-8 bg-gray-200 dark:bg-gray-700 mt-1" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{step.step_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Assigned to: {step.assigned_to_name ?? 'Unassigned'}
                    </p>
                    {step.acted_on_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {step.status.charAt(0).toUpperCase() + step.status.slice(1)} by {step.acted_on_by_name} on {format(new Date(step.acted_on_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                    {step.decision_notes && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">"{step.decision_notes}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'timeline' && (
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
                      {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'comments' && (
        <div className="space-y-4">
          <div className="card p-6">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4">No comments yet.</p>
            ) : (
              <div className="space-y-4 mb-6">
                {comments.map(function renderComment(c: Comment): JSX.Element {
                  return (
                    <div key={c.id}>
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                          {c.user_name?.charAt(0) ?? '?'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.user_name}</span>
                            <span className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                            </span>
                            {c.is_internal && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 px-1.5 py-0.5 rounded">Internal</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{c.body}</p>
                        </div>
                      </div>
                      {c.replies && c.replies.length > 0 && (
                        <div className="ml-10 mt-3 space-y-3 border-l-2 border-gray-100 dark:border-gray-700 pl-4">
                          {c.replies.map(renderComment)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {userRole !== 'viewer' && (
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-gray-400 mt-2" />
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="input"
                    rows={2}
                  />
                  <div className="flex justify-end mt-2">
                    <button onClick={handleComment} className="btn-primary btn-sm" disabled={!commentText.trim()}>
                      Post Comment
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
