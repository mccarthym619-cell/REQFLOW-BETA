import { NotificationType } from '../types/notification.js';

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  approval_needed: 'Approval Required',
  status_changed: 'Status Changed',
  comment_added: 'New Comment',
  request_returned: 'Request Returned',
  request_submitted: 'New Request',
  sla_warning: 'SLA Warning',
  nudge_received: 'Action Requested',
  nudge_acknowledged: 'Nudge Acknowledged',
  registration_request: 'Registration Request',
};
