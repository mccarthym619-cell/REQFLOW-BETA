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

-- Seed departments for NSWG-8 (parent command)
INSERT OR IGNORE INTO departments (id, command_id, name, code, sort_order) VALUES
    (1,  1, 'N1',          'N1',          1),
    (2,  1, 'N2',          'N2',          2),
    (3,  1, 'N3',          'N3',          3),
    (4,  1, 'N4',          'N4',          4),
    (5,  1, 'N6',          'N6',          5),
    (6,  1, 'N7',          'N7',          6),
    (7,  1, 'N8',          'N8',          7),
    (8,  1, 'Medical',     'MED',         8),
    (9,  1, 'Facilities',  'FAC',         9),
    (10, 1, 'JAG',         'JAG',         10),
    (11, 1, 'Contracting', 'CONTR',       11),
    (12, 1, 'Executive',   'EXEC',        12);

-- Seed departments for subordinate commands (same set for all)
-- SDVT-1
INSERT OR IGNORE INTO departments (id, command_id, name, code, sort_order) VALUES
    (13, 2, 'N1',           'N1',    1),
    (14, 2, 'N2',           'N2',    2),
    (15, 2, 'N3',           'N3',    3),
    (16, 2, 'N4',           'N4',    4),
    (17, 2, 'N6',           'N6',    5),
    (18, 2, 'Medical',      'MED',   6),
    (19, 2, 'Dive Systems', 'DIVE',  7),
    (20, 2, '1TRP',         '1TRP',  8),
    (21, 2, '2TRP',         '2TRP',  9),
    (22, 2, '3TRP',         '3TRP',  10),
    (23, 2, '4TRP',         '4TRP',  11),
    (24, 2, 'TRIAD',        'TRIAD', 12);

-- SDVT-2
INSERT OR IGNORE INTO departments (id, command_id, name, code, sort_order) VALUES
    (25, 3, 'N1',           'N1',    1),
    (26, 3, 'N2',           'N2',    2),
    (27, 3, 'N3',           'N3',    3),
    (28, 3, 'N4',           'N4',    4),
    (29, 3, 'N6',           'N6',    5),
    (30, 3, 'Medical',      'MED',   6),
    (31, 3, 'Dive Systems', 'DIVE',  7),
    (32, 3, '1TRP',         '1TRP',  8),
    (33, 3, '2TRP',         '2TRP',  9),
    (34, 3, '3TRP',         '3TRP',  10),
    (35, 3, '4TRP',         '4TRP',  11),
    (36, 3, 'TRIAD',        'TRIAD', 12);

-- SRT-1
INSERT OR IGNORE INTO departments (id, command_id, name, code, sort_order) VALUES
    (37, 4, 'N1',           'N1',    1),
    (38, 4, 'N2',           'N2',    2),
    (39, 4, 'N3',           'N3',    3),
    (40, 4, 'N4',           'N4',    4),
    (41, 4, 'N6',           'N6',    5),
    (42, 4, 'Medical',      'MED',   6),
    (43, 4, 'Dive Systems', 'DIVE',  7),
    (44, 4, '1TRP',         '1TRP',  8),
    (45, 4, '2TRP',         '2TRP',  9),
    (46, 4, '3TRP',         '3TRP',  10),
    (47, 4, '4TRP',         '4TRP',  11),
    (48, 4, 'TRIAD',        'TRIAD', 12);

-- SRT-2
INSERT OR IGNORE INTO departments (id, command_id, name, code, sort_order) VALUES
    (49, 5, 'N1',           'N1',    1),
    (50, 5, 'N2',           'N2',    2),
    (51, 5, 'N3',           'N3',    3),
    (52, 5, 'N4',           'N4',    4),
    (53, 5, 'N6',           'N6',    5),
    (54, 5, 'Medical',      'MED',   6),
    (55, 5, 'Dive Systems', 'DIVE',  7),
    (56, 5, '1TRP',         '1TRP',  8),
    (57, 5, '2TRP',         '2TRP',  9),
    (58, 5, '3TRP',         '3TRP',  10),
    (59, 5, '4TRP',         '4TRP',  11),
    (60, 5, 'TRIAD',        'TRIAD', 12);

-- LOSGU-8
INSERT OR IGNORE INTO departments (id, command_id, name, code, sort_order) VALUES
    (61, 6, 'N1',           'N1',    1),
    (62, 6, 'N2',           'N2',    2),
    (63, 6, 'N3',           'N3',    3),
    (64, 6, 'N4',           'N4',    4),
    (65, 6, 'N6',           'N6',    5),
    (66, 6, 'Medical',      'MED',   6),
    (67, 6, 'Dive Systems', 'DIVE',  7),
    (68, 6, '1TRP',         '1TRP',  8),
    (69, 6, '2TRP',         '2TRP',  9),
    (70, 6, '3TRP',         '3TRP',  10),
    (71, 6, '4TRP',         '4TRP',  11),
    (72, 6, 'TRIAD',        'TRIAD', 12);

-- MSC
INSERT OR IGNORE INTO departments (id, command_id, name, code, sort_order) VALUES
    (73, 7, 'N1',           'N1',    1),
    (74, 7, 'N2',           'N2',    2),
    (75, 7, 'N3',           'N3',    3),
    (76, 7, 'N4',           'N4',    4),
    (77, 7, 'N6',           'N6',    5),
    (78, 7, 'Medical',      'MED',   6),
    (79, 7, 'Dive Systems', 'DIVE',  7),
    (80, 7, '1TRP',         '1TRP',  8),
    (81, 7, '2TRP',         '2TRP',  9),
    (82, 7, '3TRP',         '3TRP',  10),
    (83, 7, '4TRP',         '4TRP',  11),
    (84, 7, 'TRIAD',        'TRIAD', 12);

-- IMD
INSERT OR IGNORE INTO departments (id, command_id, name, code, sort_order) VALUES
    (85, 8, 'N1',           'N1',    1),
    (86, 8, 'N2',           'N2',    2),
    (87, 8, 'N3',           'N3',    3),
    (88, 8, 'N4',           'N4',    4),
    (89, 8, 'N6',           'N6',    5),
    (90, 8, 'Medical',      'MED',   6),
    (91, 8, 'Dive Systems', 'DIVE',  7),
    (92, 8, '1TRP',         '1TRP',  8),
    (93, 8, '2TRP',         '2TRP',  9),
    (94, 8, '3TRP',         '3TRP',  10),
    (95, 8, '4TRP',         '4TRP',  11),
    (96, 8, 'TRIAD',        'TRIAD', 12);

-- TRADET-8 HI
INSERT OR IGNORE INTO departments (id, command_id, name, code, sort_order) VALUES
    (97,  9, 'N1',           'N1',    1),
    (98,  9, 'N2',           'N2',    2),
    (99,  9, 'N3',           'N3',    3),
    (100, 9, 'N4',           'N4',    4),
    (101, 9, 'N6',           'N6',    5),
    (102, 9, 'Medical',      'MED',   6),
    (103, 9, 'Dive Systems', 'DIVE',  7),
    (104, 9, '1TRP',         '1TRP',  8),
    (105, 9, '2TRP',         '2TRP',  9),
    (106, 9, '3TRP',         '3TRP',  10),
    (107, 9, '4TRP',         '4TRP',  11),
    (108, 9, 'TRIAD',        'TRIAD', 12);

-- TRADET-8 CA
INSERT OR IGNORE INTO departments (id, command_id, name, code, sort_order) VALUES
    (109, 10, 'N1',           'N1',    1),
    (110, 10, 'N2',           'N2',    2),
    (111, 10, 'N3',           'N3',    3),
    (112, 10, 'N4',           'N4',    4),
    (113, 10, 'N6',           'N6',    5),
    (114, 10, 'Medical',      'MED',   6),
    (115, 10, 'Dive Systems', 'DIVE',  7),
    (116, 10, '1TRP',         '1TRP',  8),
    (117, 10, '2TRP',         '2TRP',  9),
    (118, 10, '3TRP',         '3TRP',  10),
    (119, 10, '4TRP',         '4TRP',  11),
    (120, 10, 'TRIAD',        'TRIAD', 12);

-- TRADET-8 VA
INSERT OR IGNORE INTO departments (id, command_id, name, code, sort_order) VALUES
    (121, 11, 'N1',           'N1',    1),
    (122, 11, 'N2',           'N2',    2),
    (123, 11, 'N3',           'N3',    3),
    (124, 11, 'N4',           'N4',    4),
    (125, 11, 'N6',           'N6',    5),
    (126, 11, 'Medical',      'MED',   6),
    (127, 11, 'Dive Systems', 'DIVE',  7),
    (128, 11, '1TRP',         '1TRP',  8),
    (129, 11, '2TRP',         '2TRP',  9),
    (130, 11, '3TRP',         '3TRP',  10),
    (131, 11, '4TRP',         '4TRP',  11),
    (132, 11, 'TRIAD',        'TRIAD', 12);

-- Seed users (roles simplified to admin/standard)
-- department_id references: NSWG-8 N4=4, NSWG-8 N8=7, NSWG-8 Executive=12, SDVT-1 N4=16
INSERT OR IGNORE INTO users (id, email, display_name, role, command_id, department_id) VALUES
    (1, 'admin@example.com', 'Sarah Admin', 'admin', 1, 12),
    (2, 'approver1@example.com', 'Jane Approver', 'standard', 1, 7),
    (3, 'approver2@example.com', 'Mike Finance', 'standard', 1, 4),
    (4, 'requester@example.com', 'John Requester', 'standard', 2, 16),
    (5, 'viewer@example.com', 'View Only', 'standard', 2, 16),
    (6, 'n4@example.com', 'Lisa N4', 'standard', 1, 4),
    (7, 'contracting@example.com', 'Tom Contracting', 'standard', 1, 11),
    (8, 'reviewer@example.com', 'Amy Reviewer', 'standard', 1, 3),
    (9, 'mccarthym619@gmail.com', 'Michael McCarthy', 'admin', 1, 12);

-- Seed user_permissions (scoped approval permissions)
-- Use explicit IDs to ensure idempotent seeding (INSERT OR IGNORE on primary key)
INSERT OR IGNORE INTO user_permissions (id, user_id, command_id, department_id, permission) VALUES
    (1, 2, 1, NULL, 'APPROVER'),     -- Jane Approver: APPROVER in NSWG-8 (all depts)
    (2, 3, 1, 4,    'CERTIFIER'),    -- Mike Finance: CERTIFIER in NSWG-8/N4
    (3, 6, 1, NULL, 'COMPLETER'),    -- Lisa N4: COMPLETER in NSWG-8 (all depts)
    (4, 6, 1, 4,    'REVIEWER'),     -- Lisa N4: REVIEWER in NSWG-8/N4
    (5, 8, 1, 3,    'REVIEWER'),     -- Amy Reviewer: REVIEWER in NSWG-8/N3
    (6, 8, 1, 3,    'ENDORSER'),     -- Amy Reviewer: ENDORSER in NSWG-8/N3
    (7, 9, 1, NULL, 'APPROVER'),     -- Michael McCarthy: APPROVER in NSWG-8 (all depts)
    (8, 1, 1, NULL, 'APPROVER');     -- Sarah Admin: APPROVER in NSWG-8 (all depts)

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
    ('app_name', '"ReqFlow"', 'Application display name'),
    ('escalation_reminder_hours', '4', 'Hours past SLA before escalation triggers'),
    ('escalation_check_interval_minutes', '15', 'Minutes between escalation check runs');
