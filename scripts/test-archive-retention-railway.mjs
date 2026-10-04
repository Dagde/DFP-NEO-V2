import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const DEFAULT_SERVICE_NAME = 'New Customer Test Database';
const args = process.argv.slice(2);
const helpRequested = args.includes('--help') || args.includes('-h');

function printHelp() {
  console.log([
    'Runs the archive retention DB smoke test through a temporary Railway database tunnel.',
    '',
    'Usage:',
    '  npm run test:archive-retention-railway',
    '  npm run test:archive-retention-railway -- "Database Service Name"',
    '',
    'Defaults:',
    `  Database service: ${DEFAULT_SERVICE_NAME}`,
    '',
    'Requirements:',
    '  1. Railway CLI installed.',
    '  2. You are logged in: railway login',
    '  3. This folder is linked to the Railway project: railway link',
    '',
    'No DATABASE_PUBLIC_URL or manual .env editing is required.',
  ].join('\n'));
}

function fail(message, details = '') {
  console.error(message);
  if (details) console.error(details);
  process.exitCode = 1;
}

function hasRailwayCli() {
  const result = spawnSync('railway', ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.status === 0;
}

function redactDatabaseUrls(value) {
  return String(value || '')
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[redacted postgres url]')
    .replace(/(Password:\s*)[^\s]+/gi, '$1[redacted]');
}

function extractDatabaseUrl(text) {
  const matches = String(text || '').match(/postgres(?:ql)?:\/\/[^\s'"]+/gi) || [];
  if (!matches.length) return '';
  return matches[matches.length - 1]
    .replace(/[),.;]+$/g, '')
    .trim();
}

function getServiceName() {
  const explicitArgs = args.filter(arg => !arg.startsWith('-'));
  return (
    explicitArgs.join(' ').trim()
    || process.env.RAILWAY_DATABASE_SERVICE
    || DEFAULT_SERVICE_NAME
  );
}

function stopTunnel(child) {
  if (!child || child.killed) return;
  child.kill('SIGINT');
  setTimeout(() => {
    if (!child.killed) child.kill('SIGTERM');
  }, 1500).unref();
}

async function main() {
  if (helpRequested) {
    printHelp();
    return;
  }

  if (!hasRailwayCli()) {
    fail([
      'Railway CLI was not found.',
      '',
      'Install it first:',
      '  brew install railway',
      '',
      'Then run:',
      '  railway login',
      '  railway link',
      '  npm run test:archive-retention-railway',
    ].join('\n'));
    return;
  }

  const serviceName = getServiceName();
  console.log(`Opening a temporary Railway database tunnel for "${serviceName}"...`);
  console.log('Leave this running. It will close the tunnel automatically when the test finishes.');

  const tunnel = spawn('railway', ['connect', serviceName, '--tunnel-only'], {
    cwd: repoRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  let resolved = false;
  let testProcess = null;

  const cleanup = () => {
    if (testProcess && !testProcess.killed) testProcess.kill('SIGTERM');
    stopTunnel(tunnel);
  };

  process.once('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  const timeout = setTimeout(() => {
    if (resolved) return;
    resolved = true;
    cleanup();
    fail([
      'Timed out waiting for Railway to open the database tunnel.',
      '',
      'Check these two things:',
      '  railway login',
      '  railway link',
      '',
      `If your database service has a different name, run:`,
      '  npm run test:archive-retention-railway -- "Exact Database Service Name"',
    ].join('\n'), redactDatabaseUrls(output));
  }, 90000);

  const maybeStartTest = () => {
    if (resolved) return;
    const databaseUrl = extractDatabaseUrl(output);
    if (!databaseUrl) return;

    resolved = true;
    clearTimeout(timeout);
    console.log('Railway tunnel is open. Running archive retention DB smoke test...');

    testProcess = spawn('node', ['scripts/test-archive-retention-db.mjs'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: ['ignore', 'inherit', 'inherit'],
    });

    testProcess.on('exit', (code, signal) => {
      stopTunnel(tunnel);
      if (signal) {
        process.exitCode = 1;
        return;
      }
      process.exitCode = code ?? 1;
    });
  };

  tunnel.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(redactDatabaseUrls(text));
    maybeStartTest();
  });

  tunnel.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stderr.write(redactDatabaseUrls(text));
    maybeStartTest();
  });

  tunnel.on('error', (error) => {
    clearTimeout(timeout);
    if (resolved) return;
    resolved = true;
    fail(`Could not start Railway tunnel: ${error.message}`);
  });

  tunnel.on('exit', (code) => {
    clearTimeout(timeout);
    if (resolved) return;
    resolved = true;
    fail([
      `Railway tunnel exited before it printed a database URL. Exit code: ${code ?? 'unknown'}.`,
      '',
      'Try:',
      '  railway login',
      '  railway link',
      `  npm run test:archive-retention-railway -- "${serviceName}"`,
    ].join('\n'), redactDatabaseUrls(output));
  });
}

main().catch((error) => {
  fail('Archive retention Railway automation failed.', error?.stack || error?.message || String(error));
});
