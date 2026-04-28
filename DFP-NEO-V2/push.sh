#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# push.sh  —  Build, post-process, copy assets, commit and push to GitHub
# Usage:  bash push.sh "commit message"
#
# PAT storage: saved in /workspace/.github_pat (never committed to git)
# To update token: echo "ghp_YOURTOKEN" > /workspace/.github_pat
#
# IMPORTANT ORDER:
#   1. vite build  (writes to dist/)
#   2. cp dist -> public/  (copies built files to deployment dir)
#   3. node update_css.js  (fixes active button colour in public/index.html)
#      update_css.js MUST run AFTER the copy — it patches public/index.html
#      Running it before the copy means the patched file gets overwritten
# ─────────────────────────────────────────────────────────────────────────────

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
FRESH_DIR="$REPO_DIR/DFP-NEO-V2-fresh"
PUBLIC_DIR="$FRESH_DIR/dfp-neo-platform/public/flight-school-app"
BRANCH="feature/comprehensive-build-algorithm"
PAT_FILE="/workspace/.github_pat"

# Load PAT from file
if [ ! -f "$PAT_FILE" ]; then
  echo "ERROR: PAT file not found at $PAT_FILE"
  echo "Run: echo 'ghp_YOURTOKEN' > /workspace/.github_pat"
  exit 1
fi
PAT="$(cat "$PAT_FILE" | tr -d '[:space:]')"
REMOTE="https://x-access-token:${PAT}@github.com/Dagde/DFP-NEO-V2.git"

MSG="${1:-chore: build and deploy}"

echo "=== 1. Building Vite ==="
cd "$FRESH_DIR"
npx vite build

echo "=== 2. Copying dist -> public ==="
cp -r "$FRESH_DIR/dist/." "$PUBLIC_DIR/"

echo "=== 3. Running post-build CSS fix (MUST be after copy) ==="
node update_css.js

echo "=== 4. Staging all changes ==="
cd "$REPO_DIR"
git add -A

echo "=== 5. Committing ==="
git commit -m "$MSG" || echo "(nothing to commit)"

echo "=== 6. Pushing to GitHub ==="
git push "$REMOTE" "$BRANCH"

echo "=== Done - Railway will redeploy automatically ==="