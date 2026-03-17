import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import { validateBody } from '../middleware/validateBody';
import * as templatesService from '../services/templates.service';

const router = Router();

const fieldSchema = z.object({
  field_name: z.string().min(1),
  field_label: z.string().min(1),
  field_type: z.enum(['text', 'textarea', 'number', 'currency', 'date', 'dropdown', 'multi_select', 'checkbox', 'file', 'url', 'email']),
  is_required: z.boolean().optional(),
  sort_order: z.number().optional(),
  options: z.array(z.string()).optional(),
  default_value: z.string().optional(),
  placeholder: z.string().optional(),
  help_text: z.string().optional(),
  validation_rules: z.object({ min: z.number().optional(), max: z.number().optional(), pattern: z.string().optional(), min_length: z.number().optional(), max_length: z.number().optional() }).optional(),
});

const approvalStepSchema = z.object({
  step_order: z.number().int().positive(),
  step_name: z.string().min(1),
  approver_type: z.enum(['role', 'specific_user', 'role_by_command']),
  approver_role: z.string().optional(),
  approver_user_id: z.number().optional(),
  execution_mode: z.enum(['sequential', 'parallel']).optional(),
  parallel_group: z.number().int().nullable().optional(),
  condition: z.string().nullable().optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  prefix: z.string().min(1).max(10),
  fields: z.array(fieldSchema).optional(),
  approval_chain: z.array(approvalStepSchema).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  prefix: z.string().min(1).max(10).optional(),
  is_active: z.boolean().optional(),
});

// Partial schema for updating a field (all fields optional)
const updateFieldSchema = fieldSchema.partial();

router.get('/', (req: Request, res: Response) => {
  const templates = templatesService.getAllTemplates();
  res.json({ data: templates });
});

router.get('/:id', (req: Request, res: Response) => {
  const template = templatesService.getTemplateById(parseInt(req.params.id, 10));
  if (!template) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } }); return; }
  res.json({ data: template });
});

router.post('/', requireRole('admin'), validateBody(createTemplateSchema), (req: Request, res: Response) => {
  const template = templatesService.createTemplate(req.body, req.user!.id);
  res.status(201).json({ data: template });
});

router.put('/:id', requireRole('admin'), validateBody(updateTemplateSchema), (req: Request, res: Response) => {
  const template = templatesService.updateTemplate(parseInt(req.params.id, 10), req.body, req.user!.id);
  if (!template) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } }); return; }
  res.json({ data: template });
});

router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  const success = templatesService.deactivateTemplate(parseInt(req.params.id, 10), req.user!.id);
  if (!success) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } }); return; }
  res.json({ data: { success: true } });
});

// Fields
router.post('/:id/fields', requireRole('admin'), validateBody(fieldSchema), (req: Request, res: Response) => {
  const field = templatesService.addField(parseInt(req.params.id, 10), req.body, req.user!.id);
  res.status(201).json({ data: field });
});

router.put('/:id/fields/:fieldId', requireRole('admin'), validateBody(updateFieldSchema), (req: Request, res: Response) => {
  const field = templatesService.updateField(parseInt(req.params.id, 10), parseInt(req.params.fieldId, 10), req.body, req.user!.id);
  if (!field) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Field not found' } }); return; }
  res.json({ data: field });
});

router.delete('/:id/fields/:fieldId', requireRole('admin'), (req: Request, res: Response) => {
  const success = templatesService.removeField(parseInt(req.params.id, 10), parseInt(req.params.fieldId, 10), req.user!.id);
  if (!success) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Field not found' } }); return; }
  res.json({ data: { success: true } });
});

router.put('/:id/fields/reorder', requireRole('admin'), validateBody(z.object({ field_ids: z.array(z.number()) })), (req: Request, res: Response) => {
  templatesService.reorderFields(parseInt(req.params.id, 10), req.body.field_ids, req.user!.id);
  res.json({ data: { success: true } });
});

// Approval chain
router.post('/:id/approval-chain/steps', requireRole('admin'), validateBody(approvalStepSchema), (req: Request, res: Response) => {
  const step = templatesService.addApprovalStep(parseInt(req.params.id, 10), req.body, req.user!.id);
  res.status(201).json({ data: step });
});

router.delete('/:id/approval-chain/steps/:stepId', requireRole('admin'), (req: Request, res: Response) => {
  const success = templatesService.removeApprovalStep(parseInt(req.params.id, 10), parseInt(req.params.stepId, 10), req.user!.id);
  if (!success) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Step not found' } }); return; }
  res.json({ data: { success: true } });
});

router.put('/:id/approval-chain/reorder', requireRole('admin'), validateBody(z.object({ step_ids: z.array(z.number()) })), (req: Request, res: Response) => {
  templatesService.reorderApprovalSteps(parseInt(req.params.id, 10), req.body.step_ids, req.user!.id);
  res.json({ data: { success: true } });
});

export default router;
