import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { PriorityBadge } from '../../components/shared/PriorityBadge';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { CheckCircle, XCircle, RotateCcw, ArrowLeft, Edit, Ban, Bell } from 'lucide-react';
import { formatDate, formatRelative } from '../../utils/dateFormat';
import { useTimezone } from '../../hooks/useTimezone';
import { useRequest } from '../../api/queries/useRequest';
import { useApprovalAction } from '../../api/mutations/useApprovalActions';
import {
  useCancelRequest,
  useCompleteRequest,
  useReviewRequest,
  useReviewReturnRequest,
  useContractAward,
  useAddComment,
  useNudge,
  useAcknowledgeNudge,
} from '../../api/mutations/useRequestActions';
import { TextInputModal, ConfirmModal } from '../../components/shared/TextInputModal';
import { ApproverPanel, N4PurchasePanel, ReviewerPanel, ContractingPanel } from './components/RequestApprovalPanel';
import { RequestDetailsTab } from './components/RequestDetailsTab';
import { RequestTimelineTab } from './components/RequestTimelineTab';
import { RequestCommentsTab } from './components/RequestCommentsTab';

type Tab = 'details' | 'approval' | 'timeline' | 'comments';

export function RequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const timezone = useTimezone();

  const { request, steps, timeline, comments, nudges, template, isLoading } = useRequest(id);

  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [commentText, setCommentText] = useState('');
  const [nudgeModalOpen, setNudgeModalOpen] = useState(false);
  const [nudgeModalId, setNudgeModalId] = useState<number | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const approvalAction = useApprovalAction(id);
  const cancelRequest = useCancelRequest(id);
  const completeRequest = useCompleteRequest(id);
  const reviewRequest = useReviewRequest(id);
  const reviewReturnRequest = useReviewReturnRequest(id);
  const contractAward = useContractAward(id);
  const addComment = useAddComment(id);
  const nudgeMutation = useNudge(id);
  const acknowledgeNudge = useAcknowledgeNudge(id);

  const acting = approvalAction.isPending || completeRequest.isPending || reviewRequest.isPending || reviewReturnRequest.isPending || contractAward.isPending;

  function handleComment() {
    if (!commentText.trim()) return;
    addComment.mutate(commentText, {
      onSuccess: () => setCommentText(''),
    });
  }

  if (isLoading) return <LoadingSpinner />;
  if (!request) return <p>Request not found</p>;

  const activeStep = steps.find(s => s.status === 'active');
  const isAssignedApprover = activeStep?.assigned_to === currentUser?.id;
  const isRequester = request.submitted_by === currentUser?.id;
  const canEdit = isRequester && (request.status === 'draft' || request.status === 'returned');
  const canNudge = isRequester && request.status === 'pending_approval';
  const pendingNudges = nudges.filter(n => !n.acknowledged_at && n.nudged_user_id === currentUser?.id);

  const userRole = currentUser?.role;
  const isAdmin = userRole === 'admin';

  const canPurchaseComplete = isAdmin && request.status === 'approved';
  const canReview = false; // Now handled via approval permissions, not role
  const canContractAward = false; // Now handled via approval permissions, not role

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
            Submitted by {request.submitter_name} {request.submitted_at && `on ${formatDate(request.submitted_at, 'MMM d, yyyy', timezone)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button onClick={() => navigate(`/requests/${id}/edit`)} className="btn-secondary btn-sm">
              <Edit className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {canNudge && (
            <button onClick={() => nudgeMutation.mutate()} className="btn-warning btn-sm">
              <Bell className="w-3.5 h-3.5" /> Nudge
            </button>
          )}
          {isRequester && !['cancelled', 'completed', 'rejected'].includes(request.status) && (
            <button onClick={() => setCancelModalOpen(true)} className="btn-danger btn-sm">
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
                Nudged by {n.nudged_by_name} {formatRelative(n.created_at)}
              </span>
              <button onClick={() => { setNudgeModalId(n.id); setNudgeModalOpen(true); }} className="btn-sm bg-yellow-200 text-yellow-900 hover:bg-yellow-300 dark:bg-yellow-800 dark:text-yellow-200 dark:hover:bg-yellow-700">
                Acknowledge
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action Panels */}
      {isAssignedApprover && request.status === 'pending_approval' && activeStep && (
        <ApproverPanel
          activeStep={activeStep}
          acting={acting}
          onApproval={(action, notes) => approvalAction.mutate({ action, notes })}
        />
      )}

      {canPurchaseComplete && (
        <N4PurchasePanel acting={acting} onComplete={(tc) => completeRequest.mutate(tc)} />
      )}

      {canReview && (
        <ReviewerPanel
          acting={acting}
          onReview={(notes) => reviewRequest.mutate(notes)}
          onReturn={(notes) => reviewReturnRequest.mutate(notes)}
        />
      )}

      {canContractAward && (
        <ContractingPanel
          acting={acting}
          onAward={(comment, docUrl) => contractAward.mutate({ comment, documentUrl: docUrl })}
        />
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
        <RequestDetailsTab request={request} template={template} />
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
                        {step.status.charAt(0).toUpperCase() + step.status.slice(1)} by {step.acted_on_by_name} on {formatDate(step.acted_on_at, 'MMM d, yyyy h:mm a', timezone)}
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
        <RequestTimelineTab timeline={timeline} timezone={timezone} />
      )}

      {activeTab === 'comments' && (
        <RequestCommentsTab
          comments={comments}
          commentText={commentText}
          onCommentTextChange={setCommentText}
          onSubmitComment={handleComment}
          canComment={true}
        />
      )}

      <TextInputModal
        open={nudgeModalOpen}
        title="Acknowledge Nudge"
        placeholder="Please explain the delay..."
        submitLabel="Acknowledge"
        onSubmit={(comment) => {
          if (nudgeModalId !== null) {
            acknowledgeNudge.mutate({ nudgeId: nudgeModalId, comment });
          }
          setNudgeModalOpen(false);
          setNudgeModalId(null);
        }}
        onClose={() => { setNudgeModalOpen(false); setNudgeModalId(null); }}
      />

      <ConfirmModal
        open={cancelModalOpen}
        title="Cancel Request"
        message="Are you sure you want to cancel this request? This action cannot be undone."
        confirmLabel="Cancel Request"
        onConfirm={() => { setCancelModalOpen(false); cancelRequest.mutate(); }}
        onClose={() => setCancelModalOpen(false)}
      />
    </div>
  );
}
