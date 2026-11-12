# WEBNEX Technologies

Phase 1 foundation, Phase 2 public website, Phase 3 API foundation, a partial Phase 4 admin platform, the first Phase 5 CMS vertical slice, and a partial Phase 6 CRM workflow for WEBNEX Technologies.

**Brand:** Engineering Digital Possibilities.  
**Initial market:** Ghana, with international expansion planned.  
**Language:** English.

The project establishes the Next.js application, PostgreSQL/Prisma schema, public pages and APIs, enquiry workflow, Auth.js credentials login, server-side RBAC foundations, and initial admin dashboard, enquiries, user management, audit-log views, service content management, and CRM pipeline. Full CMS coverage, media uploads, password reset, and production integrations are not complete.

## Requirements

- Node.js 20.9 or later (Node.js 24 is used for the current development setup).
- npm.
- PostgreSQL 16 or later, running locally or reachable through a private/secured connection.
- Git.
- A random `RATE_LIMIT_SECRET` of at least 32 characters for enquiry submissions.
- A separate random `AUTH_SECRET` for administrator sessions.

PostgreSQL must be running and accessible with valid credentials before migrations, seeds, or database connectivity checks can succeed. The application does not fall back to SQLite or browser storage.

## Install

From this directory:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install
```

Edit `.env` and set `DATABASE_URL` to a PostgreSQL database you control. The checked-in `.env.example` contains placeholders only. Do not commit `.env` or paste credentials into source files.

Example format:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/webnex?schema=public"
```

The local `.env` created for this setup also contains placeholders; replace them before connecting.

Generate a rate-limit secret locally (do not share it or commit it):

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Generate separate random secrets and put them in `.env` as `RATE_LIMIT_SECRET` and `AUTH_SECRET`. Do not reuse values or commit them. Enquiry and login endpoints fail closed without the rate-limit secret; administrator authentication requires a stable Auth.js secret.

## Database setup

After PostgreSQL is available and `DATABASE_URL` is configured:

```powershell
npm run db:generate
npm run db:deploy
npm run db:seed
npm run admin:bootstrap
npm run db:check
```

- `db:generate` generates the Prisma client without connecting to PostgreSQL.
- `db:migrate` creates/applies a development migration and requires a reachable disposable development database.
- `db:seed` inserts the `SUPER_ADMIN`, `ADMIN`, `EDITOR`, and `SALES` role definitions and permission mappings. It does not create user accounts or sample company content.
- `admin:bootstrap` is an interactive one-time CLI that creates the first Super Admin; it requires migrations and role seed to be applied. Password input is hidden, 12–72 UTF-8 bytes, and never passed as a command-line argument. It refuses to run when an active Super Admin already exists.
- `db:check` runs a real `SELECT 1` connectivity check.
- `db:deploy` applies committed migrations in a deployment environment.

The migration history includes the Phase 1 baseline and additive Phase 3/Phase 4/Phase 5 migrations. A PostgreSQL 16 service is running locally on port 5432, but the connection check could not authenticate because valid credentials were not provided. **No migration history has been confirmed against a live database in this environment.** Apply only to a dedicated development database and review every migration first. Never use reset commands against production data.

## Run locally

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Checks:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run build` generates the Prisma client and builds Next.js. `npm test` runs isolated request-validation tests; database integration tests are not included because no test database is configured.

Set `NEXT_PUBLIC_SITE_URL` to the confirmed public HTTPS origin before deployment. Until that is supplied, metadata and the sitemap use the local development origin.

## Administrator access (partial Phase 4)

After applying migrations and seeding roles:

1. Set `AUTH_SECRET`, `RATE_LIMIT_SECRET`, and `NEXTAUTH_URL` in the local `.env`.
2. Run `npm run admin:bootstrap` in a trusted interactive terminal and create the initial Super Admin.
3. Run `npm run dev`, then open `http://localhost:3000/admin/login`.

Auth.js Credentials uses bcrypt password hashes, eight-hour signed sessions, active-account/session-version checks on server session reads, login rate limiting, temporary lockout after five invalid attempts, generic login errors, and login audit records. Admin endpoints re-check permissions from the database for each operation. Admin state-changing endpoints require a same-origin `Origin` header. The first Super Admin is created by the CLI and cannot be self-provisioned through the web UI.

| Role | Access |
| --- | --- |
| `SUPER_ADMIN` | All seeded permissions, including users, role assignment, audit log and settings. |
| `ADMIN` | Content, media, dashboard and enquiry operations; cannot manage users, assign roles or read system audit logs. |
| `EDITOR` | Dashboard, editorial content permissions and media; no enquiry or user access. Per-item assigned-content scoping is not implemented. |
| `SALES` | Dashboard and enquiry read/update permissions. |

Implemented admin routes are `/admin/login`, `/admin`, `/admin/enquiries`, `/admin/enquiries/[id]`, `/admin/users`, `/admin/audit-logs`, and `/admin/unauthorized`. Dashboard metrics and records query PostgreSQL directly and are permission-scoped; there are no seeded or fabricated dashboard statistics. Enquiry list supports server-side search, status filtering and pagination; detail supports internal notes, status, assignee and follow-up updates with audit records. User management is Super Admin-only, hashes initial passwords, prevents self role/deactivation changes, protects the last active Super Admin, increments session versions, and writes audit records.

Password reset is intentionally unavailable until an email provider is approved. No administrator invite email, MFA, full media library, editable settings, or complete role assignment UI has been implemented. Team profiles and their private photo workflow are documented below. Admin navigation identifies unfinished content modules as pending rather than linking to nonfunctional controls.

## Phase 5 CMS status (partial)

The initial Services CMS vertical slice adds `/admin/services` with server-side search and pagination, validated draft creation/editing, review and approval transitions, publish/unpublish, audited revisions and restore-as-draft, protected deletion, and collision-checked slug redirects. The public homepage, services listing, service detail route, and service API read published service records from PostgreSQL; old service slugs redirect while the service remains published. Service content is structured JSON rendered as ordinary React text, not executable HTML.

The additive `20261111110000_phase5_services_cms` migration expands content workflow states and adds service revision history, updater tracking, scheduling timestamp storage, and service slug redirects. **It has not been applied** because PostgreSQL authentication is unavailable. Re-run `npm run db:generate` after schema changes, then use the database setup commands above against a dedicated development database.

Not implemented: CMS editors for homepage/about sections, projects, case studies, industries, blog, categories/tags, testimonials, navigation, global settings, full SEO controls, and a general media library. Team profiles are implemented as a separate CMS workflow below. There is no scheduled-publishing worker; `SCHEDULED` is not accepted by the Services workflow. Service CRUD, revisions, RBAC boundaries, database migration, and public database rendering still need integration tests against an isolated PostgreSQL database.

## Phase 3 API

Successful responses use `{ "data": ..., "meta": { "requestId": "..." } }`. Errors use `{ "error": { "code": "...", "message": "...", "details": ... }, "meta": { "requestId": "..." } }`. API responses are `no-store`. Public content queries filter to `PUBLISHED` records whose `publishedAt` is not in the future; they return explicit selected fields, bounded pagination (`pageSize` up to 50), and optional `q` search.

| Method and route | Behavior |
| --- | --- |
| `GET /api/v1/health` | Executes `SELECT 1`; returns 503 when PostgreSQL is unavailable. |
| `GET /api/v1/services[?page=1&pageSize=12&q=...]` | Published services. |
| `GET /api/v1/services/:slug` | One published service; otherwise 404. |
| `GET /api/v1/projects` and `/api/v1/projects/:slug` | Published projects and their published related content. |
| `GET /api/v1/case-studies` and `/api/v1/case-studies/:slug` | Published case studies. |
| `GET /api/v1/industries` and `/api/v1/industries/:slug` | Published industries. |
| `GET /api/v1/blog[?category=slug]` and `/api/v1/blog/:slug` | Published articles; list supports search and category filtering. |
| `GET /api/v1/blog/categories` | Categories with at least one published article. |
| `GET /api/v1/testimonials` | Published testimonials only. |
| `GET /api/v1/navigation` | Visible navigation and visible child items. |
| `GET /api/v1/site-settings` | Settings explicitly marked public. |
| `POST /api/v1/enquiries` | Validates and stores project enquiries; see workflow below. |

The public services listing and detail routes read published PostgreSQL service records as described in Phase 5. Most other public industry, navigation, and editorial UI still uses Phase 2 typed content modules and is **not yet hydrated from these APIs/database records**. No production/sample content has been seeded.

## Enquiry workflow

`POST /api/v1/enquiries` requires JSON and a UUID `Idempotency-Key` header. The server enforces same-origin requests when an `Origin` header is supplied, a 16 KiB request cap, server-side Zod validation, enumerated service/contact values, a honeypot, a database-backed rate limit of five accepted requests per IP per 15-minute window, and normalized lowercase email addresses. Client IP rate limiting currently uses `x-real-ip`; the deployment proxy must overwrite that header. If it does not, configure a trusted proxy/header before public launch.

The endpoint transactionally creates an enquiry with a unique `WNX-YYYYMMDD-<12 hex>` reference and an outbox row. A repeated idempotency key returns the original reference. It returns 201 only after the transaction succeeds (200 for an idempotent retry); DB or configuration failures return a generic error, not success. Public responses do not include enquiry details or allow status changes.

Enquiry notifications are queued in the transactional outbox. SendGrid was selected, and a server-only dispatcher is implemented, but no provider credentials, sender identity, or recipient address have been configured. The endpoint does **not** claim that an email was sent.

## Phase 6 CRM and business automation status (partial)

Implemented in code: lead activity timeline; status, assignment, note, contact and follow-up event recording; dedicated follow-up tasks; GHS/USD proposal drafting with exact decimal input and guarded status transitions; a stage-based pipeline from persisted enquiry records; optional WhatsApp click-to-chat after explicit customer opt-in; and a SendGrid integration/outbox page with bounded retries, provider message IDs, and manual retry for failed events. Proposal “sent” is a recorded CRM status only; the platform does not send proposal documents or email them. Opening a WhatsApp link does not prove a message was submitted or delivered.

Admin pages added: `/admin/pipeline`, `/admin/follow-ups`, `/admin/proposals`, and `/admin/integrations`. Related protected APIs are under `/api/admin/v1/follow-ups`, `/api/admin/v1/enquiries/[id]/activities`, `/api/admin/v1/enquiries/[id]/proposals`, `/api/admin/v1/proposals/[id]`, and `/api/admin/v1/integrations/email/outbox/[id]/retry`.

The Phase 6 additive migration `20261111151500_phase6_crm_workflows` adds enquiry activity, follow-up task, proposal and contact-consent fields. It is not applied because valid PostgreSQL credentials are unavailable. Apply it only after confirming the target is a dedicated development database and reviewing the migration. `npm run db:generate` generates the client; `npm run db:deploy` applies committed migrations.

Configure these server environment values before enabling SendGrid: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `NOTIFICATION_TO_EMAIL`, and a confirmed HTTPS `NEXT_PUBLIC_SITE_URL`. Customer acknowledgement emails remain disabled unless `SENDGRID_CUSTOMER_ACKNOWLEDGEMENTS=true` is explicitly set. Run `npm run email:dispatch` from an external scheduler; the application does not schedule it automatically. A successful provider API response means accepted by SendGrid, not delivered to a recipient. Delivery webhooks, event signature verification, deduplication, and delivery/bounce status tracking are not implemented. The worker retries transient failures up to five times; because provider acceptance and database status updates cannot share a transaction, a process failure between those operations can cause a duplicate email on a later retry.

Not implemented: database integration tests, CRM analytics and conversion attribution, in-app notifications, scheduled reminders/automatic follow-up execution, proposal PDF generation or dispatch, and SendGrid delivery webhooks. Phase 6 is incomplete until its migration and core workflows are exercised against an isolated PostgreSQL test database; do not treat it as production-ready.

## Team profiles and photographs (implemented in code; database/storage unverified)

The `/admin/team` module provides paginated and searchable profile management with a draft → review → approval → publish workflow, active/inactive visibility, profile ordering, HTTPS-only professional links, audit records, protected deletion, and a live card preview. Seeded permissions distinguish profile viewing, creation, editing, approval, publication, deletion, and photo management. Public `/about`, `/team`, and `/team/[slug]` routes, the team API, and sitemap entries show only active profiles that are published and whose publication time has arrived. No team members or photos are fabricated.

The additive `20261111165000_team_members_profiles` migration extends the existing `TeamMember` and `MediaAsset` models, backfills stable unique slugs, preserves legacy fields and existing published status, and adds profile/photo indexes, a nullable media foreign key, and database checks for new writes. It has **not** been applied because PostgreSQL authentication is unavailable. Apply it only to a reviewed, dedicated development database using `npm run db:deploy`.

Photo upload requires an S3-compatible private bucket and server-only `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY_ID`, and `OBJECT_STORAGE_SECRET_ACCESS_KEY` values in `.env`. Production endpoints must use HTTPS. Configure the provider's bucket policy to deny public access; the application serves published photos through a database-checked image proxy and never exposes storage credentials or object keys to the browser. Uploads accept JPG, PNG, and WebP files up to 5 MB, validate the actual image bytes and pixel count, rotate/crop to an 800×1000 WebP, and store metadata in PostgreSQL. Replacing, removing, or deleting a profile performs reference-checked cleanup; failures are logged and surfaced in the admin workflow. An image must be saved as a profile before uploading its photo.

Validation and image transformation tests run with `npm test`. No PostgreSQL migration, authenticated role workflow, object-storage upload, persistence, or Hostinger storage configuration has been verified here. Before production, configure and test a private persistent bucket, apply the migration, and run DB-backed authorization, CRUD, publication, and upload tests against isolated PostgreSQL and storage resources.

## Phase 7 audit status

The local Phase 7 checks passed for lint, TypeScript, 19 automated tests, Prisma schema validation, the production build, sampled public route rendering and responsive overflow on the homepage. Full and production npm audits report zero vulnerabilities after a narrow development-tooling `minimatch` override; see the security report for its maintenance caveat. PostgreSQL authentication still fails (`28P01`), so migrations, persisted workflows and authenticated role boundaries remain unverified. Hostinger plan compatibility, SendGrid delivery and backup restoration are also unverified. **Production readiness: NOT READY.**

Phase 7 evidence and operational documents:

- [Phase 7 audit report](./PHASE_7_AUDIT_REPORT.md)
- [Security audit report](./SECURITY_AUDIT_REPORT.md)
- [Performance audit report](./PERFORMANCE_AUDIT_REPORT.md)
- [Testing report](./TESTING_REPORT.md)
- [Disaster recovery plan](./DISASTER_RECOVERY_PLAN.md)
- [Deployment checklist](./DEPLOYMENT_CHECKLIST.md)
- [Production readiness report](./PRODUCTION_READINESS_REPORT.md)

## Project structure

```text
app/                    Public routes, metadata, sitemap, robots, and global styles
  api/v1/                Versioned health, content read, and enquiry endpoints
  api/auth/              Auth.js session endpoints
  api/admin/v1/          Permission-protected CMS, enquiry, team and user APIs
  admin/                 Login, dashboard, enquiry, team, user and audit pages
prisma/
  migrations/           Version-controlled PostgreSQL migrations
  schema.prisma         Relational application schema
  seed.ts               Idempotent role and permission bootstrap
scripts/
  check-database.ts     Explicit PostgreSQL connectivity check
  bootstrap-super-admin.ts  Interactive first administrator bootstrap
src/
  components/           Shared layout, navigation, forms, cards, and page components
  config/               Site identity and navigation configuration
  data/                 Typed service/industry content and empty editorial collections
  lib/api/              Client-to-backend enquiry integration
  lib/validation/       Shared request and CMS Zod schemas
  data/projects.ts      Typed project and case study models (empty until approved)
  server/
    db.ts               Server-side Prisma client
    env.ts              Zod validation for server environment
    api/                 Shared API response and pagination helpers
    auth/                Auth.js configuration and server-side RBAC
    content/             Public, published-only Prisma queries
    enquiries/           Transactional enquiry creation
    integrations/        Server-only external service clients
    media/               Image validation and optimization
    security/            Database-backed rate limits and same-origin checks
types/                  Auth.js session and credentials type extensions
  generated/prisma/     Generated Prisma client (git-ignored)
public/                 Public static assets
prisma.config.ts        Prisma CLI, migration, and seed configuration
.env.example            Safe environment-variable template
OBJECT_STORAGE_*        Optional server-only S3-compatible storage configuration
RATE_LIMIT_SECRET       Private secret for HMAC-hashed rate-limit identifiers
AUTH_SECRET             Private Auth.js JWT signing secret
NEXTAUTH_URL            Public origin required by Auth.js in production
NEXT_PUBLIC_SITE_URL    Public canonical origin; configure the confirmed .com domain
```

## Database and data safety

The schema includes Auth.js-compatible account/session models, users, roles and permissions, CMS pages and revisions, services, projects, industries, case studies, team members, testimonials, blog posts, categories, tags, media metadata, enquiries and notes, enquiry activity, follow-up tasks, proposals, site settings, navigation items, audit logs, notification outbox records, and rate-limit buckets. Content tables start as drafts; seed data contains no invented company claims, users, testimonials, or projects. The Phase 3 migration adds the enquiry reference and form fields, requested enquiry statuses, public-setting flag, industry relationship, and outbox/rate-limit tables. It also maps legacy `IN_PROGRESS` to `CONTACTED` and `CLOSED`/`SPAM` to `LOST`. Later phases add the service CMS and partial CRM workflow described below.

The rate-limit identifier is stored as a keyed HMAC, not a raw IP. The database schema has constraints for enquiry reference format and field lengths. Enquiry writes and notification queue creation share a transaction.

Use reviewed Prisma migrations, least-privilege database credentials, encrypted database connections, and separate off-site backups with a tested restore process before production deployment. Hostinger plan compatibility and production PostgreSQL connectivity have not been verified.

## Git

Git is initialized on the `main` branch. Before publishing, create a private GitHub repository and add its URL as `origin`:

```powershell
git remote add origin https://github.com/ORG/REPOSITORY.git
git add .
git commit -m "Create WEBNEX Phase 1 foundation"
git push -u origin main
```

## Phase 3 status and remaining work

- PostgreSQL 16 is running locally, but `psql` is not installed and no usable database credentials or separate test database were provided. Migrations, seed, DB health, published-content queries, enquiry persistence, constraints, idempotency, and DB rate limiting have not been verified against PostgreSQL.
- The new SQL migration is additive and reviewed in source, but it has not been applied. Do not claim the application has a verified DB connection.
- Public API routes are implemented, but public page rendering/navigation/search is not yet wired to these records.
- Administrator login/logout, credentials hashing, active-account and session-version checks, seeded RBAC, protected admin routes, and first-admin bootstrap are implemented in code, but cannot be verified against PostgreSQL without valid credentials. MFA and password reset are not implemented.
- An outbox row is created with each enquiry; email delivery and outbox retry processing are not implemented pending provider approval. The API success response means the enquiry is stored and notification is queued, not emailed.
- Full media upload/management is not implemented. Existing media rows store metadata only; persistent object storage must be selected and configured before uploads.
- A shared-proxy deployment needs a trusted `x-real-ip` header for per-client rate limits; verify Hostinger's proxy behavior before launch.
- Database backups/restore, production credentials, and deployment have not been configured or verified.
- Projects, case studies, articles, testimonials, contact details, and legal policies are not fabricated. Their pages show an honest empty or approval-required state until verified content is supplied.
- The privacy and terms pages explicitly state that legal review is pending and are excluded from indexing.
- Hostinger production hosting compatibility remains unverified.

Before marking Phase 3 complete, configure a dedicated PostgreSQL test DB, add and run integration/security tests against it, apply and verify the migrations, wire public pages to persisted content, and resolve notification provider configuration.

## Phase 4 implementation status

Implemented in code: Auth.js Credentials login/logout, bcrypt password hashes, eight-hour signed sessions, database-backed account activation/session-version checks, dual login rate limits, temporary account lockout after five invalid attempts, generic authentication failures, login audit records, server-side role/permission checks, protected admin pages/APIs, and an interactive one-time Super Admin bootstrap.

The initial role definitions are `SUPER_ADMIN`, `ADMIN`, `EDITOR`, and `SALES`. `SUPER_ADMIN` receives all seeded permissions; `ADMIN` manages content/media/enquiries but not users, roles or audit logs; `EDITOR` receives dashboard/editorial/media permissions but no enquiry or user access; `SALES` receives dashboard/enquiry permissions. Per-item editor assignment scopes are not implemented.

Implemented admin routes are `/admin/login`, `/admin`, `/admin/enquiries`, `/admin/enquiries/[id]`, `/admin/users`, `/admin/audit-logs`, and `/admin/unauthorized`. Dashboard metrics and records query PostgreSQL directly and are permission-scoped; no mock statistics are shown. Enquiries support server-side search, status/service/date/assignee filters, pagination, detail, internal notes, status, assignee and follow-up changes, with audit events. User management is limited to Super Admin permissions, hashes initial passwords, prevents self role/deactivation changes, protects the last active Super Admin under a transaction lock, invalidates sessions on account/role changes, and writes audit records.

Password reset is intentionally unavailable until an email provider is approved. No administrator invite email, MFA, content CRUD, media storage/upload, editable settings/navigation, or complete permission-definition editor has been implemented. Admin navigation identifies unfinished content modules as pending instead of offering dead links.

**Phase 4 verification is blocked:** the local PostgreSQL service rejected configured credentials (`28P01`/Prisma `P1000`). The Phase 3 and Phase 4 migrations are not applied, and there is no dedicated test DB. Auth success/failure, logout/session expiry, lockout against persisted users, RBAC boundaries, last-Super-Admin protection, enquiry management, user management, migration integrity, and audit persistence have therefore not been integration-tested. Do not treat Phase 4 as complete or production-ready until these tests run against an isolated PostgreSQL database and all remaining required content/media modules are implemented.

## Public Phase 2 routes

- `/`, `/about`
- `/services`, `/services/[slug]`
- `/projects`, `/projects/[slug]`
- `/case-studies`, `/case-studies/[slug]`
- `/industries`, `/industries/[slug]`
- `/insights`, `/insights/[slug]`
- `/contact`, `/privacy`, `/terms`
- `/sitemap.xml`, `/robots.txt`, and a custom not-found page
