export type UserRole = 'admin' | 'standard';

/** Scoped approval permission levels */
export type ApprovalPermission = 'REVIEWER' | 'ENDORSER' | 'CERTIFIER' | 'APPROVER' | 'COMPLETER';

export interface Command {
  id: number;
  name: string;
  code: string;
  is_parent: boolean;
  is_active: boolean;
}

export interface Department {
  id: number;
  command_id: number;
  name: string;
  code: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  /** Joined from commands table */
  command_name?: string;
}

export interface UserPermission {
  id: number;
  user_id: number;
  command_id: number;
  department_id: number | null;
  permission: ApprovalPermission;
  delegation_limit: number | null;
  created_at: string;
  /** Joined fields */
  command_name?: string;
  department_name?: string;
  user_name?: string;
}

export interface User {
  id: number;
  email: string;
  display_name: string;
  role: UserRole;
  timezone: string;
  command_id: number | null;
  command_name: string | null;
  department_id: number | null;
  department_name: string | null;
  is_active: boolean;
  has_password: boolean;
  created_at: string;
  updated_at: string;
  /** Populated from user_permissions table */
  permissions?: UserPermission[];
}

export interface CreateUserPayload {
  email: string;
  display_name: string;
  role: UserRole;
  command_id?: number;
  department_id?: number;
}

export interface UpdateUserPayload {
  email?: string;
  display_name?: string;
  role?: UserRole;
  timezone?: string;
  command_id?: number | null;
  department_id?: number | null;
  is_active?: boolean;
}

export interface CreateUserPermissionPayload {
  user_id: number;
  command_id: number;
  department_id?: number | null;
  permission: ApprovalPermission;
  delegation_limit?: number | null;
}

export interface UpdateUserPermissionPayload {
  delegation_limit?: number | null;
}
