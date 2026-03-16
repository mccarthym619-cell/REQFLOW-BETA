export type UserRole = 'admin' | 'approver' | 'n4' | 'contracting' | 'reviewer' | 'requester' | 'viewer';

export interface User {
  id: number;
  email: string;
  display_name: string;
  role: UserRole;
  timezone: string;
  is_active: boolean;
  has_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserPayload {
  email: string;
  display_name: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  email?: string;
  display_name?: string;
  role?: UserRole;
  timezone?: string;
  is_active?: boolean;
}
