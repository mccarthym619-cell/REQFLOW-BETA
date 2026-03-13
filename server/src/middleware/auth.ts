import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { getUserById } from '../services/users.service';
import type { User } from '@req-tracker/shared';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Dev auth middleware: reads X-Current-User-Id header to simulate authentication.
 * ONLY active in development. In production, sessionAuth middleware already sets
 * req.user from the session cookie, so this middleware is a pass-through.
 */
export function devAuth(req: Request, res: Response, next: NextFunction): void {
  // In production, sessionAuth already sets req.user — nothing to do here
  if (config.nodeEnv === 'production') {
    next();
    return;
  }

  // Development only: allow header-based user switching
  const userId = req.headers['x-current-user-id'] as string;

  if (!userId) {
    // Default to user 1 (admin) if no header provided in dev
    const user = getUserById(1);
    if (user) {
      req.user = user;
    }
    next();
    return;
  }

  const user = getUserById(parseInt(userId, 10));

  if (!user || !user.is_active) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid user' } });
    return;
  }

  req.user = user;
  next();
}
