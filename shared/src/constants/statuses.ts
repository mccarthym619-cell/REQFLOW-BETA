import { RequestStatus, ApprovalStepStatus } from '../types/request.js';

export const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned for Revision',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export const STATUS_COLORS: Record<RequestStatus, string> = {
  draft: 'gray',
  submitted: 'blue',
  pending_approval: 'yellow',
  approved: 'green',
  rejected: 'red',
  returned: 'orange',
  cancelled: 'gray',
  completed: 'emerald',
};

export const APPROVAL_STEP_LABELS: Record<ApprovalStepStatus, string> = {
  pending: 'Pending',
  active: 'Awaiting Action',
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned',
  skipped: 'Skipped',
};

export const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'rejected', 'returned', 'cancelled'],
  approved: ['completed', 'cancelled'],
  rejected: [],
  returned: ['submitted', 'cancelled'],
  cancelled: [],
  completed: [],
};
