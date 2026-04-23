# Deployment Checklist

## ⚠ CRITICAL: Always check current branch before pushing

**ACTIVE BRANCH: `feature/comprehensive-build-algorithm`**

The `main` branch has NOT been used for months. All deployment MUST go to:
- `git checkout feature/comprehensive-build-algorithm`
- `git push origin feature/comprehensive-build-algorithm`

Or use token-based push:
- `git push https://x-access-token:$GITHUB_TOKEN@github.com/Dagde/DFP-NEO-V2.git feature/comprehensive-build-algorithm`

---

## Git Aliases (set up once)
```bash
# Alias to safely push to the correct branch
git config --global alias.cdeploy '!git checkout feature/comprehensive-build-algorithm && git push https://x-access-token:$GITHUB_TOKEN@github.com/Dagde/DFP-NEO-V2.git feature/comprehensive-build-algorithm'

# Alias to check current branch
git config --global alias.cb rev-parse --abbrev-ref HEAD

# Quick check command
git cb  # shows current branch
```

---

## Pre-Push Workflow

```bash
# 1. Check current branch
git rev-parse --abbrev-ref HEAD
# Should output: feature/comprehensive-build-algorithm

# 2. If NOT on correct branch, switch IMMEDIATELY
git checkout feature/comprehensive-build-algorithm

# 3. Build
cd DFP-NEO-V2-fresh && npm run build && cd ..

# 4. Commit
git add .
git commit -m "Your commit message"

# 5. Push (ALWAYS use full URL with token)
git push https://x-access-token:$GITHUB_TOKEN@github.com/Dagde/DFP-NEO-V2.git feature/comprehensive-build-algorithm
```

---

## Deployment Verification

After pushing:
1. `git log --oneline -3` - verify commit message
2. `git status` - should show "nothing to commit, working tree clean"

---

## Railway Auto-Deploy

- Railway is configured to deploy from `feature/comprehensive-build-algorithm`
- Pushes to `main` will NOT trigger Railway deployment (incorrect branch)
- Railway monitors `feature/comprehensive-build-algorithm` branch for changes

---

### Last Updated: 2025-11-03
**IMPORTANT: This checklist is the source of truth for deployment branch.**