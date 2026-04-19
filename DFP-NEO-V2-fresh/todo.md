# DFP-NEO Bug Fixes - Build Algorithm & UI Issues

## Current Bugs To Fix
- [ ] Bug 1: Solo events not scheduling at all (fix takeoffConflict + schedule order)
- [ ] Bug 2: Schedule not saving to DB after NEO Build + Publish (disappears on hard refresh)
- [ ] Bug 3: Validation Check button also displays Hourly Event Rate overlay (should only show conflicts)

## Push Command
```bash
export GITHUB_TOKEN=$(cat /workspace/.github_pat)
git push https://x-access-token:$GITHUB_TOKEN@github.com/Dagde/DFP-NEO-V2.git feature/comprehensive-build-algorithm
```