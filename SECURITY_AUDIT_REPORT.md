# Security Audit Report

**Audit date:** 2026-11-11  
**Review type:** Independent read-only code review of the local application. No external targets, destructive testing, penetration testing or production data were used.

## Result

The independent security reviewer reported **no confirmed exploitable vulnerabilities in application code** in the reviewed scope. A separate full dependency audit did find one moderate vulnerability repeated across seven transitive dependency records in development tooling; see below. This is not a security certification and does not establish that the system is secure in production. The database, live authentication flows, SendGrid, uploads and deployment configuration could not be verified end to end.

## Review coverage

The review scope included authentication and authorization implementation, API routes, input validation, data exposure, uploads/media, integrations, secrets/configuration, headers and database access controls where implemented.

| Area | Finding |
|---|---|
| Authentication | Auth.js Credentials and bcrypt-based password handling are implemented. Session lifecycle, logout invalidation and lockout persistence were not exercised against a working database. |
| Authorization | Admin routes use server-side permission checks in code; one anonymous admin API request returned 401. Role-specific positive and negative tests remain not tested. |
| Validation and queries | Request validation and ORM-backed persistence patterns exist; targeted malformed-input tests pass for enquiry and CMS service validation. No live database behavior was verified. |
| CSRF/origin protection | Same-origin checks are used by state-changing admin APIs and enquiry submission. Full browser/session testing remains not tested. |
| XSS and uploads | Content rendering uses structured/text content in the implemented Services slice. Uploads are not implemented, so upload controls are not assessable. |
| Secrets/configuration | `.env.example` contains placeholders. Runtime secrets must be independently configured and kept out of client code and source control. |
| External services | SendGrid credentials are absent; WhatsApp is a consent-gated click-to-chat link, not an API delivery integration. |
| Database | PostgreSQL rejected the configured credentials with `28P01`; access controls, migrations and data exposure behavior could not be verified against a live database. |
| Webhooks | No webhook endpoints are implemented in the route inventory; signature, replay and deduplication controls therefore are not applicable to current routes. |

## Required pre-production security checks

- Re-run authentication and authorization tests using persisted accounts for `SUPER_ADMIN`, `ADMIN`, `EDITOR` and `SALES`; test direct URLs and API calls, not only hidden UI controls.
- Apply migrations only to an isolated test database first; verify least-privilege application credentials, TLS and backup access restrictions.
- Configure unique, high-entropy `AUTH_SECRET` and `RATE_LIMIT_SECRET` values per environment. Verify `.env` stays ignored and CI logs never print secrets.
- Configure proxy trust correctly for IP-based rate limiting and verify the deployment overwrites any client-supplied forwarding headers.
- Test public content endpoints against draft/unpublished records, and test that private notes, customer data and audit events are inaccessible without permissions.
- Before implementing uploads or webhooks, design server-side type/size/content checks, private storage policies, signed webhook verification, idempotency and replay handling.
- Review security headers and deployment TLS behavior on the selected Hostinger plan or alternative before launch.

## Dependency audit

`npm audit --audit-level=moderate` initially reported seven moderate transitive records rooted in `minimatch`'s denial-of-service advisory [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). The affected package was a development-only nested dependency beneath `@typescript-eslint/typescript-estree`. `npm audit fix` did not change the resolution. A narrow `package.json` override now resolves this parser dependency to `minimatch@11.0.8` (`package-lock.json:2984`); both full and production audits report zero vulnerabilities, and lint, typecheck and tests pass. The parser declares a `^10` range, so this intentionally crosses its declared major version. The parser call site uses the `minimatch` named function, which is present in v11, and the project's Node.js floor meets v11's engine requirement. Keep the override explicit, retain regression checks, and remove it when the upstream parser releases a compatible patched range.

`npm audit --omit=dev --audit-level=moderate` reported **0 vulnerabilities** in production dependencies. Do not interpret the production-only result as a full dependency clearance.
