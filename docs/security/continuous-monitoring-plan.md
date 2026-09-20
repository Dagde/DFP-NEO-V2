# Continuous Monitoring Plan

## Purpose

This plan defines the monitoring needed to detect security-relevant events and maintain evidence for DFP NEO deployments.

## Current Application Signals

DFP NEO currently has:

- application audit log records;
- security event helper with redaction;
- login and password change events;
- upload accept/reject events;
- rate-limit blocked events;
- platform configuration audit entries;
- admin-only security event and status APIs;
- admin-only deployment security posture API;
- admin-only security event export API;
- admin-only security evidence bundle API;
- local `npm run security:posture` report command;
- deployment/runtime logs through the hosting platform.

## Required Monitoring Controls

For production deployments, configure:

- centralised log export;
- protected/immutable retention where available;
- alerting for suspicious events;
- routine review of admin/security events;
- time synchronisation evidence;
- log retention period aligned to customer requirements.

## Accepted Interim Monitoring Control

Until a customer-approved SIEM, webhook, managed log destination or SOC workflow is selected, DFP NEO's accepted interim monitoring control is:

- security-relevant events are written to the application audit log;
- administrators can review current security status through `/api/security/status`;
- administrators can export security event evidence through `/api/security/events/export`;
- administrators can download full internal evidence through `/api/security/evidence-bundle`;
- administrators can download redacted external evidence through `/api/security/evidence-bundle?redacted=true`;
- the security posture report clearly records whether external security event forwarding is configured.

This interim control is accepted for product development, internal assurance, testbed demonstrations and early customer review. It is not a substitute for a customer-approved central monitoring destination for higher-assurance production deployments. The deployment owner must either configure external forwarding or formally accept the residual risk for that deployment.

## Events To Monitor

- failed login spikes;
- successful privileged/admin login;
- password reset/change;
- new user creation;
- role or permission change;
- platform configuration change;
- workbook upload rejection for unsafe content;
- rate-limit block;
- account deletion/deactivation;
- emergency/freeze/security control change;
- unexpected server errors on auth/admin endpoints;
- backup/restore failure;
- deployment or environment variable change;
- failed security posture check before release or customer handover.

## Evidence Template

| Field | Value |
| --- | --- |
| Deployment |  |
| Log source |  |
| Central log destination |  |
| Retention period |  |
| Alert owner |  |
| Review cadence |  |
| Last review date |  |
| Findings |  |
| Actions |  |

## Security Event Evidence Export

An administrator can export locally stored security monitoring events for review:

```text
/api/security/events/export
```

Optional filters:

- `days`: number of days to include, default 30;
- `limit`: maximum records to include, default 500;
- `severity`: filter by severity;
- `eventType`: filter by event type;
- `format=json`: export JSON instead of CSV.

Retain the export with the security review evidence for the deployment. This export is not a replacement for central monitoring, but it provides a practical evidence source until a customer-approved SIEM, webhook, or managed log destination is configured.

## Security Evidence Bundle

An administrator can download a combined JSON evidence bundle:

```text
/api/security/evidence-bundle
/api/security/evidence-bundle?redacted=true
```

The bundle includes:

- deployment posture report;
- monitoring status;
- recent security events;
- the applied export filters;
- generation time and admin role.

Use this as the preferred quick evidence capture during customer review, internal security review, release assurance, and pre-deployment checks.

Use the `redacted=true` version when the file may be shared outside the internal operator group. The redacted version masks operational identifiers such as names, usernames, email addresses, personnel IDs, person IDs, IP addresses, user agents and message IDs.

## Current Open Work

- Select central logging/SIEM destination when required by a customer deployment.
- Define alert thresholds for the selected central monitoring destination.
- Define audit log retention and export for each deployment.
- Add operational runbook for reviewing security events.
