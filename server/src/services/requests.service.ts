import { getDb } from '../database/connection';
import { createAuditEntry, diffAndAuditFields } from './audit.service';
import { generateReferenceNumber, generateDraftReferenceNumber } from '../utils/referenceNumber';
import { getTemplateById } from './templates.service';
import { createNotification } from './notifications.service';
import * as filesService from './files.service';
import { isValidTransition } from '@req-tracker/shared';
import { AppError } from '../middleware/errorHandler';
import type { Request as ReqType, CreateRequestPayload, UpdateRequestPayload, RequestStatus } from '@req-tracker/shared';

export function getRequests(filters: {
  status?: string;
  templateId?: number;
  submittedBy?: number;
  search?: string;
  page?: number;
  perPage?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}): { requests: ReqType[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    conditions.push('r.status = ?');
    params.push(filters.status);
  }
  if (filters.templateId) {
    conditions.push('r.template_id = ?');
    params.push(filters.templateId);
  }
  if (filters.submittedBy) {
    conditions.push('r.submitted_by = ?');
    params.push(filters.submittedBy);
  }
  if (filters.search) {
    conditions.push('(r.title LIKE ? OR r.reference_number LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 20;
  const offset = (page - 1) * perPage;
  const sort = filters.sort ?? 'created_at';
  const order = filters.order ?? 'desc';

  const allowedSorts = ['created_at', 'updated_at', 'title', 'status', 'priority', 'reference_number'];
  const safeSort = allowedSorts.includes(sort) ? sort : 'created_at';

  const total = (db.prepare(`SELECT COUNT(*) as count FROM requests r ${where}`).get(...params) as { count: number }).count;

  const requests = db.prepare(`
    SELECT r.*, t.name as template_name, u.display_name as submitter_name
    FROM requests r
    LEFT JOIN request_templates t ON t.id = r.template_id
    LEFT JOIN users u ON u.id = r.submitted_by
    ${where}
    ORDER BY r.${safeSort} ${order === 'asc' ? 'ASC' : 'DESC'}
    LIMIT ? OFFSET ?
  `).all(...params, perPage, offset) as ReqType[];

  return { requests, total };
}

export function getRequestById(id: number): ReqType | undefined {
  const db = getDb();
  const request = db.prepare(`
    SELECT r.*, t.name as template_name, u.display_name as submitter_name
    FROM requests r
    LEFT JOIN request_templates t ON t.id = r.template_id
    LEFT JOIN users u ON u.id = r.submitted_by
    WHERE r.id = ?
  `).get(id) as ReqType | undefined;

  if (request) {
    // Load custom field values (include field_type to detect file fields)
    const fieldValues = db.prepare(`
      SELECT cfd.field_name, cfd.field_type, cfv.field_value
      FROM custom_field_values cfv
      JOIN custom_field_definitions cfd ON cfd.id = cfv.field_def_id
      WHERE cfv.request_id = ?
    `).all(id) as { field_name: string; field_type: string; field_value: string }[];

    request.field_values = {};
    (request as any).file_fields = {};
    for (const fv of fieldValues) {
      request.field_values[fv.field_name] = fv.field_value;
      // For file fields, look up the uploaded_files record to provide metadata
      if (fv.field_type === 'file' && fv.field_value) {
        const fileRecord = filesService.getFileById(parseInt(fv.field_value, 10));
        if (fileRecord) {
          (request as any).file_fields[fv.field_name] = {
            file_id: fileRecord.id,
            original_name: fileRecord.original_name,
            mime_type: fileRecord.mime_type,
            size_bytes: fileRecord.size_bytes,
          };
        }
      }
      // For multi_file fields, look up all file IDs in the JSON array
      if (fv.field_type === 'multi_file' && fv.field_value) {
        try {
          const fileIds: number[] = JSON.parse(fv.field_value);
          const fileRecords = fileIds.map((fileId) => {
            const rec = filesService.getFileById(fileId);
            return rec ? {
              file_id: rec.id,
              original_name: rec.original_name,
              mime_type: rec.mime_type,
              size_bytes: rec.size_bytes,
            } : null;
          }).filter(Boolean);
          (request as any).file_fields[fv.field_name] = fileRecords;
        } catch { /* ignore parse errors */ }
      }
    }
  }

  return request;
}

export function createRequest(payload: CreateRequestPayload, userId: number): ReqType {
  const db = getDb();
  const template = getTemplateById(payload.template_id);
  if (!template) throw new AppError(400, 'INVALID_TEMPLATE', 'Template not found');

  // Use a draft reference number; final ref will be generated on submit
  const refNum = generateDraftReferenceNumber();

  // Derive priority from field values if present (standard field 'priority')
  const priorityField = payload.field_values?.priority;
  const priority = priorityField ? priorityField.toLowerCase() as any : (payload.priority ?? 'normal');

  // Auto-generate title from command + request type if available
  const command = payload.field_values?.command ?? '';
  const requestType = payload.field_values?.request_type ?? '';
  const title = payload.title || (command && requestType ? `${command} - ${requestType}` : 'New Request');

  const result = db.transaction(() => {
    const res = db.prepare(`
      INSERT INTO requests (reference_number, template_id, submitted_by, title, priority, status)
      VALUES (?, ?, ?, ?, ?, 'draft')
    `).run(refNum, payload.template_id, userId, title, priority);

    const requestId = res.lastInsertRowid as number;

    // Save custom field values
    if (payload.field_values) {
      const insertValue = db.prepare(`
        INSERT INTO custom_field_values (request_id, field_def_id, field_value, file_path)
        VALUES (?, ?, ?, ?)
      `);
      for (const field of template.fields) {
        const value = payload.field_values[field.field_name];
        if (value !== undefined) {
          let filePath: string | null = null;
          if (field.field_type === 'file' && value) {
            const fileRecord = filesService.getFileById(parseInt(value, 10));
            if (fileRecord) {
              filePath = fileRecord.stored_name;
              filesService.linkFileToRequest(fileRecord.id, requestId, field.id);
            }
          }
          // Handle multi_file: link all files in JSON array
          if (field.field_type === 'multi_file' && value) {
            try {
              const fileIds: number[] = JSON.parse(value);
              for (const fileId of fileIds) {
                const fileRecord = filesService.getFileById(fileId);
                if (fileRecord) {
                  filesService.linkFileToRequest(fileRecord.id, requestId, field.id);
                }
              }
            } catch { /* ignore parse errors */ }
          }
          insertValue.run(requestId, field.id, value, filePath);
        }
      }
    }

    createAuditEntry({
      entityType: 'request',
      entityId: requestId,
      requestId: requestId,
      action: 'created',
      newValue: { title, template: template.name, reference_number: refNum },
      performedBy: userId,
    });

    return requestId;
  })();

  return getRequestById(result as number)!;
}

export function updateRequest(id: number, payload: UpdateRequestPayload, userId: number): ReqType | undefined {
  const db = getDb();
  const existing = getRequestById(id);
  if (!existing) return undefined;

  if (existing.status !== 'draft' && existing.status !== 'returned') {
    throw new AppError(400, 'INVALID_STATE', 'Can only edit draft or returned requests');
  }

  db.transaction(() => {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (payload.title !== undefined) { updates.push('title = ?'); values.push(payload.title); }
    if (payload.priority !== undefined) { updates.push('priority = ?'); values.push(payload.priority); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE requests SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    // Update field values
    if (payload.field_values) {
      const template = getTemplateById(existing.template_id);
      if (template) {
        const oldValues = existing.field_values ?? {};
        const upsertValue = db.prepare(`
          INSERT INTO custom_field_values (request_id, field_def_id, field_value, file_path)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(request_id, field_def_id) DO UPDATE SET field_value = excluded.field_value, file_path = excluded.file_path, updated_at = datetime('now')
        `);
        for (const field of template.fields) {
          const value = payload.field_values[field.field_name];
          if (value !== undefined) {
            let filePath: string | null = null;
            if (field.field_type === 'file' && value) {
              const fileRecord = filesService.getFileById(parseInt(value, 10));
              if (fileRecord) {
                filePath = fileRecord.stored_name;
                filesService.linkFileToRequest(fileRecord.id, id, field.id);
              }
            }
            // Handle multi_file: link all files in JSON array
            if (field.field_type === 'multi_file' && value) {
              try {
                const fileIds: number[] = JSON.parse(value);
                for (const fileId of fileIds) {
                  const fileRecord = filesService.getFileById(fileId);
                  if (fileRecord) {
                    filesService.linkFileToRequest(fileRecord.id, id, field.id);
                  }
                }
              } catch { /* ignore parse errors */ }
            }
            upsertValue.run(id, field.id, value, filePath);
          }
        }

        // Audit field changes
        diffAndAuditFields('request', id, id, oldValues, payload.field_values, userId);
      }
    }

    if (payload.title && payload.title !== existing.title) {
      createAuditEntry({
        entityType: 'request',
        entityId: id,
        requestId: id,
        action: 'field_changed',
        fieldName: 'title',
        oldValue: existing.title,
        newValue: payload.title,
        performedBy: userId,
      });
    }
  })();

  return getRequestById(id);
}

export function submitRequest(id: number, userId: number): ReqType {
  const db = getDb();
  const request = getRequestById(id);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');
  if (request.submitted_by !== userId) throw new AppError(403, 'FORBIDDEN', 'Only the requester can submit');

  if (!isValidTransition(request.status, 'submitted')) {
    throw new AppError(400, 'INVALID_STATE', `Cannot submit from ${request.status} status`);
  }

  const template = getTemplateById(request.template_id);
  if (!template) throw new AppError(500, 'INTERNAL', 'Template not found');

  db.transaction(() => {
    const now = new Date().toISOString().replace('T', ' ').split('.')[0];
    const submitDate = new Date();

    // Generate final reference number from command + request type
    const command = request.field_values?.command ?? '';
    const requestType = request.field_values?.request_type ?? '';
    let finalRefNum = request.reference_number;

    if (command && requestType) {
      finalRefNum = generateReferenceNumber(command, requestType, submitDate);
      db.prepare('UPDATE requests SET reference_number = ?, title = ? WHERE id = ?').run(finalRefNum, finalRefNum, id);
    }

    // Calculate SLA deadline
    const slaHours = parseInt(
      (db.prepare("SELECT value FROM system_settings WHERE key = 'sla_default_hours'").get() as { value: string })?.value ?? '72',
      10
    );
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0];

    if (template.approval_chain.length === 0) {
      // No approval chain -> auto-approve
      db.prepare(`
        UPDATE requests SET status = 'approved', submitted_at = ?, completed_at = ?, sla_deadline = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(now, now, slaDeadline, id);

      createAuditEntry({
        entityType: 'request',
        entityId: id,
        requestId: id,
        action: 'submitted',
        performedBy: userId,
      });
      createAuditEntry({
        entityType: 'request',
        entityId: id,
        requestId: id,
        action: 'status_changed',
        oldValue: request.status,
        newValue: 'approved',
        performedBy: userId,
        metadata: { reason: 'No approval chain configured' },
      });
    } else {
      // Create approval steps
      const insertStep = db.prepare(`
        INSERT INTO request_approval_steps (request_id, chain_step_id, step_order, status, assigned_to)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const step of template.approval_chain) {
        let assignedTo: number | null = null;
        if (step.approver_type === 'specific_user') {
          assignedTo = step.approver_user_id;
        } else if (step.approver_type === 'role' && step.approver_role) {
          // Find first active user with the role
          const user = db.prepare('SELECT id FROM users WHERE role = ? AND is_active = 1 LIMIT 1').get(step.approver_role) as { id: number } | undefined;
          assignedTo = user?.id ?? null;
        }
        const status = step.step_order === template.approval_chain[0].step_order ? 'active' : 'pending';
        insertStep.run(id, step.id, step.step_order, status, assignedTo);
      }

      db.prepare(`
        UPDATE requests SET status = 'pending_approval', submitted_at = ?, current_step_order = ?, sla_deadline = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(now, template.approval_chain[0].step_order, slaDeadline, id);

      createAuditEntry({
        entityType: 'request',
        entityId: id,
        requestId: id,
        action: 'submitted',
        performedBy: userId,
      });
      createAuditEntry({
        entityType: 'request',
        entityId: id,
        requestId: id,
        action: 'status_changed',
        oldValue: request.status,
        newValue: 'pending_approval',
        performedBy: userId,
      });

      // Notify first approver
      const firstStep = db.prepare(`
        SELECT ras.*, acs.step_name FROM request_approval_steps ras
        JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
        WHERE ras.request_id = ? AND ras.status = 'active'
      `).get(id) as { assigned_to: number; step_name: string } | undefined;

      if (firstStep?.assigned_to) {
        createNotification({
          userId: firstStep.assigned_to,
          requestId: id,
          type: 'approval_needed',
          title: 'Approval Required',
          message: `Request ${request.reference_number} "${request.title}" requires your approval (${firstStep.step_name})`,
          actionUrl: `/requests/${id}`,
        });
      }
    }
  })();

  return getRequestById(id)!;
}

export function cancelRequest(id: number, userId: number): ReqType {
  const db = getDb();
  const request = getRequestById(id);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');

  // Only the requester who submitted it (or admin) can cancel
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string } | undefined;
  if (request.submitted_by !== userId && user?.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Only the requester or an admin can cancel this request');
  }

  if (!isValidTransition(request.status, 'cancelled')) {
    throw new AppError(400, 'INVALID_STATE', `Cannot cancel from ${request.status} status`);
  }

  db.prepare("UPDATE requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(id);

  createAuditEntry({
    entityType: 'request',
    entityId: id,
    requestId: id,
    action: 'cancelled',
    oldValue: request.status,
    newValue: 'cancelled',
    performedBy: userId,
  });

  return getRequestById(id)!;
}

export function completeRequest(id: number, userId: number, trackingComment?: string): ReqType {
  const db = getDb();
  const request = getRequestById(id);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');

  if (!isValidTransition(request.status, 'completed')) {
    throw new AppError(400, 'INVALID_STATE', `Cannot complete from ${request.status} status`);
  }

  db.transaction(() => {
    const now = new Date().toISOString().replace('T', ' ').split('.')[0];
    db.prepare("UPDATE requests SET status = 'completed', completed_at = ?, updated_at = datetime('now') WHERE id = ?").run(now, id);

    createAuditEntry({
      entityType: 'request',
      entityId: id,
      requestId: id,
      action: 'completed',
      oldValue: request.status,
      newValue: 'completed',
      performedBy: userId,
      metadata: trackingComment ? { tracking_comment: trackingComment } : undefined,
    });

    // Save tracking comment as a comment on the request
    if (trackingComment) {
      db.prepare(`
        INSERT INTO comments (request_id, user_id, body, is_internal)
        VALUES (?, ?, ?, 0)
      `).run(id, userId, `[Purchase Complete] ${trackingComment}`);
    }

    createNotification({
      userId: request.submitted_by,
      requestId: id,
      type: 'status_changed',
      title: 'Purchase Complete',
      message: `Request ${request.reference_number} "${request.title}" has been marked as purchase complete${trackingComment ? `: ${trackingComment}` : ''}`,
      actionUrl: `/requests/${id}`,
    });
  })();

  return getRequestById(id)!;
}

export function markReviewed(id: number, userId: number, notes?: string): void {
  const db = getDb();
  const request = getRequestById(id);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');

  db.transaction(() => {
    createAuditEntry({
      entityType: 'request',
      entityId: id,
      requestId: id,
      action: 'reviewed',
      performedBy: userId,
      metadata: notes ? { notes } : undefined,
    });

    // Save review as a comment
    if (notes) {
      db.prepare(`
        INSERT INTO comments (request_id, user_id, body, is_internal)
        VALUES (?, ?, ?, 0)
      `).run(id, userId, `[Reviewed] ${notes}`);
    } else {
      db.prepare(`
        INSERT INTO comments (request_id, user_id, body, is_internal)
        VALUES (?, ?, ?, 0)
      `).run(id, userId, '[Reviewed] Marked as reviewed');
    }

    createNotification({
      userId: request.submitted_by,
      requestId: id,
      type: 'status_changed',
      title: 'Request Reviewed',
      message: `Request ${request.reference_number} "${request.title}" has been reviewed${notes ? `: ${notes}` : ''}`,
      actionUrl: `/requests/${id}`,
    });
  })();
}

export function reviewReturn(id: number, userId: number, notes?: string): void {
  const db = getDb();
  const request = getRequestById(id);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');

  if (!isValidTransition(request.status, 'returned')) {
    throw new AppError(400, 'INVALID_STATE', `Cannot return from ${request.status} status`);
  }

  db.transaction(() => {
    db.prepare("UPDATE requests SET status = 'returned', updated_at = datetime('now') WHERE id = ?").run(id);

    createAuditEntry({
      entityType: 'request',
      entityId: id,
      requestId: id,
      action: 'returned',
      oldValue: request.status,
      newValue: 'returned',
      performedBy: userId,
      metadata: notes ? { notes } : undefined,
    });

    // Save return reason as a comment
    db.prepare(`
      INSERT INTO comments (request_id, user_id, body, is_internal)
      VALUES (?, ?, ?, 0)
    `).run(id, userId, `[Returned by Reviewer] ${notes || 'Returned for revision'}`);

    createNotification({
      userId: request.submitted_by,
      requestId: id,
      type: 'status_changed',
      title: 'Request Returned by Reviewer',
      message: `Request ${request.reference_number} "${request.title}" has been returned by a reviewer${notes ? `: ${notes}` : ''}`,
      actionUrl: `/requests/${id}`,
    });
  })();
}

export function markContractAwarded(id: number, userId: number, comment?: string, documentUrl?: string): void {
  const db = getDb();
  const request = getRequestById(id);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');

  db.transaction(() => {
    createAuditEntry({
      entityType: 'request',
      entityId: id,
      requestId: id,
      action: 'contract_awarded',
      performedBy: userId,
      metadata: {
        ...(comment ? { comment } : {}),
        ...(documentUrl ? { document_url: documentUrl } : {}),
      },
    });

    // Save as a comment with contract details
    const parts: string[] = ['[Contract Awarded]'];
    if (comment) parts.push(comment);
    if (documentUrl) parts.push(`Document: ${documentUrl}`);

    db.prepare(`
      INSERT INTO comments (request_id, user_id, body, is_internal)
      VALUES (?, ?, ?, 0)
    `).run(id, userId, parts.join(' '));

    createNotification({
      userId: request.submitted_by,
      requestId: id,
      type: 'status_changed',
      title: 'Contract Awarded',
      message: `Contract has been awarded for request ${request.reference_number} "${request.title}"${comment ? `: ${comment}` : ''}`,
      actionUrl: `/requests/${id}`,
    });
  })();
}
