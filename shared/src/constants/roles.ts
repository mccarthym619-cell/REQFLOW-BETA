import { UserRole } from '../types/user.js';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  approver: 'Approver',
  n4: 'N4',
  contracting: 'Contracting',
  reviewer: 'Reviewer',
  requester: 'Requester',
  viewer: 'Viewer',
};

export type Permission =
  | 'requests.create'
  | 'requests.view_own'
  | 'requests.view_all'
  | 'requests.edit_own'
  | 'requests.cancel_own'
  | 'requests.approve'
  | 'requests.review'
  | 'requests.contract_award'
  | 'requests.complete'
  | 'templates.manage'
  | 'users.manage'
  | 'audit.view'
  | 'settings.manage'
  | 'notifications.view_own';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'requests.create',
    'requests.view_own',
    'requests.view_all',
    'requests.edit_own',
    'requests.cancel_own',
    'requests.approve',
    'requests.complete',
    'templates.manage',
    'users.manage',
    'audit.view',
    'settings.manage',
    'notifications.view_own',
  ],
  approver: [
    'requests.create',
    'requests.view_own',
    'requests.view_all',
    'requests.edit_own',
    'requests.cancel_own',
    'requests.approve',
    'notifications.view_own',
  ],
  n4: [
    'requests.view_own',
    'requests.view_all',
    'requests.complete',
    'audit.view',
    'notifications.view_own',
  ],
  contracting: [
    'requests.view_own',
    'requests.view_all',
    'requests.contract_award',
    'notifications.view_own',
  ],
  reviewer: [
    'requests.view_own',
    'requests.view_all',
    'requests.review',
    'notifications.view_own',
  ],
  requester: [
    'requests.create',
    'requests.view_own',
    'requests.edit_own',
    'requests.cancel_own',
    'notifications.view_own',
  ],
  viewer: [
    'requests.view_own',
    'notifications.view_own',
  ],
};
