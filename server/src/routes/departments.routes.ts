import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import * as deptRepo from '../repositories/departments.repository';

const router = Router();

const createDeptSchema = z.object({
  command_id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  sort_order: z.number().int().optional(),
});

const updateDeptSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(20).optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

// GET /api/departments - List all active departments
router.get('/', (req: Request, res: Response) => {
  const commandId = req.query.command_id ? Number(req.query.command_id) : undefined;
  const departments = commandId
    ? deptRepo.getDepartmentsByCommand(commandId)
    : deptRepo.getAllDepartments();
  res.json({ data: departments });
});

// GET /api/departments/:id - Get single department
router.get('/:id', (req: Request, res: Response) => {
  const dept = deptRepo.getDepartmentById(Number(req.params.id));
  if (!dept) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Department not found' } });
    return;
  }
  res.json({ data: dept });
});

// POST /api/departments - Create department (admin only)
router.post('/', requireRole('admin'), (req: Request, res: Response) => {
  const result = createDeptSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: result.error.flatten() } });
    return;
  }
  try {
    const id = deptRepo.createDepartment(result.data);
    const dept = deptRepo.getDepartmentById(id);
    res.status(201).json({ data: dept });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'Department code already exists for this command' } });
      return;
    }
    throw e;
  }
});

// PUT /api/departments/:id - Update department (admin only)
router.put('/:id', requireRole('admin'), (req: Request, res: Response) => {
  const result = updateDeptSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: result.error.flatten() } });
    return;
  }
  const updated = deptRepo.updateDepartment(Number(req.params.id), result.data);
  if (!updated) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Department not found' } });
    return;
  }
  const dept = deptRepo.getDepartmentById(Number(req.params.id));
  res.json({ data: dept });
});

// DELETE /api/departments/:id - Deactivate department (admin only)
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  const deactivated = deptRepo.deactivateDepartment(Number(req.params.id));
  if (!deactivated) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Department not found' } });
    return;
  }
  res.json({ message: 'Department deactivated' });
});

export default router;
