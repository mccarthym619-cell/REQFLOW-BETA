import { useState } from 'react';
import { CheckCircle, XCircle, RotateCcw, Package, FileCheck, Award, Link } from 'lucide-react';
import { showError } from '../../../utils/toast';
import type { Request as ReqType, RequestApprovalStep } from '@req-tracker/shared';

interface ApproverPanelProps {
  activeStep: RequestApprovalStep;
  acting: boolean;
  onApproval: (action: 'approve' | 'reject' | 'return', notes: string) => void;
}

export function ApproverPanel({ activeStep, acting, onApproval }: ApproverPanelProps) {
  const [notes, setNotes] = useState('');

  function handleAction(action: 'approve' | 'reject' | 'return') {
    onApproval(action, notes);
    setNotes('');
  }

  return (
    <div className="card p-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
      <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3">
        This request requires your action ({activeStep.step_name})
      </p>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Decision notes (optional for approval, recommended for rejection/return)"
        className="input mb-3"
        rows={2}
      />
      <div className="flex items-center gap-2">
        <button onClick={() => handleAction('approve')} disabled={acting} className="btn-success btn-sm">
          <CheckCircle className="w-4 h-4" /> Approve
        </button>
        <button onClick={() => handleAction('return')} disabled={acting} className="btn-warning btn-sm">
          <RotateCcw className="w-4 h-4" /> Return for Revision
        </button>
        <button onClick={() => handleAction('reject')} disabled={acting} className="btn-danger btn-sm">
          <XCircle className="w-4 h-4" /> Reject
        </button>
      </div>
    </div>
  );
}

interface N4PanelProps {
  acting: boolean;
  onComplete: (trackingComment?: string) => void;
}

export function N4PurchasePanel({ acting, onComplete }: N4PanelProps) {
  const [trackingComment, setTrackingComment] = useState('');

  return (
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
      <button onClick={() => { onComplete(trackingComment || undefined); setTrackingComment(''); }} disabled={acting} className="btn-success btn-sm">
        <Package className="w-4 h-4" /> {acting ? 'Processing...' : 'Purchase Complete'}
      </button>
    </div>
  );
}

interface ReviewerPanelProps {
  acting: boolean;
  onReview: (notes?: string) => void;
  onReturn: (notes: string) => void;
}

export function ReviewerPanel({ acting, onReview, onReturn }: ReviewerPanelProps) {
  const [notes, setNotes] = useState('');

  function handleReturn() {
    if (!notes.trim()) {
      showError('Please provide notes explaining why the request is being returned.');
      return;
    }
    onReturn(notes);
    setNotes('');
  }

  return (
    <div className="card p-4 border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20">
      <p className="text-sm font-medium text-purple-900 dark:text-purple-300 mb-3">
        <FileCheck className="w-4 h-4 inline mr-1.5" />
        Review this request
      </p>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Review notes (required for return, optional for marking reviewed)..."
        className="input mb-3"
        rows={2}
      />
      <div className="flex items-center gap-2">
        <button onClick={() => { onReview(notes || undefined); setNotes(''); }} disabled={acting} className="btn-success btn-sm">
          <FileCheck className="w-4 h-4" /> {acting ? 'Processing...' : 'Mark Reviewed'}
        </button>
        <button onClick={handleReturn} disabled={acting} className="btn-warning btn-sm">
          <RotateCcw className="w-4 h-4" /> {acting ? 'Processing...' : 'Return with Comments'}
        </button>
      </div>
    </div>
  );
}

interface ContractingPanelProps {
  acting: boolean;
  onAward: (comment?: string, documentUrl?: string) => void;
}

export function ContractingPanel({ acting, onAward }: ContractingPanelProps) {
  const [comment, setComment] = useState('');
  const [docUrl, setDocUrl] = useState('');

  return (
    <div className="card p-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-3">
        <Award className="w-4 h-4 inline mr-1.5" />
        Contract status for this request
      </p>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
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
          value={docUrl}
          onChange={e => setDocUrl(e.target.value)}
          placeholder="https://sharepoint.example.com/contract-doc.pdf"
          className="input"
        />
      </div>
      <button onClick={() => { onAward(comment || undefined, docUrl || undefined); setComment(''); setDocUrl(''); }} disabled={acting} className="btn-success btn-sm">
        <Award className="w-4 h-4" /> {acting ? 'Processing...' : 'Contract Awarded'}
      </button>
    </div>
  );
}
