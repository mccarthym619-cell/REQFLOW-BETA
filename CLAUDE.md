# ReqFlow

Requisition tracking web portal for a large military organization. Tracks review, approval, and status of requisition requests with audit trails, admin-configurable templates, and role-based access control. Standalone app linked from SharePoint.

## Architecture

- **Monorepo**: npm workspaces — `client/`, `server/`, `shared/`
- **Frontend**: React 18 + Vite + Tailwind CSS + TanStack Query + react-hot-toast + lucide-react icons
- **Backend**: Node.js + Express + better-sqlite3 (synchronous API) + tsx runtime
- **Shared**: TypeScript types, constants, enums, status machine, permissions (compiled with `module: NodeNext`, imports use `.js` extensions)
- **Database**: SQLite stored at `data/requisition-tracker.db` (relative paths resolved against project root via `resolveProjectPath()` in `env.ts`)
- **File uploads**: Multer → `data/uploads/` with UUID filenames
- **Security**: Helmet headers, express-rate-limit, CORS lockdown, signed-cookie session auth
- **Deployment**: Docker (multi-stage) → Railway with persistent volume

## Running

```bash
npm run dev              # Both servers via concurrently (builds shared first)
npm run dev:server       # API only (tsx watch)
npm run dev:client       # Client only (Vite)
npm run build            # Build all workspaces (shared compile + server typecheck + client bundle)
npm run start            # Production: tsx server/src/index.ts
npm run typecheck        # Type check all workspaces
npm run db:reset         # Delete DB and reseed
```

- API server: http://localhost:3001
- Client dev: http://localhost:5173
- Production: http://localhost:3001 (Express serves client/dist + SPA catch-all)
- Launch config at `.claude/launch.json` (runs from parent "Work better" dir)
- **Reset DB**: `npm run db:reset` or delete `data/requisition-tracker.db` and restart server — schema + seed data re-applied automatically
- **Reset DB (production)**: Set `RESET_DB=true` env var → deploy → DB deleted before migrations → remove the env var after
- **Server runs from source** via `tsx` (not compiled JS) — no `server/dist/` in production

## Access Control & Auth

### Individual User Authentication (Production)
Each user has their own email + password login. Admins create user accounts; users set their own password on first login.

- **Login flow**: Email entry → `POST /api/auth/check-email` → if `needs_password_setup` show "Set Password" form (`POST /api/auth/set-password`), otherwise show "Enter Password" form (`POST /api/auth/login`)
- **Session middleware**: `server/src/middleware/accessGate.ts` (`sessionAuth`) — reads signed `session_token` cookie, loads user from DB, sets `req.user`
- **Auth routes**: `server/src/routes/auth.routes.ts` — `POST /login`, `POST /set-password`, `POST /check-email`, `GET /check`, `POST /logout`, `POST /register`
- **Client session**: `client/src/context/SessionContext.tsx` + `client/src/pages/Auth/LoginPage.tsx`
- **Cookie**: signed httpOnly `session_token`, 7-day expiry, secure in production, sameSite strict
- **Password hashing**: `crypto.scryptSync` with timing-safe comparison (`server/src/utils/password.ts`)
- **`password_hash = NULL`** means user must set password on next login (first-time or after admin reset)
- **Admin controls**: User Management page shows "Password Status" column (Set/Pending Setup). Admin can click "Reset Password" to force re-setup
- **Skipped in dev**: `sessionAuth` middleware skips in development; `devAuth` handles user context

### Self-Registration
Public registration form at login page for new users to request access. Submits to `POST /api/auth/register` (public, rate-limited). Admins review pending registrations in User Management → "Pending Registrations" tab. Admin can approve (assign role + command) or deny (with reason). Approved users get a new account and set their password on first login.

- **Routes**: `server/src/routes/registrations.routes.ts` — `GET /` (list), `POST /:id/approve`, `POST /:id/deny`
- **Service**: `server/src/services/registrations.service.ts`
- **DB table**: `registration_requests` (status: pending/approved/denied)

### Dev Auth (Role Switching)
Dev role-switcher toolbar at top of page. Uses `X-Current-User-Id` header — defaults to user 4 on page refresh. Middleware at `server/src/middleware/auth.ts`. DevToolbar only renders in development.

### Two-Axis Permission Model

**App Roles** (`users.role`): `admin`, `standard`
- `admin` — full app access: manage templates, users, departments, permissions, settings, audit log
- `standard` — create/edit/submit requests in own command, view all requests

**Approval Permissions** (`user_permissions` table): REVIEWER, ENDORSER, CERTIFIER, APPROVER, COMPLETER
- Scoped to **command + department** (NULL department = all departments in that command)
- NSWG-8 (parent command) permissions **cascade** to all subordinate commands (not department-specific when cascading)
- Each approval chain step targets a specific department + permission level
- Routing engine resolves eligible users via `user_permissions`, excludes submitter, checks delegation limits

**Departments** (`departments` table): subdivisions within commands
- NSWG-8: N1, N2, N3, N4, N6, N7, N8, Medical, Facilities, JAG, Contracting, Executive
- Subordinate commands: N1, N2, N3, N4, N6, Medical, Dive Systems, 1TRP, 2TRP, 3TRP, 4TRP, TRIAD
- Admin-manageable: add, rename, deactivate per command

**Seed users** (from `server/src/database/seed.sql`):
1. Sarah Admin (admin, NSWG-8/Executive, APPROVER), 2. Jane Approver (standard, NSWG-8/N8, APPROVER), 3. Mike Finance (standard, NSWG-8/N4, CERTIFIER), 4. John Requester (standard, SDVT-1/N4), 5. View Only (standard, SDVT-1/N4), 6. Lisa N4 (standard, NSWG-8/N4, COMPLETER+REVIEWER), 7. Tom Contracting (standard, NSWG-8/Contracting), 8. Amy Reviewer (standard, NSWG-8/N3, REVIEWER+ENDORSER), 9. Michael McCarthy (admin, NSWG-8/Executive, APPROVER)

## Commands & Departments

11 military commands stored in `commands` table, seeded via `seed.sql`. Each user belongs to a command + department via `users.command_id` and `users.department_id` FKs.

- **Commands**: NSWG-8 (parent), SDVT-1, SDVT-2, SRT-1, SRT-2, LOSGU-8, MSC, IMD, TRADET-8 HI, TRADET-8 CA, TRADET-8 VA
- **Departments**: subdivisions within commands (stored in `departments` table). NSWG-8 has 12 depts, subordinate commands have 12 each
- **Command hierarchy**: NSWG-8 is the parent command; permissions in NSWG-8 cascade to all subordinate commands
- **Routing engine**: `server/src/services/routing.service.ts` resolves eligible approvers based on `user_permissions` (command + department + permission level). Supports compound AND/OR conditions, delegation limits, submitter exclusion, and parent command cascade
- **Pending actions**: `pending_actions` table drives the dashboard "Pending Your Action" widget and SLA tracking. Rows are created when a step activates and closed when acted upon
- **Escalation service**: `server/src/services/escalation.service.ts` runs every 15 min, checks overdue `pending_actions`, sends reminders then escalations
- **Request filtering**: My Requests page has a command dropdown filter

## Key Patterns

- **EAV for custom fields**: `custom_field_definitions` (per template) + `custom_field_values` (per request)
- **Standard fields**: Every template auto-includes 17 locked fields (is_standard=1) defined in `shared/src/constants/standardFields.ts` — command, request type, department/troop, fiscal year, fiscal quarter, primary requestor (name/phone/email/notifications), secondary requestor (name/phone/email/notifications), priority, description, requested start date, document uploads (multi-file)
- **Naming convention**: Auto-generated reference numbers in format `[CommandKey]-[RequestType]-[###]-[DD MMM YYYY]` (e.g., `NSWG8-Facilities-001-09 MAR 2026`). CommandKey strips hyphens from command name. Sequential numbering is per-command via `sequence_counters` table. Title is set to reference number on submit. Logic in `server/src/utils/referenceNumber.ts`
- **Field validation**: Server-side per-type validation in `server/src/utils/fieldValidation.ts` — validates number, currency, date, url, email, dropdown, multi_select, checkbox values. Called during create and update request
- **Input sanitization**: `server/src/utils/sanitize.ts` escapes HTML entities in notification content before DB insert
- **Toast notifications**: `client/src/utils/toast.ts` wraps `react-hot-toast` — `showError()` and `showSuccess()` replace all `alert()`/`console.error`-only patterns
- **Approval race condition protection**: Optimistic locking in approval service — UPDATE checks `WHERE status = 'active'` and verifies `changes === 0` → 409 Conflict
- **Approval pipeline**: Sequential and parallel steps defined per template. Each step targets a department + permission level. Routing engine (`server/src/services/routing.service.ts`) resolves eligible users from `user_permissions`. Supports `execution_mode` (sequential/parallel), `parallel_group`, compound conditions, `sla_hours`, and `target_department_id`/`required_permission` fields. Service layer in `server/src/services/approvals.service.ts`. Pending actions dispatched via `server/src/services/pending-actions.service.ts`
- **RETURNED resume**: When a step returns a request, `returned_from_step` is stored. On re-submit, routing resumes at the returning step (steps before it are not re-run)
- **Repository pattern**: New tables (departments, user_permissions, pending_actions) use a data access layer in `server/src/repositories/` to isolate SQL for future DB migration
- **Audit log IP/User-Agent**: Approval and request action services accept optional `ip` and `userAgent` params, passed from route handlers via `req.ip` and `req.get('user-agent')`
- **Request types**: Facilities, OCIE, Supplies and Services, Training, Force Generation, Professional Development, Maintenance, MIPR
- **Priority levels**: Critical, Essential, Enhancing (standard template); also supports low, normal, high, urgent in the type system
- **File upload**: "Upload-first" pattern — `POST /api/files/upload` returns file ID, stored as string field value, linked to request on save. Download via `GET /api/files/:id/download`. Supports single-file (`file` type) and multi-file (`multi_file` type, stores JSON array of file IDs). Client-side MIME validation in `client/src/utils/fileValidation.ts` mirrors server whitelist
- **Status machine**: `draft → submitted → pending_approval → approved/rejected/returned → completed` (also `cancelled` from any active state). Defined in `shared/src/utils/statusMachine.ts`
- **Audit**: Immutable append-only `audit_log` table with field-level change tracking (old_value → new_value as JSON)
- **Notifications**: In-app via SSE (`server/src/services/sse.service.ts`) + email via Nodemailer
- **Nudge system**: Requesters can nudge approvers after configurable threshold (default 72h), rate-limited 1 per 24h

## User Management (Admin)

Admin-only page at `/admin/users` with server-side pagination, search, and filtering.

- **Pagination**: `GET /api/users?page=1&perPage=50&search=...&role=...&command_id=...&is_active=...&sort=...&order=...`
- **Backward-compatible**: No query params → returns flat array (for DevToolbar user list)
- **Bulk CSV import**: `POST /api/users/import` — accepts array of `{email, display_name, role, command}`, resolves command names to IDs, validates, inserts in transaction
- **UI features**: Debounced search, role/command filter dropdowns, sortable column headers, CSV file upload with preview table and import result summary modal
- **Password reset**: `POST /api/users/:id/reset-password` clears `password_hash`, forcing re-setup on next login

## Security (Production Hardening)

- **Helmet**: Security headers — CSP, X-Frame-Options, HSTS, X-Content-Type-Options (CSP disabled in dev for Vite HMR)
- **Rate limiting**: 200 requests per 15 minutes on `/api` routes (`express-rate-limit`); 10 per 15 min on `/api/auth` in production
- **CORS**: Production = same-origin (no CORS needed); dev = allow `http://localhost:5173` with credentials
- **Signed cookies**: `cookie-parser` with `SESSION_SECRET` for session tokens (min 32 chars in production)
- **SQL injection**: All queries parameterized via better-sqlite3. Sort columns validated against allowlist
- **File uploads**: UUID filenames, 10MB limit, MIME whitelist (validated client-side and server-side)
- **Input length limits**: Field values capped at 10,000 chars via Zod schema validation
- **Role-based route guards**: Admin-only endpoints use `requireRole('admin')`. Approval eligibility is validated at the service layer via the routing engine (`isUserEligibleForStep`), not at the route guard level
- **Error handler**: No stack trace leaks in responses

## Deployment

### Docker
Multi-stage `Dockerfile`: builder stage (full deps + build shared/client) → production stage (prod deps + shared/dist + server/src + client/dist). Server runs via `tsx` from TypeScript source. `.dockerignore` uses `**/dist/` and `**/*.tsbuildinfo` patterns to exclude build artifacts.

### Railway Config

**Production URL**: `glistening-solace-production.up.railway.app`

**Custom Start Command**: `npx tsx server/src/index.ts`

| Env Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | `openssl rand -hex 32` (min 32 chars) |
| `DATABASE_PATH` | `/app/data/requisition-tracker.db` |
| `UPLOADS_DIR` | `/app/data/uploads` |
| `RESET_DB` | `true` (temporary — set to delete DB before migrations, remove after deploy) |

Persistent volume: mount at `/app/data` (SQLite DB + uploaded files survive redeploys)

### Environment Config
All env vars defined in `server/src/config/env.ts`. Defaults in `.env.example`. The `.env` file is gitignored.

`resolveProjectPath()` in `env.ts` resolves relative paths (e.g. `./data/...`) against `PROJECT_ROOT` (3 levels up from `server/src/config/`). Absolute paths (e.g. `/app/data/...` in production) are used as-is. This prevents different DB files being created when cwd differs (npm workspace vs preview server).

## Database Migrations

Migrations in `server/src/database/migrate.ts` run on every server startup. Pattern: `ALTER TABLE ... ADD COLUMN` wrapped in try/catch that ignores "duplicate column" errors.

**Migration order matters**: `schema.sql` runs first (creates tables if not exist), then ALTER TABLE migrations add new columns to existing tables, then `seed.sql` runs (uses `INSERT OR IGNORE`).

**Important**: New columns/indexes that reference columns added by migrations must NOT be in `schema.sql` — they must be in `migrate.ts` after the ALTER TABLE that adds the column. Example: `command_id` indexes are in `migrate.ts`, not `schema.sql`, because existing DBs won't have `command_id` when schema runs.

Current migrations:
1. `password_hash` column on `users`
2. `timezone` column on `users`
3. `command_id` column on `users` + indexes
4. `execution_mode`, `parallel_group`, `condition` columns on `approval_chain_steps`
5. `department_id` column on `users`
6. `target_department_id`, `required_permission`, `sla_hours` columns on `approval_chain_steps`
7. `department_id`, `returned_from_step` columns on `requests`
8. `trigger_type`, `trigger_config` columns on `request_templates`
9. Role migration: old roles (approver, n4, contracting, reviewer, requester, viewer) → `standard`

## Timezone Support

Per-user timezone stored in `users.timezone` column (default `'UTC'`). Auto-detected from browser on first login via `SessionContext.tsx`.

- **Date formatting**: `client/src/utils/dateFormat.ts` — `formatDate(utcStr, pattern, tz)` uses `date-fns-tz` `formatInTimeZone()`, `formatRelative(utcStr)` uses `formatDistanceToNow`. Both parse UTC strings by appending `'Z'` suffix (SQLite `datetime('now')` omits it)
- **Timezone hook**: `client/src/hooks/useTimezone.ts` — returns user's timezone from session, falls back to browser timezone
- **User settings page**: `client/src/pages/Settings/UserSettingsPage.tsx` — searchable timezone dropdown, browser auto-detect button, saves via `PUT /api/users/me/timezone`
- **API endpoint**: `PUT /api/users/me/timezone` in `server/src/routes/users.routes.ts`

## Dark Mode

Toggleable dark mode via Sun/Moon icon in the top bar. Uses Tailwind `darkMode: 'class'` strategy. **Defaults to dark mode** for new users (no localStorage entry).

- **ThemeContext** (`client/src/context/ThemeContext.tsx`): Manages `dark` class on `<html>`, persists to localStorage, exports `useTheme()` hook. Default theme is `'dark'`
- **Flash prevention**: Inline `<script>` in `client/index.html` reads localStorage before React renders
- **Global CSS classes** (`client/src/styles/globals.css`): `.card`, `.btn-*`, `.input`, `.label` all include `dark:` variants — highest-leverage change covering most UI
- **Coverage**: All layout components, shared components, and 11 page files include `dark:` Tailwind utility classes

## Help Guide

In-app walkthrough for new users, accessible from the **Help Guide** button in the sidebar (visible on every page).

- **Component**: `client/src/components/shared/HelpGuide.tsx` — full-screen modal with sidebar nav, 9-step wizard
- **Triggered from**: `client/src/components/layout/Sidebar.tsx` — HelpCircle button before user profile section
- **Screenshots**: `client/public/help/*.png` — 10 real PNG screenshots served at `/help/*.png` by Vite
- **Steps**: Dashboard Overview, Creating a Request, Approval Pipeline, Request Statuses, Comments & Discussion, Notifications, Search & Filters, User Management, System Settings
- **Features**: Sidebar step navigation, Previous/Next buttons, step counter, Escape to close, click-outside to close, arrow key navigation, dark mode support

## Database Schema (19 tables)

`commands`, `departments`, `users`, `user_permissions`, `request_templates`, `custom_field_definitions`, `approval_chain_steps`, `requests`, `custom_field_values`, `uploaded_files`, `request_approval_steps`, `pending_actions`, `comments`, `audit_log`, `notifications`, `nudges`, `system_settings`, `sequence_counters`, `registration_requests`

Schema: `server/src/database/schema.sql` | Seed: `server/src/database/seed.sql` | Demo data: `server/src/database/seed-demo.sql`

Key indexes: `idx_ras_request_status` on `request_approval_steps(request_id, status)` for fast active-step lookups

Demo seed includes 10 requests across all statuses (draft, submitted, pending_approval, approved, rejected, returned, completed) with approval chain steps, custom field values, comments, and audit log entries. Only seeded when `requests` table is empty.

## Project Structure

```
shared/src/
  types/          — FieldType, CustomFieldDefinition, Request (includes department_id, returned_from_step), User (includes department_id, ApprovalPermission), Department, UserPermission, PendingAction, StepCondition (compound AND/OR), Priority, DashboardSummary, etc.
  constants/      — statuses, roles (admin/standard + APPROVAL_PERMISSION_LABELS), fieldTypes, standardFields, notifications
  utils/          — statusMachine, permissions

server/src/
  config/         — env.ts (all env vars), uploads.ts (UPLOADS_DIR, MAX_FILE_SIZE, ALLOWED_MIME_TYPES)
  database/       — connection.ts, migrate.ts, schema.sql, seed.sql, seed-demo.sql
  middleware/     — auth.ts (dev role switching), accessGate.ts (session auth cookie), errorHandler.ts, validation.ts
  repositories/   — data access layer for departments, permissions, pendingActions (isolates SQL for future DB migration)
  routes/         — auth, files, requests, templates, users, registrations, audit, dashboard, notifications, settings, departments, permissions
  services/       — matching service for each route + approvals, comments, nudges, registrations, sse, routing (engine), pending-actions, escalation
  utils/          — referenceNumber.ts, dateFormat.ts (DB date formatting), fieldValidation.ts (per-type validation), sanitize.ts (HTML escaping), password.ts

client/src/
  api/
    client.ts     — axios client (withCredentials, auth header, 401 interceptor)
    queries/      — useRequests (paginated list), useRequest (detail + parallel sub-queries), useTemplates, useDashboard (4 typed hooks)
    mutations/    — useApprovalActions, useRequestActions (cancel/complete/review/comment/nudge), useCreateRequest
  hooks/          — useTimezone (user timezone from session)
  utils/          — dateFormat (UTC-safe formatDate + formatRelative), toast.ts (react-hot-toast wrappers), fileValidation.ts (client MIME whitelist)
  context/        — SessionContext (session auth + timezone auto-detect), AuthContext (current user + role), ThemeContext (dark mode), NotificationContext (SSE)
  components/
    layout/       — Sidebar, TopBar (includes dark mode toggle), DevToolbar
    shared/       — StatusBadge, PriorityBadge, LoadingSpinner, EmptyState, FileUploadInput, MultiFileUploadInput, HelpGuide, TextInputModal (+ ConfirmModal)
  pages/
    Admin/        — Templates (list + builder), Users (management + pending registrations), Departments, Permissions, AuditLog, Settings
    Approvals/    — PendingApprovalsPage
    Auth/         — LoginPage (email + password two-step + registration)
    Dashboard/    — DashboardPage (role-aware layout, see below)
    Settings/     — UserSettingsPage (timezone)
    Notifications/
    Requests/     — RequestListPage (status + command filters), RequestCreatePage, RequestDetailPage
      components/ — RequestApprovalPanel (4 panels), RequestDetailsTab, RequestTimelineTab, RequestCommentsTab, RequestFieldRenderer
```

## Dashboard Layout

Role-aware dashboard in `client/src/pages/Dashboard/DashboardPage.tsx`:

**Admin layout** (top → bottom):
1. Status Summary Cards (Draft, Pending Approval, Approved, Rejected, Completed)
2. Awaiting Purchase Completion (when items exist)
3. Two-column grid: Pending Your Action + Recent Activity

**Standard user layout** (top → bottom):
1. Pending Your Action (full-width, powered by `pending_actions` table)
2. Status Summary Cards
3. Recent Activity (full-width)

## API Endpoints

- `/api/auth` — check-email, set-password, login, check, logout, register (user auth + self-registration)
- `/api/health` — health check (bypasses access gate)
- `/api/users` — CRUD + current user + password reset + timezone + bulk import + commands list
- `/api/users/commands` — list all active commands
- `/api/departments` — CRUD for departments per command (admin can add/rename/deactivate)
- `/api/permissions` — CRUD for scoped user permissions (admin only)
- `/api/registrations` — list pending, approve, deny (admin only)
- `/api/templates` — CRUD with nested fields + approval chain
- `/api/requests` — CRUD + submit/cancel/complete + timeline + approval status (supports `command` filter param)
- `/api/requests/:id/approvals` — approve/reject/return (validates via routing engine, not role)
- `/api/requests/:id/nudge` — send nudge, acknowledge
- `/api/requests/:id/comments` — threaded CRUD
- `/api/files` — upload, download, metadata, delete
- `/api/notifications` — list, read, SSE stream
- `/api/audit` — search/filter
- `/api/dashboard` — summary counts, pending actions (from `pending_actions` table), awaiting-completion (admin)
- `/api/settings` — system config (admin)

## TanStack Query Patterns

All pages use React Query hooks instead of manual `useEffect`+`useState`. Hooks live in `client/src/api/queries/` and `client/src/api/mutations/`.

- **Query keys**: `['requests', filters]`, `['request', id]`, `['request', id, 'steps']`, `['templates']`, `['template', id]`, `['dashboard-summary']`, etc.
- **Cache invalidation**: Mutations invalidate `['request', id]`, `['requests']`, and `['dashboard-summary']` on success
- **Parallel queries**: `useRequest` hook uses `useQueries` to fetch steps, timeline, comments, nudges, and template in parallel
- **Pagination**: `useRequests` uses `keepPreviousData` for smooth page transitions
- **File batch loading**: `getRequestById` collects all file field IDs and batch-fetches via `getFilesByIds()` (avoids N+1)

## Important Notes

- `npm install` may need `HOME=/tmp npm install` if cache permission errors occur
- better-sqlite3 is synchronous — no async/await needed for DB calls
- Multer errors (file too large, invalid type) handled in `server/src/middleware/errorHandler.ts`
- Template builder: standard fields shown as locked (Lock icon), custom fields editable below. Approval chain steps target a department + permission level (or specific user), with optional SLA hours per step
- Request forms render all 12 field types: text, textarea, number, currency, date, dropdown, multi_select, checkbox, file, multi_file, url, email
- Request title is auto-generated from reference number on submit — not user-entered
- **Shared package** uses `.js` extensions in imports (`import ... from './types/user.js'`) for Node.js ESM compatibility. TypeScript with `moduleResolution: NodeNext` resolves `.js` → `.ts` files
- **Server runs from TypeScript source** via `tsx` (production dependency) — no compiled `dist/` for server
- **Middleware order** in `app.ts`: helmet → cookieParser → CORS → rateLimit → express.json → health check → sessionAuth → devAuth → API routes → static files (prod) → SPA catch-all (prod) → errorHandler
