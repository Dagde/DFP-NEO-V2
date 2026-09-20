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

## Current Open Work

- Select central logging/SIEM destination.
- Define alert thresholds.
- Define audit log retention and export.
- Add operational runbook for reviewing security events.
