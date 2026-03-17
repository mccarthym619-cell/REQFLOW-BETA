-- Seed commands (must come before users for FK references)
INSERT OR IGNORE INTO commands (id, name, code, is_parent) VALUES
    (1,  'NSWG-8',       'NSWG8',      1),
    (2,  'SDVT-1',       'SDVT1',      0),
    (3,  'SDVT-2',       'SDVT2',      0),
    (4,  'SRT-1',        'SRT1',       0),
    (5,  'SRT-2',        'SRT2',       0),
    (6,  'LOSGU-8',      'LOSGU8',     0),
    (7,  'MSC',          'MSC',        0),
    (8,  'IMD',          'IMD',        0),
    (9,  'TRADET-8 HI',  'TRADET8HI',  0),
    (10, 'TRADET-8 CA',  'TRADET8CA',  0),
    (11, 'TRADET-8 VA',  'TRADET8VA',  0);

-- Seed data for development (NSWG-8 = command_id 1 for HQ staff; SDVT-1 = 2 for requesters)
INSERT OR IGNORE INTO users (id, email, display_name, role, command_id) VALUES
    (1, 'admin@example.com', 'Sarah Admin', 'admin', 1),
    (2, 'approver1@example.com', 'Jane Approver', 'approver', 1),
    (3, 'approver2@example.com', 'Mike Finance', 'approver', 1),
    (4, 'requester@example.com', 'John Requester', 'requester', 2),
    (5, 'viewer@example.com', 'View Only', 'viewer', 2),
    (6, 'n4@example.com', 'Lisa N4', 'n4', 1),
    (7, 'contracting@example.com', 'Tom Contracting', 'contracting', 1),
    (8, 'reviewer@example.com', 'Amy Reviewer', 'reviewer', 1),
    (9, 'mccarthym619@gmail.com', 'Michael McCarthy', 'admin', 1);

INSERT OR IGNORE INTO system_settings (key, value, description) VALUES
    ('sla_default_hours', '72', 'Default SLA deadline in hours from submission'),
    ('nudge_threshold_hours', '72', 'Hours before nudge button becomes available'),
    ('nudge_cooldown_hours', '24', 'Minimum hours between nudges on the same step'),
    ('email_enabled', 'false', 'Whether email notifications are active'),
    ('smtp_host', '""', 'SMTP server hostname'),
    ('smtp_port', '587', 'SMTP server port'),
    ('smtp_user', '""', 'SMTP username'),
    ('smtp_pass', '""', 'SMTP password'),
    ('smtp_from', '"noreply@example.com"', 'SMTP from address'),
    ('app_name', '"ReqFlow"', 'Application display name');
