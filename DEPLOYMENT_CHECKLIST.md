# Deployment Checklist

**Status:** Not deployment-approved. Render is the selected hosting target; the service plan, database setup and production domain have not been confirmed.

## Hosting and architecture

- [ ] Confirm the Render web service supports the project's required Node.js version (currently Node.js 20.19+; local verification used v24.19.0).
- [ ] Confirm secure PostgreSQL connectivity from that runtime, connection limits/pooling, TLS and migration execution.
- [ ] Confirm support for environment variables, HTTPS, deployment workflow, webhook ingress and scheduled/background workers.
- [ ] Attach a paid Render persistent disk mounted at `/var/data`; set `OBJECT_STORAGE_DRIVER=filesystem` and `OBJECT_STORAGE_FILESYSTEM_PATH=/var/data/webnex-media`. Keep the service at one instance and verify the disk's backup/recovery plan, or configure a private S3-compatible bucket instead.
- [ ] If shared hosting cannot meet runtime/database/worker requirements, select a compatible VPS or managed application/database hosting. Do not deploy based on shared-hosting assumptions.
- [ ] Confirm the `.com` domain and final canonical HTTPS origin.

## Environment separation

- [ ] Maintain separate development, staging and production databases and credentials.
- [ ] Create separate high-entropy `AUTH_SECRET` and `RATE_LIMIT_SECRET` values per environment.
- [ ] Configure server-only `DATABASE_URL`; never expose it with a `NEXT_PUBLIC_` prefix.
- [ ] Configure `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` to the correct HTTPS production origin.
- [ ] Confirm the trusted reverse proxy overwrites the IP header used for rate limiting.
- [ ] Configure `SENDGRID_API_KEY`, verified `SENDGRID_FROM_EMAIL` and approved `NOTIFICATION_TO_EMAIL` only after SendGrid setup and recipient approval.
- [ ] Leave `SENDGRID_CUSTOMER_ACKNOWLEDGEMENTS=false` unless customer acknowledgement behavior is explicitly approved.
- [ ] Store secrets in the hosting secret manager/environment settings; never in Git, build output or logs.

## Database and release

- [ ] Provision an isolated staging PostgreSQL database and verify application connectivity.
- [ ] Review all five migrations; apply them to staging using `npm run db:deploy`.
- [ ] Verify migration status, constraints, indexes, seed roles and admin bootstrap.
- [ ] Run database integration and end-to-end tests before production approval.
- [ ] Configure automated encrypted backups and complete an isolated restore test.
- [ ] Confirm deploy rollback procedure and database migration compatibility plan.

## Application checks

- [ ] Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and the full dependency audit in CI.
- [ ] Test admin role boundaries and public API privacy on staging.
- [ ] Verify public pages, contact submission, sitemap, robots and canonical metadata using the confirmed domain.
- [ ] Verify HTTPS, security headers, error handling and no secret leakage.
- [ ] Configure uptime, error, database and background-job monitoring.
- [ ] Select an error-monitoring provider (for example Sentry) and an uptime monitor (for example Better Stack or UptimeRobot) only after privacy, retention and cost review; no paid service has been installed or authorized here.
- [ ] Enable the selected PostgreSQL provider's connection, saturation, backup and slow-query metrics; add alerts for outbox queue age, failed dispatches and scheduler silence.
- [ ] Ensure application logs include request IDs and sanitized failure context, but exclude passwords, session tokens, API keys and unnecessary customer data.
- [ ] If using SendGrid, run an approved test-recipient delivery and verify outbox/retry semantics; do not treat provider acceptance as delivery.
- [ ] Schedule `npm run email:dispatch` only after confirming scheduler availability, concurrency and alerting. It is not automatically scheduled by the app.
- [ ] Complete mobile layout, accessibility and performance checks on the deployed staging environment.
- [ ] Obtain content/legal approval for public company claims, privacy notice and terms.

## Go-live approval

- [ ] All critical blockers in `PRODUCTION_READINESS_REPORT.md` are resolved or explicitly accepted by the owner.
- [ ] Recovery objectives are approved and demonstrated.
- [ ] Hosting capabilities, domain, credentials, support ownership and rollback contacts are recorded.
- [ ] The user has approved deployment. No deployment has been performed as part of Phase 7.
