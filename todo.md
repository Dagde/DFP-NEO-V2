# Fix Plan

## Tasks
- [x] Check current state of files
- [x] Fix server.js recalculate: accept `clientTimezoneOffsetHours` as primary offset (not inference)
- [x] Fix ACHistoryAircraftAvailability: add `timezoneOffset` prop, send `clientTimezoneOffsetHours`
- [x] Fix ACHistoryPage: add + pass `timezoneOffset` prop
- [x] Fix SettingsView.tsx: pass `timezoneOffset` to ACHistoryPage
- [x] Rebuild frontend bundle
- [x] Push to feature/comprehensive-build-algorithm