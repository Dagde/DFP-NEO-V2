#!/bin/bash

# Git Automation Script for Multi-AI Bot Collaboration
# This script handles automatic push/pull operations

set -e

# Configuration
REPO_DIR="/workspace/DFP---NEO"
BRANCH="main"
SYNC_INTERVAL=300  # 5 minutes
AUTO_COMMIT_MESSAGE="Auto-sync: $(date '+%Y-%m-%d %H:%M:%S')"

cd "$REPO_DIR"

# Function to check if we have changes
has_changes() {
    if [[ -n $(git status --porcelain) ]]; then
        return 0
    else
        return 1
    fi
}

# Function to auto-pull latest changes
auto_pull() {
    echo "🔄 Auto-pulling latest changes..."
    
    # Stash any local changes temporarily
    if has_changes; then
        echo "📦 Stashing local changes..."
        git stash push -m "temp-stash-$(date +%s)"
    fi
    
    # Pull latest changes
    git pull origin main
    
    # Try to reapply stashed changes
    if git stash list | grep -q "temp-stash"; then
        echo "📦 Restoring stashed changes..."
        git stash pop || echo "⚠️  Conflict detected - manual resolution needed"
    fi
    
    echo "✅ Auto-pull complete"
}

# Function to auto-push changes
auto_push() {
    if has_changes; then
        echo "📤 Auto-pushing changes..."
        
        # Add all changes
        git add .
        
        # Check if there's anything to commit
        if git diff --cached --quiet; then
            echo "ℹ️  No changes to commit"
            return 0
        fi
        
        # Commit with auto-generated message
        git commit -m "$AUTO_COMMIT_MESSAGE"
        
        # Push to remote
        git push origin main
        
        echo "✅ Auto-push complete"
    else
        echo "ℹ️  No changes to push"
    fi
}

# Function to sync both ways
full_sync() {
    echo "🔄 Starting full sync..."
    auto_pull
    auto_push
    echo "✅ Full sync complete"
}

# Main execution based on argument
case "$1" in
    "pull")
        auto_pull
        ;;
    "push")
        auto_push
        ;;
    "sync")
        full_sync
        ;;
    "status")
        git status
        echo "📊 Last sync: $(date)"
        ;;
    *)
        echo "Usage: $0 {pull|push|sync|status}"
        echo "  pull   - Pull latest changes from remote"
        echo "  push   - Push local changes to remote" 
        echo "  sync   - Full sync (pull then push)"
        echo "  status - Show git status"
        exit 1
        ;;
esac