import { useState, useRef } from 'react';
import { api } from '../../api/client';
import { Paperclip, X, Upload, AlertCircle, Loader2 } from 'lucide-react';

interface FileInfo {
  file_id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

interface FileUploadInputProps {
  fieldName: string;
  value: string; // file ID as string, or ''
  onChange: (fileId: string) => void;
  existingFile?: FileInfo;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploadInput({ fieldName, value, onChange, existingFile }: FileUploadInputProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    id: number;
    original_name: string;
    size_bytes: number;
  } | null>(existingFile ? {
    id: existingFile.file_id,
    original_name: existingFile.original_name,
    size_bytes: existingFile.size_bytes,
  } : null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data.data;
      setUploadedFile({
        id: data.id,
        original_name: data.original_name,
        size_bytes: data.size_bytes,
      });
      onChange(String(data.id));
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Upload failed';
      setError(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleRemove() {
    setUploadedFile(null);
    onChange('');
    setError('');
  }

  // Show uploaded file state
  if (uploadedFile) {
    return (
      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800">
        <Paperclip className="w-4 h-4 text-green-600 shrink-0 dark:text-green-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-900 truncate dark:text-green-300">{uploadedFile.original_name}</p>
          <p className="text-xs text-green-600 dark:text-green-400">{formatFileSize(uploadedFile.size_bytes)}</p>
        </div>
        <button
          type="button"
          onClick={handleRemove}
          className="text-green-600 hover:text-red-600 transition-colors p-1"
          title="Remove file"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Show upload zone
  return (
    <div>
      <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/20">
        {uploading ? (
          <>
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <span className="text-sm text-blue-600 font-medium">Uploading...</span>
          </>
        ) : (
          <>
            <Upload className="w-6 h-6 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Click to upload a file</span>
            <span className="text-xs text-gray-400">PDF, images, Word, Excel, PowerPoint (max 10MB)</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg,.txt,.csv"
        />
      </label>
      {error && (
        <div className="flex items-center gap-1.5 mt-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
