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

## Checks Performed

The posture report checks and records:

- production runtime mode;
- database connection presence;
- session signing secret presence and minimum length;
- server-side browser session cookie posture;
- secure cookie mode;
- CORS origin allow-list posture;
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

## Current Limitations

The posture report is not a certification result. It is an operational guardrail and evidence aid.

Open work remains for:

- central log export and alerting configuration;
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
- evidence of configured central logging or the accepted alternative;
- evidence of backup configuration and restore test;
- deployment platform security settings and access list.
