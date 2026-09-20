# Incident Response Plan

## Purpose

This plan defines how DFP NEO security incidents are identified, triaged, contained, reported and learned from.

## Incident Types

Security incidents may include:

- suspected unauthorised access;
- compromised user account;
- exposed secret or environment variable;
- unauthorised configuration or permission change;
- suspicious upload or malicious workbook;
- data loss, corruption or unauthorised deletion;
- unusual audit log activity;
- supplier or cloud platform incident;
- availability outage with suspected security cause;
- vulnerability exploitation.

## Severity Levels

| Severity | Description | Initial Response Target |
| --- | --- | --- |
| Critical | Confirmed compromise, data exposure, destructive action, or active exploitation | Immediate response |
| High | Strong suspicion of compromise, privileged account concern, serious vulnerability exposure | Same business day |
| Medium | Suspicious event requiring investigation | Within 2 business days |
| Low | Security observation or minor policy deviation | Track and review |

## Response Steps

1. Identify and record the event.
2. Preserve relevant logs and evidence.
3. Triage severity and affected scope.
4. Contain the issue.
5. Notify internal owner and customer contact where applicable.
6. Eradicate the cause.
7. Restore service if impacted.
8. Review audit logs and data changes.
9. Document root cause, timeline, impact and remediation.
10. Update controls and this evidence pack.

## Evidence To Capture

- incident ID;
- date/time detected;
- detecting user/system;
- affected deployment;
- affected user/accounts;
- affected data categories;
- log extracts;
- screenshots or traces;
- containment action;
- customer notification decision;
- root cause;
- corrective actions;
- closure approval.

## Current Open Work

- Define named incident manager and deputy.
- Define customer notification templates.
- Define incident evidence storage location.
- Define annual tabletop exercise cadence.
- Configure centralised security event export.
