import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import { validateBody } from '../middleware/validateBody';
import * as usersService from '../services/users.service';
import { config } from '../config/env';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1).max(200),
  role: z.enum(['admin', 'approver', 'n4', 'contracting', 'reviewer', 'requester', 'viewer']),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  display_name: z.string().min(1).max(200).optional(),
  role: z.enum(['admin', 'approver', 'n4', 'contracting', 'reviewer', 'requester', 'viewer']).optional(),
  is_active: z.boolean().optional(),
});

// GET /api/users - List all users
// In production: admin only. In dev: all roles (for DevToolbar user switching).
router.get('/', ...(config.nodeEnv === 'production' ? [requireRole('admin')] : []), (req: Request, res: Response) => {
  const users = usersService.getAllUsers();
  res.json({ data: users });
});

// GET /api/users/me - Current user
router.get('/me', (req: Request, res: Response) => {
  res.json({ data: req.user });
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req: Request, res: Response) => {
  const user = usersService.getUserById(parseInt(req.params.id, 10));
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }
  res.json({ data: user });
});

// POST /api/users - Create user
router.post('/', requireRole('admin'), validateBody(createUserSchema), (req: Request, res: Response) => {
  const user = usersService.createUser(req.body, req.user!.id);
  res.status(201).json({ data: user });
});

// PUT /api/users/:id - Update user
router.put('/:id', requireRole('admin'), validateBody(updateUserSchema), (req: Request, res: Response) => {
  const user = usersService.updateUser(parseInt(req.params.id, 10), req.body, req.user!.id);
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }
  res.json({ data: user });
});

// POST /api/users/:id/reset-password - Admin resets a user's password (forces re-setup)
router.post('/:id/reset-password', requireRole('admin'), (req: Request, res: Response) => {
  const userId = parseInt(req.params.id, 10);
  const user = usersService.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  usersService.clearPasswordHash(userId, req.user!.id);

  res.json({ data: { success: true, message: 'Password reset. User will need to set a new password on next login.' } });
});

export default router;
