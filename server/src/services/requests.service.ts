import { getDb } from '../database/connection';
import { createAuditEntry, diffAndAuditFields } from './audit.service';
import { generateReferenceNumber, generateDraftReferenceNumber } from '../utils/referenceNumber';
import { getTemplateById } from './templates.service';
import { createNotification } from './notifications.service';
import * as filesService from './files.service';
import { isValidTransition } from '@req-tracker/shared';
import { AppError } from '../middleware/errorHandler';
import { formatDateForDb } from '../utils/dateFormat';
import { validateFieldValue } from '../utils/fieldValidation';
import { logger } from '../config/logger';
import type { Request as ReqType, CreateRequestPayload, UpdateRequestPayload, RequestStatus, ApprovalChainStep, LegacyStepCondition } from '@req-tracker/shared';
import type Database from 'better-sqlite3';
import { resolveNextSteps } from './routing.service';
import { dispatchPendingActions, onRequestClosed } from './pending-actions.service';

/**
 * Evaluate a step condition against request field values.
 * Returns true if the step should be included (condition met or no condition).
 */
function evaluateStepCondition(conditionJson: string | null, fieldValues: Record<string, string>): boolean {
  if (!conditionJson) return true;
  try {
    const cond: LegacyStepCondition = JSON.parse(conditionJson);
    const actual = fieldValues[cond.field];
    switch (cond.operator) {
      case 'equals': return actual === cond.value;
      case 'not_equals': return actual !== cond.value;
      case 'in': return cond.values?.includes(actual) ?? false;
      case 'not_in': return !(cond.values?.includes(actual) ?? false);
      default: return true;
    }
  } catch {
    return true;
  }
}

/**
 * Resolve the assigned approver for an approval chain step.
 * Supports 'specific_user', 'role', and 'role_by_command'.
 */
function resolveApprover(db: Database.Database, step: ApprovalChainStep, fieldValues: Record<string, string>): number | null {
  if (step.approver_type === 'specific_user') {
    return step.approver_user_id;
  }

  if (step.approver_type === 'role' && step.approver_role) {
    const user = db.prepare('SELECT id FROM users WHERE role = ? AND is_active = 1 LIMIT 1').get(step.approver_role) as { id: number } | undefined;
    return user?.id ?? null;
  }

  if (step.approver_type === 'role_by_command' && step.approver_role) {
    const requestCommand = fieldValues.command;
    if (requestCommand) {
      const cmd = db.prepare('SELECT id FROM commands WHERE name = ?').get(requestCommand) as { id: number } | undefined;
      if (cmd) {
        // Try to find a user with the role in the request's command
        const user = db.prepare('SELECT id FROM users WHERE role = ? AND command_id = ? AND is_active = 1 LIMIT 1').get(step.approver_role, cmd.id) as { id: number } | undefined;
        if (user) return user.id;

        // Fall back to parent command (NSWG-8) user
        const parentUser = db.prepare(`
          SELECT u.id FROM users u
          JOIN commands c ON c.id = u.command_id
          WHERE u.role = ? AND c.is_parent = 1 AND u.is_active = 1
          LIMIT 1
        `).get(step.approver_role) as { id: number } | undefined;
        return parentUser?.id ?? null;
      }
    }
    // Fallback: any user with the role
    const user = db.prepare('SELECT id FROM users WHERE role = ? AND is_active = 1 LIMIT 1').get(step.approver_role) as { id: number } | undefined;
    return user?.id ?? null;
  }

  return null;
}

export function getRequests(filters: {
  status?: string;
  templateId?: number;
  submittedBy?: number;
  search?: string;
  command?: string;
  page?: number;
  perPage?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  userRole?: string;
  userId?: number;
}): { requests: ReqType[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  // All users can see all requests (visibility is not restricted by role)
  if (filters.submittedBy) {
    conditions.push('r.submitted_by = ?');
    params.push(filters.submittedBy);
  }

  if (filters.status) {
    conditions.push('r.status = ?');
    params.push(filters.status);
  }
  if (filters.templateId) {
    conditions.push('r.template_id = ?');
    params.push(filters.templateId);
  }
  if (filters.search) {
    conditions.push('(r.title LIKE ? OR r.reference_number LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.command) {
    conditions.push(`r.id IN (
      SELECT cfv.request_id FROM custom_field_values cfv
      JOIN custom_field_definitions cfd ON cfd.id = cfv.field_def_id
      WHERE cfd.field_name = 'command' AND cfv.field_value = ?
    )`);
    params.push(filters.command);
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

    // Collect all file IDs for batch fetching (avoid N+1 queries)
    const allFileIds: number[] = [];
    for (const fv of fieldValues) {
      if (fv.field_type === 'file' && fv.field_value) {
        const parsed = parseInt(fv.field_value, 10);
        if (!isNaN(parsed)) allFileIds.push(parsed);
      }
      if (fv.field_type === 'multi_file' && fv.field_value) {
        try {
          const ids: number[] = JSON.parse(fv.field_value);
          allFileIds.push(...ids);
        } catch {
          logger.warn({ requestId: id, fieldName: fv.field_name }, 'Failed to parse multi_file field value as JSON');
        }
      }
    }
    const fileRecords = filesService.getFilesByIds(allFileIds);
    const fileMap = new Map(fileRecords.map(f => [f.id, f]));

    request.field_values = {};
    (request as any).file_fields = {};
    for (const fv of fieldValues) {
      request.field_values[fv.field_name] = fv.field_value;
      if (fv.field_type === 'file' && fv.field_value) {
        const rec = fileMap.get(parseInt(fv.field_value, 10));
        if (rec) {
          (request as any).file_fields[fv.field_name] = {
            file_id: rec.id,
            original_name: rec.original_name,
            mime_type: rec.mime_type,
            size_bytes: rec.size_bytes,
          };
        }
      }
      if (fv.field_type === 'multi_file' && fv.field_value) {
        try {
          const fileIds: number[] = JSON.parse(fv.field_value);
          const records = fileIds
            .map(fid => fileMap.get(fid))
            .filter(Boolean)
            .map(rec => ({
              file_id: rec!.id,
              original_name: rec!.original_name,
              mime_type: rec!.mime_type,
              size_bytes: rec!.size_bytes,
            }));
          (request as any).file_fields[fv.field_name] = records;
        } catch {
          logger.warn({ requestId: id, fieldName: fv.field_name }, 'Failed to parse multi_file field value as JSON');
        }
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
          validateFieldValue(field.field_type, value, field.field_name, field.options ? JSON.stringify(field.options) : null);

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
            } catch (err) { logger.warn({ fieldName: field.field_name, err }, 'Failed to parse multi_file field value'); }
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
            validateFieldValue(field.field_type, value, field.field_name, field.options ? JSON.stringify(field.options) : null);

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
              } catch (err) { logger.warn({ fieldName: field.field_name, err }, 'Failed to parse multi_file field value'); }
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
  if (!template.is_active) throw new AppError(400, 'INVALID_TEMPLATE', 'Template is no longer active');

  db.transaction(() => {
    const submitDate = new Date();
    const now = formatDateForDb(submitDate);

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
    const slaDeadline = formatDateForDb(new Date(Date.now() + slaHours * 60 * 60 * 1000));

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
      // Filter steps by condition evaluation
      const fieldValues = request.field_values ?? {};
      const applicableSteps = template.approval_chain.filter(step =>
        evaluateStepCondition(step.condition, fieldValues)
      );

      if (applicableSteps.length === 0) {
        // All steps filtered out by conditions -> auto-approve
        db.prepare(`
          UPDATE requests SET status = 'approved', submitted_at = ?, completed_at = ?, sla_deadline = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(now, now, slaDeadline, id);

        createAuditEntry({ entityType: 'request', entityId: id, requestId: id, action: 'submitted', performedBy: userId });
        createAuditEntry({ entityType: 'request', entityId: id, requestId: id, action: 'status_changed', oldValue: request.status, newValue: 'approved', performedBy: userId, metadata: { reason: 'All approval steps filtered by conditions' } });
      } else {
        // Check if this is a re-submit after RETURN (resume at returned_from_step)
        const isResubmit = request.returned_from_step != null;
        const resumeFromStep = request.returned_from_step;

        if (isResubmit) {
          // Re-submit: reset returned step to pending, then activate it
          // Steps before returned_from_step stay as approved (already completed)
          db.prepare(`
            UPDATE request_approval_steps SET status = 'pending', updated_at = datetime('now')
            WHERE request_id = ? AND status = 'returned'
          `).run(id);

          // Activate the step that was returned (and any parallel siblings)
          const returnedRas = db.prepare(`
            SELECT ras.*, acs.execution_mode, acs.parallel_group
            FROM request_approval_steps ras
            JOIN approval_chain_steps acs ON acs.id = ras.chain_step_id
            WHERE ras.request_id = ? AND ras.step_order = ?
          `).get(id, resumeFromStep) as any;

          if (returnedRas) {
            if (returnedRas.execution_mode === 'parallel' && returnedRas.parallel_group != null) {
              // Activate all steps in the parallel group
              db.prepare(`
                UPDATE request_approval_steps SET status = 'active', updated_at = datetime('now')
                WHERE request_id = ? AND id IN (
                  SELECT ras2.id FROM request_approval_steps ras2
                  JOIN approval_chain_steps acs2 ON acs2.id = ras2.chain_step_id
                  WHERE ras2.request_id = ? AND acs2.parallel_group = ? AND ras2.status = 'pending'
                )
              `).run(id, id, returnedRas.parallel_group);
            } else {
              db.prepare("UPDATE request_approval_steps SET status = 'active', updated_at = datetime('now') WHERE request_id = ? AND step_order = ?").run(id, resumeFromStep);
            }
          }

          db.prepare(`
            UPDATE requests SET status = 'pending_approval', submitted_at = ?,
              current_step_order = ?, returned_from_step = NULL,
              sla_deadline = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(now, resumeFromStep, slaDeadline, id);

          createAuditEntry({ entityType: 'request', entityId: id, requestId: id, action: 'resubmitted', performedBy: userId, metadata: { resumed_from_step: resumeFromStep } });
          createAuditEntry({ entityType: 'request', entityId: id, requestId: id, action: 'status_changed', oldValue: 'returned', newValue: 'pending_approval', performedBy: userId });
        } else {
          // Fresh submit: create approval steps
          const insertStep = db.prepare(`
            INSERT INTO request_approval_steps (request_id, chain_step_id, step_order, status, assigned_to)
            VALUES (?, ?, ?, ?, ?)
          `);

          const firstStep = applicableSteps[0];
          const firstGroup = firstStep.parallel_group;
          const isFirstGroupParallel = firstStep.execution_mode === 'parallel' && firstGroup != null;

          for (const step of applicableSteps) {
            const assignedTo = resolveApprover(db, step, fieldValues);

            let status: string;
            if (isFirstGroupParallel) {
              status = (step.execution_mode === 'parallel' && step.parallel_group === firstGroup) ? 'active' : 'pending';
            } else {
              status = step.step_order === firstStep.step_order ? 'active' : 'pending';
            }

            insertStep.run(id, step.id, step.step_order, status, assignedTo);
          }

          db.prepare(`
            UPDATE requests SET status = 'pending_approval', submitted_at = ?,
              current_step_order = ?, sla_deadline = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(now, firstStep.step_order, slaDeadline, id);

          createAuditEntry({ entityType: 'request', entityId: id, requestId: id, action: 'submitted', performedBy: userId });
          createAuditEntry({ entityType: 'request', entityId: id, requestId: id, action: 'status_changed', oldValue: request.status, newValue: 'pending_approval', performedBy: userId });
        }

        // Dispatch pending_actions for the initially active steps using routing engine
        const updatedRequest = getRequestById(id);
        if (updatedRequest) {
          const stepResolutions = resolveNextSteps(
            {
              id,
              submitted_by: updatedRequest.submitted_by,
              department_id: updatedRequest.department_id,
              current_step_order: isResubmit ? (resumeFromStep! - 1) : 0,
              returned_from_step: null,
            },
            updatedRequest.template_id
          );
          if (!('complete' in stepResolutions)) {
            dispatchPendingActions({ requestId: id, stepResolutions });
          }
        }
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

  // Close any pending_actions for this request
  onRequestClosed(id);

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
    const now = formatDateForDb();
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
