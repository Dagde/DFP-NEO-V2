# DFP-NEO-V2 Fix Session

## Completed
- [x] Fix btn-aluminium-brushed CSS (dark grey → light silver)
- [x] Fix hex colour handling in all components (FlightTile, CourseDataWindow, Sidebar, etc.)
- [x] Rebuild bundle and push (commit 8e756c74)
- [x] Fix applyCoursePriority returning [] when coursePriorities=[] (commit 20a277bb)
- [x] Fix TDZ crash: syllabusDetails useState before useEffects (commit 55bdd1ef)
- [x] Fix syllabus code mismatch (item.id vs item.code in completedEventIds check)
- [x] Fix blank Master LMP: init syllabusDetails with INITIAL_SYLLABUS_DETAILS,
      remove from settings save/load, add catch fallback (commit ee2e3981)

## Active - NEO Build STBY Issue
- [ ] View neo2.jpg screenshot
- [ ] Investigate why scheduleEvent() returns null for all trainees
  - Check syllabusDetails population (now fixed - always INITIAL_SYLLABUS_DETAILS)
  - Check instructorsData filtering / timing
  - Check isInstructorEligibleByUnit()
  - Check eventLimits
  - Check time boundary / availability matching
  - Check computeNextEventsForTrainee returns correct events
- [ ] Implement fix for NEO Build STBY issue
- [ ] Rebuild bundle and push fix