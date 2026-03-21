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

  // Migration: add department_id to users
  try {
    db.exec('ALTER TABLE users ADD COLUMN department_id INTEGER REFERENCES departments(id)');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
  }

  // Migration: expand users.role CHECK to include 'standard' (SQLite doesn't enforce ALTER CHECK,
  // but new rows will use the schema definition; existing rows with old roles are migrated in seed)

  // Migration: add target_department_id, required_permission, sla_hours to approval_chain_steps
  try {
    db.exec('ALTER TABLE approval_chain_steps ADD COLUMN target_department_id INTEGER REFERENCES departments(id)');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec("ALTER TABLE approval_chain_steps ADD COLUMN required_permission TEXT");
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE approval_chain_steps ADD COLUMN sla_hours INTEGER DEFAULT NULL');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
  }

  // Migration: add department_id, returned_from_step to requests
  try {
    db.exec('ALTER TABLE requests ADD COLUMN department_id INTEGER REFERENCES departments(id)');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE requests ADD COLUMN returned_from_step INTEGER DEFAULT NULL');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
  }

  // Migration: add trigger_type, trigger_config to request_templates
  try {
    db.exec("ALTER TABLE request_templates ADD COLUMN trigger_type TEXT NOT NULL DEFAULT 'MANUAL'");
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE request_templates ADD COLUMN trigger_config TEXT DEFAULT NULL');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
  }

  // Migration: migrate old user roles to new two-axis model
  // SQLite CHECK constraints can't be altered, so we must recreate the table
  // if the old CHECK constraint still exists (production DB has old 7-role CHECK).
  // Detection: check the table's SQL definition from sqlite_master for the old CHECK.
  const hasOldRoleCheck = (() => {
    const tableInfo = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
    ).get() as { sql: string } | undefined;
    if (!tableInfo) return false;
    // If the CREATE TABLE SQL contains the old 7-role CHECK, we need to recreate
    return tableInfo.sql.includes("'approver'") || tableInfo.sql.includes("'requester'");
  })();

  if (hasOldRoleCheck) {
    logger.info('Migrating users table to new role CHECK constraint...');

    // Clean up from any previous failed migration attempt
    db.exec('DROP TABLE IF EXISTS users_new');

    // Must disable FK enforcement to drop a table referenced by other tables
    db.pragma('foreign_keys = OFF');

    db.transaction(() => {
      db.exec(`
        CREATE TABLE users_new (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          email           TEXT    NOT NULL UNIQUE,
          display_name    TEXT    NOT NULL,
          role            TEXT    NOT NULL CHECK (role IN ('admin', 'standard')),
          password_hash   TEXT    DEFAULT NULL,
          timezone        TEXT    NOT NULL DEFAULT 'UTC',
          command_id      INTEGER REFERENCES commands(id),
          department_id   INTEGER REFERENCES departments(id),
          is_active       INTEGER NOT NULL DEFAULT 1,
          created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `);
      db.exec(`
        INSERT INTO users_new (id, email, display_name, role, password_hash, timezone, command_id, department_id, is_active, created_at, updated_at)
          SELECT id, email, display_name,
            CASE WHEN role = 'admin' THEN 'admin' ELSE 'standard' END,
            password_hash, timezone, command_id, department_id, is_active, created_at, updated_at
          FROM users
      `);
      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users_new RENAME TO users');
    })();

    // Re-enable FK enforcement
    db.pragma('foreign_keys = ON');

    // Recreate indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_command ON users(command_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_role_command ON users(role, command_id, is_active)');
    logger.info('Users table migrated to new role model.');
  } else {
    // New schema already in place — just update any remaining old role values
    db.exec(`
      UPDATE users SET role = 'standard'
      WHERE role NOT IN ('admin', 'standard')
    `);
  }

  const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
  db.exec(seed);

  // Seed the Standard Request template if it doesn't exist
  seedStandardTemplate(db);

  // Seed demo requests (depends on template + field definitions existing)
  const hasRequests = db.prepare('SELECT COUNT(*) as count FROM requests').get() as any;
  if (hasRequests.count === 0) {
    try {
      const demoSeed = fs.readFileSync(path.join(__dirname, 'seed-demo.sql'), 'utf-8');
      db.exec(demoSeed);
      logger.info('Demo request data seeded.');
    } catch (e: any) {
      // Demo seed may fail on migrated DBs due to FK/CHECK constraints from old data
      // This is non-fatal — the app works without demo data
      logger.warn({ error: e.message }, 'Demo seed skipped (non-fatal)');
    }
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
