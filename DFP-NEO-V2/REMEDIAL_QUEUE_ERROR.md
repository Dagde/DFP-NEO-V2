# Remedial Queue Force Schedule Error

## Issue
When ticking the "Force Schedule" checkbox in the Remedial Queue page, the following error occurs:
```
Something went wrong.
ReferenceError: syllabus is not defined
```

## Investigation Complete ✅

### Phase 1: Locate Component ✅
- [x] Found Remedial Queue in PrioritiesView.tsx
- [x] Located Force Schedule checkbox (line 553)
- [x] Found handler: onToggleRemedialRequest in App.tsx (line 6029)

### Phase 2: Root Cause Identified ✅
- [x] Error occurs in syncPriorityEventsWithSctAndRemedial function (App.tsx line 4063)
- [x] **LINE 4163**: `const duration = syllabus?.duration || 1.5;`
- [x] **TYPO**: Variable name is `syllabus` but should be `syllabusItem`
- [x] `syllabusItem` is declared on line 4161, but line 4163 references non-existent `syllabus`

### Phase 3: Fix Applied ✅
- [x] Changed `syllabus?.duration` to `syllabusItem?.duration`
- [x] Variable now correctly references the syllabusItem found on line 4161

## Root Cause
**Simple typo**: `syllabus` instead of `syllabusItem`

## The Fix
```typescript
// BEFORE (INCORRECT):
const duration = syllabus?.duration || 1.5;

// AFTER (CORRECT):
const duration = syllabusItem?.duration || 1.5;
```

## Location
File: App.tsx
Function: syncPriorityEventsWithSctAndRemedial
Line: 4163