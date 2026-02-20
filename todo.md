# TODO: Reorganize Sidebars

## Task 1: Move all courses to left sidebar
- [x] Update Sidebar.tsx to show all courses (not just half)
- [x] Change course text size to 9px

## Task 2: Add user info to right sidebar bottom
- [x] Remove courses section from RightSidebar.tsx
- [x] Add user info display showing:
  - Line 1: Rank
  - Line 2: Surname only
  - Line 3: Location
  - Line 4: Assigned unit
- [x] No headings, just data

## Task 3: Update App.tsx to pass user data to RightSidebar
- [x] Pass currentUser data to RightSidebar
- [x] Pass location/unit info

## Task 4: Build and deploy
- [x] Build with Vite
- [x] Deploy to both directories
- [x] Commit and push changes

## Summary
Successfully reorganized the sidebars:
- All courses now displayed in the left sidebar with 9px text
- Right sidebar no longer shows courses
- Right sidebar now displays current user info at the bottom:
  - Rank (line 1)
  - Surname only (line 2)
  - Location (line 3)
  - Assigned unit (line 4)
- No headings on user info, just data
- All changes built, deployed, committed, and pushed to feature/comprehensive-build-algorithm branch