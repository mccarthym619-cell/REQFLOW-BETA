import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/requireRole';
import { searchAuditLog } from '../services/audit.service';

const router = Router();

router.get('/', requireRole('admin'), (req: Request, res: Response) => {
  const result = searchAuditLog({
    entityType: req.query.entity_type as string | undefined,
    action: req.query.action as string | undefined,
    performedBy: req.query.performed_by ? parseInt(req.query.performed_by as string, 10) : undefined,
    startDate: req.query.start_date as string | undefined,
    endDate: req.query.end_date as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    perPage: req.query.per_page ? parseInt(req.query.per_page as string, 10) : 50,
  });

  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const perPage = req.query.per_page ? parseInt(req.query.per_page as string, 10) : 50;

  res.json({
    data: result.entries,
    meta: { page, per_page: perPage, total: result.total, total_pages: Math.ceil(result.total / perPage) },
  });
});

export default router;
