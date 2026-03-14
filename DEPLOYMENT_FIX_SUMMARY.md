# Deployment Fix Summary - Root Cause Analysis

## The Problem

Over the past two days (March 13-14, 2026), nearly every Railway deployment failed. The failures manifested as:

```
[vite:build-html] crypto.hash is not a function
file: /app/index.html
```

## The Root Cause

**A single change in `nixpacks.toml` caused ALL the failures:**

- **Working commit `d25becd3`**: `nixPkgs = ["nodejs_22", "npm-9_x"]`
- **Broken commits**: `nixPkgs = ["nodejs_18", "npm-9_x", "openssl"]`

### Why Node 18 Broke Everything

| Requirement | Node 18 | Node 22 |
|-------------|---------|---------|
| vite 7.3.1 requires | ❌ `node: "^20.19.0 \|\| >=22.12.0"` | ✅ Compatible |
| `crypto.hash` function | ❌ Doesn't exist (added in Node 20.12/21.7) | ✅ Available |
| Build result | ❌ `crypto.hash is not a function` | ✅ Success |

**vite 7.3.1 explicitly requires Node `>=20.19.0` or `>=22.12.0`**. Node 18 is completely incompatible.

## The Fix

Changed `nodejs_18` back to `nodejs_22` in both nixpacks.toml files:

```diff
# DFP-NEO-V2-fresh/nixpacks.toml
# nixpacks.toml (root)

[phases.setup]
- nixPkgs = ["nodejs_18", "npm-9_x", "openssl"]
+ nixPkgs = ["nodejs_22", "npm-9_x", "openssl"]
```

**Commit**: `a6b2c2f6`

## Was This Common to the Majority of Failed Deploys?

**YES - This was the root cause of nearly ALL failed deploys.**

Evidence from the logs:
- `logs.1773491433016.log` (latest): Shows `node: 'v18.20.5'` → `crypto.hash is not a function`
- `logs.1773490801219.log`: Same error
- `logs.1773489995324.log`: Same error
- `logs.1773489379762.log`: Same error

All logs from March 14 show:
1. `setup: nodejs_18, npm-9_x, openssl` in the Nixpacks plan
2. `npm warn EBADENGINE` warnings about vite requiring Node 20+
3. `crypto.hash is not a function` crash during vite build

## Why Wasn't This Caught Earlier?

1. **`railway.json` overrides `nixpacks.toml`** for build/start commands — so we focused on fixing `railway.json`
2. **BUT `nixpacks.toml` controls the Node version** via `nixPkgs` — this was overlooked
3. Multiple "fixes" were attempted (removing npm ci, fixing EBUSY, etc.) but the underlying Node version issue was not identified until deep log analysis

## Lesson Learned

When debugging Railway/Nixpacks build failures:

1. **Check the Nixpacks plan FIRST** — Look at the `setup` line in deploy logs
2. **Node version matters** — Always verify `nixpacks.toml` has the correct Node version
3. **`railway.json` does NOT override `nixPkgs`** — Only commands, not packages

## Files Changed

| File | Change |
|------|--------|
| `DFP-NEO-V2-fresh/nixpacks.toml` | `nodejs_18` → `nodejs_22` |
| `nixpacks.toml` (root) | `nodejs_18` → `nodejs_22` |

## Status

- [x] Root cause identified
- [x] Fix committed and pushed
- [ ] Verify successful Railway deployment