# Data Classification And Flows

## Purpose

This document records the expected data categories, sensitivity considerations and main data flows for DFP NEO.

## Data Categories

| Data Category | Examples | Sensitivity Consideration | Current Handling |
| --- | --- | --- | --- |
| Personnel profile data | Staff/trainee name, rank, role, unit, ID, contact/account links | Personal and operationally sensitive | Stored in database |
| Training and progression data | LMP assignment, training reports, scores, completion state | Personal performance and readiness data | Stored in database |
| Schedule data | Daily flying program tiles, aircraft, crew, timing, events | Operational scheduling data | Stored in database and displayed in app |
| Configuration data | Organisation, location, unit, aircraft, resource rows, settings | Commercial and operational configuration | Stored in settings/database |
| Audit data | User, action, IP, user agent, changes | Security-relevant and potentially personal | Stored in `AuditLog` |
| Uploaded workbook data | Syllabus, trainee/staff imports | May contain personal and training data | Parsed server-side; retention policy required |
| Weather data | TAF by home airfield ICAO | Public feed data, operational context | Retrieved server-side and cached |
| Licensing/deployment data | License state, deployment readiness, module access | Commercial and operational control data | Stored in database/configuration |

## Classification Decision

Before each production deployment, record:

- customer organisation;
- deployment environment;
- approved classification or sensitivity marking;
- whether the deployment contains Defence operational information;
- whether the deployment contains personal information;
- whether data residency requirements apply;
- whether external suppliers are permitted to process, store or transmit data.

## Primary Data Flows

1. Browser user authenticates to the DFP NEO server.
2. Server validates credentials and creates a server-side session.
3. Browser receives an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie.
4. Browser calls same-origin APIs.
5. Server reads/writes operational data in PostgreSQL.
6. Server writes audit events for security-relevant and platform events.
7. Server may call approved external services, such as NOAA AWC for TAF data.
8. Server may send email through the configured SMTP provider.
9. Administrators may upload workbook files for syllabus or personnel data.
10. Deployment platform stores logs, environment variables and runtime artefacts.

## Data Residency

Data residency must be confirmed per deployment. Record:

- application region;
- database region;
- backup region;
- log region;
- email provider processing region;
- external service processing region;
- support access location.

## Retention Requirements

Minimum retention settings are to be defined per customer:

- active schedule and training records;
- archived/historical schedules;
- audit logs;
- account/session records;
- backup retention;
- uploaded file retention;
- incident evidence retention.

## Required Next Evidence

- customer-approved data classification decision;
- data flow diagram;
- database backup location;
- audit log retention setting;
- privacy and personal information handling decision;
- supplier processing locations.
