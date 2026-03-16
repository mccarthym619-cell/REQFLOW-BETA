import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../config/env';
import { validateBody } from '../middleware/validateBody';
import { getUserByEmailWithPassword, setPasswordHash } from '../services/users.service';
import { hashPassword, verifyPassword } from '../utils/password';
import { createAuditEntry } from '../services/audit.service';

const router = Router();

const checkEmailSchema = z.object({
  email: z.string().email(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const setPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

function setSessionCookie(res: Response, userId: number): void {
  res.cookie('session_token', String(userId), {
    signed: true,
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/** POST /api/auth/check-email — check if email exists and needs password setup */
router.post('/check-email', validateBody(checkEmailSchema), (req: Request, res: Response) => {
  const { email } = req.body;
  const user = getUserByEmailWithPassword(email);

  if (!user || !user.is_active) {
    // Don't reveal whether email exists
    res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or account not found' },
    });
    return;
  }

  res.json({
    data: {
      exists: true,
      needs_password_setup: !user.password_hash,
    },
  });
});

/** POST /api/auth/set-password — set password for first-time login */
router.post('/set-password', validateBody(setPasswordSchema), (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = getUserByEmailWithPassword(email);

  if (!user || !user.is_active) {
    res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or account not found' },
    });
    return;
  }

  if (user.password_hash) {
    res.status(400).json({
      error: { code: 'PASSWORD_ALREADY_SET', message: 'Password is already set. Use login instead.' },
    });
    return;
  }

  const hash = hashPassword(password);
  setPasswordHash(user.id, hash);

  createAuditEntry({
    entityType: 'user',
    entityId: user.id,
    action: 'password_set',
    performedBy: user.id,
  });

  // Auto-login after setting password
  setSessionCookie(res, user.id);

  res.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        timezone: user.timezone,
        is_active: user.is_active,
        has_password: true,
      },
    },
  });
});

/** POST /api/auth/login — authenticate with email + password */
router.post('/login', validateBody(loginSchema), (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = getUserByEmailWithPassword(email);

  if (!user || !user.is_active || !user.password_hash) {
    res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
    return;
  }

  if (!verifyPassword(password, user.password_hash)) {
    res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
    return;
  }

  createAuditEntry({
    entityType: 'user',
    entityId: user.id,
    action: 'user_login',
    performedBy: user.id,
  });

  setSessionCookie(res, user.id);

  res.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        timezone: user.timezone,
        is_active: user.is_active,
        has_password: true,
      },
    },
  });
});

/** GET /api/auth/check — check if session is valid, returns current user */
router.get('/check', (req: Request, res: Response) => {
  // In dev without session, rely on devAuth middleware having set req.user
  if (config.nodeEnv !== 'production') {
    if (req.user) {
      res.json({ data: { authenticated: true, user: req.user } });
    } else {
      res.status(401).json({ data: { authenticated: false } });
    }
    return;
  }

  const userId = req.signedCookies?.session_token;
  if (!userId) {
    res.status(401).json({ data: { authenticated: false } });
    return;
  }

  // User is already loaded by sessionAuth middleware
  if (req.user) {
    res.json({ data: { authenticated: true, user: req.user } });
  } else {
    res.clearCookie('session_token');
    res.status(401).json({ data: { authenticated: false } });
  }
});

/** POST /api/auth/logout — clear session cookie */
router.post('/logout', (req: Request, res: Response) => {
  if (req.user) {
    createAuditEntry({
      entityType: 'user',
      entityId: req.user.id,
      action: 'user_logout',
      performedBy: req.user.id,
    });
  }

  res.clearCookie('session_token');
  // Also clear legacy access_token cookie if it exists
  res.clearCookie('access_token');
  res.json({ data: { success: true } });
});

export default router;
