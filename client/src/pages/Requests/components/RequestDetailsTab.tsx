import { Paperclip } from 'lucide-react';
import type { Request as ReqType, CustomFieldDefinition } from '@req-tracker/shared';

interface RequestDetailsTabProps {
  request: ReqType;
  template: { fields: CustomFieldDefinition[] } | null;
}

export function RequestDetailsTab({ request, template }: RequestDetailsTabProps) {
  return (
    <div className="card p-6 space-y-4">
      {template?.fields?.map((field: CustomFieldDefinition) => {
        const value = request.field_values?.[field.field_name];
        const fileInfo = (request as any).file_fields?.[field.field_name];
        return (
          <div key={field.id} className="grid grid-cols-3 gap-4">
            <span className="text-sm font-medium text-gray-500">{field.field_label}</span>
            <span className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
              {field.field_type === 'file' && fileInfo ? (
                <a
                  href={`/api/files/${fileInfo.file_id}/download`}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  {fileInfo.original_name}
                  <span className="text-xs text-gray-400 ml-1">
                    ({fileInfo.size_bytes < 1024 * 1024
                      ? `${(fileInfo.size_bytes / 1024).toFixed(1)} KB`
                      : `${(fileInfo.size_bytes / (1024 * 1024)).toFixed(1)} MB`
                    })
                  </span>
                </a>
              ) : field.field_type === 'multi_file' && Array.isArray(fileInfo) && fileInfo.length > 0 ? (
                <div className="space-y-1.5">
                  {fileInfo.map((f: any) => (
                    <a
                      key={f.file_id}
                      href={`/api/files/${f.file_id}/download`}
                      className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      {f.original_name}
                      <span className="text-xs text-gray-400 ml-1">
                        ({f.size_bytes < 1024 * 1024
                          ? `${(f.size_bytes / 1024).toFixed(1)} KB`
                          : `${(f.size_bytes / (1024 * 1024)).toFixed(1)} MB`
                        })
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                value || <span className="text-gray-300 dark:text-gray-600">--</span>
              )}
            </span>
          </div>
        );
      })}
      {(!template?.fields || template.fields.length === 0) && (
        <p className="text-sm text-gray-500">No custom fields defined for this template.</p>
      )}
    </div>
  );
}
