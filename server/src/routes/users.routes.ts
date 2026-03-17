import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import { validateBody } from '../middleware/validateBody';
import * as usersService from '../services/users.service';
import { getDb } from '../database/connection';
import { config } from '../config/env';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1).max(200),
  role: z.enum(['admin', 'approver', 'n4', 'contracting', 'reviewer', 'requester', 'viewer']),
  command_id: z.number().int().positive().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  display_name: z.string().min(1).max(200).optional(),
  role: z.enum(['admin', 'approver', 'n4', 'contracting', 'reviewer', 'requester', 'viewer']).optional(),
  command_id: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
});

// GET /api/commands - List all active commands
router.get('/commands', (req: Request, res: Response) => {
  const commands = usersService.getAllCommands();
  res.json({ data: commands });
});

// GET /api/users - List all users (supports pagination, search, filters)
// In production: admin only. In dev: all roles (for DevToolbar user switching).
router.get('/', ...(config.nodeEnv === 'production' ? [requireRole('admin')] : []), (req: Request, res: Response) => {
  const { search, role, command_id, is_active, page, perPage, sort, order } = req.query;

  const hasFilters = search || role || command_id || is_active !== undefined || page || perPage;

  if (!hasFilters) {
    // Backward-compatible: return flat array
    const users = usersService.getAllUsers();
    res.json({ data: users });
    return;
  }

  const result = usersService.getAllUsers({
    search: search as string | undefined,
    role: role as string | undefined,
    command_id: command_id ? parseInt(command_id as string, 10) : undefined,
    is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
    page: page ? parseInt(page as string, 10) : 1,
    perPage: perPage ? parseInt(perPage as string, 10) : 50,
    sort: sort as string | undefined,
    order: order === 'desc' ? 'desc' : 'asc',
  });

  res.json(result);
});

// GET /api/users/me - Current user
router.get('/me', (req: Request, res: Response) => {
  res.json({ data: req.user });
});

// PUT /api/users/me/timezone - Update current user's timezone
const timezoneSchema = z.object({ timezone: z.string().min(1).max(100) });
router.put('/me/timezone', validateBody(timezoneSchema), (req: Request, res: Response) => {
  const db = getDb();
  db.prepare("UPDATE users SET timezone = ?, updated_at = datetime('now') WHERE id = ?")
    .run(req.body.timezone, req.user!.id);
  const user = usersService.getUserById(req.user!.id);
  res.json({ data: user });
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

// POST /api/users/import - Bulk import users from CSV data
const importSchema = z.object({
  users: z.array(z.object({
    email: z.string().email(),
    display_name: z.string().min(1),
    role: z.string().min(1),
    command: z.string().optional(),
  })),
});

router.post('/import', requireRole('admin'), validateBody(importSchema), (req: Request, res: Response) => {
  const result = usersService.bulkImportUsers(req.body.users, req.user!.id);
  res.json({ data: result });
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
