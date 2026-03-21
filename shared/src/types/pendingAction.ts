export type PendingActionStatus = 'WAITING' | 'ACTED' | 'EXPIRED';

export interface PendingAction {
  id: number;
  request_id: number;
  step_id: number;
  assigned_to: number;
  assigned_at: string;
  status: PendingActionStatus;
  notified_at: string | null;
  due_by: string | null;
  /** Joined fields */
  request_reference?: string;
  request_title?: string;
  request_amount?: number;
  request_status?: string;
  step_name?: string;
  step_order?: number;
  required_permission?: string;
  assigned_to_name?: string;
  submitted_by_name?: string;
  department_name?: string;
  command_name?: string;
}
