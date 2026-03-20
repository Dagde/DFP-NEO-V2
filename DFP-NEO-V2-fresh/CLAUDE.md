# AI Assistant Instructions for DFP-NEO-V2

## 🚨 CRITICAL: Read This Before ANY Action 🚨

### Railway Deployment Configuration

**Railway deploys from the `DFP-NEO-V2-fresh` subdirectory ONLY.**

The `railway.json` is located at `DFP-NEO-V2-fresh/railway.json`, which means Railway
exclusively deploys code from within the `DFP-NEO-V2-fresh/` directory.

### Mandatory Pre-Action Checklist

Before making ANY file changes or commits, verify:

1. ✅ You are working in `/workspace/DFP-NEO-V2-fresh/` directory
2. ✅ You are pushing to `feature/comprehensive-build-algorithm` branch (NOT `main`)
3. ✅ After editing React components, run `npm run build` before committing
4. ✅ Built files in `dfp-neo-platform/public/flight-school-app/assets/` are committed

### Correct File Locations

| File | Correct Path |
|------|-------------|
| Express server | `DFP-NEO-V2-fresh/server.js` |
| API functions | `DFP-NEO-V2-fresh/lib/api.ts` |
| React components | `DFP-NEO-V2-fresh/components/` |
| Mock data | `DFP-NEO-V2-fresh/mockData.ts` |
| Database schema | `DFP-NEO-V2-fresh/prisma/schema.prisma` |
| Railway config | `DFP-NEO-V2-fresh/railway.json` |

### Correct Push Command

```bash
cd /workspace/DFP-NEO-V2-fresh
git push https://x-access-token:$GITHUB_TOKEN@github.com/Dagde/DFP-NEO-V2.git HEAD:feature/comprehensive-build-algorithm
```

### What Happens If You Get It Wrong

- Changes at repository root → **NOT deployed** (Railway ignores them)
- React changes without rebuild → **NOT visible** (Railway serves built files)
- Push to `main` branch → **Wrong branch** (development happens on feature branch)

### History

This project had repeated deployment failures in March 2026 because changes were made
at the repository root instead of the `DFP-NEO-V2-fresh` subdirectory. These rules
exist to prevent that from recurring.

See `DEPLOYMENT_GUIDE.md` for full documentation.