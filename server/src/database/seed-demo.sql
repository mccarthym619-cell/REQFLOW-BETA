-- ============================================================
-- DEMO DATA: Realistic example requests for demonstration
-- Runs after seedStandardTemplate (template_id=1, field_def_ids 1-17)
-- ============================================================

-- Approval chain for Standard Request template
INSERT OR IGNORE INTO approval_chain_steps (id, template_id, step_order, step_name, approver_type, approver_role)
VALUES
    (1, 1, 1, 'Supervisor Approval', 'role', 'approver'),
    (2, 1, 2, 'N4 Review', 'role', 'n4');

-- Sequence counters for commands used in demo data
INSERT OR IGNORE INTO sequence_counters (prefix, current_value) VALUES
    ('NSWG8', 3),
    ('SDVT1', 1),
    ('SRT1', 1),
    ('SRT2', 1),
    ('LOSGU8', 1),
    ('SDVT2', 1),
    ('MSC', 1),
    ('TRADET8HI', 1),
    ('DRAFT', 2);

-- ============================================================
-- REQUESTS (10 total across various statuses)
-- ============================================================

-- Request 1: COMPLETED — Facilities renovation at NSWG-8
INSERT OR IGNORE INTO requests (id, reference_number, template_id, submitted_by, title, status, priority, submitted_at, completed_at, sla_deadline, created_at, updated_at)
VALUES (1, 'NSWG8-Facilities-001-18 FEB 2026', 1, 4, 'NSWG8-Facilities-001-18 FEB 2026', 'completed', 'essential',
    '2026-02-18 08:30:00', '2026-03-01 14:00:00', '2026-02-21 08:30:00', '2026-02-15 10:00:00', '2026-03-01 14:00:00');

-- Request 2: APPROVED — OCIE gear for SDVT-1
INSERT OR IGNORE INTO requests (id, reference_number, template_id, submitted_by, title, status, priority, submitted_at, sla_deadline, created_at, updated_at)
VALUES (2, 'SDVT1-OCIE-001-24 FEB 2026', 1, 4, 'SDVT1-OCIE-001-24 FEB 2026', 'approved', 'critical',
    '2026-02-24 09:15:00', '2026-02-27 09:15:00', '2026-02-22 13:00:00', '2026-03-05 11:00:00');

-- Request 3: PENDING APPROVAL (step 2) — Training at SRT-1
INSERT OR IGNORE INTO requests (id, reference_number, template_id, submitted_by, title, status, priority, current_step_order, submitted_at, sla_deadline, created_at, updated_at)
VALUES (3, 'SRT1-Training-001-03 MAR 2026', 1, 8, 'SRT1-Training-001-03 MAR 2026', 'pending_approval', 'enhancing', 2,
    '2026-03-03 07:45:00', '2026-03-06 07:45:00', '2026-03-01 09:30:00', '2026-03-07 10:00:00');

-- Request 4: PENDING APPROVAL (step 1) — Supplies at NSWG-8
INSERT OR IGNORE INTO requests (id, reference_number, template_id, submitted_by, title, status, priority, current_step_order, submitted_at, sla_deadline, created_at, updated_at)
VALUES (4, 'NSWG8-Supplies and Services-002-07 MAR 2026', 1, 4, 'NSWG8-Supplies and Services-002-07 MAR 2026', 'pending_approval', 'essential', 1,
    '2026-03-07 10:00:00', '2026-03-10 10:00:00', '2026-03-05 14:20:00', '2026-03-07 10:00:00');

-- Request 5: SUBMITTED — Maintenance at LOSGU-8
INSERT OR IGNORE INTO requests (id, reference_number, template_id, submitted_by, title, status, priority, submitted_at, sla_deadline, created_at, updated_at)
VALUES (5, 'LOSGU8-Maintenance-001-10 MAR 2026', 1, 7, 'LOSGU8-Maintenance-001-10 MAR 2026', 'submitted', 'critical',
    '2026-03-10 11:30:00', '2026-03-13 11:30:00', '2026-03-08 16:00:00', '2026-03-10 11:30:00');

-- Request 6: REJECTED — Force Generation at SDVT-2
INSERT OR IGNORE INTO requests (id, reference_number, template_id, submitted_by, title, status, priority, submitted_at, sla_deadline, created_at, updated_at)
VALUES (6, 'SDVT2-Force Generation-001-25 FEB 2026', 1, 4, 'SDVT2-Force Generation-001-25 FEB 2026', 'rejected', 'enhancing',
    '2026-02-25 13:00:00', '2026-02-28 13:00:00', '2026-02-23 11:00:00', '2026-02-27 09:00:00');

-- Request 7: RETURNED — Professional Development at MSC
INSERT OR IGNORE INTO requests (id, reference_number, template_id, submitted_by, title, status, priority, submitted_at, sla_deadline, created_at, updated_at)
VALUES (7, 'MSC-Professional Development-001-05 MAR 2026', 1, 8, 'MSC-Professional Development-001-05 MAR 2026', 'returned', 'essential',
    '2026-03-05 08:00:00', '2026-03-08 08:00:00', '2026-03-03 15:00:00', '2026-03-06 16:30:00');

-- Request 8: DRAFT — MIPR at TRADET-8 HI
INSERT OR IGNORE INTO requests (id, reference_number, template_id, submitted_by, title, status, priority, created_at, updated_at)
VALUES (8, 'DRAFT-00001', 1, 4, 'New Request', 'draft', 'critical',
    '2026-03-11 09:00:00', '2026-03-11 09:30:00');

-- Request 9: DRAFT — Facilities at SRT-2
INSERT OR IGNORE INTO requests (id, reference_number, template_id, submitted_by, title, status, priority, created_at, updated_at)
VALUES (9, 'DRAFT-00002', 1, 7, 'New Request', 'draft', 'essential',
    '2026-03-12 14:00:00', '2026-03-12 14:15:00');

-- Request 10: SUBMITTED — Training at NSWG-8
INSERT OR IGNORE INTO requests (id, reference_number, template_id, submitted_by, title, status, priority, submitted_at, sla_deadline, created_at, updated_at)
VALUES (10, 'NSWG8-Training-003-11 MAR 2026', 1, 9, 'NSWG8-Training-003-11 MAR 2026', 'submitted', 'enhancing',
    '2026-03-11 15:00:00', '2026-03-14 15:00:00', '2026-03-10 10:00:00', '2026-03-11 15:00:00');

-- ============================================================
-- CUSTOM FIELD VALUES
-- Field IDs: 1=command, 2=request_type, 3=department_troop,
--   4=fiscal_year, 5=fiscal_quarter, 6=pri_name, 7=pri_phone,
--   8=pri_email, 9=pri_notifications, 14=priority,
--   15=description, 16=requested_start_date
-- ============================================================

-- Request 1 (Completed — NSWG-8 Facilities)
INSERT OR IGNORE INTO custom_field_values (request_id, field_def_id, field_value) VALUES
    (1, 1, 'NSWG-8'), (1, 2, 'Facilities'), (1, 3, 'Operations Department'),
    (1, 4, '2026'), (1, 5, '2nd'), (1, 6, 'John Requester'), (1, 7, '(619) 555-0101'),
    (1, 8, 'requester@example.com'), (1, 9, '1'), (1, 14, 'Essential'),
    (1, 15, 'Request to renovate Building 240 conference room. Current HVAC system is non-functional and ceiling tiles need replacement. Impacts daily operations for 30+ personnel.'),
    (1, 16, '2026-03-15');

-- Request 2 (Approved — SDVT-1 OCIE)
INSERT OR IGNORE INTO custom_field_values (request_id, field_def_id, field_value) VALUES
    (2, 1, 'SDVT-1'), (2, 2, 'OCIE'), (2, 3, 'Alpha Platoon'),
    (2, 4, '2026'), (2, 5, '2nd'), (2, 6, 'John Requester'), (2, 7, '(619) 555-0101'),
    (2, 8, 'requester@example.com'), (2, 9, '1'), (2, 14, 'Critical'),
    (2, 15, 'Urgent OCIE replacement for 12 operators deploying in April. Need complete kit refresh including body armor, helmets, and NVG mounts. Current gear is beyond serviceable life.'),
    (2, 16, '2026-03-10');

-- Request 3 (Pending Approval step 2 — SRT-1 Training)
INSERT OR IGNORE INTO custom_field_values (request_id, field_def_id, field_value) VALUES
    (3, 1, 'SRT-1'), (3, 2, 'Training'), (3, 3, 'Bravo Troop'),
    (3, 4, '2026'), (3, 5, '3rd'), (3, 6, 'Amy Reviewer'), (3, 7, '(619) 555-0108'),
    (3, 8, 'reviewer@example.com'), (3, 9, '1'), (3, 14, 'Enhancing'),
    (3, 15, 'Request for advanced maritime operations course for 8 team members. Course offered by NAVSCIATTS, 3-week duration at Stennis Space Center. Enhances unit readiness for FY26 Q3 deployment.'),
    (3, 16, '2026-04-21');

-- Request 4 (Pending Approval step 1 — NSWG-8 Supplies)
INSERT OR IGNORE INTO custom_field_values (request_id, field_def_id, field_value) VALUES
    (4, 1, 'NSWG-8'), (4, 2, 'Supplies and Services'), (4, 3, 'Logistics Branch'),
    (4, 4, '2026'), (4, 5, '2nd'), (4, 6, 'John Requester'), (4, 7, '(619) 555-0101'),
    (4, 8, 'requester@example.com'), (4, 9, '1'), (4, 14, 'Essential'),
    (4, 15, 'Procurement of 50 ruggedized tablets for field operations. Required for digital navigation and comms integration across all troops. Current devices are obsolete and unsupported.'),
    (4, 16, '2026-04-01');

-- Request 5 (Submitted — LOSGU-8 Maintenance)
INSERT OR IGNORE INTO custom_field_values (request_id, field_def_id, field_value) VALUES
    (5, 1, 'LOSGU-8'), (5, 2, 'Maintenance'), (5, 3, 'Vehicle Maintenance Bay'),
    (5, 4, '2026'), (5, 5, '2nd'), (5, 6, 'Tom Contracting'), (5, 7, '(619) 555-0107'),
    (5, 8, 'contracting@example.com'), (5, 9, '1'), (5, 14, 'Critical'),
    (5, 15, 'Emergency maintenance required for 3 MRAP vehicles. Brake systems showing critical wear during last inspection. Vehicles must be mission-ready by end of month for scheduled exercise.'),
    (5, 16, '2026-03-20');

-- Request 6 (Rejected — SDVT-2 Force Generation)
INSERT OR IGNORE INTO custom_field_values (request_id, field_def_id, field_value) VALUES
    (6, 1, 'SDVT-2'), (6, 2, 'Force Generation'), (6, 3, 'Charlie Platoon'),
    (6, 4, '2026'), (6, 5, '2nd'), (6, 6, 'John Requester'), (6, 7, '(619) 555-0101'),
    (6, 8, 'requester@example.com'), (6, 9, '1'), (6, 14, 'Enhancing'),
    (6, 15, 'Request for additional billets to support expanded mission scope. Need 4 additional E-6 and above positions for new operational detachment.'),
    (6, 16, '2026-03-31');

-- Request 7 (Returned — MSC Professional Development)
INSERT OR IGNORE INTO custom_field_values (request_id, field_def_id, field_value) VALUES
    (7, 1, 'MSC'), (7, 2, 'Professional Development'), (7, 3, 'Training Division'),
    (7, 4, '2026'), (7, 5, '3rd'), (7, 6, 'Amy Reviewer'), (7, 7, '(619) 555-0108'),
    (7, 8, 'reviewer@example.com'), (7, 9, '1'), (7, 14, 'Essential'),
    (7, 15, 'Requesting funding for 6 personnel to attend Project Management Professional (PMP) certification course. Aligns with workforce development goals for FY26.'),
    (7, 16, '2026-05-01');

-- Request 8 (Draft — TRADET-8 HI MIPR, partially filled)
INSERT OR IGNORE INTO custom_field_values (request_id, field_def_id, field_value) VALUES
    (8, 1, 'TRADET-8 HI'), (8, 2, 'MIPR'), (8, 3, 'Admin Support'),
    (8, 4, '2026'), (8, 5, '3rd'), (8, 6, 'John Requester'), (8, 7, '(619) 555-0101'),
    (8, 8, 'requester@example.com'), (8, 14, 'Critical'),
    (8, 15, 'MIPR for inter-service support agreement with Army Corps of Engineers for range facility improvements at Pohakuloa Training Area.'),
    (8, 16, '2026-06-01');

-- Request 9 (Draft — SRT-2 Facilities, partially filled)
INSERT OR IGNORE INTO custom_field_values (request_id, field_def_id, field_value) VALUES
    (9, 1, 'SRT-2'), (9, 2, 'Facilities'), (9, 3, 'Operations Center'),
    (9, 4, '2026'), (9, 5, '3rd'), (9, 6, 'Tom Contracting'), (9, 7, '(619) 555-0107'),
    (9, 8, 'contracting@example.com'), (9, 14, 'Essential'),
    (9, 15, 'Upgrade tactical operations center communications infrastructure. Replace aging fiber optic backbone and install new SIPR terminals.'),
    (9, 16, '2026-05-15');

-- Request 10 (Submitted — NSWG-8 Training)
INSERT OR IGNORE INTO custom_field_values (request_id, field_def_id, field_value) VALUES
    (10, 1, 'NSWG-8'), (10, 2, 'Training'), (10, 3, 'Group Training Cell'),
    (10, 4, '2026'), (10, 5, '2nd'), (10, 6, 'Michael McCarthy'), (10, 7, '(619) 555-0109'),
    (10, 8, 'mccarthym619@gmail.com'), (10, 9, '1'), (10, 14, 'Enhancing'),
    (10, 15, 'Request for joint training exercise coordination with partner nation forces. Two-week bilateral exercise requiring range time, ammo allocation, and interpreter support.'),
    (10, 16, '2026-04-14');

-- ============================================================
-- REQUEST APPROVAL STEPS
-- ============================================================

-- Request 1 (Completed): Both steps approved
INSERT OR IGNORE INTO request_approval_steps (id, request_id, chain_step_id, step_order, status, assigned_to, acted_on_by, acted_on_at, decision_notes) VALUES
    (1, 1, 1, 1, 'approved', 2, 2, '2026-02-19 14:00:00', 'Approved. Building 240 renovation is overdue.'),
    (2, 1, 2, 2, 'approved', 6, 6, '2026-02-21 10:30:00', 'Funds available in facilities account. Approved.');

-- Request 2 (Approved): Both steps approved
INSERT OR IGNORE INTO request_approval_steps (id, request_id, chain_step_id, step_order, status, assigned_to, acted_on_by, acted_on_at, decision_notes) VALUES
    (3, 2, 1, 1, 'approved', 2, 2, '2026-02-26 08:30:00', 'OCIE replacement is mission-critical for upcoming deployment.'),
    (4, 2, 2, 2, 'approved', 6, 6, '2026-03-02 11:00:00', 'Approved. Coordinating with supply for expedited delivery.');

-- Request 3 (Pending step 2): Step 1 approved, step 2 active
INSERT OR IGNORE INTO request_approval_steps (id, request_id, chain_step_id, step_order, status, assigned_to, acted_on_by, acted_on_at, decision_notes) VALUES
    (5, 3, 1, 1, 'approved', 3, 3, '2026-03-05 16:00:00', 'Training request looks good. Forwarding to N4 for funding review.');
INSERT OR IGNORE INTO request_approval_steps (id, request_id, chain_step_id, step_order, status, assigned_to) VALUES
    (6, 3, 2, 2, 'active', 6);

-- Request 4 (Pending step 1): Step 1 active, step 2 pending
INSERT OR IGNORE INTO request_approval_steps (id, request_id, chain_step_id, step_order, status, assigned_to) VALUES
    (7, 4, 1, 1, 'active', 2);
INSERT OR IGNORE INTO request_approval_steps (id, request_id, chain_step_id, step_order, status) VALUES
    (8, 4, 2, 2, 'pending');

-- Request 6 (Rejected): Step 1 rejected, step 2 skipped
INSERT OR IGNORE INTO request_approval_steps (id, request_id, chain_step_id, step_order, status, assigned_to, acted_on_by, acted_on_at, decision_notes) VALUES
    (9, 6, 1, 1, 'rejected', 2, 2, '2026-02-27 09:00:00', 'Billet increase requests must go through manpower planning. Please coordinate with N1 first.');
INSERT OR IGNORE INTO request_approval_steps (id, request_id, chain_step_id, step_order, status) VALUES
    (10, 6, 2, 2, 'skipped');

-- Request 7 (Returned): Step 1 returned
INSERT OR IGNORE INTO request_approval_steps (id, request_id, chain_step_id, step_order, status, assigned_to, acted_on_by, acted_on_at, decision_notes) VALUES
    (11, 7, 1, 1, 'returned', 3, 3, '2026-03-06 16:30:00', 'Need cost breakdown per student and justification memo from department head. Please resubmit with attachments.');
INSERT OR IGNORE INTO request_approval_steps (id, request_id, chain_step_id, step_order, status) VALUES
    (12, 7, 2, 2, 'pending');

-- ============================================================
-- COMMENTS (for realism)
-- ============================================================

INSERT OR IGNORE INTO comments (id, request_id, user_id, body, created_at) VALUES
    (1, 1, 4, 'HVAC in Building 240 has been down for two weeks. This is affecting daily briefings.', '2026-02-16 08:00:00'),
    (2, 1, 2, 'I''ve coordinated with facilities. They can start work as soon as this is approved.', '2026-02-18 11:00:00'),
    (3, 1, 6, 'Renovation complete and verified. Marking as done.', '2026-03-01 14:00:00'),
    (4, 2, 4, 'Deployment timeline moved up. Need expedited processing on this one.', '2026-02-24 10:00:00'),
    (5, 3, 8, 'NAVSCIATTS confirmed availability for the April course dates.', '2026-03-02 14:30:00'),
    (6, 4, 4, 'Current tablets are running Windows 7 and cannot connect to updated networks.', '2026-03-06 09:00:00'),
    (7, 7, 3, 'Amy, please attach the cost estimate and supervisor endorsement letter when you resubmit.', '2026-03-06 16:45:00');

-- ============================================================
-- AUDIT LOG (key actions)
-- ============================================================

INSERT OR IGNORE INTO audit_log (id, entity_type, entity_id, request_id, action, performed_by, created_at) VALUES
    (1, 'request', 1, 1, 'created', 4, '2026-02-15 10:00:00'),
    (2, 'request', 1, 1, 'submitted', 4, '2026-02-18 08:30:00'),
    (3, 'approval_step', 1, 1, 'approved', 2, '2026-02-19 14:00:00'),
    (4, 'approval_step', 2, 1, 'approved', 6, '2026-02-21 10:30:00'),
    (5, 'request', 1, 1, 'completed', 6, '2026-03-01 14:00:00'),
    (6, 'request', 2, 2, 'created', 4, '2026-02-22 13:00:00'),
    (7, 'request', 2, 2, 'submitted', 4, '2026-02-24 09:15:00'),
    (8, 'approval_step', 3, 2, 'approved', 2, '2026-02-26 08:30:00'),
    (9, 'approval_step', 4, 2, 'approved', 6, '2026-03-02 11:00:00'),
    (10, 'request', 3, 3, 'created', 8, '2026-03-01 09:30:00'),
    (11, 'request', 3, 3, 'submitted', 8, '2026-03-03 07:45:00'),
    (12, 'approval_step', 5, 3, 'approved', 3, '2026-03-05 16:00:00'),
    (13, 'request', 4, 4, 'created', 4, '2026-03-05 14:20:00'),
    (14, 'request', 4, 4, 'submitted', 4, '2026-03-07 10:00:00'),
    (15, 'request', 5, 5, 'created', 7, '2026-03-08 16:00:00'),
    (16, 'request', 5, 5, 'submitted', 7, '2026-03-10 11:30:00'),
    (17, 'request', 6, 6, 'created', 4, '2026-02-23 11:00:00'),
    (18, 'request', 6, 6, 'submitted', 4, '2026-02-25 13:00:00'),
    (19, 'approval_step', 9, 6, 'rejected', 2, '2026-02-27 09:00:00'),
    (20, 'request', 7, 7, 'created', 8, '2026-03-03 15:00:00'),
    (21, 'request', 7, 7, 'submitted', 8, '2026-03-05 08:00:00'),
    (22, 'approval_step', 11, 7, 'returned', 3, '2026-03-06 16:30:00'),
    (23, 'request', 8, 8, 'created', 4, '2026-03-11 09:00:00'),
    (24, 'request', 9, 9, 'created', 7, '2026-03-12 14:00:00'),
    (25, 'request', 10, 10, 'created', 9, '2026-03-10 10:00:00'),
    (26, 'request', 10, 10, 'submitted', 9, '2026-03-11 15:00:00');
