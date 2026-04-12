# DFP-NEO Bug Fixes - Deployment Unavailability & Console

## Latest Commits
- `8138dc9e` - Fix totalAircraft column name + stale closure fix + cleanup endpoint
- `b36951aa` - Strip __deploy__ tags at startup + console cleanup + conflict tracking

## Completed Tasks
- [x] Fix `column "totalFleet" does not exist` 500 error (root server.js INSERT → totalAircraft)
- [x] Fix CREATE TABLE to use totalAircraft for consistency
- [x] Fix GET /api/aircraft-availability-current to read totalAircraft with totalFleet fallback
- [x] Add POST /api/cleanup-deploy-unavailability server endpoint (bulk DB cleanup)
- [x] Fix stale closure bug in removeDeployedUnavailability (refs instead of state)
- [x] Fix stale closure bug in upsertDeployedUnavailability (refs instead of state)
- [x] Call cleanup endpoint when no deployment tiles found (double-clean: in-memory + DB)
- [x] Strip __deploy__ tags from personnel/trainee data at app load time (loadInitialData)
- [x] Call cleanup endpoint on app startup (async, to clean DB for future loads)
- [x] Add [UnavailConflicts] tracking log to unavailabilityConflicts useMemo
  - Shows exactly which events are red, which person is causing it, and whether it's
    a __deploy__ tag or a real period
- [x] Remove 50+ noisy console.log lines (DATA TRACKING, duplicate monitors, deploy logs)
- [x] Remove .github_pat from git history (push protection block)
- [x] PAT saved to /workspace/.github_pat (not committed to repo)

## Push Command
```bash
export GITHUB_TOKEN=$(cat /workspace/.github_pat)
git push https://x-access-token:$GITHUB_TOKEN@github.com/Dagde/DFP-NEO-V2.git feature/comprehensive-build-algorithm
```