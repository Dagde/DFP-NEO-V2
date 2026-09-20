# System Security Plan

## Purpose

This document defines the security boundary and baseline controls for DFP NEO. It is a living system security plan for assessment readiness and customer deployment planning.

## System Overview

DFP NEO is a defence aviation scheduling and training management platform. It supports multiple operating models, including Flight School, Air Combat, Fixed Crew, and Pooled Crew models.

Core functions include:

- daily flying program scheduling;
- NEO Build scheduling assistance;
- staff, trainee, LMP, training package, aircraft and resource management;
- training reports and logbook-derived metrics;
- My Home dashboards;
- audit, diagnostics, publishing and deployment readiness functions;
- website/manual/admin support in a separate website repository.

## Security Boundary

The core application boundary includes:

- React/Vite browser client;
- Express application server in `server.js`;
- PostgreSQL database accessed via Prisma and selected raw SQL;
- deployment platform and runtime environment;
- authentication/session handling;
- uploaded workbook processing;
- audit logging and platform configuration;
- external integrations, including email delivery and weather data services.

The website/manual repository is a separate system component and should have its own deployment evidence. Shared identity, admin, manual upload, or analytics behaviour must be recorded in the supplier/cloud register when deployed.

## In-Scope Data

The system may process:

- staff names, ranks, roles, qualifications and scheduling constraints;
- trainee names, course progress and training results;
- daily flying program details;
- training report and logbook-derived data;
- operational location, unit, aircraft/resource configuration;
- audit logs including user, IP address and user agent;
- deployment, licensing and platform configuration data.

## Initial Classification Assumption

Default planning assumption: operational and personnel scheduling data should be treated at least as sensitive organisational information. A customer-specific data classification decision is required before production use.

DFP NEO must not be represented as approved for OFFICIAL: Sensitive, PROTECTED, SECRET, or any customer-specific Defence classification without a deployment-specific assessment and authorisation decision.

## Authentication And Sessions

Current implemented controls:

- password authentication with bcrypt hashing;
- server-side session records;
- browser session restore through `HttpOnly`, `Secure`, `SameSite=Lax` cookie;
- production JWT secret requirement;
- direct logout clears the server cookie and deletes the server session;
- activation code fields support controlled first access and forced password change.

Controls requiring further work:

- MFA or enterprise SSO;
- session idle timeout policy;
- formal password and lockout policy;
- privileged access review cadence;
- customer identity provider integration for enterprise deployments.

## Authorisation

Roles and permissions exist in application configuration and account access workflows. A formal role matrix is required for assessment.

Minimum required evidence:

- role names and capabilities;
- privileged roles and approval workflow;
- account creation, deactivation and password reset workflow;
- access review record.

## Audit And Logging

Current implemented controls:

- `AuditLog` model records actions, entity type, entity ID, changes, IP address, user agent and created time;
- security audit helper redacts sensitive values with password/token/secret/key names;
- selected security events and upload decisions are logged.

Controls requiring further work:

- centralised log export;
- immutable/protected retention;
- alerting rules;
- log review ownership and cadence;
- clock/time-source evidence.

## Upload And Content Handling

Current implemented controls:

- spreadsheet uploads are limited by file size, field count and workbook dimensions;
- macro-enabled workbooks are rejected;
- workbook macro/ActiveX/external content indicators are checked;
- upload security events are written.

Controls requiring further work:

- formal risk treatment for the `xlsx` dependency;
- malware scanning or sandboxing for uploaded files in higher assurance deployments;
- file retention/deletion policy.

## Cryptography And Secrets

Current implemented controls:

- HTTPS is required in production deployment;
- HSTS is set for secure/proxied HTTPS requests;
- JWT secret is required in production;
- selected SMTP secrets can be encrypted at rest in settings.

Controls requiring further work:

- key ownership and rotation procedure;
- secret inventory;
- TLS configuration evidence from hosting provider;
- post-quantum transition statement for future procurements when required.

## Backups And Recovery

Backups and recovery are not proven by code alone. The deployment owner must maintain evidence of database backups, retention, encryption, access restrictions and restore testing.

See [Backup And Restore Plan](backup-and-restore-plan.md).

## Open Risks

Open risks are tracked in [Plan Of Action And Milestones](plan-of-action-and-milestones.md).
