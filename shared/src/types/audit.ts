export type EntityType = 'request' | 'template' | 'user' | 'approval_step' | 'comment' | 'nudge' | 'registration';

export type AuditAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'submitted'
  | 'resubmitted'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'cancelled'
  | 'completed'
  | 'reviewed'
  | 'contract_awarded'
  | 'commented'
  | 'field_changed'
  | 'nudged'
  | 'nudge_acknowledged'
  | 'user_login'
  | 'user_logout'
  | 'password_set'
  | 'password_reset'
  | 'denied';

export interface AuditEntry {
  id: number;
  entity_type: EntityType;
  entity_id: number;
  request_id: number | null;
  action: AuditAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  performed_by: number;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  performer_name?: string;
}
