# FIC211 Color Display Fix

## Current Issue
FIC211 color (#F97316) is not displaying in:
- Trainee Roster page
- Daily Schedule color legend (bottom left)

## Context
- FIC211 was restored via API with correct color `#F97316`
- API returns course data correctly (verified via curl)
- Console shows only LMP init logs, no `initializeData` or `loadInitialData` logs
- This suggests the new bundle with debug logs may not be deployed

## Tasks
- [x] Verify current bundle contains debug logs (confirmed present in local bundle)
- [x] Push changes to trigger Railway rebuild
- [x] Force Railway rebuild with .gitignore change
- [ ] Wait for Railway deployment to complete (monitor logs)
- [ ] User to perform hard refresh (Ctrl+Shift+R) to clear browser cache
- [ ] Check console for debug logs and verify courseColors state
- [ ] If still broken, investigate Railway build cache issue