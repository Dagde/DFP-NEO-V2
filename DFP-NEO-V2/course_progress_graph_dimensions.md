# Course Progress Graph - Dimensions and Measurements

Based on analysis of the Flight School Scheduler app's Course Progress Graph component (FullPageProgressGraph.tsx), here are the exact dimensions in pixels:

---

## Overall Graph Dimensions

### SVG Canvas Size
- **Total SVG Width**: 800px
- **Total SVG Height**: Not specified in the code (dynamic based on content)

### Chart Plotting Area
- **Chart Width** (actual graph area): 700px
  - Calculation: `SVG_WIDTH (800) - PADDING.left (70) - PADDING.right (50)`
- **Padding Configuration**:
  - Top: 50px
  - Right: 50px
  - Bottom: 70px
  - Left: 70px

---

## Line Stroke Widths

### Data Lines (Trainee Progress)
1. **Highest Progress Line** (Green circles): 2px stroke width
2. **Average Progress Line** (Blue circles): 2.5px stroke width
3. **Lowest Progress Line** (Red circles): 2px stroke width

### Guide Lines (Reference Lines)
All three reference lines have the same stroke width: **0.5px**
- 3.5/wk line (Red dashed)
- 4.0/wk line (Yellow solid)
- 4.5/wk line (Green dashed)

### Gridlines
- **Horizontal Gridlines**: 0.5px stroke width

### Legend Reference Lines
- **Legend line markers**: 2px stroke width (for visual reference in the legend area)

---

## Data Point Dot Sizes (Radius in Pixels)

### Weekly Data Points (Along the Progress Lines)

1. **Highest Progress Dots** (Green filled circles):
   - **Radius**: 2.5px
   - **Fill Color**: #4ade80 (green)
   - **Stroke Color**: #1f2937 (dark gray)
   - **Stroke Width**: 1px
   - **Purpose**: Marks the highest event count trainee for each week

2. **Lowest Progress Dots** (Red filled circles):
   - **Radius**: 2.5px
   - **Fill Color**: #f87171 (red)
   - **Stroke Color**: #1f2937 (dark gray)
   - **Stroke Width**: 1px
   - **Purpose**: Marks the lowest event count trainee for each week

3. **Average Progress Dots** (Blue filled circles):
   - **Radius**: 2px
   - **Fill Color**: #60a5fa (blue)
   - **Stroke Color**: #1f2937 (dark gray)
   - **Stroke Width**: 1px
   - **Purpose**: Marks the average event count for each week

### Legend Marker Dots
These appear in the top legend area:

1. **Highest Marker** (Green): 3px radius
2. **Lowest Marker** (Red): 3px radius

---

## Summary Table

| Element | Type | Width/Size (px) | Notes |
|---------|------|-----------------|-------|
| **Overall Graph** | | | |
| SVG Canvas | Width | 800px | Total canvas width |
| Plotting Area | Width | 700px | Actual chart area (800 - 70 - 50) |
| Padding (Left/Right) | Width | 70px / 50px | Left and right margins |
| **Data Lines** | | | |
| Highest Line | Stroke | 2px | Green line with green dots |
| Average Line | Stroke | 2.5px | Blue line with blue dots |
| Lowest Line | Stroke | 2px | Red line with red dots |
| **Reference Lines** | | | |
| All 3 Guide Lines | Stroke | 0.5px | 3.5/wk, 4.0/wk, 4.5/wk lines |
| Gridlines | Stroke | 0.5px | Horizontal grid lines |
| **Data Point Dots** | | | |
| Highest Dots | Radius | 2.5px | Green circles along the progress line |
| Lowest Dots | Radius | 2.5px | Red circles along the progress line |
| Average Dots | Radius | 2.0px | Blue circles along the progress line |
| Legend Markers | Radius | 3.0px | Reference markers in legend area |

---

## Additional Notes

- All data point dots have a 1px stroke (#1f2937 dark gray) for better visibility
- The data points are rendered as `<circle>` SVG elements with `cx`, `cy`, `r`, `fill`, and `stroke` attributes
- Each data point has an associated `<title>` element that displays hover information (week number, event count, and trainee name for highest/lowest)
- The graph uses a dark theme with a dark gray/charcoal background (#1f2937) which makes the colored data lines and dots stand out prominently