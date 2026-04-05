# Option A - Fix vite.config + Color Fixes

## Tasks
- [x] Review current state of repo (at 42c167c2)
- [x] Check vite.config.ts - still has manualChunks/fixed filenames
- [x] Check all 5 component files for color fix locations
- [x] Step 1: Fix vite.config.ts (remove rollupOptions/manualChunks, keep minify:false)
- [x] Step 2: Fix update_css.js (handle content-hashed bundle filenames)
- [x] Step 3: Fix Sidebar.tsx - line 221 (hex color support for color swatch)
- [x] Step 4: Fix TraineeColumn.tsx - convertTailwindToHex hex passthrough
- [x] Step 5: Fix CourseDataWindow.tsx - courseColor used as className in 2 places
- [x] Step 6: Fix CourseRosterView.tsx - color used as className for card header
- [x] Step 7: Fix ArchivedCoursesView.tsx - color used as className for swatch
- [x] Step 8: Run npm run build to verify - SUCCESS
- [x] Step 9: Commit and push - eb2641cb pushed