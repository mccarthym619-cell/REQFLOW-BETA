import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Project root is 3 levels up from server/src/config/
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

dotenv.config({ path: path.resolve(PROJECT_ROOT, '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// In production, SESSION_SECRET must be explicitly set to a strong value
const sessionSecret = process.env.SESSION_SECRET || (isProduction ? '' : 'dev-secret-change-in-production');
if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
  console.error('FATAL: SESSION_SECRET must be set to a strong value (>= 32 characters) in production.');
  console.error('Generate one with: openssl rand -hex 32');
  process.exit(1);
}

function resolveProjectPath(envValue: string | undefined, ...fallback: string[]): string {
  const raw = envValue || path.join(...fallback);
  return path.isAbsolute(raw) ? raw : path.resolve(PROJECT_ROOT, raw);
}

export const config = {
  nodeEnv,
  port: parseInt(process.env.PORT || '3001', 10),
  databasePath: resolveProjectPath(process.env.DATABASE_PATH, 'data', 'requisition-tracker.db'),
  uploadsDir: resolveProjectPath(process.env.UPLOADS_DIR, 'data', 'uploads'),
  sessionSecret,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@example.com',
  },
};
