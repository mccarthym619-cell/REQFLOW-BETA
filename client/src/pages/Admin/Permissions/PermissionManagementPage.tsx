import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { showSuccess, showError } from '../../../utils/toast';
import { Plus, Edit, Trash2, X, Shield } from 'lucide-react';

type ApprovalPermission = 'REVIEWER' | 'ENDORSER' | 'CERTIFIER' | 'APPROVER' | 'COMPLETER';

interface UserPermission {
  id: number;
  user_id: number;
  command_id: number;
  department_id: number | null;
  permission: ApprovalPermission;
  delegation_limit: number | null;
  created_at: string;
  command_name?: string;
  department_name?: string;
  user_name?: string;
}

interface User {
  id: number;
  display_name: string;
  email: string;
}

interface Command {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
}

const PERMISSION_LABELS: Record<ApprovalPermission, string> = {
  REVIEWER: 'Reviewer',
  ENDORSER: 'Endorser',
  CERTIFIER: 'Certifier',
  APPROVER: 'Approver',
  COMPLETER: 'Completer',
};

const PERMISSION_COLORS: Record<ApprovalPermission, string> = {
  REVIEWER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  ENDORSER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  CERTIFIER: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
  APPROVER: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  COMPLETER: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
};

const ALL_PERMISSIONS: ApprovalPermission[] = ['REVIEWER', 'ENDORSER', 'CERTIFIER', 'APPROVER', 'COMPLETER'];

interface GrantForm {
  user_id: number | null;
  command_id: number | null;
  department_id: number | null;
  permission: ApprovalPermission;
  delegation_limit: string;
}

const EMPTY_FORM: GrantForm = {
  user_id: null,
  command_id: null,
  department_id: null,
  permission: 'REVIEWER',
  delegation_limit: '',
};

export function PermissionManagementPage() {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterUserId, setFilterUserId] = useState('');
  const [filterCommandId, setFilterCommandId] = useState('');

  // Grant modal
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantForm, setGrantForm] = useState<GrantForm>(EMPTY_FORM);
  const [grantDepartments, setGrantDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);

  // Edit inline
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDelegationLimit, setEditDelegationLimit] = useState('');

  // Revoke confirmation
  const [confirmRevokeId, setConfirmRevokeId] = useState<number | null>(null);

  const loadPermissions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterUserId) params.set('user_id', filterUserId);
      const query = params.toString();
      const res = await api.get(`/permissions${query ? `?${query}` : ''}`);
      setPermissions(res.data.data);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Failed to load permissions');
    }
  }, [filterUserId]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/users');
      const data = res.data.data ?? res.data;
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, []);

  const loadCommands = useCallback(async () => {
    try {
      const res = await api.get('/users/commands');
      setCommands(res.data.data);
    } catch (err) {
      console.error('Failed to load commands:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadUsers(), loadCommands()]).finally(() => setLoading(false));
  }, [loadUsers, loadCommands]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // Load departments when grant form command changes
  useEffect(() => {
    if (!grantForm.command_id) {
      setGrantDepartments([]);
      return;
    }
    api.get(`/departments?command_id=${grantForm.command_id}`)
      .then(res => setGrantDepartments(res.data.data))
      .catch(() => setGrantDepartments([]));
  }, [grantForm.command_id]);

  // Load departments for filter (all departments for selected filter command)
  useEffect(() => {
    if (!filterCommandId) {
      setDepartments([]);
      return;
    }
    api.get(`/departments?command_id=${filterCommandId}`)
      .then(res => setDepartments(res.data.data))
      .catch(() => setDepartments([]));
  }, [filterCommandId]);

  function openGrantModal() {
    setGrantForm(EMPTY_FORM);
    setGrantDepartments([]);
    setShowGrantModal(true);
  }

  async function handleGrant() {
    if (!grantForm.user_id || !grantForm.command_id) {
      showError('User and Command are required.');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        user_id: grantForm.user_id,
        command_id: grantForm.command_id,
        permission: grantForm.permission,
      };
      if (grantForm.department_id) body.department_id = grantForm.department_id;
      if (grantForm.delegation_limit) body.delegation_limit = Number(grantForm.delegation_limit);
      await api.post('/permissions', body);
      showSuccess('Permission granted successfully.');
      setShowGrantModal(false);
      await loadPermissions();
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Failed to grant permission');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(perm: UserPermission) {
    setEditingId(perm.id);
    setEditDelegationLimit(perm.delegation_limit != null ? String(perm.delegation_limit) : '');
  }

  async function handleSaveEdit(id: number) {
    setSaving(true);
    try {
      const body: Record<string, any> = {};
      body.delegation_limit = editDelegationLimit ? Number(editDelegationLimit) : null;
      await api.put(`/permissions/${id}`, body);
      showSuccess('Permission updated.');
      setEditingId(null);
      await loadPermissions();
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Failed to update permission');
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: number) {
    try {
      await api.delete(`/permissions/${id}`);
      showSuccess('Permission revoked.');
      setConfirmRevokeId(null);
      await loadPermissions();
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Failed to revoke permission');
    }
  }

  // Group permissions by user
  const grouped = permissions.reduce<Record<number, { userName: string; perms: UserPermission[] }>>((acc, p) => {
    if (!acc[p.user_id]) {
      acc[p.user_id] = { userName: p.user_name || `User #${p.user_id}`, perms: [] };
    }
    acc[p.user_id].perms.push(p);
    return acc;
  }, {});

  // Filter by command on client side (permissions API only supports user_id filter)
  const filteredGrouped = Object.entries(grouped).reduce<Record<string, { userName: string; perms: UserPermission[] }>>((acc, [userId, group]) => {
    const filtered = filterCommandId
      ? group.perms.filter(p => p.command_id === Number(filterCommandId))
      : group.perms;
    if (filtered.length > 0) {
      acc[userId] = { userName: group.userName, perms: filtered };
    }
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Permission Management</h1>
        <button onClick={openGrantModal} className="btn-primary">
          <Plus className="w-4 h-4" /> Grant Permission
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterUserId}
          onChange={e => setFilterUserId(e.target.value)}
          className="input w-auto"
        >
          <option value="">All Users</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.display_name}</option>
          ))}
        </select>
        <select
          value={filterCommandId}
          onChange={e => setFilterCommandId(e.target.value)}
          className="input w-auto"
        >
          <option value="">All Commands</option>
          {commands.map(cmd => (
            <option key={cmd.id} value={cmd.id}>{cmd.name}</option>
          ))}
        </select>
      </div>

      {/* Permissions table grouped by user */}
      {Object.keys(filteredGrouped).length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No permissions found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(filteredGrouped).map(([userId, group]) => (
            <div key={userId} className="card overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {group.userName}
                </span>
                <span className="ml-2 text-xs text-gray-400">
                  ({group.perms.length} permission{group.perms.length !== 1 ? 's' : ''})
                </span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Command</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Permission Level</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Delegation Limit</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {group.perms.map(perm => (
                    <tr key={perm.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {perm.command_name || `Command #${perm.command_id}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {perm.department_id ? (perm.department_name || `Dept #${perm.department_id}`) : 'All Departments'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PERMISSION_COLORS[perm.permission]}`}>
                          {PERMISSION_LABELS[perm.permission]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {editingId === perm.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editDelegationLimit}
                              onChange={e => setEditDelegationLimit(e.target.value)}
                              placeholder="No limit"
                              className="input w-32 text-sm"
                            />
                            <button
                              onClick={() => handleSaveEdit(perm.id)}
                              disabled={saving}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-gray-400 hover:text-gray-600 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          perm.delegation_limit != null
                            ? `$${Number(perm.delegation_limit).toLocaleString()}`
                            : <span className="text-gray-400">No limit</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {editingId !== perm.id && (
                          <>
                            <button
                              onClick={() => startEdit(perm)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Edit delegation limit"
                            >
                              <Edit className="w-4 h-4 inline" />
                            </button>
                            {confirmRevokeId === perm.id ? (
                              <span className="inline-flex items-center gap-1 text-xs">
                                <span className="text-red-600 dark:text-red-400">Revoke?</span>
                                <button
                                  onClick={() => handleRevoke(perm.id)}
                                  className="text-red-600 hover:text-red-800 font-medium"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setConfirmRevokeId(null)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  No
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmRevokeId(perm.id)}
                                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                title="Revoke permission"
                              >
                                <Trash2 className="w-4 h-4 inline" />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Grant Permission Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Grant Permission</h2>
              <button onClick={() => setShowGrantModal(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div>
              <label className="label">User *</label>
              <select
                value={grantForm.user_id ?? ''}
                onChange={e => setGrantForm(prev => ({ ...prev, user_id: e.target.value ? Number(e.target.value) : null }))}
                className="input"
              >
                <option value="">-- Select User --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.display_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Command *</label>
              <select
                value={grantForm.command_id ?? ''}
                onChange={e => setGrantForm(prev => ({
                  ...prev,
                  command_id: e.target.value ? Number(e.target.value) : null,
                  department_id: null,
                }))}
                className="input"
              >
                <option value="">-- Select Command --</option>
                {commands.map(cmd => (
                  <option key={cmd.id} value={cmd.id}>{cmd.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Department</label>
              <select
                value={grantForm.department_id ?? ''}
                onChange={e => setGrantForm(prev => ({ ...prev, department_id: e.target.value ? Number(e.target.value) : null }))}
                className="input"
                disabled={!grantForm.command_id}
              >
                <option value="">All Departments</option>
                {grantDepartments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
              {!grantForm.command_id && (
                <p className="text-xs text-gray-400 mt-1">Select a command first</p>
              )}
            </div>

            <div>
              <label className="label">Permission Level *</label>
              <select
                value={grantForm.permission}
                onChange={e => setGrantForm(prev => ({ ...prev, permission: e.target.value as ApprovalPermission }))}
                className="input"
              >
                {ALL_PERMISSIONS.map(p => (
                  <option key={p} value={p}>{PERMISSION_LABELS[p]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Delegation Limit ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={grantForm.delegation_limit}
                onChange={e => setGrantForm(prev => ({ ...prev, delegation_limit: e.target.value }))}
                placeholder="No limit"
                className="input"
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank for no limit</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowGrantModal(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleGrant}
                className="btn-primary"
                disabled={saving || !grantForm.user_id || !grantForm.command_id}
              >
                {saving ? 'Granting...' : 'Grant Permission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke confirmation is inline (no separate modal needed) */}
    </div>
  );
}
