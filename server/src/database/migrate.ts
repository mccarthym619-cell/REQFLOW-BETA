import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './connection';
import { STANDARD_FIELDS } from '@req-tracker/shared';
import { config } from '../config/env';
import { logger } from '../config/logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runMigrations(): void {
  // Support RESET_DB env var for production DB reset (delete DB before migrations)
  if (process.env.RESET_DB === 'true') {
    if (fs.existsSync(config.databasePath)) {
      fs.unlinkSync(config.databasePath);
      logger.info('RESET_DB: Database deleted for fresh seed.');
    }
  }

  const db = getDb();

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  // Migration: add password_hash column to existing databases
  try {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT NULL');
  } catch (e: any) {
    // Column already exists — safe to ignore
    if (!e.message.includes('duplicate column')) throw e;
  }

  // Migration: add timezone column to existing databases
  try {
    db.exec("ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'");
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
  }

  // Migration: add command_id column to existing databases
  try {
    db.exec('ALTER TABLE users ADD COLUMN command_id INTEGER REFERENCES commands(id)');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
  }

  // Ensure indexes exist for command-related queries
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_command ON users(command_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_role_command ON users(role, command_id, is_active)');

  // Migration: add execution_mode, parallel_group, condition to approval_chain_steps
  try {
    db.exec("ALTER TABLE approval_chain_steps ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'sequential'");
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE approval_chain_steps ADD COLUMN parallel_group INTEGER DEFAULT NULL');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE approval_chain_steps ADD COLUMN condition TEXT DEFAULT NULL');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
  }

  const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
  db.exec(seed);

  // Seed the Standard Request template if it doesn't exist
  seedStandardTemplate(db);

  // Seed demo requests (depends on template + field definitions existing)
  const hasRequests = db.prepare('SELECT COUNT(*) as count FROM requests').get() as any;
  if (hasRequests.count === 0) {
    const demoSeed = fs.readFileSync(path.join(__dirname, 'seed-demo.sql'), 'utf-8');
    db.exec(demoSeed);
    logger.info('Demo request data seeded.');
  }

  logger.info('Database migrations and seed data applied.');
}

function seedStandardTemplate(db: ReturnType<typeof getDb>): void {
  // Check if template already exists
  const existing = db.prepare("SELECT id FROM request_templates WHERE name = 'Standard Request' AND is_active = 1").get();
  if (existing) return;

  db.transaction(() => {
    // Create the template
    const res = db.prepare(`
      INSERT INTO request_templates (name, description, prefix, created_by) VALUES (?, ?, ?, ?)
    `).run(
      'Standard Request',
      'Standard requisition request template with command, requestor, priority, and document upload fields.',
      'REQ',
      1 // admin user
    );
    const templateId = res.lastInsertRowid as number;

    // Insert all standard fields
    const insertField = db.prepare(`
      INSERT INTO custom_field_definitions (template_id, field_name, field_label, field_type, is_required, sort_order, options, default_value, placeholder, help_text, validation_rules, is_standard)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const sf of STANDARD_FIELDS) {
      insertField.run(
        templateId,
        sf.field_name,
        sf.field_label,
        sf.field_type,
        sf.is_required ? 1 : 0,
        sf.sort_order ?? 0,
        sf.options ? JSON.stringify(sf.options) : null,
        sf.default_value ?? null,
        sf.placeholder ?? null,
        sf.help_text ?? null,
        sf.validation_rules ? JSON.stringify(sf.validation_rules) : null,
      );
    }
  })();

  logger.info('Standard Request template created.');
}

// Allow running directly: tsx src/database/migrate.ts --reset
if (process.argv.includes('--reset')) {
  if (fs.existsSync(config.databasePath)) {
    fs.unlinkSync(config.databasePath);
    logger.info('Database deleted.');
  }
  runMigrations();
  logger.info('Database reset complete.');
  process.exit(0);
}
