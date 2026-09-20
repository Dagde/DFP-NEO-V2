# Supplier And Cloud Service Register

## Purpose

This register records external providers and cloud services used by DFP NEO deployments. It must be completed per deployment before production use.

## Register

| Service | Purpose | Data Processed | Region/Data Location | Current Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| GitHub | Source repository and deployment source control | Source code, issues/PRs if used | To be confirmed | Repository access controls required | Open |
| Railway | Current application hosting for production testbed | Application runtime, logs, environment variables | To be confirmed | Hosting/security assessment required | Open |
| PostgreSQL provider | Application database | Personnel, schedule, audit, configuration data | To be confirmed | Backup/encryption/access evidence required | Open |
| SMTP/email provider | Activation/password/admin email delivery | Email addresses, activation/reset content | To be confirmed | Provider and contract/security evidence required | Open |
| NOAA Aviation Weather Center | TAF data source | ICAO request only, public weather data | External public service | Server-side cached integration implemented | Monitor |
| Browser vendor | End-user client execution | Local application state and cookies | User controlled | User/browser policy outside app boundary | Noted |

## Required Fields For Each Production Deployment

For each provider, record:

- provider name;
- service name;
- business owner;
- technical owner;
- contract or subscription reference;
- data categories processed;
- data classification accepted for the service;
- storage, processing and backup regions;
- security certification or assessment evidence;
- incident notification contact and SLA;
- support access model;
- exit/export plan;
- last security review date;
- next security review date.

## Approval Rule

No supplier should be used for production customer data until the deployment owner has accepted:

- provider suitability for the intended classification;
- data location;
- backup and deletion behaviour;
- incident notification terms;
- administrative access controls;
- residual risk.
