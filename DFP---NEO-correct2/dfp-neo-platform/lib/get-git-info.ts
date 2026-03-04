export function getGitCommitHash(): string {
  try {
    const gitRev = require('child_process')
      .execSync('git rev-parse --short HEAD')
      .toString()
      .trim();
    return gitRev;
  } catch (error) {
    console.error('Failed to get git commit hash:', error);
    return 'unknown';
  }
}

export function getGitBranch(): string {
  try {
    const gitBranch = require('child_process')
      .execSync('git rev-parse --abbrev-ref HEAD')
      .toString()
      .trim();
    return gitBranch;
  } catch (error) {
    console.error('Failed to get git branch:', error);
    return 'unknown';
  }
}

export function getGitCommitMessage(): string {
  try {
    const gitMessage = require('child_process')
      .execSync('git log -1 --pretty=format:%s')
      .toString()
      .trim();
    return gitMessage;
  } catch (error) {
    console.error('Failed to get git commit message:', error);
    return 'unknown';
  }
}