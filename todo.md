# DFP-NEO-V2 TODO

## Completed: Exclude Courses from NEO Build Feature

✅ **DB Schema** - Added `excludedCourses TEXT NOT NULL DEFAULT '[]'` column to `CourseSettings` table with migration safety
✅ **API Routes** - GET/PUT `/api/settings/course-settings` handle excludedCourses array
✅ **PeopleProfilePage** - Added "Exclude Courses" UI with checkboxes, trainee counts, live exclusion summary
✅ **SettingsViewWithMenu** - Added excludedCourses props and passed to PeopleProfilePage
✅ **App.tsx** - Passed excludedCourses state/handler to SettingsViewWithMenu
✅ **NEO Build Algorithm** - Already filters excludedcourses at pre-build + main build stages
✅ **Built** - Production build verified
✅ **Pushed** - Pushed to correct branch: `feature/comprehensive-build-algorithm`
✅ **Railway** - Auto-deploying now

## Deployment Safeguards Added

✅ **DEPLOYMENT_CHECKLIST.md** - Documents correct branch (`feature/comprehensive-build-algorithm`), pre-push workflow, Railway config
✅ **Git alias `git cb`** - Quick command to check current branch (`git cb`)
✅ **Git alias `git cdeploy`** - One-command safe deploy (switches to correct branch + pushes with token)
✅ **pre-push hook** - Warns before pushing to `main` branch with instructions

## Git Commands Reference

```bash
# Check current branch
git cb

# Safe deploy (switches to correct branch + pushes)
git cdeploy

# Manual deploy steps
git checkout feature/comprehensive-build-algorithm
cd DFP-NEO-V2-fresh && npm run build && cd ..
git add .
git commit -m "Commit message"
git push https://x-access-token:$GITHUB_TOKEN@github.com/Dagde/DFP-NEO-V2.git feature/comprehensive-build-algorithm
```

## Important Notes

- **Never push to `main`** — that branch is deprecated, Railway watches `feature/comprehensive-build-algorithm`
- **Always use token-based push** — `git push https://x-access-token:$GITHUB_TOKEN@github.com/Dagde/DFP-NEO-V2.git <branch>`
- **Check branch before push** — `git cb` should output `feature/comprehensive-build-algorithm`