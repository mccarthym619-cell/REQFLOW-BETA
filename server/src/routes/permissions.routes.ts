import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import * as permRepo from '../repositories/permissions.repository';

const router = Router();

const PERMISSION_VALUES = ['REVIEWER', 'ENDORSER', 'CERTIFIER', 'APPROVER', 'COMPLETER'] as const;

const createPermSchema = z.object({
  user_id: z.number().int().positive(),
  command_id: z.number().int().positive(),
  department_id: z.number().int().positive().nullable().optional(),
  permission: z.enum(PERMISSION_VALUES),
  delegation_limit: z.number().positive().nullable().optional(),
});

const updatePermSchema = z.object({
  delegation_limit: z.number().positive().nullable().optional(),
});

// GET /api/permissions - List all permissions (admin only)
router.get('/', requireRole('admin'), (req: Request, res: Response) => {
  const userId = req.query.user_id ? Number(req.query.user_id) : undefined;
  const permissions = userId
    ? permRepo.getPermissionsByUser(userId)
    : permRepo.getAllPermissions();
  res.json({ data: permissions });
});

// GET /api/permissions/user/:userId - Get permissions for a specific user
router.get('/user/:userId', (req: Request, res: Response) => {
  const permissions = permRepo.getPermissionsByUser(Number(req.params.userId));
  res.json({ data: permissions });
});

// POST /api/permissions - Create permission grant (admin only)
router.post('/', requireRole('admin'), (req: Request, res: Response) => {
  const result = createPermSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: result.error.flatten() } });
    return;
  }
  try {
    const id = permRepo.createPermission(result.data);
    const perm = permRepo.getPermissionById(id);
    res.status(201).json({ data: perm });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'This permission already exists for this user/command/department combination' } });
      return;
    }
    throw e;
  }
});

// PUT /api/permissions/:id - Update permission (admin only)
router.put('/:id', requireRole('admin'), (req: Request, res: Response) => {
  const result = updatePermSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: result.error.flatten() } });
    return;
  }
  const updated = permRepo.updatePermission(Number(req.params.id), result.data);
  if (!updated) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Permission not found' } });
    return;
  }
  const perm = permRepo.getPermissionById(Number(req.params.id));
  res.json({ data: perm });
});

// DELETE /api/permissions/:id - Delete permission (admin only)
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  const deleted = permRepo.deletePermission(Number(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Permission not found' } });
    return;
  }
  res.json({ message: 'Permission removed' });
});

export default router;
