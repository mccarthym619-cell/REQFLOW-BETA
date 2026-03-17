import { getDb } from '../database/connection';
import { AppError } from '../middleware/errorHandler';
import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from '../config/uploads';

export interface UploadedFile {
  id: number;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: number;
  request_id: number | null;
  field_def_id: number | null;
  created_at: string;
}

export function createFileRecord(data: {
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: number;
}): UploadedFile {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO uploaded_files (original_name, stored_name, mime_type, size_bytes, uploaded_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.originalName, data.storedName, data.mimeType, data.sizeBytes, data.uploadedBy);

  return getFileById(result.lastInsertRowid as number)!;
}

export function getFileById(id: number): UploadedFile | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM uploaded_files WHERE id = ?').get(id) as UploadedFile | undefined;
}

export function getFilesByIds(ids: number[]): UploadedFile[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM uploaded_files WHERE id IN (${placeholders})`).all(...ids) as UploadedFile[];
}

export function linkFileToRequest(fileId: number, requestId: number, fieldDefId: number): void {
  const db = getDb();
  db.prepare('UPDATE uploaded_files SET request_id = ?, field_def_id = ? WHERE id = ?')
    .run(requestId, fieldDefId, fileId);
}

export function getFilePath(file: UploadedFile): string {
  return path.join(UPLOADS_DIR, file.stored_name);
}

export function deleteFile(id: number): void {
  const db = getDb();
  const file = getFileById(id);
  if (!file) return;

  // Delete from filesystem
  const filePath = path.join(UPLOADS_DIR, file.stored_name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Delete from database
  db.prepare('DELETE FROM uploaded_files WHERE id = ?').run(id);
}
