/** Allowed MIME types — must match server's ALLOWED_MIME_TYPES in server/src/config/uploads.ts */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
];

/** File extensions for the accept attribute (no SVG — server rejects it) */
export const ACCEPT_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv';

export function isAllowedFileType(file: File): boolean {
  return ALLOWED_MIME_TYPES.includes(file.type);
}
