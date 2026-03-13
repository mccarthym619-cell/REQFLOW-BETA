export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'cancelled'
  | 'completed';

export type Priority = 'low' | 'normal' | 'high' | 'urgent' | 'critical' | 'essential' | 'enhancing';

export type ApprovalStepStatus = 'pending' | 'active' | 'approved' | 'rejected' | 'returned' | 'skipped';

export interface Request {
  id: number;
  reference_number: string;
  template_id: number;
  submitted_by: number;
  title: string;
  status: RequestStatus;
  priority: Priority;
  current_step_order: number | null;
  submitted_at: string | null;
  completed_at: string | null;
  sla_deadline: string | null;
  created_at: string;
  updated_at: string;
  template_name?: string;
  submitter_name?: string;
  field_values?: Record<string, string>;
}

export interface CreateRequestPayload {
  template_id: number;
  title: string;
  priority?: Priority;
  field_values?: Record<string, string>;
}

export interface UpdateRequestPayload {
  title?: string;
  priority?: Priority;
  field_values?: Record<string, string>;
}

export interface RequestApprovalStep {
  id: number;
  request_id: number;
  chain_step_id: number;
  step_order: number;
  status: ApprovalStepStatus;
  assigned_to: number | null;
  acted_on_by: number | null;
  acted_on_at: string | null;
  decision_notes: string | null;
  created_at: string;
  updated_at: string;
  step_name?: string;
  assigned_to_name?: string;
  acted_on_by_name?: string;
}

export interface ApprovalActionPayload {
  notes?: string;
}
