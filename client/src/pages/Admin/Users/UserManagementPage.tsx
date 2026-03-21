import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../api/client';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { ROLE_LABELS } from '@req-tracker/shared';
import { Plus, Edit, X, KeyRound, Check, Ban, Search, Upload, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { User, UserRole, Command } from '@req-tracker/shared';

interface UserForm {
  email: string;
  display_name: string;
  role: UserRole;
  command_id: number | null;
}

interface RegistrationRequest {
  id: number;
  email: string;
  display_name: string;
  command_id: number | null;
  command_name: string | null;
  justification: string | null;
  status: string;
  created_at: string;
}

interface ImportRow {
  email: string;
  display_name: string;
  role: string;
  command?: string;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; email: string; error: string }[];
}

type Tab = 'users' | 'registrations';

export function UserManagementPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [commands, setCommands] = useState<Command[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>({ email: '', display_name: '', role: 'standard', command_id: null });
  const [saving, setSaving] = useState(false);

  // Search & filter state
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterCommand, setFilterCommand] = useState('');
  const [sort, setSort] = useState('display_name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Approval modal state
  const [approvingReg, setApprovingReg] = useState<RegistrationRequest | null>(null);
  const [approveRole, setApproveRole] = useState<UserRole>('standard');
  const [denyReason, setDenyReason] = useState('');
  const [showDenyModal, setShowDenyModal] = useState<RegistrationRequest | null>(null);

  // Debounced search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

  const loadUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', String(perPage));
      params.set('sort', sort);
      params.set('order', order);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filterRole) params.set('role', filterRole);
      if (filterCommand) params.set('command_id', filterCommand);

      const res = await api.get(`/users?${params.toString()}`);
      setUsers(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, [page, perPage, sort, order, debouncedSearch, filterRole, filterCommand]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    Promise.all([loadCommands(), loadRegistrations()]).finally(() => setLoading(false));
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterRole, filterCommand]);

  async function loadCommands() {
    try {
      const res = await api.get('/users/commands');
      setCommands(res.data.data);
    } catch (err) {
      console.error('Failed to load commands:', err);
    }
  }

  async function loadRegistrations() {
    try {
      const res = await api.get('/admin/registrations?status=pending');
      setRegistrations(res.data.data);
    } catch (err) {
      console.error('Failed to load registrations:', err);
    }
  }

  function openCreate() {
    setEditingUser(null);
    setForm({ email: '', display_name: '', role: 'standard', command_id: null });
    setShowForm(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setForm({ email: user.email, display_name: user.display_name, role: user.role as UserRole, command_id: user.command_id });
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        email: form.email,
        display_name: form.display_name,
        role: form.role,
        ...(form.command_id ? { command_id: form.command_id } : {}),
      };
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, { ...payload, command_id: form.command_id });
      } else {
        await api.post('/users', payload);
      }
      setShowForm(false);
      await loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(user: User) {
    if (!confirm(`Reset password for ${user.display_name}? They will need to set a new password on next login.`)) return;
    try {
      await api.post(`/users/${user.id}/reset-password`);
      await loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to reset password');
    }
  }

  async function handleApproveRegistration() {
    if (!approvingReg) return;
    setSaving(true);
    try {
      await api.post(`/admin/registrations/${approvingReg.id}/approve`, { role: approveRole });
      setApprovingReg(null);
      await Promise.all([loadUsers(), loadRegistrations()]);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to approve registration');
    } finally {
      setSaving(false);
    }
  }

  async function handleDenyRegistration() {
    if (!showDenyModal) return;
    if (!denyReason.trim()) {
      alert('Please provide a reason for denial.');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/admin/registrations/${showDenyModal.id}/deny`, { reason: denyReason.trim() });
      setShowDenyModal(null);
      setDenyReason('');
      await loadRegistrations();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to deny registration');
    } finally {
      setSaving(false);
    }
  }

  function handleSort(col: string) {
    if (sort === col) {
      setOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(col);
      setOrder('asc');
    }
  }

  function SortIcon({ col }: { col: string }) {
    if (sort !== col) return null;
    return order === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        alert('CSV must have a header row and at least one data row.');
        return;
      }

      const header = lines[0].toLowerCase().split(',').map(h => h.trim());
      const emailIdx = header.indexOf('email');
      const nameIdx = header.indexOf('display_name');
      const roleIdx = header.indexOf('role');
      const cmdIdx = header.indexOf('command');

      if (emailIdx === -1 || nameIdx === -1 || roleIdx === -1) {
        alert('CSV must have columns: email, display_name, role (and optionally command).');
        return;
      }

      const rows: ImportRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        rows.push({
          email: cols[emailIdx] || '',
          display_name: cols[nameIdx] || '',
          role: cols[roleIdx] || '',
          command: cmdIdx >= 0 ? cols[cmdIdx] || undefined : undefined,
        });
      }

      setImportRows(rows);
      setImportResult(null);
      setShowImport(true);
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  }

  async function handleImport() {
    setImporting(true);
    try {
      const res = await api.post('/users/import', { users: importRows });
      setImportResult(res.data.data);
      await loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  const pendingCount = registrations.length;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add User</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'users' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          Users ({total})
        </button>
        <button
          onClick={() => setTab('registrations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'registrations' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          Pending Registrations
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <>
          {/* Search & Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="input w-auto"
            >
              <option value="">All Roles</option>
              <option value="admin">Administrator</option>
              <option value="standard">Standard</option>
            </select>
            <select
              value={filterCommand}
              onChange={e => setFilterCommand(e.target.value)}
              className="input w-auto"
            >
              <option value="">All Commands</option>
              {commands.map(cmd => (
                <option key={cmd.id} value={cmd.id}>{cmd.name}</option>
              ))}
            </select>
          </div>

          {/* Users table */}
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('display_name')}>
                    Name <SortIcon col="display_name" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('email')}>
                    Email <SortIcon col="email" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('command_name')}>
                    Command <SortIcon col="command_name" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => handleSort('role')}>
                    Role <SortIcon col="role" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Password</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{user.display_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{user.command_name || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                        {ROLE_LABELS[user.role as UserRole]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${user.has_password ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'}`}>
                        {user.has_password ? 'Set' : 'Pending Setup'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => openEdit(user)} className="text-blue-600 hover:text-blue-800 text-sm" title="Edit user">
                        <Edit className="w-4 h-4 inline" />
                      </button>
                      {user.has_password && (
                        <button onClick={() => handleResetPassword(user)} className="text-orange-600 hover:text-orange-800 text-sm" title="Reset password">
                          <KeyRound className="w-4 h-4 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total} users
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary px-2 py-1 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary px-2 py-1 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Registrations table */}
      {tab === 'registrations' && (
        <div className="card overflow-hidden">
          {registrations.length === 0 ? (
            <p className="p-6 text-center text-gray-500 dark:text-gray-400">No pending registration requests.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Command</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Justification</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Submitted</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {registrations.map(reg => (
                  <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{reg.display_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{reg.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{reg.command_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{reg.justification || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(reg.created_at + 'Z').toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => { setApprovingReg(reg); setApproveRole('standard'); }}
                        className="text-green-600 hover:text-green-800 text-sm"
                        title="Approve"
                      >
                        <Check className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={() => { setShowDenyModal(reg); setDenyReason(''); }}
                        className="text-red-600 hover:text-red-800 text-sm"
                        title="Deny"
                      >
                        <Ban className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create/Edit User Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingUser ? 'Edit User' : 'Add User'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div>
              <label className="label">Display Name</label>
              <input type="text" value={form.display_name} onChange={e => setForm(prev => ({ ...prev, display_name: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Command</label>
              <select
                value={form.command_id ?? ''}
                onChange={e => setForm(prev => ({ ...prev, command_id: e.target.value ? Number(e.target.value) : null }))}
                className="input"
              >
                <option value="">— Select Command —</option>
                {commands.map(cmd => (
                  <option key={cmd.id} value={cmd.id}>{cmd.name}{cmd.is_parent ? ' (HQ)' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Role</label>
              <select value={form.role} onChange={e => setForm(prev => ({ ...prev, role: e.target.value as UserRole }))} className="input">
                <option value="admin">Administrator</option>
                <option value="standard">Standard</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Import Users from CSV</h2>
              <button onClick={() => { setShowImport(false); setImportRows([]); setImportResult(null); }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {importResult ? (
              <div className="space-y-3">
                <div className="flex gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center flex-1">
                    <div className="text-2xl font-bold text-green-700 dark:text-green-400">{importResult.created}</div>
                    <div className="text-xs text-green-600 dark:text-green-500">Created</div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center flex-1">
                    <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{importResult.skipped}</div>
                    <div className="text-xs text-yellow-600 dark:text-yellow-500">Skipped (existing)</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center flex-1">
                    <div className="text-2xl font-bold text-red-700 dark:text-red-400">{importResult.errors.length}</div>
                    <div className="text-xs text-red-600 dark:text-red-500">Errors</div>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-red-50 dark:bg-red-900/20">
                          <th className="text-left px-3 py-2">Row</th>
                          <th className="text-left px-3 py-2">Email</th>
                          <th className="text-left px-3 py-2">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.errors.map((e, i) => (
                          <tr key={i} className="border-t border-red-100 dark:border-red-800">
                            <td className="px-3 py-1.5">{e.row}</td>
                            <td className="px-3 py-1.5">{e.email}</td>
                            <td className="px-3 py-1.5 text-red-600 dark:text-red-400">{e.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={() => { setShowImport(false); setImportRows([]); setImportResult(null); }} className="btn-primary">Done</button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Preview: {importRows.length} user{importRows.length !== 1 ? 's' : ''} to import
                </p>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        <th className="text-left px-3 py-2">Email</th>
                        <th className="text-left px-3 py-2">Name</th>
                        <th className="text-left px-3 py-2">Role</th>
                        <th className="text-left px-3 py-2">Command</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {importRows.slice(0, 100).map((row, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5">{row.email}</td>
                          <td className="px-3 py-1.5">{row.display_name}</td>
                          <td className="px-3 py-1.5">{row.role}</td>
                          <td className="px-3 py-1.5">{row.command || '—'}</td>
                        </tr>
                      ))}
                      {importRows.length > 100 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-center text-gray-500 italic">
                            ...and {importRows.length - 100} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowImport(false); setImportRows([]); }} className="btn-secondary">Cancel</button>
                  <button onClick={handleImport} className="btn-primary" disabled={importing}>
                    {importing ? 'Importing...' : `Import ${importRows.length} Users`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Approve Registration Modal */}
      {approvingReg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Approve Registration</h2>
              <button onClick={() => setApprovingReg(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Approve <span className="font-medium text-gray-900 dark:text-gray-100">{approvingReg.display_name}</span> ({approvingReg.email})
            </p>
            {approvingReg.justification && (
              <p className="text-sm text-gray-500 italic">"{approvingReg.justification}"</p>
            )}
            <div>
              <label className="label">Assign Role</label>
              <select value={approveRole} onChange={e => setApproveRole(e.target.value as UserRole)} className="input">
                <option value="admin">Administrator</option>
                <option value="standard">Standard</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setApprovingReg(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleApproveRegistration} className="btn-primary" disabled={saving}>
                {saving ? 'Approving...' : 'Approve & Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deny Registration Modal */}
      {showDenyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Deny Registration</h2>
              <button onClick={() => setShowDenyModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Deny access for <span className="font-medium text-gray-900 dark:text-gray-100">{showDenyModal.display_name}</span> ({showDenyModal.email})
            </p>
            <div>
              <label className="label">Reason for Denial</label>
              <textarea
                className="input"
                rows={3}
                value={denyReason}
                onChange={e => setDenyReason(e.target.value)}
                placeholder="Provide a reason..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDenyModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleDenyRegistration} className="btn-primary bg-red-600 hover:bg-red-700" disabled={saving || !denyReason.trim()}>
                {saving ? 'Denying...' : 'Deny Registration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
