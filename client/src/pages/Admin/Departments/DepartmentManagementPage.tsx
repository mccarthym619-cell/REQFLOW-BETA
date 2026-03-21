import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { showSuccess, showError } from '../../../utils/toast';
import { Plus, Edit, X, Trash2 } from 'lucide-react';

interface Department {
  id: number;
  command_id: number;
  name: string;
  code: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  command_name?: string;
}

interface Command {
  id: number;
  name: string;
  code: string;
  is_parent: boolean;
  is_active: boolean;
}

interface DepartmentForm {
  name: string;
  code: string;
  sort_order: number;
}

const emptyForm: DepartmentForm = { name: '', code: '', sort_order: 0 };

export function DepartmentManagementPage() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [selectedCommandId, setSelectedCommandId] = useState<number | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDepts, setLoadingDepts] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Load commands on mount
  useEffect(() => {
    loadCommands();
  }, []);

  // Load departments when command changes
  useEffect(() => {
    if (selectedCommandId) {
      loadDepartments(selectedCommandId);
    }
  }, [selectedCommandId]);

  async function loadCommands() {
    try {
      const res = await api.get('/users/commands');
      const cmds: Command[] = res.data.data;
      setCommands(cmds);
      if (cmds.length > 0) {
        setSelectedCommandId(cmds[0].id);
      }
    } catch {
      showError('Failed to load commands');
    } finally {
      setLoading(false);
    }
  }

  async function loadDepartments(commandId: number) {
    setLoadingDepts(true);
    try {
      const res = await api.get(`/departments?command_id=${commandId}`);
      const depts: Department[] = res.data.data;
      depts.sort((a, b) => a.sort_order - b.sort_order);
      setDepartments(depts);
    } catch {
      showError('Failed to load departments');
    } finally {
      setLoadingDepts(false);
    }
  }

  function openCreate() {
    setEditingDept(null);
    const maxSort = departments.length > 0
      ? Math.max(...departments.map(d => d.sort_order))
      : 0;
    setForm({ name: '', code: '', sort_order: maxSort + 1 });
    setShowForm(true);
  }

  function openEdit(dept: Department) {
    setEditingDept(dept);
    setForm({ name: dept.name, code: dept.code, sort_order: dept.sort_order });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) {
      showError('Name and code are required');
      return;
    }
    setSaving(true);
    try {
      if (editingDept) {
        await api.put(`/departments/${editingDept.id}`, {
          name: form.name.trim(),
          code: form.code.trim(),
          sort_order: form.sort_order,
        });
        showSuccess('Department updated');
      } else {
        await api.post('/departments', {
          command_id: selectedCommandId,
          name: form.name.trim(),
          code: form.code.trim(),
          sort_order: form.sort_order,
        });
        showSuccess('Department created');
      }
      setShowForm(false);
      if (selectedCommandId) {
        await loadDepartments(selectedCommandId);
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(dept: Department) {
    if (!confirm(`Deactivate "${dept.name}"? This department will no longer be available for selection.`)) return;
    try {
      await api.delete(`/departments/${dept.id}`);
      showSuccess('Department deactivated');
      if (selectedCommandId) {
        await loadDepartments(selectedCommandId);
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Failed to deactivate department');
    }
  }

  async function handleToggleActive(dept: Department) {
    try {
      await api.put(`/departments/${dept.id}`, { is_active: !dept.is_active });
      showSuccess(dept.is_active ? 'Department deactivated' : 'Department reactivated');
      if (selectedCommandId) {
        await loadDepartments(selectedCommandId);
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Failed to update department');
    }
  }

  if (loading) return <LoadingSpinner />;

  const selectedCommand = commands.find(c => c.id === selectedCommandId);
  const activeCount = departments.filter(d => d.is_active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Department Management</h1>
        <button onClick={openCreate} className="btn-primary" disabled={!selectedCommandId}>
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      {/* Command selector */}
      <div className="flex items-center gap-4">
        <div>
          <label className="label">Command</label>
          <select
            value={selectedCommandId ?? ''}
            onChange={e => setSelectedCommandId(Number(e.target.value))}
            className="input w-auto"
          >
            {commands.map(cmd => (
              <option key={cmd.id} value={cmd.id}>
                {cmd.name}{cmd.is_parent ? ' (HQ)' : ''}
              </option>
            ))}
          </select>
        </div>
        {selectedCommand && (
          <div className="text-sm text-gray-500 dark:text-gray-400 self-end pb-2">
            {activeCount} active department{activeCount !== 1 ? 's' : ''} / {departments.length} total
          </div>
        )}
      </div>

      {/* Departments table */}
      {loadingDepts ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Sort Order</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {departments.map(dept => (
                <tr key={dept.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{dept.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">{dept.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{dept.sort_order}</td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleToggleActive(dept)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                        dept.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
                      }`}
                    >
                      {dept.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(dept)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                      title="Edit department"
                    >
                      <Edit className="w-4 h-4 inline" />
                    </button>
                    {dept.is_active && (
                      <button
                        onClick={() => handleDeactivate(dept)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
                        title="Deactivate department"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No departments found for this command.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingDept ? 'Edit Department' : 'Add Department'}
              </h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              </button>
            </div>

            {!editingDept && selectedCommand && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Adding to: <span className="font-medium text-gray-700 dark:text-gray-300">{selectedCommand.name}</span>
              </p>
            )}

            <div>
              <label className="label">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="input"
                placeholder="e.g. Operations"
              />
            </div>
            <div>
              <label className="label">Code</label>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
                className="input"
                placeholder="e.g. OPS"
              />
            </div>
            <div>
              <label className="label">Sort Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={e => setForm(prev => ({ ...prev, sort_order: Number(e.target.value) }))}
                className="input"
                min={0}
              />
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
    </div>
  );
}
