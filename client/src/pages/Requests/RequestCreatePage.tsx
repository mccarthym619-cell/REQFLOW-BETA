import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { FileUploadInput } from '../../components/shared/FileUploadInput';
import { MultiFileUploadInput } from '../../components/shared/MultiFileUploadInput';
import type { RequestTemplate, CustomFieldDefinition } from '@req-tracker/shared';

/** Field names that belong to the Primary Requestor group */
const PRIMARY_REQUESTOR_FIELDS = [
  'primary_requestor_name',
  'primary_requestor_phone',
  'primary_requestor_email',
  'primary_requestor_notifications',
];

/** Field names that belong to the Secondary Requestor group */
const SECONDARY_REQUESTOR_FIELDS = [
  'secondary_requestor_name',
  'secondary_requestor_phone',
  'secondary_requestor_email',
  'secondary_requestor_notifications',
];

/** All grouped fields (to skip in the default render loop) */
const GROUPED_FIELDS = new Set([...PRIMARY_REQUESTOR_FIELDS, ...SECONDARY_REQUESTOR_FIELDS]);

export function RequestCreatePage() {
  const navigate = useNavigate();
  const { id } = useParams(); // edit mode if id exists
  const [templates, setTemplates] = useState<RequestTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<(RequestTemplate & { fields: CustomFieldDefinition[] }) | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [existingFileFields, setExistingFileFields] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const templatesRes = await api.get('/templates');
      setTemplates(templatesRes.data.data);

      if (id) {
        const reqRes = await api.get(`/requests/${id}`);
        const req = reqRes.data.data;
        setFieldValues(req.field_values || {});
        setExistingFileFields(req.file_fields || {});

        const tmplRes = await api.get(`/templates/${req.template_id}`);
        setSelectedTemplate(tmplRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function selectTemplate(templateId: number) {
    const res = await api.get(`/templates/${templateId}`);
    setSelectedTemplate(res.data.data);
    setFieldValues({});
  }

  async function handleSubmit(asDraft: boolean) {
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Auto-generate title from command + request type
      const command = fieldValues.command ?? '';
      const requestType = fieldValues.request_type ?? '';
      const title = command && requestType ? `${command} - ${requestType}` : 'New Request';

      // Map priority field value to system priority
      const priorityMap: Record<string, string> = {
        'Critical': 'critical',
        'Essential': 'essential',
        'Enhancing': 'enhancing',
      };
      const priority = priorityMap[fieldValues.priority ?? ''] ?? 'normal';

      if (id) {
        await api.put(`/requests/${id}`, { title, priority, field_values: fieldValues });
        if (!asDraft) {
          await api.post(`/requests/${id}/submit`);
        }
        navigate(`/requests/${id}`);
      } else {
        const res = await api.post('/requests', {
          template_id: selectedTemplate.id,
          title,
          priority,
          field_values: fieldValues,
        });
        if (!asDraft) {
          await api.post(`/requests/${res.data.data.id}/submit`);
        }
        navigate(`/requests/${res.data.data.id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save request');
    } finally {
      setSubmitting(false);
    }
  }

  function renderFieldInput(field: CustomFieldDefinition) {
    if (field.field_type === 'textarea') {
      return (
        <textarea
          value={fieldValues[field.field_name] ?? ''}
          onChange={e => setFieldValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
          placeholder={field.placeholder ?? ''}
          className="input min-h-[120px]"
        />
      );
    }

    if (field.field_type === 'dropdown') {
      return (
        <select
          value={fieldValues[field.field_name] ?? ''}
          onChange={e => setFieldValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
          className="input"
        >
          <option value="">Select...</option>
          {(field.options as string[] || []).map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (field.field_type === 'checkbox') {
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={fieldValues[field.field_name] === 'true'}
            onChange={e => setFieldValues(prev => ({ ...prev, [field.field_name]: String(e.target.checked) }))}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">{field.field_label}</span>
        </label>
      );
    }

    if (field.field_type === 'file') {
      return (
        <FileUploadInput
          fieldName={field.field_name}
          value={fieldValues[field.field_name] ?? ''}
          onChange={(fileId) => setFieldValues(prev => ({ ...prev, [field.field_name]: fileId }))}
          existingFile={existingFileFields[field.field_name]}
        />
      );
    }

    if (field.field_type === 'multi_file') {
      return (
        <MultiFileUploadInput
          fieldName={field.field_name}
          value={fieldValues[field.field_name] ?? ''}
          onChange={(value) => setFieldValues(prev => ({ ...prev, [field.field_name]: value }))}
          existingFiles={existingFileFields[field.field_name]}
          maxFiles={10}
        />
      );
    }

    return (
      <input
        type={
          field.field_type === 'number' || field.field_type === 'currency' ? 'number' :
          field.field_type === 'date' ? 'date' :
          field.field_type === 'email' ? 'email' :
          field.field_type === 'url' ? 'url' : 'text'
        }
        value={fieldValues[field.field_name] ?? ''}
        onChange={e => setFieldValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
        placeholder={field.placeholder ?? ''}
        className="input"
        step={field.field_type === 'currency' ? '0.01' : undefined}
      />
    );
  }

  function renderFieldBlock(field: CustomFieldDefinition) {
    // For checkboxes, the label is in the input itself
    if (field.field_type === 'checkbox') {
      return (
        <div key={field.id}>
          {renderFieldInput(field)}
        </div>
      );
    }
    return (
      <div key={field.id}>
        <label className="label">
          {field.field_label} {field.is_required ? '*' : ''}
        </label>
        {field.help_text && <p className="text-xs text-gray-400 mb-1">{field.help_text}</p>}
        {renderFieldInput(field)}
      </div>
    );
  }

  function renderGroupedFields(fieldNames: string[], groupLabel: string) {
    if (!selectedTemplate?.fields) return null;
    const groupFields = fieldNames
      .map(name => selectedTemplate.fields.find(f => f.field_name === name))
      .filter(Boolean) as CustomFieldDefinition[];

    if (groupFields.length === 0) return null;

    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 pb-2">{groupLabel}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {groupFields.map(field => {
            if (field.field_type === 'checkbox') {
              return (
                <div key={field.id} className="md:col-span-3">
                  {renderFieldInput(field)}
                </div>
              );
            }
            return (
              <div key={field.id}>
                <label className="label">
                  {field.field_label.replace(/^(Primary|Secondary) Requestor - /, '')} {field.is_required ? '*' : ''}
                </label>
                {renderFieldInput(field)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  // Split fields into: before requestor groups, and after
  const beforeGroupFields: CustomFieldDefinition[] = [];
  const afterGroupFields: CustomFieldDefinition[] = [];

  if (selectedTemplate?.fields) {
    for (const field of selectedTemplate.fields) {
      if (GROUPED_FIELDS.has(field.field_name)) continue;
      // Fields before the primary requestor group (sort_order < 5)
      if (field.sort_order < 5) {
        beforeGroupFields.push(field);
      } else {
        afterGroupFields.push(field);
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{id ? 'Edit Request' : 'New Request'}</h1>

      {!id && !selectedTemplate && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Select a Template</h2>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-500">No templates available. An admin needs to create one first.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t.id)}
                  className="text-left p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <p className="font-medium text-gray-900 dark:text-gray-100">{t.name}</p>
                  {t.description && <p className="text-sm text-gray-500 mt-1">{t.description}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedTemplate && (
        <div className="card p-6 space-y-6">
          {!id && (
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">{selectedTemplate.name}</h2>
                {selectedTemplate.description && <p className="text-sm text-gray-500 mt-0.5">{selectedTemplate.description}</p>}
              </div>
              <button onClick={() => setSelectedTemplate(null)} className="text-sm text-blue-600 hover:underline">
                Change template
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm p-3 rounded-lg">{error}</div>
          )}

          {/* Fields before requestor groups (Command, Request Type, Dept, FY, FQ) */}
          {beforeGroupFields.map(field => renderFieldBlock(field))}

          {/* Primary Requestor Group */}
          {renderGroupedFields(PRIMARY_REQUESTOR_FIELDS, 'Primary Requestor')}

          {/* Secondary Requestor Group */}
          {renderGroupedFields(SECONDARY_REQUESTOR_FIELDS, 'Secondary Requestor')}

          {/* Fields after requestor groups (Priority, Description, Date, Documents, custom fields) */}
          {afterGroupFields.map(field => renderFieldBlock(field))}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button onClick={() => navigate(-1)} className="btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button onClick={() => handleSubmit(true)} className="btn-secondary" disabled={submitting}>
              Save as Draft
            </button>
            <button onClick={() => handleSubmit(false)} className="btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
