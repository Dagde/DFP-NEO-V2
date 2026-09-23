# NEO Guide Source Audit

Generated: 2026-09-23T13:24:37.390Z

## Status

This is the Phase 1 source-derived knowledge model foundation for NEO Guide. It is generated from the current DFP-NEO implementation and is intentionally not a generic FAQ.

## Counts

- Source files inspected: 375
- Components found: 558
- Controls found: 3413
- Stable guide targets already present: 0
- Page/API routes found: 80
- Express endpoints found: 198
- Prisma models found: 37
- Permission references found: 510
- Warning/error/status messages found: 2917
- Function records generated: 3728
- Concept graph nodes: 56
- Concept graph edges: 1357

## Outputs

- `public/neo-guide/dfp-neo-knowledge-model.json`
- `dfp-neo-platform/public/flight-school-app/neo-guide/dfp-neo-knowledge-model.json`
- `docs/neo-guide/dfp-neo-knowledge-model.full.json`

## Next Required Work

1. Enrich extracted functions with verified workflow summaries from implementation review.
2. Add stable `data-neo-guide` targets to high-value controls and sections.
3. Build the local interpretation/reasoning engine over this model.
4. Add a permission-aware read-only guide API for live-data troubleshooting.
5. Add the NEO Guide UI and navigation/highlight behavior.
