# NEO Build Fix - Events All in STBY Line

## Root Causes
1. DB syllabus has wrong codes (BGF_GND_001) - don't match scores (BGF1, BGF MB1)
2. `computeNextEventsForTrainee` checks `item.id` (UUID) but scores use short codes
3. DB syllabus has wrong event types ('Flying', 'Ground', 'Simulator') vs app expects ('Flight', 'FTD', 'Ground School')
4. `/api/syllabus` returns `{ syllabusItems }` but syllabusService already fixed to read `data.syllabus || data.syllabusItems`
5. Best fix: replace DB seed with correct codes from mockData.ts AND fix type mapping

## Tasks

- [x] Fix 1: applyCoursePriority returns rankedList when coursePriorities=[] (already in bundle 295f98d0)
- [x] Fix 2: syllabusService reads data.syllabus || data.syllabusItems (already done)
- [x] Fix 3: Re-initialize traineeLMPs when syllabusDetails loads (already in App.tsx)
- [x] Fix 4: Update seed API to use correct codes matching mockData.ts/seed-syllabus.ts
- [x] Fix 5: Fix /api/syllabus route to return `{ syllabus: items }` (matching what syllabusService expects)
- [x] Fix 6: Fix type mapping in seed API (Flying→Flight, Simulator→FTD, Ground→Ground School)
- [x] Fix 7: Add code-based fallback in computeNextEventsForTrainee (item.code match in completedEventIds)
- [x] Fix 8: Fallback to INITIAL_SYLLABUS_DETAILS when DB syllabus has wrong codes (BGF_GND_001)
- [x] Build bundle and commit (8103c77b)
- [x] Push to GitHub (295f98d0..8103c77b)