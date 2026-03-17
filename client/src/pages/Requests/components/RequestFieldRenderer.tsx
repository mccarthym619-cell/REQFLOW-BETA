import { FileUploadInput } from '../../../components/shared/FileUploadInput';
import { MultiFileUploadInput } from '../../../components/shared/MultiFileUploadInput';
import type { CustomFieldDefinition } from '@req-tracker/shared';

interface FieldRendererProps {
  field: CustomFieldDefinition;
  value: string;
  onChange: (fieldName: string, value: string) => void;
  existingFile?: any;
}

export function FieldInput({ field, value, onChange, existingFile }: FieldRendererProps) {
  if (field.field_type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={e => onChange(field.field_name, e.target.value)}
        placeholder={field.placeholder ?? ''}
        className="input min-h-[120px]"
      />
    );
  }

  if (field.field_type === 'dropdown') {
    return (
      <select
        value={value}
        onChange={e => onChange(field.field_name, e.target.value)}
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
          checked={value === 'true'}
          onChange={e => onChange(field.field_name, String(e.target.checked))}
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
        value={value}
        onChange={(fileId) => onChange(field.field_name, fileId)}
        existingFile={existingFile}
      />
    );
  }

  if (field.field_type === 'multi_file') {
    return (
      <MultiFileUploadInput
        fieldName={field.field_name}
        value={value}
        onChange={(v) => onChange(field.field_name, v)}
        existingFiles={existingFile}
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
      value={value}
      onChange={e => onChange(field.field_name, e.target.value)}
      placeholder={field.placeholder ?? ''}
      className="input"
      step={field.field_type === 'currency' ? '0.01' : undefined}
    />
  );
}

interface FieldBlockProps {
  field: CustomFieldDefinition;
  value: string;
  onChange: (fieldName: string, value: string) => void;
  existingFile?: any;
}

export function FieldBlock({ field, value, onChange, existingFile }: FieldBlockProps) {
  if (field.field_type === 'checkbox') {
    return (
      <div>
        <FieldInput field={field} value={value} onChange={onChange} existingFile={existingFile} />
      </div>
    );
  }
  return (
    <div>
      <label className="label">
        {field.field_label} {field.is_required ? '*' : ''}
      </label>
      {field.help_text && <p className="text-xs text-gray-400 mb-1">{field.help_text}</p>}
      <FieldInput field={field} value={value} onChange={onChange} existingFile={existingFile} />
    </div>
  );
}

interface GroupedFieldsProps {
  fields: CustomFieldDefinition[];
  fieldNames: string[];
  groupLabel: string;
  values: Record<string, string>;
  onChange: (fieldName: string, value: string) => void;
}

export function GroupedFields({ fields, fieldNames, groupLabel, values, onChange }: GroupedFieldsProps) {
  const groupFields = fieldNames
    .map(name => fields.find(f => f.field_name === name))
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
                <FieldInput field={field} value={values[field.field_name] ?? ''} onChange={onChange} />
              </div>
            );
          }
          return (
            <div key={field.id}>
              <label className="label">
                {field.field_label.replace(/^(Primary|Secondary) Requestor - /, '')} {field.is_required ? '*' : ''}
              </label>
              <FieldInput field={field} value={values[field.field_name] ?? ''} onChange={onChange} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
