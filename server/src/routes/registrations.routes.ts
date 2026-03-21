import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import { validateBody } from '../middleware/validateBody';
import * as registrationsService from '../services/registrations.service';

const router = Router();

// GET /api/admin/registrations - List all registrations (admin only)
router.get('/', requireRole('admin'), (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const registrations = status === 'pending'
    ? registrationsService.getPendingRegistrations()
    : registrationsService.getAllRegistrations();
  res.json({ data: registrations });
});

// POST /api/admin/registrations/:id/approve - Approve registration
const approveSchema = z.object({
  role: z.enum(['admin', 'standard']),
});

router.post('/:id/approve', requireRole('admin'), validateBody(approveSchema), (req: Request, res: Response) => {
  const reg = registrationsService.approveRegistration(
    parseInt(req.params.id, 10),
    req.body.role,
    req.user!.id
  );
  res.json({ data: reg });
});

// POST /api/admin/registrations/:id/deny - Deny registration
const denySchema = z.object({
  reason: z.string().min(1).max(500),
});

router.post('/:id/deny', requireRole('admin'), validateBody(denySchema), (req: Request, res: Response) => {
  const reg = registrationsService.denyRegistration(
    parseInt(req.params.id, 10),
    req.body.reason,
    req.user!.id
  );
  res.json({ data: reg });
});

export default router;
