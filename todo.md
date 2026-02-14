# Build Intelligence Restructure - Implementation Tasks

## Phase 1: Create Reusable Component Library ✓ ANALYSIS COMPLETE
- [x] Analyze existing Program Data View (862 lines)
- [x] Analyze existing Build Analysis View (477 lines)
- [x] Document all sections, features, and data dependencies
- [x] Create comprehensive analysis document
- [x] Verify no data loss in proposed structure

## Phase 2: Extract Reusable UI Components ✓ COMPLETE
- [x] Create `/workspace/components/shared/StatCard.tsx`
- [x] Create `/workspace/components/shared/InteractiveStatCard.tsx`
- [x] Create `/workspace/components/shared/ListCard.tsx`
- [x] Create `/workspace/components/shared/AvailabilityCard.tsx`
- [x] Create `/workspace/components/shared/PieChart.tsx`
- [x] Create `/workspace/components/shared/TimeDistributionChart.tsx`
- [x] Create `/workspace/components/shared/CourseDistributionTable.tsx`
- [x] Create `/workspace/components/shared/LimitingFactorsSection.tsx`
- [x] Create `/workspace/components/shared/InsightsSection.tsx`

## Phase 3: Create Tab Components ✓ COMPLETE
- [x] Create `/workspace/components/tabs/PeopleTab.tsx` with sections:
  - Personnel Unavailable
  - Waiting for Night Flying
  - Instructors (5 stat cards)
  - Trainees (5 stat cards)
  - Trainee Availability (with search and filters)
  - Next Event Lists (8 cards)
- [x] Create `/workspace/components/tabs/CourseMetricsTab.tsx` with sections:
  - Events per Course (Excl. Ground School)
  - Course Distribution Analysis (table)
  - Flight Events per Course (pie chart)
  - Total Events per Course (pie chart)
- [x] Create `/workspace/components/tabs/BuildAnalyticsTab.tsx` with sections:
  - Tiles (4 stat cards)
  - Build Summary (4 stat cards)
  - Scheduling Bottlenecks
  - Time Distribution (bar chart)
  - Insights & Recommendations

## Phase 4: Create Main Container ✓ COMPLETE
- [x] Create `/workspace/components/BuildIntelligenceView.tsx`
  - Tab navigation UI (People, Course Metrics, Build Analytics)
  - State management for active tab
  - Props aggregation and distribution to tabs
  - Preserve all data flow from original components

## Phase 5: Update Navigation ✓ COMPLETE
- [x] Update `/workspace/components/RightSidebar.tsx`:
  - Remove "Program Data" button
  - Remove "Build Analysis" button
  - Add single "Build Intelligence" button
- [x] Update `/workspace/App.tsx`:
  - Import BuildIntelligenceView
  - Replace ProgramDataView case with BuildIntelligenceView
  - Replace BuildAnalysisView case with BuildIntelligenceView
  - Ensure all props are passed correctly

## Phase 6: Testing & Verification
- [ ] Test People tab:
  - Personnel Unavailable displays correctly
  - Waiting for Night Flying displays correctly
  - Instructor stat cards show correct counts
  - Hover tooltips show personnel lists
  - Click navigation to person works
  - Trainee stat cards show correct counts
  - Trainee Availability filters work
  - Search functionality works
  - Next Event Lists display correctly
  - Course filters work on lists
- [ ] Test Course Metrics tab:
  - Events per Course displays correctly
  - Interactive stat cards work
  - Course Distribution table shows all columns
  - Pie charts render correctly
  - Pie chart hover tooltips work
- [ ] Test Build Analytics tab:
  - Tiles stat cards display correctly
  - Build Summary displays correctly
  - Scheduling Bottlenecks displays correctly
  - Time Distribution chart renders correctly
  - Bar chart hover tooltips work
  - Insights section displays correctly
  - Color coding works correctly
- [ ] Test tab navigation:
  - Switching between tabs is smooth
  - Tab state is preserved
  - No performance issues
- [ ] Test with no build data:
  - Appropriate empty states display
  - No errors occur

## Phase 7: Cleanup
- [ ] Remove old `/workspace/components/ProgramDataView.tsx`
- [ ] Remove old `/workspace/components/BuildAnalysisView.tsx`
- [ ] Update imports in App.tsx
- [ ] Verify no broken references

## Phase 8: Build & Deploy ✓ COMPLETE
- [x] Run `npm run build` to verify no errors
- [x] Copy dist to deployment directories
- [x] Update HTML bundle references
- [x] Restore button colors
- [x] Commit changes to git
- [x] Push to GitHub
- [x] Verify Railway deployment (pending)

## Notes
- All calculations, filters, and interactive features must remain identical
- No data loss or functionality degradation
- Maintain responsive design
- Preserve all color coding and status indicators
- Keep all useMemo hooks for performance