import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import { validateBody } from '../middleware/validateBody';
import * as settingsService from '../services/settings.service';

const router = Router();

// Only allow known setting keys to be updated
const ALLOWED_SETTING_KEYS = [
  'sla_default_hours',
  'nudge_threshold_hours',
  'nudge_cooldown_hours',
  'email_enabled',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_from',
  'app_name',
] as const;

const updateSettingsSchema = z.record(
  z.enum(ALLOWED_SETTING_KEYS),
  z.string().max(500)
);

router.get('/', requireRole('admin'), (req: Request, res: Response) => {
  const settings = settingsService.getAllSettings();
  res.json({ data: settings });
});

router.put('/', requireRole('admin'), validateBody(updateSettingsSchema), (req: Request, res: Response) => {
  const settings = settingsService.updateSettings(req.body, req.user!.id);
  res.json({ data: settings });
});

export default router;
