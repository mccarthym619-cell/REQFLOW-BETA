import { useState, useRef } from 'react';
import { api } from '../../api/client';
import { Paperclip, X, Upload, AlertCircle, Loader2 } from 'lucide-react';

interface UploadedFile {
  id: number;
  original_name: string;
  size_bytes: number;
}

interface MultiFileUploadInputProps {
  fieldName: string;
  /** JSON array of file IDs, e.g. "[1,2,3]" or "" */
  value: string;
  onChange: (value: string) => void;
  existingFiles?: { file_id: number; original_name: string; size_bytes: number }[];
  maxFiles?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MultiFileUploadInput({
  fieldName,
  value,
  onChange,
  existingFiles,
  maxFiles = 10,
}: MultiFileUploadInputProps) {
  // Parse stored file IDs from JSON array string
  const parseFileIds = (val: string): number[] => {
    if (!val) return [];
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const [files, setFiles] = useState<UploadedFile[]>(() => {
    if (existingFiles?.length) {
      return existingFiles.map((f) => ({
        id: f.file_id,
        original_name: f.original_name,
        size_bytes: f.size_bytes,
      }));
    }
    return [];
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function updateValue(updatedFiles: UploadedFile[]) {
    setFiles(updatedFiles);
    if (updatedFiles.length === 0) {
      onChange('');
    } else {
      onChange(JSON.stringify(updatedFiles.map((f) => f.id)));
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files;
    if (!selectedFiles?.length) return;

    const remaining = maxFiles - files.length;
    if (remaining <= 0) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const filesToUpload = Array.from(selectedFiles).slice(0, remaining);
    setError('');
    setUploading(true);

    const newFiles: UploadedFile[] = [];

    for (const file of filesToUpload) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const data = res.data.data;
        newFiles.push({
          id: data.id,
          original_name: data.original_name,
          size_bytes: data.size_bytes,
        });
      } catch (err: any) {
        const msg = err.response?.data?.error?.message || `Failed to upload ${file.name}`;
        setError(msg);
      }
    }

    if (newFiles.length > 0) {
      updateValue([...files, ...newFiles]);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleRemove(fileId: number) {
    const updated = files.filter((f) => f.id !== fileId);
    updateValue(updated);
    setError('');
  }

  const canUploadMore = files.length < maxFiles;

  return (
    <div className="space-y-3">
      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800"
            >
              <Paperclip className="w-4 h-4 text-green-600 shrink-0 dark:text-green-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-900 truncate dark:text-green-300">
                  {file.original_name}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">{formatFileSize(file.size_bytes)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(file.id)}
                className="text-green-600 hover:text-red-600 transition-colors p-1"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {canUploadMore && (
        <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/20">
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              <span className="text-sm text-blue-600 font-medium">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Click to upload files ({files.length}/{maxFiles})
              </span>
              <span className="text-xs text-gray-400">
                PDF, images, Word, Excel, PowerPoint (max 10MB each)
              </span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg,.txt,.csv"
          />
        </label>
      )}

      {/* Max files reached message */}
      {!canUploadMore && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Maximum {maxFiles} files reached. Remove a file to upload a new one.
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
