# DFP NEO Security Readiness Summary

## Purpose

This document gives a plain-English summary of the current DFP NEO security position after Phases 1 to 4 of the security uplift. It is intended for product owners, customer representatives, deployment decision makers and security reviewers who need to understand what has been done, what evidence exists and what still depends on the final deployment environment.

This is not a certification statement. It does not claim that DFP NEO is automatically compliant with the Defence Information Security Manual or ready for every Defence environment. It records the current readiness position and the evidence needed before a specific customer deployment can be approved.

## Overall Readiness Position

DFP NEO now has a usable baseline security evidence pack and several repeatable security reports. The application is in a stronger position for customer security review, testbed demonstration and controlled pilot planning.

The current position is:

- Application-level security posture reporting is implemented.
- Admin-only security event exports and evidence bundles are implemented.
- Browser authentication now relies on a server-side `HttpOnly` session cookie.
- Production cookie and browser security header controls are recorded.
- Dependency scanning is repeatable.
- Workbook upload risk is treated with compensating controls and evidence.
- Raw SQL review is repeatable and currently reports zero high-risk findings.
- Local monitoring evidence is accepted as an interim control until a customer monitoring destination is selected.

DFP NEO should still be treated as requiring customer-specific security approval before production use in a Defence or other high-assurance environment.

## Phase Status

| Phase | Status | Plain-English Outcome |
| --- | --- | --- |
| Phase 1 | Complete for current scope | Browser session handling was hardened so local browser storage is no longer the authority for login state. |
| Phase 2 | Complete | A baseline security evidence pack was created for customer review and future assurance work. |
| Phase 3 | Complete | Platform security posture reporting, security event export and evidence bundle downloads were added. |
| Phase 4 | Complete | Dependency, workbook upload and raw SQL evidence reports were added. Known package and SQL risks were treated or documented. |
| Phase 5 | Complete | Readiness summary completed for customer and assessor review. |

## Evidence Available Now

The following evidence can be generated or downloaded now:

| Evidence | How To Produce It | What It Shows |
| --- | --- | --- |
| Security posture report | `npm run security:posture` or admin API `/api/security/posture` | Runtime security settings, cookie posture, debug flags, headers and monitoring status. |
| Dependency report | `npm run security:dependencies` | Current npm audit position for production and all dependencies. |
| Workbook upload report | `npm run security:workbooks` | All live workbook parsing paths have validation before parsing. |
| Raw SQL report | `npm run security:sql` | Current raw SQL inventory, with zero high-risk findings in the current baseline. |
| Security event export | Admin API `/api/security/events/export` | Recent security-relevant events for review evidence. |
| Evidence bundle | Admin API `/api/security/evidence-bundle` | Combined posture, monitoring and recent-event evidence. |
| Redacted evidence bundle | Admin API `/api/security/evidence-bundle?redacted=true` | Safer customer/shareable evidence with sensitive operational identifiers masked. |

## Treated Risks

The following risks have been treated for the current baseline:

| Area | Current Treatment |
| --- | --- |
| Browser session restore | Server-side session cookie is authoritative; the browser cannot restore access using only local storage. |
| Prisma/deepmerge dependency advisory | Prisma CLI and client are pinned to `6.12.0`, removing the audit finding without adopting release-candidate major versions. |
| Raw SQL | High-risk raw SQL findings have been reduced to zero. One testing-only Super Admin reset path remains visible as reviewed dynamic SQL. |
| Workbook parsing with `xlsx` | Accepted interim risk. All live parse paths have pre-parse validation for size, type, signature and unsafe content indicators. |
| Monitoring gap | Accepted interim control. Local audit logs and admin export/evidence bundle functions are available until a customer monitoring destination is selected. |

## Remaining Deployment Decisions

These items are not code defects, but they must be decided for each serious customer deployment:

| Decision | Why It Matters |
| --- | --- |
| Data classification | The customer must decide the classification or sensitivity level of the deployed data. |
| Hosting and data residency | Region, supplier, database, backups and logs must match customer requirements. |
| Central monitoring | A customer-approved SIEM, webhook, managed log platform or SOC workflow should be selected for higher-assurance production deployments. |
| Backup and restore evidence | Backup settings and a successful restore test must be recorded before production readiness is claimed. |
| Enterprise identity | MFA or SSO should be defined where customer policy requires it. |
| Supplier evidence | Hosting, database, email, repository and any other supplier evidence must be completed for the chosen deployment. |
| CSP tightening | The current CSP still allows inline assets for frontend compatibility and should be tightened after bundle validation. |
| Workbook parser future | `xlsx` should be replaced, sandboxed or reassessed before higher-assurance deployments. |

## Plain-English Assessment

DFP NEO is now suitable for a structured security review, customer due diligence discussion and controlled pilot planning. It has practical evidence reports rather than relying only on written claims.

DFP NEO should not yet be described as fully Defence-compliant for all environments. The final compliance position depends on the deployment classification, hosting arrangement, monitoring integration, backup evidence, customer identity requirements and formal risk acceptance.

The recommended position is:

- Ready for internal security review.
- Ready for customer security briefing.
- Ready for controlled testbed or pilot planning.
- Not yet approved for high-assurance production until customer-specific deployment evidence is completed.

## Simple Customer Review Checklist

Before a customer or assessor review, collect:

1. The latest `npm run security:posture` report.
2. The latest `npm run security:dependencies` report.
3. The latest `npm run security:workbooks` report.
4. The latest `npm run security:sql` report.
5. A redacted evidence bundle from `/api/security/evidence-bundle?redacted=true`.
6. Backup configuration and restore-test evidence.
7. Data classification decision.
8. Monitoring decision or formal acceptance of interim local audit/export control.
9. Supplier and hosting evidence.
10. Any customer-specific residual risk acceptance.

## Recommended Next Steps

1. Complete a customer-specific deployment profile: hosting, database, email, logging, backup and region.
2. Record the customer data classification decision.
3. Run a restore test and record the result.
4. Decide whether the deployment requires MFA or SSO before go-live.
5. Decide whether central monitoring is required before go-live.
6. Run the four local security reports and retain them with the release evidence.
7. Use the Security Assessment Report Template to record the final review outcome.
