import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { config } from './config/env';
import { logger } from './config/logger';
import { getDb } from './database/connection';
import { sessionAuth } from './middleware/accessGate';
import { devAuth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import apiRouter from './routes/index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  } : false,
}));

// Signed cookie support for session auth
app.use(cookieParser(config.sessionSecret));

// CORS: production = same-origin (no CORS needed), dev = allow Vite dev server
if (config.nodeEnv !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}

// Stricter rate limiting on auth endpoints (brute-force protection) — production only
if (config.nodeEnv === 'production') {
  app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,                   // 10 attempts per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many authentication attempts. Please try again later.' } },
  }));
}

// General rate limiting on API routes
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Body parsing with size limit
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use(pinoHttp({ logger, autoLogging: false }));

// Health check with DB ping (before access gate so Railway can ping it)
app.get('/api/health', (_req, res) => {
  try {
    getDb().prepare('SELECT 1').get();
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }
});

// Session authentication (production: validates session cookie; dev: skips)
app.use(sessionAuth);

// Dev auth (user context via X-Current-User-Id header)
app.use(devAuth);

// API routes
app.use('/api', apiRouter);

// Production: serve client build + SPA catch-all
if (config.nodeEnv === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler (must be last)
app.use(errorHandler);

export default app;
