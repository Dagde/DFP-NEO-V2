# Plan Of Action And Milestones

## Purpose

This POA&M tracks open security work, residual risk treatment and readiness tasks for DFP NEO.

## Open Items

| ID | Priority | Item | Current State | Required Outcome | Owner | Target | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POAM-001 | High | `xlsx` dependency risk | `npm audit` reports high advisories with no npm fix; pre-parse workbook safety checks added to browser and server import paths | Replace, further isolate, sandbox or formally risk-accept workbook parsing | Engineering | Phase 4 | Open |
| POAM-003 | High | Raw SQL review | High-risk raw SQL findings reduced to zero; one testing-only Super Admin reset path remains marked as reviewed dynamic SQL | Retain repeatable scan evidence and review any future high-risk findings before release | Engineering | Phase 4 | Treated |
| POAM-004 | High | MFA/SSO | Password auth exists; no enterprise MFA/SSO evidence | Define and implement enterprise identity option | Product/Engineering | Phase 3 | Open |
| POAM-005 | High | Customer central monitoring integration | Interim local audit/export control accepted for Phase 3; no customer SIEM/export destination selected | Configure central log export and review workflow when required by a customer deployment | Operations | Customer deployment | Open |
| POAM-006 | High | Backup/restore evidence | No restore-test evidence in repo | Document encrypted backups and complete restore test | Operations | Phase 3 | Open |
| POAM-007 | Medium | Supplier/cloud register | Initial register created but incomplete | Complete Railway, database, SMTP and GitHub supplier evidence | Operations | Phase 2 | Open |
| POAM-008 | Medium | Classification decision | Default sensitivity assumption only | Record customer-specific data classification | System owner | Phase 2 | Open |
| POAM-009 | Medium | Incident response exercise | Plan created; no exercise evidence | Run tabletop and record result | System owner | Phase 3 | Open |
| POAM-010 | Medium | Change/release evidence | Git commits exist; no formal release checklist | Add release checklist and rollback procedure | Engineering | Phase 2 | Open |
| POAM-011 | Medium | CSP tightening | Current CSP allows inline script/style for frontend compatibility | Remove inline allowances after validating the built frontend bundle | Engineering | Phase 4 | Open |

## Closed Items

| ID | Closed In | Summary |
| --- | --- | --- |
| POAM-CLOSED-001 | `d18996e2` | Browser auth restore now requires server-validated session; legacy local-storage auth shortcut removed. |
| POAM-CLOSED-002 | `CCH 8.969` | Phase 3 deployment posture report added as admin API and local command. |
| POAM-CLOSED-003 | `CCH 8.970` | Admin security event evidence export added for monitoring review packs. |
| POAM-CLOSED-004 | `CCH 8.973` | Admin security evidence bundle added for posture, monitoring and recent-event review evidence. |
| POAM-CLOSED-005 | `CCH 8.974` | Redacted security evidence bundle added for safer external/customer review sharing. |
| POAM-CLOSED-006 | `CCH 8.975` | CORS posture clarified so same-origin-only browser access is recorded as the secure default. |
| POAM-CLOSED-007 | `CCH 8.976` | Local audit logs, admin status, event export and evidence bundles documented as the accepted interim monitoring control. |
| POAM-CLOSED-008 | `CCH 8.977` | Phase 4 dependency security report command added to produce repeatable npm audit evidence for production and all dependencies. |
| POAM-CLOSED-009 | `CCH 8.978` | Prisma CLI and client pinned to `6.12.0`, removing the Prisma/deepmerge npm audit finding without adopting a release-candidate major version. |
