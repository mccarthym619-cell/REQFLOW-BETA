import { Router, Request, Response } from 'express';
import * as notificationsService from '../services/notifications.service';
import { sseService } from '../services/sse.service';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const page = req.query.page ? Math.max(1, parseInt(req.query.page as string, 10)) : 1;
  const perPage = req.query.per_page ? Math.min(100, Math.max(1, parseInt(req.query.per_page as string, 10))) : 20;
  const result = notificationsService.getNotificationsForUser(req.user!.id, page, perPage);
  res.json({
    data: result.notifications,
    meta: { page, per_page: perPage, total: result.total, total_pages: Math.ceil(result.total / perPage) },
  });
});

router.get('/unread-count', (req: Request, res: Response) => {
  const count = notificationsService.getUnreadCount(req.user!.id);
  res.json({ data: { count } });
});

router.put('/:id/read', (req: Request, res: Response) => {
  notificationsService.markAsRead(parseInt(req.params.id, 10), req.user!.id);
  res.json({ data: { success: true } });
});

router.put('/read-all', (req: Request, res: Response) => {
  notificationsService.markAllAsRead(req.user!.id);
  res.json({ data: { success: true } });
});

// SSE stream
router.get('/stream', (req: Request, res: Response) => {
  sseService.addConnection(req.user!.id, res);
});

export default router;
