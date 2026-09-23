# NEO Guide Source Audit

Generated: 2026-09-23T14:32:45.619Z

## Status

This is the Phase 2 source-derived knowledge model foundation for NEO Guide, with a first curated implementation-enrichment layer. It is generated from the current DFP-NEO implementation and is intentionally not a generic FAQ.

## Counts

- Source files inspected: 376
- Components found: 558
- Controls found: 3413
- Stable guide targets already present: 49
- Page/API routes found: 80
- Express endpoints found: 198
- Prisma models found: 37
- Permission references found: 510
- Warning/error/status messages found: 2929
- Curated workflow functions: 17
- Curated concept records: 3
- Curated synonym groups: 4
- Function records generated: 3745
- Concept graph nodes: 57
- Concept graph edges: 1396

## Outputs

- `public/neo-guide/dfp-neo-knowledge-model.json`
- `dfp-neo-platform/public/flight-school-app/neo-guide/dfp-neo-knowledge-model.json`
- `docs/neo-guide/dfp-neo-knowledge-model.full.json`

## Next Required Work

1. Continue enriching extracted functions with verified workflow summaries from implementation review.
2. Expand stable `data-neo-guide` target coverage beyond the main navigation and operational controls.
3. Build the local interpretation/reasoning engine over this model.
4. Add a permission-aware read-only guide API for live-data troubleshooting.
5. Add the NEO Guide UI and navigation/highlight behavior.
