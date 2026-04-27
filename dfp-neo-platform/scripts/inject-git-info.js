const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getGitInfo() {
  let commitHash = 'unknown';
  let commitMessage = 'unknown';
  let branch = 'unknown';

  // Try to get git info from environment variables (Railway provides these)
  if (process.env.RAILWAY_GIT_COMMIT_SHA) {
    commitHash = process.env.RAILWAY_GIT_COMMIT_SHA.substring(0, 7);
  }
  
  if (process.env.RAILWAY_GIT_BRANCH) {
    branch = process.env.RAILWAY_GIT_BRANCH.replace('refs/heads/', '');
  }

  if (process.env.RAILWAY_GIT_COMMIT_MESSAGE) {
    commitMessage = process.env.RAILWAY_GIT_COMMIT_MESSAGE;
  }

  // If env vars are not available, try git commands
  if (commitHash === 'unknown') {
    try {
      commitHash = execSync('git rev-parse --short HEAD').toString().trim();
    } catch (error) {
      console.log('Git not available, using placeholder values');
    }
  }

  if (commitMessage === 'unknown') {
    try {
      commitMessage = execSync('git log -1 --pretty=format:%s').toString().trim();
    } catch (error) {
      console.log('Git not available, using placeholder values');
    }
  }

  if (branch === 'unknown') {
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    } catch (error) {
      console.log('Git not available, using placeholder values');
    }
  }

  return { commitHash, commitMessage, branch };
}

function injectGitInfo() {
  const htmlPath = path.join(__dirname, '../public/flight-school-app/index-v2.html');
  const gitInfo = getGitInfo();

  console.log('📦 Injecting Git information into HTML:');
  console.log(`   Commit: ${gitInfo.commitHash}`);
  console.log(`   Message: ${gitInfo.commitMessage}`);
  console.log(`   Branch: ${gitInfo.branch}`);

  let html = fs.readFileSync(htmlPath, 'utf8');

  // Replace the commit hash placeholder
  html = html.replace(
    /const commitHash = ".*?";/,
    `const commitHash = "${gitInfo.commitHash}";`
  );

  // Replace the commit message placeholder
  html = html.replace(
    /const commitMessage = ".*?";/,
    `const commitMessage = "${gitInfo.commitMessage}";`
  );

  // Replace the branch placeholder
  html = html.replace(
    /const branch = ".*?";/,
    `const branch = "${gitInfo.branch}";`
  );

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('✅ Git information injected successfully!');
}

injectGitInfo();