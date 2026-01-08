# CourseRoster Debugging Added

## Hypothesis
The Course Roster only displays courses that exist in `courseColors` (configured courses). If trainees have courses that aren't configured, they won't show up.

## How CourseRoster Works

1. **Groups trainees by course**: `groupedTrainees[course] = [trainees...]`
2. **Gets configured courses**: `activeCourseNumbers = Object.keys(courseColors)`
3. **Maps through configured courses only**:
   ```typescript
   {coursesToDisplay.map(courseName => {
       const courseTrainees = groupedTrainees[courseName] || [];
   })}
   ```

**Problem**: If `trainee.course` is not in `courseColors.keys()`, the trainee won't be displayed!

## What I Added

### CourseRosterView Debugging Logs

```typescript
console.log('📊 CourseRoster - Grouped trainees:', {
    totalTrainees: traineesData.length,
    totalGroups: Object.keys(groups).length,
    groups: Object.keys(groups).map(course => ({
        course,
        count: groups[course].length
    }))
});

console.log('📋 CourseRoster - Course config:', {
    view,
    activeCourseNumbers,
    archivedCourseNumbers,
    coursesToDisplay,
    activeCourseCount: activeCourseNumbers.length,
    archivedCourseCount: archivedCourseNumbers.length
});
```

## What We'll Learn

### 1. What courses do trainees actually have?
```
📊 CourseRoster - Grouped trainees: {
    totalTrainees: 117,
    totalGroups: 8,
    groups: [
        {course: '01/25', count: 15},
        {course: '02/25', count: 18},
        ...
    ]
}
```

### 2. What courses are configured in the app?
```
📋 CourseRoster - Course config: {
    activeCourseNumbers: [],
    coursesToDisplay: [],
    activeCourseCount: 0
}
```

### 3. Do they match?
- If `groups` has courses but `activeCourseNumbers` is empty → **Configuration issue**
- If they match → **Rendering issue**
- If format differs → **Format mismatch**

## Expected Scenarios

### Scenario A: No Courses Configured (Most Likely)
```
📊 CourseRoster - Grouped trainees: {
    totalTrainees: 117,
    totalGroups: 8,
    groups: [{course: '01/25', count: 15}, ...]
}
📋 CourseRoster - Course config: {
    activeCourseNumbers: [],
    coursesToDisplay: [],
    activeCourseCount: 0
}
```
**Problem**: Courses exist in data but not configured in app. Need to initialize `courseColors`.

### Scenario B: Format Mismatch
```
📊 Grouped trainees: {groups: [{course: '01-25', ...}]}
📋 Course config: {activeCourseNumbers: ['01/25', ...]}
```
**Problem**: Course format differs (`01-25` vs `01/25`)

### Scenario C: Perfect Match
```
📊 Grouped trainees: {groups: [{course: '01/25', count: 15}, ...]}
📋 Course config: {activeCourseNumbers: ['01/25', ...]}
```
**Success**: Should display trainees!

## Next Steps After Deployment (2-5 minutes)

1. Open https://dfp-neo.com/flight-school-app/
2. Navigate to Course Roster
3. Open console (F12)
4. Look for:
   - `📊 CourseRoster - Grouped trainees:`
   - `📋 CourseRoster - Course config:`
5. Share the console output

## Deployment Status
- ✅ Build completed
- ✅ Files deployed
- ✅ Committed (commit `0255717`)
- ✅ Pushed to GitHub
- ⏳ Railway deploying now (2-5 minutes)