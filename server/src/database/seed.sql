-- Seed data for development
INSERT OR IGNORE INTO users (id, email, display_name, role) VALUES
    (1, 'admin@example.com', 'Sarah Admin', 'admin'),
    (2, 'approver1@example.com', 'Jane Approver', 'approver'),
    (3, 'approver2@example.com', 'Mike Finance', 'approver'),
    (4, 'requester@example.com', 'John Requester', 'requester'),
    (5, 'viewer@example.com', 'View Only', 'viewer'),
    (6, 'n4@example.com', 'Lisa N4', 'n4'),
    (7, 'contracting@example.com', 'Tom Contracting', 'contracting'),
    (8, 'reviewer@example.com', 'Amy Reviewer', 'reviewer'),
    (9, 'mccarthym619@gmail.com', 'Michael McCarthy', 'admin');

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
