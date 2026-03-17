import { RequestStatus, Priority } from './request.js';

export interface DashboardSummary {
  status_counts: Partial<Record<RequestStatus, number>>;
  total_requests: number;
  pending_my_action: number;
  sla_at_risk: number;
}

export interface DashboardPendingItem {
  id: number;
  reference_number: string;
  title: string;
  status: RequestStatus;
  priority: Priority;
  template_name: string;
  submitter_name: string;
  step_id: number;
  step_name: string;
  sla_deadline: string | null;
  created_at: string;
}

export interface DashboardActivityItem {
  id: number;
  entity_type: string;
  entity_id: number;
  request_id: number | null;
  action: string;
  performer_name: string;
  reference_number: string | null;
  request_title: string | null;
  created_at: string;
}

export interface DashboardAwaitingItem {
  id: number;
  reference_number: string;
  title: string;
  status: RequestStatus;
  priority: Priority;
  template_name: string;
  submitter_name: string;
  updated_at: string;
}
