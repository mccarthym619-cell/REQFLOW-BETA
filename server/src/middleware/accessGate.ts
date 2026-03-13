import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { getUserById } from '../services/users.service';

/**
 * Session authentication middleware.
 * In production: reads signed `session_token` cookie, loads user from DB, sets req.user.
 * In development: skips (devAuth middleware handles user context via X-Current-User-Id header).
 * Always allows auth routes and health check through without a session.
 */
export function sessionAuth(req: Request, res: Response, next: NextFunction): void {
  // Only gate API routes (let static assets through for the login page)
  if (!req.path.startsWith('/api')) {
    next();
    return;
  }

  // Allow auth routes and health check through without a session
  if (req.path.startsWith('/api/auth/') || req.path === '/api/health') {
    next();
    return;
  }

  // In development, skip session auth (devAuth handles user context)
  if (config.nodeEnv !== 'production') {
    next();
    return;
  }

  // Production: require valid session cookie
  const userId = req.signedCookies?.session_token;
  if (!userId) {
    res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
    });
    return;
  }

  const user = getUserById(parseInt(userId, 10));
  if (!user || !user.is_active) {
    res.clearCookie('session_token');
    res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Session expired or account deactivated' },
    });
    return;
  }

  req.user = user;
  next();
}
