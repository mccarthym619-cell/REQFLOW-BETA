import fs from 'fs';
import app from './app';
import { config } from './config/env';
import { logger } from './config/logger';
import { runMigrations } from './database/migrate';
import { UPLOADS_DIR } from './config/uploads';

// Initialize database
runMigrations();

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.listen(config.port, () => {
  logger.info(`Server running on http://localhost:${config.port}`);
});
