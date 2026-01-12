# Data Source Toggle - Safe Implementation Plan

## What Went Wrong Last Time (Lessons Learned)

### Critical Mistakes That Caused Infinite Loops:
1. **Changed data structures** - Converted Map → Array → Map → Object mid-flight
2. **Modified useMemo dependencies** - Added `effectiveDate` variable that changed on every render
3. **Changed scores state type** - From `Map<string, Score[]>` to `Record<string, Score[]>` without updating all code
4. **Made too many changes at once** - No incremental testing
5. **Didn't test locally** - Deployed broken code directly

### What Caused Deployment Crashes:
1. **Schema mismatches** - Database had tables that schema didn't have
2. **Missing fields** - Added required fields to tables with existing data
3. **Wrong field names** - Used `studentCount` when database had `armyCount`, `navyCount`, etc.

## Safe Implementation Strategy

### Core Principles:
1. ✅ **NO data structure changes** - Keep everything as-is
2. ✅ **NO useMemo modifications** - Don't touch existing memos
3. ✅ **NO state type changes** - Keep all state types identical
4. ✅ **Test after EVERY change** - Build and verify locally
5. ✅ **One file at a time** - Never modify multiple files in one commit

## Implementation Plan

### Phase 1: Settings Page UI (20 minutes)
**Goal:** Add Data Source section with 3 toggle switches

**Files to modify:**
- `components/SettingsView.tsx` - Add UI only, no logic yet

**What to add:**
- 3 toggle switches (Staff, Trainees, Courses)
- Labels and descriptions
- Visual design matching existing settings

**Testing:**
- Build locally
- Verify Settings page loads
- Verify toggles display correctly
- **Rollback point:** Tag as `data-source-step1-ui`

### Phase 2: Settings State Management (15 minutes)
**Goal:** Add state for toggle switches in SettingsView

**Files to modify:**
- `components/SettingsView.tsx` - Add local state only

**What to add:**
- `useState` for toggle states
- `localStorage` persistence
- Toggle handlers (local only, no parent communication)

**Testing:**
- Build locally
- Verify toggles work
- Verify localStorage saves/loads
- **Rollback point:** Tag as `data-source-step2-state`

### Phase 3: Data Service Logic (20 minutes)
**Goal:** Add merging logic to dataService.ts

**Files to modify:**
- `lib/dataService.ts` - Add merge functions

**What to add:**
- `loadDataSourceSettings()` - Load from localStorage
- `mergeData()` - Merge database + mock data
- Update `initializeData()` to check settings

**CRITICAL RULES:**
- ✅ Keep return type EXACTLY the same
- ✅ Return plain objects, NOT Maps
- ✅ Don't change any existing code structure
- ✅ Only ADD new code, don't modify existing

**Testing:**
- Build locally
- Verify data loads correctly
- Test with toggles ON and OFF
- **Rollback point:** Tag as `data-source-step3-logic`

### Phase 4: App Integration (15 minutes)
**Goal:** Pass settings from App.tsx to SettingsView

**Files to modify:**
- `App.tsx` - Add props to SettingsView component

**What to add:**
- Props: `dataSourceSettings`, `onUpdateDataSourceSettings`
- Handler: `handleUpdateDataSourceSettings` (saves to localStorage)
- NO state changes, NO useMemo changes

**CRITICAL RULES:**
- ✅ Don't add dataSourceSettings to any state
- ✅ Don't add to any useMemo dependencies
- ✅ Only pass through as props
- ✅ Let SettingsView manage its own state

**Testing:**
- Build locally
- Verify Settings page works
- Test toggle changes
- Verify data reloads
- **Rollback point:** Tag as `data-source-step4-integration`

### Phase 5: Deploy and Verify (10 minutes)
**Goal:** Deploy to production and test

**Actions:**
- Push to GitHub
- Wait for Railway deployment
- Test all toggle combinations
- Verify no infinite loops
- **Final tag:** `data-source-complete`

## Total Time: ~80 minutes

## Key Differences from Last Time

| Last Time (FAILED) | This Time (SAFE) |
|-------------------|------------------|
| Changed Map to Object | Keep all types the same |
| Modified useMemo dependencies | Don't touch useMemos |
| Changed state types | Keep state types identical |
| Multiple files at once | One file per commit |
| No local testing | Test after every change |
| No rollback points | Tag after every step |

## Success Criteria

After implementation:
- ✅ App loads without errors
- ✅ Settings page has Data Source section
- ✅ Toggles work (ON = DB+mock, OFF = DB only)
- ✅ Settings persist in localStorage
- ✅ Data reloads when settings change
- ✅ NEO Build still works
- ✅ No infinite loops
- ✅ No deployment crashes

## Emergency Rollback

If anything breaks:
```bash
git reset --hard v2.0-stable-phase4-complete
git push origin feature/comprehensive-build-algorithm --force
```

This will restore to the current working version instantly.

---

**Ready to proceed?** I'll implement this step-by-step with testing after each change.