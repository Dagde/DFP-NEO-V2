# Plan Of Action And Milestones

## Purpose

This POA&M tracks open security work, residual risk treatment and readiness tasks for DFP NEO.

## Open Items

| ID | Priority | Item | Current State | Required Outcome | Owner | Target | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POAM-001 | High | `xlsx` dependency risk | `npm audit` reports high advisories with no npm fix | Replace, isolate, sandbox or formally risk-accept workbook parsing | Engineering | Phase 1 | Open |
| POAM-002 | High | Prisma/deepmerge advisory | `npm audit` reports high advisory through Prisma tooling | Safely upgrade Prisma path or risk-treat if not runtime-exposed | Engineering | Phase 1 | Open |
| POAM-003 | High | Raw SQL review | Many raw SQL calls exist | Review unsafe queries for injection and privilege risk | Engineering | Phase 1 | Open |
| POAM-004 | High | MFA/SSO | Password auth exists; no enterprise MFA/SSO evidence | Define and implement enterprise identity option | Product/Engineering | Phase 3 | Open |
| POAM-005 | High | Central logging | Database audit log exists; no central SIEM/export evidence | Configure central log export and review workflow | Operations | Phase 3 | Open |
| POAM-006 | High | Backup/restore evidence | No restore-test evidence in repo | Document encrypted backups and complete restore test | Operations | Phase 3 | Open |
| POAM-007 | Medium | Supplier/cloud register | Initial register created but incomplete | Complete Railway, database, SMTP and GitHub supplier evidence | Operations | Phase 2 | Open |
| POAM-008 | Medium | Classification decision | Default sensitivity assumption only | Record customer-specific data classification | System owner | Phase 2 | Open |
| POAM-009 | Medium | Incident response exercise | Plan created; no exercise evidence | Run tabletop and record result | System owner | Phase 3 | Open |
| POAM-010 | Medium | Change/release evidence | Git commits exist; no formal release checklist | Add release checklist and rollback procedure | Engineering | Phase 2 | Open |

## Closed Items

| ID | Closed In | Summary |
| --- | --- | --- |
| POAM-CLOSED-001 | `d18996e2` | Browser auth restore now requires server-validated session; legacy local-storage auth shortcut removed. |
