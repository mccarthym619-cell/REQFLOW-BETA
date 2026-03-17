export type UserRole = 'admin' | 'approver' | 'n4' | 'contracting' | 'reviewer' | 'requester' | 'viewer';

export interface Command {
  id: number;
  name: string;
  code: string;
  is_parent: boolean;
  is_active: boolean;
}

export interface User {
  id: number;
  email: string;
  display_name: string;
  role: UserRole;
  timezone: string;
  command_id: number | null;
  command_name: string | null;
  is_active: boolean;
  has_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserPayload {
  email: string;
  display_name: string;
  role: UserRole;
  command_id?: number;
}

export interface UpdateUserPayload {
  email?: string;
  display_name?: string;
  role?: UserRole;
  timezone?: string;
  command_id?: number | null;
  is_active?: boolean;
}
