import { Router, Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';
import type { UserRole } from '@req-tracker/shared';

const router = Router();

router.get('/summary', (req: Request, res: Response) => {
  const summary = dashboardService.getDashboardSummary(req.user!.id, req.user!.role as UserRole);
  res.json({ data: summary });
});

router.get('/my-pending', (req: Request, res: Response) => {
  const pending = dashboardService.getPendingActions(req.user!.id);
  res.json({ data: pending });
});

router.get('/awaiting-completion', (req: Request, res: Response) => {
  const items = dashboardService.getAwaitingPurchaseCompletion();
  res.json({ data: items });
});

router.get('/recent-activity', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const activity = dashboardService.getRecentActivity(req.user!.id, req.user!.role as UserRole, limit);
  res.json({ data: activity });
});

export default router;
