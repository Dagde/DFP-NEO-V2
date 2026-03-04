# Git Automation for Multi-AI Bot Collaboration

## Overview
This Git automation system automatically synchronizes your workspace with GitHub, allowing multiple AI bots to work on the same project without conflicts.

## Features
- ✅ **Auto-Pull**: Automatically pulls latest changes from GitHub
- ✅ **Auto-Push**: Automatically pushes local changes to GitHub  
- ✅ **Continuous Sync**: Runs every 5 minutes in background
- ✅ **Conflict Resolution**: Attempts safe conflict resolution
- ✅ **Status Monitoring**: Tracks sync status and last sync time

## Available Commands

```bash
# Check current sync status
npm run git-status

# Perform one-time full sync (pull + push)
npm run git-sync-once

# Pull latest changes only
npm run git-pull

# Push local changes only
npm run git-push

# Start continuous background sync (runs every 5 minutes)
npm run git-sync
```

## How It Works

### Continuous Sync Mode
When you run `npm run git-sync`, the automation:
1. Starts in the background
2. Performs an immediate full sync
3. Continues syncing every 5 minutes
4. Handles conflicts automatically when possible
5. Logs all activities with timestamps

### Sync Process
1. **Stash Local Changes**: Temporarily saves your work
2. **Pull Latest**: Gets updates from GitHub
3. **Resolve Conflicts**: Attempts safe automatic resolution
4. **Restore Changes**: Reapplies your stashed work
5. **Push Changes**: Commits and pushes your updates

## Conflict Resolution

The automation handles conflicts by:
- Stashing your local changes before pulling
- Resetting to clean state if merge conflicts occur
- Attempting to reapply your changes after pulling
- Creating descriptive auto-commit messages with timestamps

## Usage for Multi-AI Bot Work

### Before Switching AI Bots
1. Let the automation run (it will auto-sync)
2. Or manually run: `npm run git-sync-once`

### After Switching AI Bots  
1. The automation will automatically pull latest changes within 5 minutes
2. Or manually pull: `npm run git-pull`

### Monitoring Status
Check `npm run git-status` to see:
- Whether continuous sync is running
- Time of last sync
- Current branch
- Whether you have local changes pending

## Logs
All sync activities are logged with timestamps:
- 🤖 GitBot prefix for automation messages
- ✅ Success indicators
- ⚠️  Warnings for conflicts
- ❌ Error indicators

## Files Created
- `git-automation.js` - Main automation engine
- `git-sync.sh` - Bash script alternative
- `git-status.js` - Status checker
- `git-sync-once.js` - One-time sync runner
- `.last-sync` - Timestamp file (auto-generated)

## Safety Features
- Non-destructive conflict resolution
- Stash/restore workflow
- Detailed logging
- Graceful shutdown handling
- Automatic commit with descriptive messages

## Troubleshooting

### If conflicts occur:
1. The automation will attempt automatic resolution
2. Manual intervention may be needed for complex conflicts
3. Check logs for specific error details

### If automation stops:
1. Run `npm run git-status` to check if it's running
2. Restart with `npm run git-sync`

### To stop continuous sync:
1. Find the process and send Ctrl+C
2. Or restart the workspace

This system ensures that both AI bots can work on the project seamlessly with automatic synchronization!