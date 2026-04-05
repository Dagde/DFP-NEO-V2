# Fix: Surgical bundle patch for FIC211 hex color + 10mb Express limit

## Tasks
- [x] Restore to ce0ee32c working state (commit cf391264)
- [x] Deep analysis: identified that rebuilding the bundle breaks the app
- [x] Fix server.js: express.json({ limit: '10mb' }) + urlencoded limit
- [x] Surgical patch index.js bundle (5 locations for hex color support)
  - [x] Sidebar.tsx line 221: course legend dot
  - [x] CourseRosterView.tsx line 308: course card header
  - [x] CourseDataWindow.tsx line 134: course header div
  - [x] CourseDataWindow.tsx line 187: per-trainee progress bar
  - [x] ArchivedCoursesView.tsx line 95: color swatch
- [x] Commit and push (NO bundle rebuild) - commit e0127a3e