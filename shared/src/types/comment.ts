export interface Comment {
  id: number;
  request_id: number;
  parent_id: number | null;
  user_id: number;
  body: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  user_name?: string;
  replies?: Comment[];
}

export interface CreateCommentPayload {
  body: string;
  parent_id?: number;
  is_internal?: boolean;
}
