import { UserRole, ApprovalPermission } from '../types/user.js';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  standard: 'Standard',
};

export const APPROVAL_PERMISSION_LABELS: Record<ApprovalPermission, string> = {
  REVIEWER: 'Reviewer',
  ENDORSER: 'Endorser',
  CERTIFIER: 'Certifier',
  APPROVER: 'Approver',
  COMPLETER: 'Completer',
};

export const APPROVAL_PERMISSIONS: ApprovalPermission[] = [
  'REVIEWER',
  'ENDORSER',
  'CERTIFIER',
  'APPROVER',
  'COMPLETER',
];

export type Permission =
  | 'requests.create'
  | 'requests.view_own'
  | 'requests.view_all'
  | 'requests.edit_own'
  | 'requests.cancel_own'
  | 'templates.manage'
  | 'users.manage'
  | 'audit.view'
  | 'settings.manage'
  | 'notifications.view_own'
  | 'departments.manage'
  | 'permissions.manage';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'requests.create',
    'requests.view_own',
    'requests.view_all',
    'requests.edit_own',
    'requests.cancel_own',
    'templates.manage',
    'users.manage',
    'audit.view',
    'settings.manage',
    'notifications.view_own',
    'departments.manage',
    'permissions.manage',
  ],
  standard: [
    'requests.create',
    'requests.view_own',
    'requests.view_all',
    'requests.edit_own',
    'requests.cancel_own',
    'notifications.view_own',
  ],
};
