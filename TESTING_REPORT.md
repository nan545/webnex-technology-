# Testing Report

**Audit date:** 2026-11-11  
**Environment:** Windows, Node.js v24.19.0, npm 11.17.0, production Next.js build; no authenticated test account or working PostgreSQL credentials.

## Executed checks

| Check | Command or method | Expected | Actual | Result |
|---|---|---|---|---|
| ESLint | `npm run lint` | No lint errors | Exit 0 | PASS |
| TypeScript | `npm run typecheck` | No type errors | Exit 0 | PASS |
| Automated tests | `npm test` | All selected tests pass | 19 passed, 0 failed | PASS |
| Prisma schema | `npm exec -- prisma validate` | Valid schema | Valid | PASS |
| Production build | `npm run build` | Generated Prisma client and compiled routes | Exit 0; public, admin and API routes generated | PASS |
| Full dependency audit | `npm audit --audit-level=moderate` | No known moderate-or-higher advisories | After scoped parser override, 0 vulnerabilities | PASS |
| Production dependency audit | `npm audit --omit=dev --audit-level=moderate` | No known moderate-or-higher advisories | 0 vulnerabilities | PASS |
| Advisory remediation | Scoped `minimatch@11.0.8` override for TypeScript ESTree | Remove the transitive advisory without broad upgrades | `npm ls` confirms v11.0.8; lint, typecheck, tests and audits pass | PASS; major override disclosed in security report |
| Database connection | `npm run db:check` | `SELECT 1` succeeds | PostgreSQL auth failed, code `28P01` | FAIL / BLOCKED |
| API health | `GET /api/v1/health` | HTTP 200 with working PostgreSQL | HTTP 503 | FAIL / BLOCKED |
| Anonymous admin API | `GET /api/admin/v1/enquiries` | Reject unauthenticated caller | HTTP 401 | PASS (negative access check only) |
| Public route smoke | Integrated browser against local production build | Main routes render | 13 sampled routes returned 200; HTML routes had one H1 | PASS (render smoke only) |
| Sitemap/robots | Integrated browser | Routes serve their content | Both returned 200 | PASS (content/canonical correctness not fully assessed) |
| Mobile/tablet/desktop overflow | Browser viewport checks at 375, 390, 430, 768, 1024, 1440, 1920 | No horizontal overflow | None observed on homepage | PASS (homepage only) |
| Authenticated workflows | Requires working DB and bootstrap account | Login, logout, roles and workflows function | Could not run | NOT TESTED |
| PostgreSQL migration/integration tests | Requires isolated PostgreSQL test DB | Migrations and persistence verified | No usable DB credentials; `psql` and `pg_isready` CLI tools unavailable | NOT TESTED |
| SendGrid delivery | Requires approved provider configuration/test recipient | Provider response and retry behavior verified | No credentials/configuration; no send attempted | NOT TESTED |
| Unconfigured outbox dispatcher | `npm run email:dispatch` | Must fail before claiming/sending queued messages when provider settings are absent | Exited with explicit SendGrid configuration error; no send attempted | PASS (safe failure path) |
| Browser performance | Local one-run browser navigation sample | Record Web Vitals | TTFB/FCP/load captured; LCP/INP/CLS not measured | PARTIAL |
| CI | Workflow inventory | Checks run on changes | No `.github/workflows` directory found | NOT CONFIGURED |

The 19 automated tests cover enquiry request validation, cross-origin rejection and failure paths, CMS service validation, WhatsApp number/link helpers and proposal validation. They do not constitute database integration or end-to-end CRM/auth/CMS tests.

## Notable test output

- Enquiry validation tests emit a warning that `RATE_LIMIT_SECRET` is absent in this local test environment. The endpoint fails closed as expected in the test.
- `db:check` reached PostgreSQL but authentication failed. No credentials were printed in this report.
- The initial full audit found one moderate development-tooling advisory, repeated across seven dependency records. A scoped parser override was added and validated; full and production audits now report zero vulnerabilities.
- The override crosses the parser's declared minimatch major range. It is intentionally narrow and must remain covered by lint/build checks until upstream provides a compatible release.

## Required next testing step

Configure a dedicated disposable PostgreSQL database (not production), apply all committed migrations, seed roles, bootstrap a test Super Admin, then add/run integration and end-to-end coverage for permission boundaries, enquiry idempotency, CMS publishing/revisions, tasks, proposals and outbox retries.
