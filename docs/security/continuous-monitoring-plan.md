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
- deployment or environment variable change.
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

## Current Open Work

- Select central logging/SIEM destination.
- Define alert thresholds.
- Define audit log retention and export.
- Add operational runbook for reviewing security events.
