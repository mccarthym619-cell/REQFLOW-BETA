-- ReqFlow Schema
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT    NOT NULL UNIQUE,
    display_name    TEXT    NOT NULL,
    role            TEXT    NOT NULL CHECK (role IN ('admin', 'approver', 'n4', 'contracting', 'reviewer', 'requester', 'viewer')),
    password_hash   TEXT    DEFAULT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- REQUEST TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS request_templates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    description     TEXT,
    prefix          TEXT    NOT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- CUSTOM FIELD DEFINITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id     INTEGER NOT NULL REFERENCES request_templates(id) ON DELETE CASCADE,
    field_name      TEXT    NOT NULL,
    field_label     TEXT    NOT NULL,
    field_type      TEXT    NOT NULL CHECK (field_type IN (
                        'text', 'textarea', 'number', 'currency',
                        'date', 'dropdown', 'multi_select',
                        'checkbox', 'file', 'multi_file', 'url', 'email'
                    )),
    is_required     INTEGER NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    options         TEXT,
    default_value   TEXT,
    placeholder     TEXT,
    help_text       TEXT,
    validation_rules TEXT,
    is_standard     INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(template_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_cfd_template ON custom_field_definitions(template_id);

-- ============================================================
-- APPROVAL CHAIN STEPS
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_chain_steps (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id     INTEGER NOT NULL REFERENCES request_templates(id) ON DELETE CASCADE,
    step_order      INTEGER NOT NULL,
    step_name       TEXT    NOT NULL,
    approver_type   TEXT    NOT NULL CHECK (approver_type IN ('role', 'specific_user')),
    approver_role   TEXT,
    approver_user_id INTEGER REFERENCES users(id),
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(template_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_acs_template ON approval_chain_steps(template_id);
CREATE INDEX IF NOT EXISTS idx_acs_approver_user ON approval_chain_steps(approver_user_id);

-- ============================================================
-- REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS requests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_number TEXT   NOT NULL UNIQUE,
    template_id     INTEGER NOT NULL REFERENCES request_templates(id),
    submitted_by    INTEGER NOT NULL REFERENCES users(id),
    title           TEXT    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN (
                        'draft', 'submitted', 'pending_approval',
                        'approved', 'rejected', 'returned',
                        'cancelled', 'completed'
                    )),
    priority        TEXT    NOT NULL DEFAULT 'normal' CHECK (priority IN (
                        'low', 'normal', 'high', 'urgent',
                        'critical', 'essential', 'enhancing'
                    )),
    current_step_order INTEGER DEFAULT NULL,
    submitted_at    TEXT,
    completed_at    TEXT,
    sla_deadline    TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_submitted_by ON requests(submitted_by);
CREATE INDEX IF NOT EXISTS idx_requests_template ON requests(template_id);
CREATE INDEX IF NOT EXISTS idx_requests_status_submitted ON requests(status, submitted_at);

-- ============================================================
-- CUSTOM FIELD VALUES
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_field_values (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id      INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    field_def_id    INTEGER NOT NULL REFERENCES custom_field_definitions(id),
    field_value     TEXT,
    file_path       TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(request_id, field_def_id)
);

CREATE INDEX IF NOT EXISTS idx_cfv_request ON custom_field_values(request_id);
CREATE INDEX IF NOT EXISTS idx_cfv_field_def ON custom_field_values(field_def_id);

-- ============================================================
-- UPLOADED FILES
-- ============================================================
CREATE TABLE IF NOT EXISTS uploaded_files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name   TEXT    NOT NULL,
    stored_name     TEXT    NOT NULL UNIQUE,
    mime_type       TEXT    NOT NULL,
    size_bytes      INTEGER NOT NULL,
    uploaded_by     INTEGER NOT NULL REFERENCES users(id),
    request_id      INTEGER REFERENCES requests(id) ON DELETE SET NULL,
    field_def_id    INTEGER REFERENCES custom_field_definitions(id) ON DELETE SET NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_request ON uploaded_files(request_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_uploaded_by ON uploaded_files(uploaded_by);

-- ============================================================
-- REQUEST APPROVAL STEPS
-- ============================================================
CREATE TABLE IF NOT EXISTS request_approval_steps (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id      INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    chain_step_id   INTEGER NOT NULL REFERENCES approval_chain_steps(id),
    step_order      INTEGER NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN (
                        'pending', 'active', 'approved', 'rejected', 'returned', 'skipped'
                    )),
    assigned_to     INTEGER REFERENCES users(id),
    acted_on_by     INTEGER REFERENCES users(id),
    acted_on_at     TEXT,
    decision_notes  TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ras_request ON request_approval_steps(request_id);
CREATE INDEX IF NOT EXISTS idx_ras_assigned ON request_approval_steps(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_ras_acted_by ON request_approval_steps(acted_on_by);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id      INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    parent_id       INTEGER REFERENCES comments(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    body            TEXT    NOT NULL,
    is_internal     INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_request ON comments(request_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

-- ============================================================
-- AUDIT LOG (Immutable, append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT    NOT NULL,
    entity_id       INTEGER NOT NULL,
    request_id      INTEGER REFERENCES requests(id),
    action          TEXT    NOT NULL,
    field_name      TEXT,
    old_value       TEXT,
    new_value       TEXT,
    performed_by    INTEGER NOT NULL REFERENCES users(id),
    ip_address      TEXT,
    user_agent      TEXT,
    metadata        TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_request ON audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    request_id      INTEGER REFERENCES requests(id),
    type            TEXT    NOT NULL,
    title           TEXT    NOT NULL,
    message         TEXT    NOT NULL,
    action_url      TEXT,
    is_read         INTEGER NOT NULL DEFAULT 0,
    is_email_sent   INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(user_id, created_at);

-- ============================================================
-- NUDGES
-- ============================================================
CREATE TABLE IF NOT EXISTS nudges (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id      INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    approval_step_id INTEGER NOT NULL REFERENCES request_approval_steps(id),
    nudged_by       INTEGER NOT NULL REFERENCES users(id),
    nudged_user_id  INTEGER NOT NULL REFERENCES users(id),
    acknowledged_at TEXT,
    acknowledge_comment TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_nudges_request ON nudges(request_id);
CREATE INDEX IF NOT EXISTS idx_nudges_user ON nudges(nudged_user_id);
CREATE INDEX IF NOT EXISTS idx_nudges_step ON nudges(approval_step_id);

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
    key             TEXT    PRIMARY KEY,
    value           TEXT    NOT NULL,
    description     TEXT,
    updated_by      INTEGER REFERENCES users(id),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- SEQUENCE COUNTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS sequence_counters (
    prefix          TEXT    PRIMARY KEY,
    current_value   INTEGER NOT NULL DEFAULT 0
);
