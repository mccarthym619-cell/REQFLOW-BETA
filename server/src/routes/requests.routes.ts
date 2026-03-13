import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import { validateBody } from '../middleware/validateBody';
import * as requestsService from '../services/requests.service';
import * as approvalsService from '../services/approvals.service';
import * as commentsService from '../services/comments.service';
import * as nudgesService from '../services/nudges.service';
import { getAuditLogForRequest } from '../services/audit.service';
import { hasPermission } from '@req-tracker/shared';
import { getDb } from '../database/connection';

const router = Router();

/**
 * Middleware: verifies the current user can access the request at :id.
 * Users with 'requests.view_all' can see any request.
 * Users with only 'requests.view_own' can only see requests they submitted.
 */
function assertRequestAccess(req: Request, res: Response, next: NextFunction): void {
  const user = req.user!;
  const requestId = parseInt(req.params.id, 10);

  // Users with view_all permission can access any request
  if (hasPermission(user.role, 'requests.view_all')) {
    next();
    return;
  }

  // For view_own users, check ownership
  const db = getDb();
  const request = db.prepare('SELECT submitted_by FROM requests WHERE id = ?').get(requestId) as { submitted_by: number } | undefined;

  if (!request) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found' } });
    return;
  }

  if (request.submitted_by !== user.id) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this request' } });
    return;
  }

  next();
}

const createRequestSchema = z.object({
  template_id: z.number().int().positive(),
  title: z.string().max(500).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent', 'critical', 'essential', 'enhancing']).optional(),
  field_values: z.record(z.string()).optional(),
});

const updateRequestSchema = z.object({
  title: z.string().max(500).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent', 'critical', 'essential', 'enhancing']).optional(),
  field_values: z.record(z.string()).optional(),
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

const contractAwardSchema = z.object({
  comment: z.string().optional(),
  document_url: z.string().optional(),
});

// Requests CRUD
router.get('/', (req: Request, res: Response) => {
  const user = req.user!;
  const filters: Parameters<typeof requestsService.getRequests>[0] = {
    status: req.query.status as string | undefined,
    templateId: req.query.template_id ? parseInt(req.query.template_id as string, 10) : undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? Math.max(1, parseInt(req.query.page as string, 10)) : 1,
    perPage: req.query.per_page ? Math.min(100, Math.max(1, parseInt(req.query.per_page as string, 10))) : 20,
    sort: req.query.sort as string | undefined,
    order: req.query.order as 'asc' | 'desc' | undefined,
  };

  // Role-based filtering: requester and viewer only see their own
  if (user.role === 'requester' || user.role === 'viewer') {
    filters.submittedBy = user.id;
  }

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

router.post('/', requireRole('admin', 'approver', 'requester'), validateBody(createRequestSchema), (req: Request, res: Response) => {
  const request = requestsService.createRequest(req.body, req.user!.id);
  res.status(201).json({ data: request });
});

router.put('/:id', requireRole('admin', 'approver', 'requester'), validateBody(updateRequestSchema), (req: Request, res: Response) => {
  const request = requestsService.updateRequest(parseInt(req.params.id, 10), req.body, req.user!.id);
  if (!request) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found' } }); return; }
  res.json({ data: request });
});

router.post('/:id/submit', requireRole('admin', 'approver', 'requester'), (req: Request, res: Response) => {
  const request = requestsService.submitRequest(parseInt(req.params.id, 10), req.user!.id);
  res.json({ data: request });
});

router.post('/:id/cancel', requireRole('admin', 'approver', 'requester'), (req: Request, res: Response) => {
  const request = requestsService.cancelRequest(parseInt(req.params.id, 10), req.user!.id);
  res.json({ data: request });
});

// ── N4: Purchase Complete (with tracking info / delivery comments) ──
router.post('/:id/complete', requireRole('admin', 'n4'), validateBody(completeSchema), (req: Request, res: Response) => {
  const request = requestsService.completeRequest(parseInt(req.params.id, 10), req.user!.id, req.body.tracking_comment);
  res.json({ data: request });
});

// ── Reviewer: Reviewed or Returned with comments ──
router.post('/:id/review', requireRole('admin', 'reviewer'), validateBody(reviewActionSchema), (req: Request, res: Response) => {
  requestsService.markReviewed(parseInt(req.params.id, 10), req.user!.id, req.body.notes);
  res.json({ data: { success: true } });
});

router.post('/:id/review-return', requireRole('admin', 'reviewer'), validateBody(reviewActionSchema), (req: Request, res: Response) => {
  requestsService.reviewReturn(parseInt(req.params.id, 10), req.user!.id, req.body.notes);
  res.json({ data: { success: true } });
});

// ── Contracting: Contract Awarded (with document/comment) ──
router.post('/:id/contract-awarded', requireRole('admin', 'contracting'), validateBody(contractAwardSchema), (req: Request, res: Response) => {
  requestsService.markContractAwarded(parseInt(req.params.id, 10), req.user!.id, req.body.comment, req.body.document_url);
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

// Approval actions — any user assigned to the active step can act (service layer validates assignment)
router.post('/:id/approvals/approve', validateBody(approvalActionSchema), (req: Request, res: Response) => {
  approvalsService.approveStep(parseInt(req.params.id, 10), req.user!.id, req.body.notes);
  const steps = approvalsService.getApprovalSteps(parseInt(req.params.id, 10));
  res.json({ data: steps });
});

router.post('/:id/approvals/reject', validateBody(approvalActionSchema), (req: Request, res: Response) => {
  approvalsService.rejectStep(parseInt(req.params.id, 10), req.user!.id, req.body.notes);
  const steps = approvalsService.getApprovalSteps(parseInt(req.params.id, 10));
  res.json({ data: steps });
});

router.post('/:id/approvals/return', validateBody(approvalActionSchema), (req: Request, res: Response) => {
  approvalsService.returnStep(parseInt(req.params.id, 10), req.user!.id, req.body.notes);
  const steps = approvalsService.getApprovalSteps(parseInt(req.params.id, 10));
  res.json({ data: steps });
});

// Comments (all roles except viewer can comment)
router.get('/:id/comments', assertRequestAccess, (req: Request, res: Response) => {
  const comments = commentsService.getComments(parseInt(req.params.id, 10));
  res.json({ data: comments });
});

router.post('/:id/comments', requireRole('admin', 'approver', 'n4', 'contracting', 'reviewer', 'requester'), validateBody(commentSchema), (req: Request, res: Response) => {
  const comment = commentsService.addComment(parseInt(req.params.id, 10), req.user!.id, req.body);
  res.status(201).json({ data: comment });
});

// Nudges
router.post('/:id/nudge', requireRole('admin', 'approver', 'requester'), (req: Request, res: Response) => {
  const nudge = nudgesService.sendNudge(parseInt(req.params.id, 10), req.user!.id);
  res.status(201).json({ data: nudge });
});

router.post('/:id/nudge/:nudgeId/acknowledge', requireRole('admin', 'approver'), validateBody(nudgeAckSchema), (req: Request, res: Response) => {
  const nudge = nudgesService.acknowledgeNudge(parseInt(req.params.nudgeId, 10), req.user!.id, req.body.comment);
  res.json({ data: nudge });
});

router.get('/:id/nudges', assertRequestAccess, (req: Request, res: Response) => {
  const nudges = nudgesService.getNudgesForRequest(parseInt(req.params.id, 10));
  res.json({ data: nudges });
});

export default router;
