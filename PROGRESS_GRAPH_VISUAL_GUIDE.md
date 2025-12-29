# Progress Graph Visual Guide

## Overview
This guide provides a visual description of the new full-page Progress Graph feature.

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Minimize    Course Progress Graphs         Filter: [All Courses ▼]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ COURSE NAME (colored header)                                     │   │
│  │ Start: DD/MM/YYYY    Total Events: XX    Graduation: DD/MM/YYYY │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │                                                                   │   │
│  │  Events                    Reference Lines:                      │   │
│  │  Completed                 ─ ─ 3.5/wk  ──── 4.0/wk  ─ ─ 4.5/wk  │   │
│  │     ^                      Progress: ● Highest ● Lowest ── Avg  │   │
│  │  XX │                                                             │   │
│  │     │                                                             │   │
│  │     │                                    ╱ ─ ─ ─ (4.5/wk)        │   │
│  │     │                              ╱ ─ ─                         │   │
│  │     │                        ╱ ─ ─       ──── (4.0/wk)           │   │
│  │     │                  ╱ ─ ─                                     │   │
│  │     │            ╱ ─ ─         ─ ─ ─ (3.5/wk)                    │   │
│  │     │      ╱ ─ ─                                                 │   │
│  │     │ ● ─ ● ─ ● ─ ● ─ ● (Average line with dots)                │   │
│  │     │ ●   ●   ●   ●   ● (Highest trainee - green)               │   │
│  │     │ ●   ●   ●   ●   ● (Lowest trainee - red)                  │   │
│  │   0 └─────────────────────────────────────────────────────────> │   │
│  │     Start                  Date                         Grad     │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ NEXT COURSE (colored header)                                     │   │
│  │ [Similar graph structure repeated]                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  [Additional courses continue vertically...]                             │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Graph Components Explained

### 1. Header Bar
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Minimize    Course Progress Graphs    Filter: [All Courses ▼] │
└─────────────────────────────────────────────────────────────────┘
```
- **Minimize Button**: Returns to Course Progress page
- **Title**: "Course Progress Graphs"
- **Filter Dropdown**: Select specific course or view all

### 2. Course Header (Color-Coded)
```
┌─────────────────────────────────────────────────────────────────┐
│ CSE 301 (Sky Blue Background)                                    │
│ Start: 15/01/2024    Total Events: 85    Graduation: 15/07/2024 │
└─────────────────────────────────────────────────────────────────┘
```
- Course name with distinctive color
- Key metrics displayed prominently

### 3. Graph Legend
```
Reference Lines:  ─ ─ ─ 3.5/wk  ──── 4.0/wk  ─ ─ ─ 4.5/wk
Progress:         ● Highest      ● Lowest     ── Average
```
- Reference lines show required pace
- Progress indicators show trainee performance

### 4. Reference Pace Lines

#### 3.5 Events/Week (Red Dashed)
```
                                        ╱ ─ ─ ─ ─
                                  ╱ ─ ─
                            ╱ ─ ─
                      ╱ ─ ─
                ╱ ─ ─
          ╱ ─ ─
    ╱ ─ ─
─ ─
```
Slowest acceptable pace - starts earliest

#### 4.0 Events/Week (Yellow Solid)
```
                                    ────────
                              ──────
                        ──────
                  ──────
            ──────
      ──────
──────
```
Target pace - middle line

#### 4.5 Events/Week (Green Dashed)
```
                                ╱ ─ ─ ─
                          ╱ ─ ─
                    ╱ ─ ─
              ╱ ─ ─
        ╱ ─ ─
  ╱ ─ ─
─ ─
```
Aggressive pace - starts latest

### 5. Weekly Progress Tracking

```
Week 1    Week 2    Week 3    Week 4    Week 5
  │         │         │         │         │
  ●         ●         ●         ●         ● ← Highest (Green)
  │         │         │         │         │
  ● ─ ─ ─ ─ ● ─ ─ ─ ─ ● ─ ─ ─ ─ ● ─ ─ ─ ─ ● ← Average (Blue Line)
  │         │         │         │         │
  ●         ●         ●         ●         ● ← Lowest (Red)
```

Each week shows:
- **Green Dot**: Trainee with most events completed
- **Red Dot**: Trainee with fewest events completed  
- **Blue Dot + Line**: Average across all trainees

### 6. Axes and Grid

```
Events
  ^
  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (Grid line)
85│
  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  │
  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
50│
  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  │
  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  0└─────┬─────┬─────┬─────┬─────┬─────┬─────>
      Jan 24  Feb 24  Mar 24  Apr 24  May 24  Jun 24  Jul 24
                            Date
```

- **Y-Axis**: Events completed (0 to total)
- **X-Axis**: Date (monthly markers)
- **Grid**: Light gray lines for reference

## Color Scheme

### Background Colors
- **Page Background**: Dark Gray (#1f2937)
- **Graph Background**: Medium Gray (#374151)
- **Grid Lines**: Light Gray (#4b5563)

### Course Header Colors (Examples)
- **CSE 301**: Sky Blue (#38bdf8)
- **CSE 302**: Purple (#c084fc)
- **CSE 303**: Yellow (#facc15)
- **CSE 304**: Pink (#f472b6)

### Reference Lines
- **3.5/wk**: Red (#f87171) - Dashed
- **4.0/wk**: Yellow (#fbbf24) - Solid
- **4.5/wk**: Green (#4ade80) - Dashed

### Progress Indicators
- **Highest**: Green (#4ade80)
- **Lowest**: Red (#f87171)
- **Average**: Blue (#60a5fa)

### Text Colors
- **Headers**: White (#ffffff)
- **Labels**: Light Gray (#d1d5db)
- **Axis Text**: Medium Gray (#9ca3af)

## Interactive Features

### Hover Tooltips
```
┌─────────────────────────┐
│ Week 5: Highest         │
│ 42 events               │
│ Smith, John             │
└─────────────────────────┘
```
Hover over any dot to see:
- Week number
- Event count
- Trainee name (for highest/lowest)

### Course Filter
```
┌─────────────────┐
│ All Courses     │ ← Currently selected
├─────────────────┤
│ CSE 301         │
│ CSE 302         │
│ CSE 303         │
│ CSE 304         │
└─────────────────┘
```
Click dropdown to filter view

## Example Scenarios

### Scenario 1: Course On Track
```
Events
  ^
85│                                        ╱ ─ ─ ─ (4.5/wk)
  │                                  ╱ ─ ─
  │                            ╱ ─ ─       ──── (4.0/wk)
  │                      ╱ ─ ─
  │                ╱ ─ ─         ─ ─ ─ (3.5/wk)
  │          ╱ ─ ─
  │    ● ─ ● ─ ● ─ ● ─ ● (Average tracking 4.0/wk line)
  0└─────────────────────────────────────────────────────>
```
Average line follows 4.0/wk reference - course on schedule

### Scenario 2: Course Behind Schedule
```
Events
  ^
85│                                        ╱ ─ ─ ─ (4.5/wk)
  │                                  ╱ ─ ─
  │                            ╱ ─ ─       ──── (4.0/wk)
  │                      ╱ ─ ─
  │                ╱ ─ ─         ─ ─ ─ (3.5/wk)
  │          ╱ ─ ─
  │    ● ─ ● ─ ● ─ ● ─ ● (Average below 3.5/wk line)
  0└─────────────────────────────────────────────────────>
```
Average line below all reference lines - needs intervention

### Scenario 3: Wide Spread Between Trainees
```
Events
  ^
  │    ●         ●         ●         ● (Highest - far ahead)
  │    │         │         │         │
  │    │         │         │         │
  │    ● ─ ─ ─ ─ ● ─ ─ ─ ─ ● ─ ─ ─ ─ ● (Average)
  │    │         │         │         │
  │    │         │         │         │
  │    ●         ●         ●         ● (Lowest - far behind)
  0└─────────────────────────────────────────────────────>
```
Large vertical gap indicates uneven progress - some trainees need support

## Usage Tips

### For Instructors
1. **Check Average Line**: Should track close to 4.0/wk reference
2. **Monitor Spread**: Large gaps indicate uneven progress
3. **Identify Trends**: Flattening average line = slowing progress
4. **Compare Courses**: Use filter to compare different courses

### For Course Managers
1. **Early Warning**: Average below 3.5/wk = intervention needed
2. **Resource Allocation**: Courses behind schedule need more resources
3. **Graduation Risk**: Average not reaching total by grad date = risk
4. **Success Metrics**: Courses tracking 4.0-4.5/wk = on target

### For Planners
1. **Capacity Planning**: Multiple courses behind = systemic issue
2. **Timeline Adjustment**: Persistent slow progress = extend grad date
3. **Curriculum Review**: Consistent struggles = review syllabus difficulty
4. **Staffing Needs**: Behind schedule = need more instructors

## Technical Notes

### Data Refresh
- Graphs update automatically when new scores are recorded
- Weekly calculations run from first event date to current week
- Only includes completed Flight and FTD events

### Performance
- Typical render time: <100ms per course
- Handles 50+ weeks of data smoothly
- Supports 6+ courses simultaneously

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- SVG-based rendering for crisp display at any zoom level
- Responsive design adapts to screen size

## Conclusion

The new Progress Graph provides at-a-glance visibility into:
- ✅ Course pacing relative to required rates
- ✅ Individual trainee progress (highest/lowest)
- ✅ Average course performance over time
- ✅ Multi-course comparison capability
- ✅ Early warning of scheduling issues

This comprehensive visualization helps ensure courses stay on track for successful graduation.