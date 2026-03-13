export type NotificationType =
  | 'approval_needed'
  | 'status_changed'
  | 'comment_added'
  | 'request_returned'
  | 'request_submitted'
  | 'sla_warning'
  | 'nudge_received'
  | 'nudge_acknowledged';

export interface Notification {
  id: number;
  user_id: number;
  request_id: number | null;
  type: NotificationType;
  title: string;
  message: string;
  action_url: string | null;
  is_read: boolean;
  is_email_sent: boolean;
  created_at: string;
}
