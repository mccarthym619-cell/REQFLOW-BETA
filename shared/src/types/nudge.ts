export interface Nudge {
  id: number;
  request_id: number;
  approval_step_id: number;
  nudged_by: number;
  nudged_user_id: number;
  acknowledged_at: string | null;
  acknowledge_comment: string | null;
  created_at: string;
  nudged_by_name?: string;
  nudged_user_name?: string;
}

export interface AcknowledgeNudgePayload {
  comment: string;
}
