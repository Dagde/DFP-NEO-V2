# Change And Configuration Management Plan

## Purpose

This plan defines how DFP NEO code, configuration and deployment changes are controlled.

## Change Types

- code changes;
- database schema changes;
- settings/default configuration changes;
- security control changes;
- dependency upgrades;
- hosting/runtime changes;
- environment variable changes;
- backup/logging changes;
- customer-specific deployment changes.

## Minimum Change Record

Each production change should record:

- change ID or commit SHA;
- change owner;
- reason for change;
- risk/impact assessment;
- files or services changed;
- tests run;
- approval;
- deployment time;
- rollback plan;
- post-deployment check.

## Source Control

Current working repository:

- GitHub: `Dagde/DFP-NEO-V2`
- Branch currently used for work: `feature/comprehensive-build-algorithm`

Website/manual repository:

- GitHub: `Dagde/DFP-NEO-Website`

## Configuration Evidence

For each deployment, record:

- environment variables used, without secret values;
- hosting region;
- database region;
- feature flags and licence mode;
- CORS/allowed origins;
- backup settings;
- logging destination;
- domain and TLS configuration.

## Open Work

- Add release checklist.
- Add deployment rollback procedure.
- Add environment variable inventory template.
- Add customer-specific configuration baseline export.
