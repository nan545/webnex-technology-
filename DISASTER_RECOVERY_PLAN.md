# Disaster Recovery Plan

**Status:** Proposed only. No backup provider, schedule, retention policy or restoration has been configured or verified.

## Recovery objectives

Proposed initial objectives, subject to business and hosting approval:

- **RPO:** 24 hours maximum data loss for PostgreSQL, using at least daily backups. Reduce the RPO if enquiry and CRM data volume/value requires it.
- **RTO:** 8 hours to restore the core site and database after a recoverable infrastructure incident. This is a planning target, not a measured capability.

## Backup design

1. Use managed PostgreSQL point-in-time recovery where available; otherwise schedule encrypted logical backups (`pg_dump` custom format) at least daily.
2. Store backups in a separate account/region or provider, encrypted in transit and at rest, with least-privilege access and MFA.
3. Proposed retention: 30 daily copies and 12 monthly copies. Confirm storage cost and legal retention needs before configuration.
4. Do not store backup credentials in the repository or application runtime. Rotate and audit access.
5. Keep schema migrations and deployment artifacts separately versioned; database backups do not replace migration review.
6. Media uploads are not implemented and no object-storage provider is configured. If persistent media is introduced, define object versioning, lifecycle, access controls and an independent restore path before launch.

## Recovery procedure

1. Declare the incident, identify the affected environment and stop changes that could worsen data loss.
2. Select a verified backup and record its timestamp/checksum; preserve the original backup.
3. Restore only to a new isolated PostgreSQL instance. Never overwrite production during a recovery exercise.
4. Apply any required reviewed migration steps, validate schema and critical row counts, then run application smoke and permission tests using restricted test accounts.
5. Validate public pages, admin login, enquiry persistence and outbox state before routing traffic.
6. Obtain owner approval before switching production DNS or connections. Record actual RPO/RTO and unresolved data gaps.

## Recovery testing and ownership

- Test a restore into an isolated environment at least quarterly and after major database/migration changes.
- Keep evidence of backup completion, restore duration, checksum, schema validation and application smoke checks.
- Assign an owner and an alternate for backup monitoring, restore approval and credential recovery before deployment.
- Monitor backup-job failures and alert on missed schedules; a backup that has not been restored is not proven recoverable.

## Current gaps

- No usable PostgreSQL credentials were available during Phase 7; database connectivity returned `28P01`.
- No backup job, retention configuration, encryption verification, restore exercise or recovery access policy was provided.
- No media object store exists to test or back up.
- Proposed objectives and retention are not approved or technically verified against the selected Hostinger plan.
