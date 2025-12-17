# Weighted Priority System Implementation Plan

## Overview
Implementing a weighted priority system where course percentages bias event allocation, with random shuffling within event types to prevent clustering.

## Requirements Confirmed

### 1. Percentage Normalization
- Auto-normalize any percentages to total 100%
- Example: 70%, 20%, 5% (95%) → 73.7%, 21.1%, 5.3% (100%)

### 2. 5% Minimum Enforcement
- UI: Prevent input <5%
- Algorithm: Treat <5% as 5%
- Both levels of protection

### 3. Random Shuffle Strategy
- Shuffle within each event type separately:
  * Day Flights
  * Night Flights
  * FTD
  * CPT
  * Ground Events

## Implementation Tasks

### Task 1: UI Validation (PrioritiesView.tsx)
- [ ] Add 5% minimum validation on percentage inputs
- [ ] Show error message for <5%
- [ ] Auto-normalize percentages on change
- [ ] Display normalized percentages to user

### Task 2: Algorithm Core (App.tsx)
- [ ] Create normalizePercentages() function
- [ ] Create enforceMinimumPercentage() function
- [ ] Replace applyCoursePriority() with weighted selection
- [ ] Implement deficit-based course selection
- [ ] Track events allocated per course

### Task 3: Event-by-Event Selection
- [ ] For each slot, calculate:
  * events_received per course
  * target_events = (percentage / 100) × total_slots
  * deficit = target_events - events_received
- [ ] Select course with largest deficit
- [ ] Use existing trainee selection within course

### Task 4: Random Shuffle (App.tsx)
- [ ] Create shuffleEventsByType() function
- [ ] Shuffle day flights separately
- [ ] Shuffle night flights separately
- [ ] Shuffle FTD events separately
- [ ] Shuffle CPT events separately
- [ ] Shuffle ground events separately
- [ ] Maintain time slot validity

### Task 5: Testing
- [ ] Test with extreme percentages (100%, 0%, 0%)
- [ ] Test with moderate percentages (70%, 20%, 10%)
- [ ] Test with equal percentages (33%, 33%, 34%)
- [ ] Verify 5% minimum enforcement
- [ ] Verify normalization
- [ ] Verify random distribution

### Task 6: Documentation
- [ ] Update PRIORITY_ALGORITHM_ANALYSIS.txt
- [ ] Update priority-analysis.html
- [ ] Add examples of new behavior
- [ ] Document percentage normalization

## Algorithm Pseudocode

```typescript
function weightedCourseSelection(
    rankedList: Trainee[],
    coursePriorities: string[],
    coursePercentages: Map<string, number>
): Trainee[] {
    // 1. Normalize percentages
    const normalized = normalizePercentages(coursePercentages);
    
    // 2. Enforce 5% minimum
    const enforced = enforceMinimumPercentage(normalized, 5);
    
    // 3. Group trainees by course
    const byCourse = groupByCourse(rankedList);
    
    // 4. Event-by-event selection
    const selected: Trainee[] = [];
    let totalAllocated = 0;
    const courseAllocations = new Map<string, number>();
    
    while (hasTraineesRemaining(byCourse)) {
        totalAllocated++;
        
        // Calculate deficit for each course
        let maxDeficit = -Infinity;
        let selectedCourse = null;
        
        for (const [course, percentage] of enforced) {
            const allocated = courseAllocations.get(course) || 0;
            const target = (percentage / 100) * totalAllocated;
            const deficit = target - allocated;
            
            if (deficit > maxDeficit && byCourse.get(course).length > 0) {
                maxDeficit = deficit;
                selectedCourse = course;
            }
        }
        
        // Take next trainee from selected course
        if (selectedCourse) {
            const trainee = byCourse.get(selectedCourse).shift();
            selected.push(trainee);
            courseAllocations.set(selectedCourse, (courseAllocations.get(selectedCourse) || 0) + 1);
        }
    }
    
    return selected;
}

function shuffleEventsByType(events: ScheduleEvent[]): ScheduleEvent[] {
    // Group by type and time window
    const dayFlights = events.filter(e => e.type === 'flight' && !e.flightNumber.startsWith('BNF'));
    const nightFlights = events.filter(e => e.type === 'flight' && e.flightNumber.startsWith('BNF'));
    const ftdEvents = events.filter(e => e.type === 'ftd');
    const cptEvents = events.filter(e => e.type === 'cpt');
    const groundEvents = events.filter(e => e.type === 'ground');
    
    // Shuffle each group
    shuffle(dayFlights);
    shuffle(nightFlights);
    shuffle(ftdEvents);
    shuffle(cptEvents);
    shuffle(groundEvents);
    
    // Recombine
    return [...dayFlights, ...nightFlights, ...ftdEvents, ...cptEvents, ...groundEvents];
}
```

## Files to Modify

1. **App.tsx**
   - Lines 767-787: Replace applyCoursePriority
   - Add normalizePercentages function
   - Add enforceMinimumPercentage function
   - Add shuffleEventsByType function
   - Modify scheduleList calls to use new system

2. **PrioritiesView.tsx**
   - Add percentage input validation
   - Add 5% minimum check
   - Add normalization display
   - Update onChange handlers

3. **PRIORITY_ALGORITHM_ANALYSIS.txt**
   - Update with new weighted system
   - Add normalization examples
   - Update recommendations section

4. **priority-analysis.html**
   - Update algorithm description
   - Add weighted selection explanation
   - Update examples

## Success Criteria

- [ ] Course with 70% gets ~70% of events
- [ ] Course with 5% gets at least 5% of events
- [ ] No course gets 0 events (starvation prevention)
- [ ] Events are randomly distributed within each type
- [ ] No clustering at beginning of day
- [ ] Percentages auto-normalize to 100%
- [ ] UI prevents <5% input
- [ ] Algorithm enforces 5% minimum

## Next Steps

1. Implement UI validation
2. Implement algorithm changes
3. Implement random shuffle
4. Test thoroughly
5. Update documentation
6. Commit and push to GitHub