# Pinned Solutions

## Staff Database Tab Not Visible After Code Changes

**Date:** January 13, 2026  
**Issue:** Staff Database tab added to source code but not visible in deployed Railway application  
**Root Cause:** Source file changes require rebuilding the standalone Vite app to regenerate bundled JavaScript files

### Problem Description

When making changes to the standalone app (`/workspace/`):
- **Direct bundled file changes work immediately** (e.g., modifying `dfp-neo-platform/public/flight-school-app/assets/*.js` directly)
- **Source file changes don't work** unless the standalone app is rebuilt and new bundles are copied to the public directory

### Why This Happens

The application has a two-part architecture:
1. **Standalone Vite App** (`/workspace/`): Source code (`.tsx`, `.ts`, etc.)
2. **Next.js App** (`/workspace/dfp-neo-platform/`): Serves static files from `public/flight-school-app/`

Railway serves the **pre-built static assets** from `public/flight-school-app/assets/`. When you modify source files in `/workspace/`, you must rebuild the standalone app to regenerate these assets.

### Solution

When modifying source files in `/workspace/`:

```bash
# 1. Navigate to standalone app directory
cd /workspace

# 2. Install dependencies (if needed)
npm install

# 3. Build the standalone app
npm run build

# 4. Copy new build artifacts to Next.js public directory
cp -r /workspace/dist/* /workspace/dfp-neo-platform/public/flight-school-app/

# 5. Verify the changes are in the bundled files
# Example: Check if "Staff Database" appears in bundled JavaScript
grep -o "Staff Database" /workspace/dfp-neo-platform/public/flight-school-app/assets/*.js | wc -l

# 6. Commit and push changes
cd /workspace
git add dfp-neo-platform/public/flight-school-app/
git commit -m "feat: [description] - Rebuilt standalone app to include latest source changes"
git push
```

### Key Points

- **Modify source files** → MUST rebuild using `npm run build`
- **Modify bundled files directly** → NO build needed, but not recommended
- Always verify changes appear in the bundled JavaScript files before committing
- The build output goes to `/workspace/dist/` and must be copied to `public/flight-school-app/`

### When to Use This Solution

- Adding new components or features to the standalone app
- Modifying React components (`.tsx` files)
- Changing TypeScript source code
- Updating styles or configurations in the standalone app
- Adding new menu items, tabs, or UI elements

### When You DON'T Need This Solution

- Modifying Next.js app routes or API endpoints (`dfp-neo-platform/app/`)
- Changing Next.js configuration or middleware
- Modifying already-bundled JavaScript files directly (not recommended)

### Example Scenario

**Before (Wrong Way):**
1. Edit `/workspace/components/SettingsViewWithMenu.tsx`
2. Commit and push
3. **Result:** Changes don't appear in deployed app ❌

**After (Correct Way):**
1. Edit `/workspace/components/SettingsViewWithMenu.tsx`
2. Run `npm install && npm run build` in `/workspace`
3. Run `cp -r /workspace/dist/* /workspace/dfp-neo-platform/public/flight-school-app/`
4. Verify changes in bundled files: `grep "Staff Database" /workspace/dfp-neo-platform/public/flight-school-app/assets/*.js`
5. Commit and push
6. **Result:** Changes appear in deployed app ✅