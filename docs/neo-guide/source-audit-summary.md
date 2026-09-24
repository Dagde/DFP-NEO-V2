# NEO Guide Source Audit

Generated: 2026-09-24T01:06:44.631Z

## Status

This is the Phase 2 source-derived knowledge model foundation for NEO Guide, with a first curated implementation-enrichment layer. It is generated from the current DFP-NEO implementation and is intentionally not a generic FAQ.

## Counts

- Source files inspected: 377
- Components found: 559
- Controls found: 3417
- Stable guide targets already present: 56
- Page/API routes found: 80
- Express endpoints found: 198
- Prisma models found: 37
- Permission references found: 510
- Warning/error/status messages found: 2933
- Terminology records generated: 5000
- Curated workflow functions: 33
- Curated concept records: 5
- Curated synonym groups: 7
- Function records generated: 3765
- Concept graph nodes: 59
- Concept graph edges: 1417

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
