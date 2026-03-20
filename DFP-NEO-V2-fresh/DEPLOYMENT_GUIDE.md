# DFP-NEO Deployment Guide

## ⚠️ CRITICAL: Railway Deployment Configuration

### The #1 Most Important Thing to Know

**Railway deploys from the `DFP-NEO-V2-fresh` subdirectory, NOT from the repository root!**

This is configured via `DFP-NEO-V2-fresh/railway.json`. All changes must be made within this subdirectory for them to be deployed.

### Common Mistake to Avoid

❌ **WRONG**: Making changes at repository root (`/server.js`, `/lib/api.ts`, etc.)
```
/workspace/server.js          ← WRONG - Railway will NOT see this
/workspace/lib/api.ts         ← WRONG - Railway will NOT see this
```

✅ **CORRECT**: Making changes inside the `DFP-NEO-V2-fresh` subdirectory
```
/workspace/DFP-NEO-V2-fresh/server.js     ← CORRECT - Railway WILL deploy this
/workspace/DFP-NEO-V2-fresh/lib/api.ts    ← CORRECT - Railway WILL deploy this
```

---

## Production Build Ready! ✅

Your app has been successfully built for production. The build output is in `dfp-neo-platform/public/flight-school-app/` folder.

## Build Summary
- **Working Directory**: `DFP-NEO-V2-fresh/`
- **Build Command**: `npm run build`
- **Output Location**: `dfp-neo-platform/public/flight-school-app/assets/`
- **Status**: ✅ Production Ready

---

## Deployment Architecture

```
Repository Root (Dagde/DFP-NEO-V2)
│
├── DFP-NEO-V2-fresh/          ← Railway deploys from HERE
│   ├── railway.json           ← Railway configuration
│   ├── server.js              ← Express server (deployed)
│   ├── lib/                   ← Backend libraries (deployed)
│   ├── components/            ← React components (deployed after build)
│   ├── dfp-neo-platform/      ← Build output directory
│   │   └── public/flight-school-app/
│   │       └── assets/        ← Built JS/CSS files served to users
│   └── package.json
│
├── (other directories)        ← NOT deployed by Railway
└── (files at root)            ← NOT deployed by Railway
```

---

## Deployment Workflow

### 1. Always Work in the Correct Directory
```bash
cd /workspace/DFP-NEO-V2-fresh
```

### 2. Pull Latest Changes
```bash
git pull origin feature/comprehensive-build-algorithm
```

### 3. Make Your Changes
Edit files within `DFP-NEO-V2-fresh/` directory only.

### 4. Build the Frontend
```bash
npm run build
```

This generates built files in `dfp-neo-platform/public/flight-school-app/assets/`.

**Important**: Railway serves the built files, NOT the source TypeScript. You must rebuild after making changes to React components.

### 5. Commit and Push
```bash
git add .
git commit -m "Your descriptive commit message"
git push https://x-access-token:$GITHUB_TOKEN@github.com/Dagde/DFP-NEO-V2.git HEAD:feature/comprehensive-build-algorithm
```

### 6. Verify Deployment
- Check Railway dashboard for deployment status
- The `/api/version` endpoint returns the active commit hash
- The User ID button in the app displays the commit hash

---

## File Locations Quick Reference

| What You're Changing | Correct Location |
|---------------------|------------------|
| Express server code | `DFP-NEO-V2-fresh/server.js` |
| API functions | `DFP-NEO-V2-fresh/lib/api.ts` |
| React components | `DFP-NEO-V2-fresh/components/` |
| Mock data | `DFP-NEO-V2-fresh/mockData.ts` |
| Database schema | `DFP-NEO-V2-fresh/prisma/schema.prisma` |
| Package dependencies | `DFP-NEO-V2-fresh/package.json` |
| Railway config | `DFP-NEO-V2-fresh/railway.json` |

---

## Troubleshooting

### "My changes aren't showing up in the deployed app"
1. Verify you're working in `DFP-NEO-V2-fresh/` directory
2. Run `npm run build` after changing React components
3. Check that built files were committed (files in `dfp-neo-platform/public/`)
4. Verify the commit hash in the app matches your pushed commit

### "I edited server.js but the API didn't change"
- Make sure you edited `DFP-NEO-V2-fresh/server.js`, NOT `/server.js` at root
- Server changes don't require a rebuild, but do require a push

### "The button/component I added isn't visible"
- You likely edited source TypeScript but didn't rebuild
- Run `npm run build` and commit the new built files

---

## Branch Information

- **Working Branch**: `feature/comprehensive-build-algorithm`
- **Do NOT push to**: `main` branch

---

## Lessons Learned (Historical Context)

### March 2026: Migration Button Not Appearing

**Problem**: Added Migration Tools button to DataSourcesSettings.tsx but it wasn't visible in the deployed app.

**Root Cause**: Changes were being pushed to the repository root instead of the `DFP-NEO-V2-fresh` subdirectory where Railway actually deploys from.

**Solution**: Work exclusively within `DFP-NEO-V2-fresh/` directory, rebuild, and push from there.

**Key Takeaway**: Always verify the Railway configuration path before making changes. The `railway.json` location reveals where Railway expects to find your application code.

---

## Key Features Deployed

✅ Complete flight scheduling interface  
✅ Personnel management system  
✅ Aircraft availability calculations  
✅ Settings and configuration  
✅ Bulk import/export functionality  
✅ Mobile-responsive design  
✅ PWA capabilities  
✅ Staff data migration to database (Migration Tools button in Settings → Data Sources)

---

*Last Updated: March 2026*
*Purpose: Prevent future developers (and AI assistants) from making the same deployment mistakes*