# 🚨 MANDATORY DEPLOYMENT RULES - READ BEFORE EVERY COMMIT 🚨

## BEFORE MAKING ANY CHANGES:

1. **VERIFY YOU ARE IN THE CORRECT DIRECTORY**
   ```bash
   pwd
   # MUST show: /workspace/DFP-NEO-V2-fresh
   # If it shows anything else, STOP and cd to the correct directory
   ```

2. **NEVER EDIT FILES AT REPOSITORY ROOT**
   - ❌ `/workspace/server.js` - WRONG
   - ❌ `/workspace/lib/` - WRONG  
   - ❌ `/workspace/components/` - WRONG
   - ✅ `/workspace/DFP-NEO-V2-fresh/server.js` - CORRECT
   - ✅ `/workspace/DFP-NEO-V2-fresh/lib/` - CORRECT
   - ✅ `/workspace/DFP-NEO-V2-fresh/components/` - CORRECT

3. **AFTER EDITING REACT COMPONENTS, ALWAYS REBUILD**
   ```bash
   cd /workspace/DFP-NEO-V2-fresh
   npm run build
   ```

## RAILWAY DEPLOYS FROM: `DFP-NEO-V2-fresh/` SUBDIRECTORY

The `railway.json` is located at `DFP-NEO-V2-fresh/railway.json`.
This means Railway ONLY sees files inside `DFP-NEO-V2-fresh/`.

Files outside this directory are INVISIBLE to Railway deployments.

---

**Violation of these rules = Changes will NOT be deployed**

*This file exists to prevent the March 2026 deployment issue from recurring.*