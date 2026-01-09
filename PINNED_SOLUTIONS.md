# 📌 PINNED SOLUTIONS - Critical Fixes for Common Issues

**Last Updated:** 2025-01-09  
**Purpose:** Quick reference for common issues and their verified fixes

---

## 1. Temporal Dead Zone Error in dataService.ts (FIXED)
**Status:** ✅ RESOLVED

**Symptoms:**
- Error: `ReferenceError: Cannot access 'r' before initialization`
- App fails to load data from API
- Console shows errors in `dataService.ts` at line 153

**Root Cause:**
Variables declared with `const` were being reassigned:
```typescript
const courses = loadFromStorage<Course[]>(STORAGE_KEYS.COURSES, []);
courses = Array.isArray(courses) ? courses : [];  // ERROR!
```

**Solution Applied:**
Changed `const` to `let` to allow reassignment:
```typescript
let courses = loadFromStorage<Course[]>(STORAGE_KEYS.COURSES, []);
courses = Array.isArray(courses) ? courses : [];  // OK!
```

**Verification:**
Check that `courses` and `coursePriorities` use `let` not `const` in `dataService.ts`.

**Prevention:**
Never reassign `const` variables. Use `let` if you need to reassign.

**Commit Reference:** `5546608` - "Fix temporal dead zone error - declare variables before use in dataService"

---

## 2. Map Deserialization Issue (FIXED)
**Status:** ✅ RESOLVED

**Symptoms:**
- Error: `TypeError: k.filter is not a function`
- App crashes when loading data from localStorage
- Map objects not properly converted when loaded

**Root Cause:**
Map objects stored in localStorage become arrays when parsed with `JSON.parse()`:
```typescript
localStorage.setItem('scores', JSON.stringify(myMap));
// Stored as: [["key1", {data}], ["key2", {data}]]
const parsed = JSON.parse(localStorage.getItem('scores'));
// parsed is Array, not Map!
```

**Solution Applied:**
Added Map detection and conversion in `loadFromStorage()`:
```typescript
if (defaultValue instanceof Map) {
  return new Map(parsed) as T;
}
```

**Verification:**
Maps should load correctly without `filter is not a function` errors.

**Prevention:**
Always convert localStorage data back to Map when storing Map objects.

**Commit Reference:** `1e0186e` - "Fix Map deserialization issue - properly convert localStorage arrays to Maps"

---

## 3. Assignment to Constant Variable (FIXED)
**Status:** ✅ RESOLVED

**Symptoms:**
- Error: `TypeError: Assignment to constant variable`
- App crashes during data initialization
- `dataService.ts` line 153 showing error

**Root Cause:**
Same as issue #1 - trying to reassign `const` variables.

**Solution Applied:**
See issue #1 - changed `const` to `let`.

**Commit Reference:** `5546608`

---

## 4. School Switching Data Loss (FIXED)
**Status:** ✅ RESOLVED

**Symptoms:**
- Staff disappears when switching from ESL to PEA
- Trainees never visible in any school
- Console shows `instructorsData count: 0`

**Root Cause:**
`changeSchool()` function was overwriting state with filtered data:
```typescript
const filteredInstructors = instructorsData.filter(i => targetUnits.includes(i.unit));
setInstructorsData(filteredInstructors);  // Lost all other data!
```

**Solution Applied:**
Modified `changeSchool()` to NOT overwrite state:
```typescript
// Don't overwrite state - just change school and let filtering happen during display
setSchool(newSchool);
```

**Verification:**
Switch schools - staff should persist and be filtered by unit during display.

**Prevention:**
Never overwrite state with filtered data. Filter during render or use derived state.

**Commit Reference:** `ff379d5` - "Fix school switching data loss - don't overwrite state with filtered data"

---

## 5. Purple Buttons (Edit/Save) - ⚠️ PERMANENT FIX APPLIED
**Status:** ✅ PERMANENTLY RESOLVED - FLAGGED TO NEVER REVERT

**Symptoms:**
- Purple buttons with "✏️ Edit" and "💾 Save" icons appear in the UI
- Buttons have inline styles that cannot be overridden with CSS
- Buttons reappear after attempts to remove them

**Root Cause:**
The buttons are injected by **external Ninja web builder platform script**:
- Script: `https://sites.super.myninja.ai/_assets/ninja-daytona-script.js`
- Contains `makeBodyEditable()` function that adds Edit/Save buttons
- NOT part of application code - external interference

### ⚠️ PERMANENT SOLUTION APPLIED (Commit 97bb5be)

**Fix Applied:**
```bash
sed -i '/ninja-daytona-script.js/d' /workspace/dfp-neo-platform/public/flight-school-app/index.html
```

**Previous Attempted Solutions (FAILED):**
1. **JavaScript override** (ABANDONED) - Caused "Page Unresponsive" errors due to aggressive DOM manipulation
2. **CSS overrides** (FAILED) - Buttons have inline styles that CSS cannot override
3. **Manual deletion** (TEMPORARY) - Script kept reappearing

**Final Solution:**
- ✅ Removed external Ninja script from source
- ✅ Verified removal from production build
- ✅ Created permanent documentation: `PERMANENT_NINJA_SCRIPT_BLOCK.md`
- ✅ **FLAGGED TO NEVER REMOVE THIS FIX**

### Verification Commands
```bash
# Check if script is removed (should return nothing)
grep -n "ninja" /workspace/dfp-neo-platform/public/flight-school-app/index.html

# Check Next.js build output
grep -r "ninja" /workspace/dfp-neo-platform/.next/server/app/page.html
```

### ⚠️ CRITICAL WARNING
This fix is **PERMANENT** and should **NEVER** be removed:
- External Ninja script has no legitimate purpose in production app
- If purple buttons reappear:
  1. Immediately check `index.html` for ninja script references
  2. Remove them: `sed -i '/ninja-daytona-script.js/d' index.html`
  3. Rebuild and redeploy
  4. Verify in production
- Any code that re-adds this script should be rejected immediately

**Commit Reference:** `97bb5be` - "PERMANENT FIX: Remove Ninja script that was injecting purple Edit/Save buttons - flagged to never revert"

---

## 6. Course Progress & Training Records Pages Blank (FIXED)
**Status:** ✅ RESOLVED

**Symptoms:**
- Course Progress page shows no data
- Training Records page shows no data
- Console shows courses array is empty

**Root Cause:**
Temporary mock data fix in `initializeData()` was returning `courses: []`:
```typescript
return {
  instructors: mockData.instructors,
  trainees: mockData.trainees,
  courses: [],  // Empty!
  scores: mockData.scores,
  // ...
};
```

**Solution Applied:**
Changed to populate courses from mock data:
```typescript
courses: ESL_DATA.courses
```

**Verification:**
Both pages should display course data properly.

**Commit Reference:** `f40762d` - "Fix Course Progress and Training Records pages - populate courses data from mock data instead of empty array"

---

## Troubleshooting Checklist

Before creating new issues, check:

1. **Check console for errors** - F12 → Console tab
2. **Check Network tab** - F12 → Network tab → Look for failed requests
3. **Check localStorage** - F12 → Application → Local Storage → Look for data
4. **Check this document** - See if the issue matches any of the solutions above
5. **Check commits** - Review recent commits for related changes

---

## Additional Resources

- **PERMANENT_NINJA_SCRIPT_BLOCK.md** - Detailed Ninja script removal documentation
- **BACKEND_STATUS_REPORT.md** - Current backend status and API endpoints
- **PHASE4_COMPLETE.md** - Phase 4 completion documentation
- **TODO.md** - Current project tasks and progress

---

## If Purple Buttons Return (CRITICAL):

1. **Immediate Action:**
   ```bash
   grep -n "ninja" /workspace/dfp-neo-platform/public/flight-school-app/index.html
   ```
   
2. **If script found:**
   ```bash
   sed -i '/ninja-daytona-script.js/d' /workspace/dfp-neo-platform/public/flight-school-app/index.html
   ```

3. **Verify removal:**
   ```bash
   grep -n "ninja" /workspace/dfp-neo-platform/public/flight-school-app/index.html
   # Should return nothing
   ```

4. **Rebuild and redeploy:**
   ```bash
   npm run build
   git add -A
   git commit -m "Emergency fix: Remove ninja script again"
   git push origin feature/comprehensive-build-algorithm
   ```

5. **Test in production:**
   - Visit https://dfp-neo.com/flight-school-app/
   - Hard refresh (Ctrl+Shift+R)
   - Verify no purple buttons appear

---

**Document Version:** 2.0  
**Total Issues Documented:** 6  
**All Issues:** ✅ RESOLVED  
**Permanent Fixes:** 1 (Ninja Script Block - NEVER REMOVE)