# Fix: Express body limit + Remove manualChunks + FIC211 hex color support

## Tasks

### Fix 1: server.js - increase body limit
- [x] Change `express.json()` to `express.json({ limit: '10mb' })` + add urlencoded limit

### Fix 2: vite.config.ts - remove manualChunks
- [x] Remove entire rollupOptions block (keep minify:false, sourcemap:true, outDir, emptyOutDir)

### Fix 3: components/Sidebar.tsx - hex color in legend
- [x] Fix line 221: conditional style for hex vs tailwind class

### Fix 4: components/TraineeColumn.tsx - hex pass-through
- [x] Fix convertTailwindToHex: add hex pass-through as first line

### Fix 5: components/CourseDataWindow.tsx - hex in header + progress bar
- [x] Fix courseColor usage in header div and progress bar

### Fix 6: components/CourseRosterView.tsx - hex in course card header
- [x] Fix color usage in course card header div

### Fix 7: components/ArchivedCoursesView.tsx - hex in color swatch
- [x] Fix color swatch div

### Build & Commit
- [x] Run npm run build to verify
- [x] Commit and push