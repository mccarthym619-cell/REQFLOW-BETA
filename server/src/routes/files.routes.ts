import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR, MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from '../config/uploads';
import * as filesService from '../services/files.service';
import { AppError } from '../middleware/errorHandler';
import { hasPermission } from '@req-tracker/shared';
import { getDb } from '../database/connection';

const router = Router();

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const storedName = `${crypto.randomUUID()}${ext}`;
    cb(null, storedName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'INVALID_FILE_TYPE',
        `File type ${file.mimetype} is not allowed. Allowed: PDF, images, Word, Excel, PowerPoint, CSV, plain text.`) as any);
    }
  },
});

/**
 * Check if the current user can access a file.
 * Allowed if: user uploaded the file, user has view_all permission,
 * or the file is linked to a request the user submitted.
 */
function assertFileAccess(file: filesService.UploadedFile, req: Request): void {
  const user = req.user!;

  // Admin or file uploader can always access
  if (user.role === 'admin' || file.uploaded_by === user.id) return;

  // Users with view_all can access any file
  if (hasPermission(user.role, 'requests.view_all')) return;

  // If file is linked to a request, check if user owns that request
  if (file.request_id) {
    const db = getDb();
    const request = db.prepare('SELECT submitted_by FROM requests WHERE id = ?').get(file.request_id) as { submitted_by: number } | undefined;
    if (request && request.submitted_by === user.id) return;
  }

  throw new AppError(403, 'FORBIDDEN', 'You do not have access to this file');
}

// POST /api/files/upload — upload a single file
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError(400, 'NO_FILE', 'No file was uploaded');
  }

  const record = filesService.createFileRecord({
    originalName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    uploadedBy: req.user!.id,
  });

  res.status(201).json({
    data: {
      id: record.id,
      original_name: record.original_name,
      mime_type: record.mime_type,
      size_bytes: record.size_bytes,
    },
  });
});

// GET /api/files/:id/download — download a file
router.get('/:id/download', (req: Request, res: Response) => {
  const fileId = parseInt(req.params.id, 10);
  const file = filesService.getFileById(fileId);

  if (!file) {
    throw new AppError(404, 'NOT_FOUND', 'File not found');
  }

  assertFileAccess(file, req);

  const filePath = filesService.getFilePath(file);

  if (!fs.existsSync(filePath)) {
    throw new AppError(404, 'FILE_MISSING', 'File not found on disk');
  }

  res.setHeader('Content-Type', file.mime_type);
  // Force download (attachment) to prevent inline rendering of potentially dangerous content
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
  res.setHeader('Content-Length', file.size_bytes.toString());
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(filePath).pipe(res);
});

// GET /api/files/:id — get file metadata
router.get('/:id', (req: Request, res: Response) => {
  const fileId = parseInt(req.params.id, 10);
  const file = filesService.getFileById(fileId);

  if (!file) {
    throw new AppError(404, 'NOT_FOUND', 'File not found');
  }

  assertFileAccess(file, req);

  res.json({
    data: {
      id: file.id,
      original_name: file.original_name,
      mime_type: file.mime_type,
      size_bytes: file.size_bytes,
      created_at: file.created_at,
    },
  });
});

// DELETE /api/files/:id — delete a file (admin or uploader only)
router.delete('/:id', (req: Request, res: Response) => {
  const fileId = parseInt(req.params.id, 10);
  const file = filesService.getFileById(fileId);

  if (!file) {
    throw new AppError(404, 'NOT_FOUND', 'File not found');
  }

  if (file.uploaded_by !== req.user!.id && req.user!.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'You can only delete your own uploads');
  }

  filesService.deleteFile(fileId);
  res.json({ data: { success: true } });
});

export default router;
