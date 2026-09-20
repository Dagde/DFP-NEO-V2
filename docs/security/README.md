# DFP NEO Security Evidence Pack

This folder is the working evidence pack for DFP NEO security readiness. It is intended to support ISM-style assessment, customer due diligence, deployment readiness reviews, and future IRAP-style review activity.

This pack does not by itself certify compliance. It records the current security position, the evidence to maintain, and the open work required before DFP NEO can be represented as Defence-ready for a specific deployment and classification.

## Current Phase

Phase 3: Platform Security Controls.

Phase 1 technical hardening has started. Browser session restore now uses a server-validated HttpOnly cookie rather than local storage as the authority for browser authentication. Remaining Phase 1 technical risks, including dependency treatment for `xlsx` and raw SQL review, are tracked in the POA&M.

Phase 2 is complete as a baseline evidence pack. Phase 3 has started with a repeatable security posture report for deployment guardrails.

## Documents

- [System Security Plan](system-security-plan.md)
- [Data Classification And Flows](data-classification-and-flows.md)
- [Supplier And Cloud Service Register](supplier-and-cloud-service-register.md)
- [Incident Response Plan](incident-response-plan.md)
- [Backup And Restore Plan](backup-and-restore-plan.md)
- [Vulnerability Management Plan](vulnerability-management-plan.md)
- [Continuous Monitoring Plan](continuous-monitoring-plan.md)
- [Platform Security Controls](platform-security-controls.md)
- [Change And Configuration Management Plan](change-and-configuration-management-plan.md)
- [Security Assessment Report Template](security-assessment-report-template.md)
- [Plan Of Action And Milestones](plan-of-action-and-milestones.md)

## Evidence Rules

For each deployment, store or link evidence for:

- deployment URL, hosting platform, database platform, email provider, DNS/domain provider, and code repository;
- data classification decision and customer-specific handling requirements;
- authentication and privileged access model;
- audit log export and retention settings;
- backup schedule, encryption, retention, and restore-test result;
- vulnerability scan result and remediation record;
- change approval and release record;
- incident response exercise or tabletop result;
- residual risks formally accepted by the authorised owner.

Do not place production secrets, personal passwords, session tokens, database credentials, API keys, private keys, or raw customer data in this folder.

## Review Cadence

- Review this pack before every production customer deployment.
- Review after any material architecture, hosting, authentication, database, logging, backup, or third-party service change.
- Review at least quarterly while DFP NEO is operated as a live service.
