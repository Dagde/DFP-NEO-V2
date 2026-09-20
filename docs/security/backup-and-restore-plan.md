# Backup And Restore Plan

## Purpose

This plan defines the backup and restore evidence required for DFP NEO production deployments.

## Backup Scope

Back up:

- PostgreSQL database;
- uploaded/imported operational data if retained outside the database;
- manual/document artefacts if hosted with customer data;
- application environment configuration excluding secrets stored separately;
- deployment version and commit SHA;
- security/audit logs if not retained in the database.

## Required Backup Controls

- encrypted backups;
- access restricted to approved backup administrators;
- retention period documented per customer;
- backups stored separately from the running application;
- deletion protection or immutability where available;
- restore testing before production and at least quarterly thereafter;
- restore procedure documented with expected RPO/RTO.

## Minimum Restore Test

For each production deployment:

1. Record backup source and timestamp.
2. Restore into an isolated environment.
3. Confirm application starts.
4. Confirm login works with a test/admin account.
5. Confirm sample schedule, personnel, training and audit data exists.
6. Confirm restored data is not connected to production users or email delivery.
7. Record restore duration and result.

## Evidence Template

| Field | Value |
| --- | --- |
| Deployment |  |
| Backup provider |  |
| Database backup frequency |  |
| Backup retention |  |
| Backup encryption evidence |  |
| Backup access owner |  |
| Last restore test date |  |
| Restore duration |  |
| RPO |  |
| RTO |  |
| Result |  |
| Residual risks |  |

## Current Open Work

- Confirm Railway/PostgreSQL backup capability and retention.
- Define customer-specific RPO/RTO.
- Add restore-test record before representing production readiness.
- Define audit log retention independent of operational database backup.
