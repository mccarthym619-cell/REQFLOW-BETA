import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { useTemplates, useTemplate } from '../../api/queries/useTemplates';
import { useRequest } from '../../api/queries/useRequest';
import { useCreateRequest, useUpdateRequest } from '../../api/mutations/useCreateRequest';
import { FieldBlock, GroupedFields } from './components/RequestFieldRenderer';
import type { CustomFieldDefinition } from '@req-tracker/shared';

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [existingFileFields, setExistingFileFields] = useState<Record<string, any>>({});
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState('');

  const templatesQuery = useTemplates();
  const templates = templatesQuery.data ?? [];

  // In edit mode, load the existing request
  const requestQuery = useRequest(id);
  const editRequest = requestQuery.request;

  // Initialize field values from existing request (edit mode)
  if (id && editRequest && !initialized) {
    setFieldValues(editRequest.field_values || {});
    setExistingFileFields((editRequest as any).file_fields || {});
    setSelectedTemplateId(editRequest.template_id);
    setInitialized(true);
  }

  const templateQuery = useTemplate(selectedTemplateId);
  const selectedTemplate = templateQuery.data ?? null;

  const createRequest = useCreateRequest();
  const updateRequest = useUpdateRequest(id);

  const submitting = createRequest.isPending || updateRequest.isPending;
  const loading = templatesQuery.isLoading || (id ? requestQuery.isLoading : false);

  function handleFieldChange(fieldName: string, value: string) {
    setFieldValues(prev => ({ ...prev, [fieldName]: value }));
  }

  function handleSubmit(asDraft: boolean) {
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }

    setError('');

    const command = fieldValues.command ?? '';
    const requestType = fieldValues.request_type ?? '';
    const title = command && requestType ? `${command} - ${requestType}` : 'New Request';

    const priorityMap: Record<string, string> = {
      'Critical': 'critical',
      'Essential': 'essential',
      'Enhancing': 'enhancing',
    };
    const priority = priorityMap[fieldValues.priority ?? ''] ?? 'normal';

    if (id) {
      updateRequest.mutate(
        { data: { title, priority, field_values: fieldValues }, submitAfter: !asDraft },
        {
          onSuccess: () => navigate(`/requests/${id}`),
          onError: (err: any) => setError(err.response?.data?.error?.message || 'Failed to save request'),
        },
      );
    } else {
      createRequest.mutate(
        { data: { template_id: selectedTemplate.id, title, priority, field_values: fieldValues }, submitAfter: !asDraft },
        {
          onSuccess: (requestId) => navigate(`/requests/${requestId}`),
          onError: (err: any) => setError(err.response?.data?.error?.message || 'Failed to save request'),
        },
      );
    }
  }

  if (loading) return <LoadingSpinner />;

  // Split fields into: before requestor groups, and after
  const beforeGroupFields: CustomFieldDefinition[] = [];
  const afterGroupFields: CustomFieldDefinition[] = [];

  if (selectedTemplate?.fields) {
    for (const field of selectedTemplate.fields) {
      if (GROUPED_FIELDS.has(field.field_name)) continue;
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
                  onClick={() => { setSelectedTemplateId(t.id); setFieldValues({}); }}
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
              <button onClick={() => setSelectedTemplateId(null)} className="text-sm text-blue-600 hover:underline">
                Change template
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm p-3 rounded-lg">{error}</div>
          )}

          {beforeGroupFields.map(field => (
            <FieldBlock
              key={field.id}
              field={field}
              value={fieldValues[field.field_name] ?? ''}
              onChange={handleFieldChange}
              existingFile={existingFileFields[field.field_name]}
            />
          ))}

          {selectedTemplate.fields && (
            <GroupedFields
              fields={selectedTemplate.fields}
              fieldNames={PRIMARY_REQUESTOR_FIELDS}
              groupLabel="Primary Requestor"
              values={fieldValues}
              onChange={handleFieldChange}
            />
          )}

          {selectedTemplate.fields && (
            <GroupedFields
              fields={selectedTemplate.fields}
              fieldNames={SECONDARY_REQUESTOR_FIELDS}
              groupLabel="Secondary Requestor"
              values={fieldValues}
              onChange={handleFieldChange}
            />
          )}

          {afterGroupFields.map(field => (
            <FieldBlock
              key={field.id}
              field={field}
              value={fieldValues[field.field_name] ?? ''}
              onChange={handleFieldChange}
              existingFile={existingFileFields[field.field_name]}
            />
          ))}

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
