import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import { validateBody } from '../middleware/validateBody';
import * as requestsService from '../services/requests.service';
import * as approvalsService from '../services/approvals.service';
import * as commentsService from '../services/comments.service';
import * as nudgesService from '../services/nudges.service';
import { getAuditLogForRequest } from '../services/audit.service';
import { getDb } from '../database/connection';

const router = Router();

/**
 * Middleware: verifies the current user can access the request at :id.
 * All authenticated users can view all requests (visibility is not restricted).
 * Standard users can only modify requests submitted from their command.
 */
function assertRequestAccess(req: Request, res: Response, next: NextFunction): void {
  // All authenticated users can view all requests
  next();
}

const createRequestSchema = z.object({
  template_id: z.number().int().positive(),
  title: z.string().max(500).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent', 'critical', 'essential', 'enhancing']).optional(),
  field_values: z.record(z.string().max(10000)).optional(),
});

const updateRequestSchema = z.object({
  title: z.string().max(500).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent', 'critical', 'essential', 'enhancing']).optional(),
  field_values: z.record(z.string().max(10000)).optional(),
});

const approvalActionSchema = z.object({
  notes: z.string().optional(),
});

const commentSchema = z.object({
  body: z.string().min(1),
  parent_id: z.number().optional(),
  is_internal: z.boolean().optional(),
});

const nudgeAckSchema = z.object({
  comment: z.string().min(1),
});

const completeSchema = z.object({
  tracking_comment: z.string().optional(),
});

const reviewActionSchema = z.object({
  notes: z.string().optional(),
});

// Requests CRUD
router.get('/', (req: Request, res: Response) => {
  const user = req.user!;
  const filters: Parameters<typeof requestsService.getRequests>[0] = {
    status: req.query.status as string | undefined,
    templateId: req.query.template_id ? parseInt(req.query.template_id as string, 10) : undefined,
    search: req.query.search as string | undefined,
    command: req.query.command as string | undefined,
    page: req.query.page ? Math.max(1, parseInt(req.query.page as string, 10)) : 1,
    perPage: req.query.per_page ? Math.min(100, Math.max(1, parseInt(req.query.per_page as string, 10))) : 20,
    sort: req.query.sort as string | undefined,
    order: req.query.order as 'asc' | 'desc' | undefined,
    userRole: user.role,
    userId: user.id,
  };

  const result = requestsService.getRequests(filters);
  res.json({
    data: result.requests,
    meta: { page: filters.page!, per_page: filters.perPage!, total: result.total, total_pages: Math.ceil(result.total / filters.perPage!) },
  });
});

router.get('/:id', assertRequestAccess, (req: Request, res: Response) => {
  const request = requestsService.getRequestById(parseInt(req.params.id, 10));
  if (!request) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found' } }); return; }
  res.json({ data: request });
});

// Any authenticated user can create a request
router.post('/', requireRole('admin', 'standard'), validateBody(createRequestSchema), (req: Request, res: Response) => {
  const request = requestsService.createRequest(req.body, req.user!.id);
  res.status(201).json({ data: request });
});

router.put('/:id', requireRole('admin', 'standard'), validateBody(updateRequestSchema), (req: Request, res: Response) => {
  const request = requestsService.updateRequest(parseInt(req.params.id, 10), req.body, req.user!.id);
  if (!request) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found' } }); return; }
  res.json({ data: request });
});

router.post('/:id/submit', requireRole('admin', 'standard'), (req: Request, res: Response) => {
  const request = requestsService.submitRequest(parseInt(req.params.id, 10), req.user!.id);
  res.json({ data: request });
});

router.post('/:id/cancel', requireRole('admin', 'standard'), (req: Request, res: Response) => {
  const request = requestsService.cancelRequest(parseInt(req.params.id, 10), req.user!.id);
  res.json({ data: request });
});

// Complete: requires COMPLETER permission (checked at service level) or admin
router.post('/:id/complete', requireRole('admin', 'standard'), validateBody(completeSchema), (req: Request, res: Response) => {
  const request = requestsService.completeRequest(parseInt(req.params.id, 10), req.user!.id, req.body.tracking_comment);
  res.json({ data: request });
});

// Legacy review/return endpoints (kept for backward compatibility, now handled via approval actions)
router.post('/:id/review', requireRole('admin', 'standard'), validateBody(reviewActionSchema), (req: Request, res: Response) => {
  requestsService.markReviewed(parseInt(req.params.id, 10), req.user!.id, req.body.notes);
  res.json({ data: { success: true } });
});

router.post('/:id/review-return', requireRole('admin', 'standard'), validateBody(reviewActionSchema), (req: Request, res: Response) => {
  requestsService.reviewReturn(parseInt(req.params.id, 10), req.user!.id, req.body.notes);
  res.json({ data: { success: true } });
});

// Timeline
router.get('/:id/timeline', assertRequestAccess, (req: Request, res: Response) => {
  const entries = getAuditLogForRequest(parseInt(req.params.id, 10));
  res.json({ data: entries });
});

// Approval status
router.get('/:id/approval-status', assertRequestAccess, (req: Request, res: Response) => {
  const steps = approvalsService.getApprovalSteps(parseInt(req.params.id, 10));
  res.json({ data: steps });
});

// Approval actions — any authenticated user can try; service layer validates via routing engine
router.post('/:id/approvals/approve', requireRole('admin', 'standard'), validateBody(approvalActionSchema), (req: Request, res: Response) => {
  approvalsService.approveStep(parseInt(req.params.id, 10), req.user!.id, req.body.notes, req.ip, req.get('user-agent'));
  const steps = approvalsService.getApprovalSteps(parseInt(req.params.id, 10));
  res.json({ data: steps });
});

router.post('/:id/approvals/reject', requireRole('admin', 'standard'), validateBody(approvalActionSchema), (req: Request, res: Response) => {
  approvalsService.rejectStep(parseInt(req.params.id, 10), req.user!.id, req.body.notes, req.ip, req.get('user-agent'));
  const steps = approvalsService.getApprovalSteps(parseInt(req.params.id, 10));
  res.json({ data: steps });
});

router.post('/:id/approvals/return', requireRole('admin', 'standard'), validateBody(approvalActionSchema), (req: Request, res: Response) => {
  approvalsService.returnStep(parseInt(req.params.id, 10), req.user!.id, req.body.notes, req.ip, req.get('user-agent'));
  const steps = approvalsService.getApprovalSteps(parseInt(req.params.id, 10));
  res.json({ data: steps });
});

// Comments — any authenticated user can comment
router.get('/:id/comments', assertRequestAccess, (req: Request, res: Response) => {
  const comments = commentsService.getComments(parseInt(req.params.id, 10));
  res.json({ data: comments });
});

router.post('/:id/comments', requireRole('admin', 'standard'), validateBody(commentSchema), (req: Request, res: Response) => {
  const comment = commentsService.addComment(parseInt(req.params.id, 10), req.user!.id, req.body);
  res.status(201).json({ data: comment });
});

// Nudges
router.post('/:id/nudge', requireRole('admin', 'standard'), (req: Request, res: Response) => {
  const nudge = nudgesService.sendNudge(parseInt(req.params.id, 10), req.user!.id);
  res.status(201).json({ data: nudge });
});

router.post('/:id/nudge/:nudgeId/acknowledge', requireRole('admin', 'standard'), validateBody(nudgeAckSchema), (req: Request, res: Response) => {
  const nudge = nudgesService.acknowledgeNudge(parseInt(req.params.nudgeId, 10), req.user!.id, req.body.comment);
  res.json({ data: nudge });
});

router.get('/:id/nudges', assertRequestAccess, (req: Request, res: Response) => {
  const nudges = nudgesService.getNudgesForRequest(parseInt(req.params.id, 10));
  res.json({ data: nudges });
});

export default router;
