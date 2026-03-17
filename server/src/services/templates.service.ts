import { getDb } from '../database/connection';
import { createAuditEntry } from './audit.service';
import { STANDARD_FIELDS, STANDARD_FIELDS_COUNT } from '@req-tracker/shared';
import type { RequestTemplate, CustomFieldDefinition, ApprovalChainStep, CreateTemplatePayload, CreateFieldPayload, CreateApprovalStepPayload } from '@req-tracker/shared';

export function getAllTemplates(activeOnly = true): RequestTemplate[] {
  const db = getDb();
  const where = activeOnly ? 'WHERE is_active = 1' : '';
  return db.prepare(`SELECT * FROM request_templates ${where} ORDER BY name`).all() as RequestTemplate[];
}

export function getTemplateById(id: number): (RequestTemplate & { fields: CustomFieldDefinition[]; approval_chain: ApprovalChainStep[] }) | undefined {
  const db = getDb();
  const template = db.prepare('SELECT * FROM request_templates WHERE id = ?').get(id) as RequestTemplate | undefined;
  if (!template) return undefined;

  const fields = db.prepare('SELECT * FROM custom_field_definitions WHERE template_id = ? AND is_active = 1 ORDER BY sort_order').all(id) as CustomFieldDefinition[];
  const approval_chain = db.prepare('SELECT * FROM approval_chain_steps WHERE template_id = ? AND is_active = 1 ORDER BY step_order').all(id) as ApprovalChainStep[];

  // Parse JSON fields
  for (const f of fields) {
    if (f.options) f.options = JSON.parse(f.options as unknown as string);
    if (f.validation_rules) f.validation_rules = JSON.parse(f.validation_rules as unknown as string);
  }

  return { ...template, fields, approval_chain };
}

export function createTemplate(payload: CreateTemplatePayload, performedBy: number): RequestTemplate {
  const db = getDb();

  const result = db.transaction(() => {
    const res = db.prepare(`
      INSERT INTO request_templates (name, description, prefix, created_by) VALUES (?, ?, ?, ?)
    `).run(payload.name, payload.description ?? null, payload.prefix, performedBy);
    const templateId = res.lastInsertRowid as number;

    // Create standard fields first (always included)
    const insertField = db.prepare(`
      INSERT INTO custom_field_definitions (template_id, field_name, field_label, field_type, is_required, sort_order, options, default_value, placeholder, help_text, validation_rules, is_standard)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const sf of STANDARD_FIELDS) {
      insertField.run(
        templateId, sf.field_name, sf.field_label, sf.field_type,
        sf.is_required ? 1 : 0, sf.sort_order ?? 0,
        sf.options ? JSON.stringify(sf.options) : null,
        sf.default_value ?? null, sf.placeholder ?? null,
        sf.help_text ?? null,
        sf.validation_rules ? JSON.stringify(sf.validation_rules) : null,
        1 // is_standard = true
      );
    }

    // Create custom fields (after standard fields)
    if (payload.fields?.length) {
      for (let i = 0; i < payload.fields.length; i++) {
        const f = payload.fields[i];
        insertField.run(
          templateId, f.field_name, f.field_label, f.field_type,
          f.is_required ? 1 : 0, (f.sort_order ?? i) + STANDARD_FIELDS_COUNT,
          f.options ? JSON.stringify(f.options) : null,
          f.default_value ?? null, f.placeholder ?? null,
          f.help_text ?? null,
          f.validation_rules ? JSON.stringify(f.validation_rules) : null,
          0 // is_standard = false
        );
      }
    }

    // Create approval chain
    if (payload.approval_chain?.length) {
      const insertStep = db.prepare(`
        INSERT INTO approval_chain_steps (template_id, step_order, step_name, approver_type, approver_role, approver_user_id, execution_mode, parallel_group, condition)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const step of payload.approval_chain) {
        insertStep.run(templateId, step.step_order, step.step_name, step.approver_type, step.approver_role ?? null, step.approver_user_id ?? null, step.execution_mode ?? 'sequential', step.parallel_group ?? null, step.condition ?? null);
      }
    }

    createAuditEntry({
      entityType: 'template',
      entityId: templateId,
      action: 'created',
      newValue: { name: payload.name, prefix: payload.prefix },
      performedBy,
    });

    return templateId;
  })();

  return getTemplateById(result as number)!;
}

export function updateTemplate(id: number, payload: Partial<CreateTemplatePayload>, performedBy: number): RequestTemplate | undefined {
  const db = getDb();
  const existing = getTemplateById(id);
  if (!existing) return undefined;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (payload.name !== undefined) { updates.push('name = ?'); values.push(payload.name); }
  if (payload.description !== undefined) { updates.push('description = ?'); values.push(payload.description); }
  if (payload.prefix !== undefined) { updates.push('prefix = ?'); values.push(payload.prefix); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE request_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    createAuditEntry({
      entityType: 'template',
      entityId: id,
      action: 'updated',
      performedBy,
      metadata: payload,
    });
  }

  return getTemplateById(id);
}

export function deactivateTemplate(id: number, performedBy: number): boolean {
  const db = getDb();
  const result = db.prepare("UPDATE request_templates SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  if (result.changes > 0) {
    createAuditEntry({
      entityType: 'template',
      entityId: id,
      action: 'status_changed',
      oldValue: 'active',
      newValue: 'inactive',
      performedBy,
    });
    return true;
  }
  return false;
}

// Field management
export function addField(templateId: number, payload: CreateFieldPayload, performedBy: number): CustomFieldDefinition {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO custom_field_definitions (template_id, field_name, field_label, field_type, is_required, sort_order, options, default_value, placeholder, help_text, validation_rules, is_standard)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    templateId, payload.field_name, payload.field_label, payload.field_type,
    payload.is_required ? 1 : 0, payload.sort_order ?? 0,
    payload.options ? JSON.stringify(payload.options) : null,
    payload.default_value ?? null, payload.placeholder ?? null,
    payload.help_text ?? null,
    payload.validation_rules ? JSON.stringify(payload.validation_rules) : null
  );

  createAuditEntry({
    entityType: 'template',
    entityId: templateId,
    action: 'updated',
    performedBy,
    metadata: { added_field: payload.field_name },
  });

  return db.prepare('SELECT * FROM custom_field_definitions WHERE id = ?').get(result.lastInsertRowid) as CustomFieldDefinition;
}

export function updateField(templateId: number, fieldId: number, payload: Partial<CreateFieldPayload>, performedBy: number): CustomFieldDefinition | undefined {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM custom_field_definitions WHERE id = ? AND template_id = ?').get(fieldId, templateId) as CustomFieldDefinition | undefined;
  if (!existing) return undefined;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (payload.field_label !== undefined) { updates.push('field_label = ?'); values.push(payload.field_label); }
  if (payload.field_type !== undefined) { updates.push('field_type = ?'); values.push(payload.field_type); }
  if (payload.is_required !== undefined) { updates.push('is_required = ?'); values.push(payload.is_required ? 1 : 0); }
  if (payload.sort_order !== undefined) { updates.push('sort_order = ?'); values.push(payload.sort_order); }
  if (payload.options !== undefined) { updates.push('options = ?'); values.push(JSON.stringify(payload.options)); }
  if (payload.default_value !== undefined) { updates.push('default_value = ?'); values.push(payload.default_value); }
  if (payload.placeholder !== undefined) { updates.push('placeholder = ?'); values.push(payload.placeholder); }
  if (payload.help_text !== undefined) { updates.push('help_text = ?'); values.push(payload.help_text); }
  if (payload.validation_rules !== undefined) { updates.push('validation_rules = ?'); values.push(JSON.stringify(payload.validation_rules)); }

  if (updates.length === 0) return existing;

  updates.push("updated_at = datetime('now')");
  values.push(fieldId);

  db.prepare(`UPDATE custom_field_definitions SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  return db.prepare('SELECT * FROM custom_field_definitions WHERE id = ?').get(fieldId) as CustomFieldDefinition;
}

export function removeField(templateId: number, fieldId: number, performedBy: number): boolean {
  const db = getDb();
  // Prevent removing standard fields
  const field = db.prepare('SELECT is_standard FROM custom_field_definitions WHERE id = ? AND template_id = ?').get(fieldId, templateId) as { is_standard: number } | undefined;
  if (field?.is_standard) return false;

  const result = db.prepare("UPDATE custom_field_definitions SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND template_id = ?").run(fieldId, templateId);
  if (result.changes > 0) {
    createAuditEntry({
      entityType: 'template',
      entityId: templateId,
      action: 'updated',
      performedBy,
      metadata: { removed_field_id: fieldId },
    });
    return true;
  }
  return false;
}

export function reorderFields(templateId: number, fieldIds: number[], performedBy: number): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE custom_field_definitions SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND template_id = ?");
  db.transaction(() => {
    for (let i = 0; i < fieldIds.length; i++) {
      stmt.run(i, fieldIds[i], templateId);
    }
  })();

  createAuditEntry({
    entityType: 'template',
    entityId: templateId,
    action: 'updated',
    performedBy,
    metadata: { reordered_fields: fieldIds },
  });
}

// Approval chain management
export function addApprovalStep(templateId: number, payload: CreateApprovalStepPayload, performedBy: number): ApprovalChainStep {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO approval_chain_steps (template_id, step_order, step_name, approver_type, approver_role, approver_user_id, execution_mode, parallel_group, condition)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(templateId, payload.step_order, payload.step_name, payload.approver_type, payload.approver_role ?? null, payload.approver_user_id ?? null, payload.execution_mode ?? 'sequential', payload.parallel_group ?? null, payload.condition ?? null);

  createAuditEntry({
    entityType: 'template',
    entityId: templateId,
    action: 'updated',
    performedBy,
    metadata: { added_approval_step: payload.step_name },
  });

  return db.prepare('SELECT * FROM approval_chain_steps WHERE id = ?').get(result.lastInsertRowid) as ApprovalChainStep;
}

export function removeApprovalStep(templateId: number, stepId: number, performedBy: number): boolean {
  const db = getDb();
  const result = db.prepare("UPDATE approval_chain_steps SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND template_id = ?").run(stepId, templateId);
  if (result.changes > 0) {
    createAuditEntry({
      entityType: 'template',
      entityId: templateId,
      action: 'updated',
      performedBy,
      metadata: { removed_step_id: stepId },
    });
    return true;
  }
  return false;
}

export function reorderApprovalSteps(templateId: number, stepIds: number[], performedBy: number): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE approval_chain_steps SET step_order = ?, updated_at = datetime('now') WHERE id = ? AND template_id = ?");
  db.transaction(() => {
    for (let i = 0; i < stepIds.length; i++) {
      stmt.run(i + 1, stepIds[i], templateId);
    }
  })();
}
