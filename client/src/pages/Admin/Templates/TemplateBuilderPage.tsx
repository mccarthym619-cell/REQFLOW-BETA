import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { LoadingSpinner } from '../../../components/shared/LoadingSpinner';
import { FIELD_TYPE_META, STANDARD_FIELDS } from '@req-tracker/shared';
import { Plus, Trash2, GripVertical, ArrowLeft, Lock } from 'lucide-react';
import { ROLE_LABELS } from '@req-tracker/shared';
import type { FieldType, CustomFieldDefinition, ApprovalChainStep, CreateFieldPayload, CreateApprovalStepPayload, UserRole } from '@req-tracker/shared';

export function TemplateBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prefix, setPrefix] = useState('');
  const [fields, setFields] = useState<Partial<CreateFieldPayload>[]>([]);
  const [approvalSteps, setApprovalSteps] = useState<Partial<CreateApprovalStepPayload>[]>([]);
  const [users, setUsers] = useState<{ id: number; display_name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
    if (isEdit) loadTemplate();
  }, [id]);

  async function loadUsers() {
    const res = await api.get('/users');
    setUsers(res.data.data);
  }

  async function loadTemplate() {
    try {
      const res = await api.get(`/templates/${id}`);
      const t = res.data.data;
      setName(t.name);
      setDescription(t.description ?? '');
      setPrefix(t.prefix);
      // Only load non-standard (custom) fields into the editable fields list
      setFields(t.fields
        .filter((f: CustomFieldDefinition) => !f.is_standard)
        .map((f: CustomFieldDefinition) => ({
          field_name: f.field_name,
          field_label: f.field_label,
          field_type: f.field_type,
          is_required: Boolean(f.is_required),
          options: f.options,
          placeholder: f.placeholder,
          help_text: f.help_text,
        })));
      setApprovalSteps(t.approval_chain.map((s: ApprovalChainStep) => ({
        step_order: s.step_order,
        step_name: s.step_name,
        approver_type: s.approver_type,
        approver_role: s.approver_role,
        approver_user_id: s.approver_user_id,
      })));
    } catch (err) {
      console.error('Failed to load template:', err);
    } finally {
      setLoading(false);
    }
  }

  function addField() {
    setFields(prev => [...prev, {
      field_name: `field_${prev.length + 1}`,
      field_label: '',
      field_type: 'text' as FieldType,
      is_required: false,
      options: [],
    }]);
  }

  function removeField(index: number) {
    setFields(prev => prev.filter((_, i) => i !== index));
  }

  function updateField(index: number, updates: Partial<CreateFieldPayload>) {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  }

  function addApprovalStep() {
    setApprovalSteps(prev => [...prev, {
      step_order: prev.length + 1,
      step_name: '',
      approver_type: 'specific_user',
    }]);
  }

  function removeApprovalStep(index: number) {
    setApprovalSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 })));
  }

  async function handleSave() {
    if (!name.trim() || !prefix.trim()) {
      setError('Name and prefix are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        name,
        description: description || undefined,
        prefix: prefix.toUpperCase(),
        fields: fields.map((f, i) => ({
          ...f,
          field_name: f.field_name || `field_${i}`,
          field_label: f.field_label || `Field ${i + 1}`,
          field_type: f.field_type || 'text',
          sort_order: i,
        })),
        approval_chain: approvalSteps.map((s, i) => ({
          ...s,
          step_order: i + 1,
          step_name: s.step_name || `Step ${i + 1}`,
          approver_type: s.approver_type || 'specific_user',
        })),
      };

      if (isEdit) {
        await api.put(`/templates/${id}`, payload);
        navigate('/admin/templates');
      } else {
        await api.post('/templates', payload);
        navigate('/admin/templates');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  const fieldTypes = Object.entries(FIELD_TYPE_META) as [FieldType, typeof FIELD_TYPE_META[FieldType]][];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate('/admin/templates')} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to Templates
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{isEdit ? 'Edit Template' : 'New Template'}</h1>

      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm p-3 rounded-lg">{error}</div>}

      {/* Template Meta */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Template Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" placeholder="e.g., IT Purchase Request" />
          </div>
          <div>
            <label className="label">Prefix *</label>
            <input type="text" value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} className="input" placeholder="e.g., IT" maxLength={10} />
            <p className="text-xs text-gray-400 mt-1">Used for reference numbers: {prefix || 'XX'}-00001</p>
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="input" rows={2} placeholder="Describe when to use this template" />
        </div>
      </div>

      {/* Standard Fields (locked) */}
      <div className="card p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Standard Fields</h2>
          <p className="text-xs text-gray-500 mt-0.5">These fields are included in every template and cannot be removed.</p>
        </div>

        <div className="space-y-2">
          {STANDARD_FIELDS.map((sf) => (
            <div key={sf.field_name} className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <div className="flex-1 flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[180px]">{sf.field_label}</span>
                <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">{FIELD_TYPE_META[sf.field_type].label}</span>
                {sf.is_required && <span className="text-xs text-red-500 dark:text-red-400">Required</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Fields */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Additional Fields</h2>
            <p className="text-xs text-gray-500 mt-0.5">Add custom fields specific to this template.</p>
          </div>
          <button onClick={addField} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Field</button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-gray-500">No additional fields. Click "Add Field" to add template-specific fields.</p>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                    <span className="text-xs text-gray-400">Custom Field {index + 1}</span>
                  </div>
                  <button onClick={() => removeField(index)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Label</label>
                    <input type="text" value={field.field_label ?? ''} onChange={e => updateField(index, { field_label: e.target.value, field_name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })} className="input" placeholder="Field label" />
                  </div>
                  <div>
                    <label className="label">Type</label>
                    <select value={field.field_type ?? 'text'} onChange={e => updateField(index, { field_type: e.target.value as FieldType })} className="input">
                      {fieldTypes.map(([type, meta]) => (
                        <option key={type} value={type}>{meta.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-3">
                    <label className="flex items-center gap-2 pb-2">
                      <input type="checkbox" checked={field.is_required ?? false} onChange={e => updateField(index, { is_required: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600 text-blue-600" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Required</span>
                    </label>
                  </div>
                </div>
                {(field.field_type === 'dropdown' || field.field_type === 'multi_select') && (
                  <div>
                    <label className="label">Options (one per line)</label>
                    <textarea
                      value={(field.options ?? []).join('\n')}
                      onChange={e => updateField(index, { options: e.target.value.split('\n').filter(Boolean) })}
                      className="input"
                      rows={3}
                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Placeholder</label>
                    <input type="text" value={field.placeholder ?? ''} onChange={e => updateField(index, { placeholder: e.target.value })} className="input" placeholder="Placeholder text" />
                  </div>
                  <div>
                    <label className="label">Help Text</label>
                    <input type="text" value={field.help_text ?? ''} onChange={e => updateField(index, { help_text: e.target.value })} className="input" placeholder="Help text shown below field" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval Chain */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Approval Chain</h2>
            <p className="text-xs text-gray-500 mt-0.5">Steps are executed sequentially. Leave empty for auto-approval.</p>
          </div>
          <button onClick={addApprovalStep} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Step</button>
        </div>

        {approvalSteps.length === 0 ? (
          <p className="text-sm text-gray-500">No approval steps. Requests using this template will be auto-approved.</p>
        ) : (
          <div className="space-y-3">
            {approvalSteps.map((step, index) => (
              <div key={index} className="flex items-center gap-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="w-8 h-8 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={step.step_name ?? ''}
                    onChange={e => {
                      const updated = [...approvalSteps];
                      updated[index] = { ...step, step_name: e.target.value };
                      setApprovalSteps(updated);
                    }}
                    className="input"
                    placeholder="Step name (e.g., Manager Approval)"
                  />
                  <select
                    value={step.approver_type ?? 'specific_user'}
                    onChange={e => {
                      const updated = [...approvalSteps];
                      updated[index] = { ...step, approver_type: e.target.value as 'role' | 'specific_user' };
                      setApprovalSteps(updated);
                    }}
                    className="input"
                  >
                    <option value="specific_user">Specific User</option>
                    <option value="role">By Role</option>
                  </select>
                  {step.approver_type === 'specific_user' ? (
                    <select
                      value={step.approver_user_id ?? ''}
                      onChange={e => {
                        const updated = [...approvalSteps];
                        updated[index] = { ...step, approver_user_id: parseInt(e.target.value, 10) };
                        setApprovalSteps(updated);
                      }}
                      className="input"
                    >
                      <option value="">Select user...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.display_name} ({u.role})</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={step.approver_role ?? ''}
                      onChange={e => {
                        const updated = [...approvalSteps];
                        updated[index] = { ...step, approver_role: e.target.value };
                        setApprovalSteps(updated);
                      }}
                      className="input"
                    >
                      <option value="">Select role...</option>
                      {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
                        <option key={role} value={role}>{label}</option>
                      ))}
                    </select>
                  )}
                </div>
                <button onClick={() => removeApprovalStep(index)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button onClick={() => navigate('/admin/templates')} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Template'}
        </button>
      </div>
    </div>
  );
}
