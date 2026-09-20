# Platform Security Controls

## Purpose

This document records the Phase 3 platform guardrails now available for DFP NEO deployments.

## Implemented Controls

DFP NEO now includes a security posture check that can be run locally or read by an authenticated administrator.

Local command:

```bash
npm run security:posture
```

Admin API:

```text
GET /api/security/posture
```

The API requires the same server-side browser session cookie used by the authenticated application and is limited to `ADMIN` and `SUPER_ADMIN` users.

Security event evidence export:

```text
GET /api/security/events/export
GET /api/security/events/export?format=json
```

The export is also limited to `ADMIN` and `SUPER_ADMIN` users. CSV is the default format. JSON is available when a structured evidence file is preferred.

Security evidence bundle:

```text
GET /api/security/evidence-bundle
GET /api/security/evidence-bundle?redacted=true
```

The bundle is also limited to `ADMIN` and `SUPER_ADMIN` users. It downloads one JSON file containing the deployment posture, monitoring status and recent security events for review evidence.

Use `redacted=true` when the bundle may be shared outside the internal operator group. The redacted bundle masks operational identifiers such as admin names, usernames, email addresses, personnel IDs, person IDs, IP addresses, user agents and message IDs.

Phase 4 dependency security evidence:

```bash
npm run security:dependencies
```

JSON format:

```bash
npm run security:dependencies -- --json
```

This report records `npm audit` evidence for production dependencies and all dependencies. Findings still require DFP NEO context review before they are treated as exploitable, remediated or formally risk-accepted.

Phase 4 raw SQL review evidence:

```bash
npm run security:sql
```

JSON format:

```bash
npm run security:sql -- --json
```

This report inventories Prisma raw SQL use in live source files and triages calls by risk. High-risk findings have been reduced to zero in the current baseline; reviewed dynamic SQL remains visible in the report and requires continued change-control review.

## Checks Performed

The posture report checks and records:

- production runtime mode;
- database connection presence;
- session signing secret presence and minimum length;
- server-side browser session cookie posture;
- secure cookie mode;
- CORS same-origin enforcement posture;
- debug route flag state;
- testing function flag state;
- demo seed endpoint flag state;
- security event forwarding configuration;
- security event evidence export availability;
- security evidence bundle availability;
- redacted evidence bundle availability;
- baseline browser security header configuration;
- current CSP inline allowance risk.

The report deliberately records presence and status only. It does not expose secrets, token values, database URLs, webhook URLs or customer data.

DFP NEO treats same-origin-only browser access as the secure default. External CORS origins should only be configured through `DFP_NEO_ALLOWED_ORIGINS` when an approved customer portal, integration or companion application genuinely requires browser calls from another origin.

## Current Limitations

The posture report is not a certification result. It is an operational guardrail and evidence aid.

Open work remains for:

- customer-specific central log export and alerting configuration where required;
- backup/restore evidence;
- enterprise SSO/MFA;
- dependency treatment;
- raw SQL review;
- CSP tightening after frontend bundle validation.

## Evidence To Retain

For each production deployment, retain:

- a generated `npm run security:posture` report;
- screenshot or export of `/api/security/posture` from an admin session;
- a security event export from `/api/security/events/export`;
- a security evidence bundle from `/api/security/evidence-bundle`;
- a redacted evidence bundle from `/api/security/evidence-bundle?redacted=true` for customer or assessor sharing;
- evidence of configured central logging or the accepted interim local audit/export control;
- evidence of backup configuration and restore test;
- deployment platform security settings and access list.
- dependency security report from `npm run security:dependencies`.
- raw SQL review report from `npm run security:sql`.
