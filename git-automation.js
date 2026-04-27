import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

class GitAutomation {
    constructor() {
        this.repoDir = '/workspace/DFP---NEO';
        this.branch = 'main';
        this.syncInterval = 5 * 60 * 1000; // 5 minutes
        this.lastSyncFile = path.join(this.repoDir, '.last-sync');
        this.isRunning = false;
    }

    log(message) {
        console.log(`🤖 GitBot: ${new Date().toISOString()} - ${message}`);
    }

    exec(command, description) {
        try {
            this.log(`Executing: ${description}`);
            const result = execSync(command, { 
                cwd: this.repoDir, 
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe']
            });
            this.log(`Success: ${description}`);
            return result;
        } catch (error) {
            this.log(`Error: ${description} - ${error.message}`);
            return null;
        }
    }

    hasChanges() {
        try {
            const result = execSync('git status --porcelain', { 
                cwd: this.repoDir, 
                encoding: 'utf8'
            });
            return result.trim().length > 0;
        } catch (error) {
            return false;
        }
    }

    getCurrentBranch() {
        try {
            const result = execSync('git rev-parse --abbrev-ref HEAD', { 
                cwd: this.repoDir, 
                encoding: 'utf8'
            });
            return result.trim();
        } catch (error) {
            return 'main';
        }
    }

    pullLatest() {
        this.log('🔄 Pulling latest changes from remote...');
        
        // Stash local changes if any
        if (this.hasChanges()) {
            this.exec('git stash push -m "auto-stash"', 'Stashing local changes');
        }

        // Pull latest changes
        const pullResult = this.exec('git pull origin main', 'Pulling from remote');
        
        if (pullResult && pullResult.includes('Automatic merge failed')) {
            this.log('⚠️  Merge conflict detected - attempting safe resolution...');
            
            // Try to stash and re-apply
            this.exec('git reset --hard HEAD', 'Resetting to HEAD');
            this.exec('git clean -fd', 'Cleaning untracked files');
            
            // Try pull again
            const secondPull = this.exec('git pull origin main', 'Second pull attempt');
            if (secondPull) {
                this.log('✅ Successfully resolved and pulled latest changes');
            } else {
                this.log('❌ Manual conflict resolution needed');
            }
        } else {
            this.log('✅ Successfully pulled latest changes');
        }

        // Try to restore stashed changes
        try {
            const stashList = execSync('git stash list', { 
                cwd: this.repoDir, 
                encoding: 'utf8'
            });
            
            if (stashList.includes('auto-stash')) {
                this.exec('git stash pop', 'Restoring stashed changes');
            }
        } catch (error) {
            this.log('Could not restore stash - may need manual intervention');
        }

        this.updateLastSync();
    }

    pushChanges() {
        if (!this.hasChanges()) {
            this.log('ℹ️  No local changes to push');
            return;
        }

        this.log('📤 Pushing local changes to remote...');
        
        // Add all changes
        this.exec('git add .', 'Adding all changes');
        
        // Commit with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const message = `🤖 Auto-sync: ${timestamp}`;
        this.exec(`git commit -m "${message}"`, 'Committing changes');
        
        // Push to remote
        const pushResult = this.exec('git push origin main', 'Pushing to remote');
        
        if (pushResult) {
            this.log('✅ Successfully pushed changes to remote');
        } else {
            this.log('❌ Failed to push changes');
        }

        this.updateLastSync();
    }

    fullSync() {
        this.log('🔄 Starting full synchronization...');
        this.pullLatest();
        this.pushChanges();
        this.log('✅ Full synchronization complete');
    }

    updateLastSync() {
        try {
            fs.writeFileSync(this.lastSyncFile, new Date().toISOString());
        } catch (error) {
            this.log('Could not update last sync file');
        }
    }

    getLastSync() {
        try {
            if (fs.existsSync(this.lastSyncFile)) {
                return fs.readFileSync(this.lastSyncFile, 'utf8');
            }
        } catch (error) {
            return null;
        }
        return null;
    }

    startContinuousSync() {
        if (this.isRunning) {
            this.log('⚠️  Continuous sync already running');
            return;
        }

        this.isRunning = true;
        this.log('🚀 Starting continuous Git synchronization...');
        
        // Initial sync
        this.fullSync();

        // Set up interval for continuous sync
        this.syncTimer = setInterval(() => {
            try {
                this.fullSync();
            } catch (error) {
                this.log(`❌ Error during sync: ${error.message}`);
            }
        }, this.syncInterval);

        this.log(`✅ Continuous sync started (interval: ${this.syncInterval/1000} seconds)`);
    }

    stopContinuousSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            this.isRunning = false;
            this.log('⏹️  Continuous sync stopped');
        }
    }

    getStatus() {
        const lastSync = this.getLastSync();
        const currentBranch = this.getCurrentBranch();
        const hasLocalChanges = this.hasChanges();
        
        return {
            isRunning: this.isRunning,
            lastSync,
            currentBranch,
            hasLocalChanges,
            syncInterval: this.syncInterval
        };
    }
}

// Create global instance
const gitBot = new GitAutomation();

// Auto-start when file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🤖 Git Automation Bot Started');
    console.log('Press Ctrl+C to stop');
    
    gitBot.startContinuousSync();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🤖 Shutting down Git automation...');
        gitBot.stopContinuousSync();
        process.exit(0);
    });
}

export default gitBot;