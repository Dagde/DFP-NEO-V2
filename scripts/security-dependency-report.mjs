import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const format = String(process.argv[2] || '--markdown').trim().toLowerCase();
const rootDir = resolve(new URL('..', import.meta.url).pathname);
const packageJsonPath = resolve(rootDir, 'package.json');
const packageLockPath = resolve(rootDir, 'package-lock.json');

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function hashFile(path) {
  if (!existsSync(path)) return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function severityRank(severity) {
  return { critical: 4, high: 3, moderate: 2, low: 1, info: 0 }[severity] ?? -1;
}

function summariseAuditFindings(audit) {
  const vulnerabilities = audit?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== 'object') return [];

  return Object.entries(vulnerabilities)
    .map(([name, item]) => ({
      package: name,
      severity: item?.severity || 'unknown',
      direct: Boolean(item?.isDirect),
      via: Array.isArray(item?.via)
        ? item.via
            .map((viaItem) =>
              typeof viaItem === 'string'
                ? viaItem
                : viaItem?.title || viaItem?.source || viaItem?.name || 'advisory'
            )
            .slice(0, 5)
        : [],
      fixAvailable:
        item?.fixAvailable === true
          ? 'yes'
          : item?.fixAvailable
            ? 'conditional'
            : 'no',
    }))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 20);
}

function runNpmAudit(label, args) {
  const startedAt = Date.now();
  const result = spawnSync('npm', ['audit', '--json', ...args], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: false,
  });

  const raw = result.stdout || result.stderr || '';
  let parsed = null;
  let parseError = '';

  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const vulnerabilities = parsed?.metadata?.vulnerabilities || {};
  const total =
    Number(vulnerabilities.info || 0) +
    Number(vulnerabilities.low || 0) +
    Number(vulnerabilities.moderate || 0) +
    Number(vulnerabilities.high || 0) +
    Number(vulnerabilities.critical || 0);

  return {
    label,
    command: `npm audit --json ${args.join(' ')}`.trim(),
    status: result.status,
    durationMs: Date.now() - startedAt,
    advisoriesAvailable: Boolean(parsed),
    parseError,
    vulnerabilities: {
      info: Number(vulnerabilities.info || 0),
      low: Number(vulnerabilities.low || 0),
      moderate: Number(vulnerabilities.moderate || 0),
      high: Number(vulnerabilities.high || 0),
      critical: Number(vulnerabilities.critical || 0),
      total,
    },
    dependencyTotals: parsed?.metadata?.dependencies || {},
    topFindings: summariseAuditFindings(parsed),
  };
}

function buildReport() {
  const pkg = readJsonFile(packageJsonPath);
  const packageLockPresent = existsSync(packageLockPath);

  return {
    generatedAt: new Date().toISOString(),
    phase: 'Phase 4 - Dependency and Secure Build Hardening',
    package: {
      name: pkg.name,
      version: pkg.version,
      private: Boolean(pkg.private),
      lockfile: packageLockPresent
        ? {
            file: basename(packageLockPath),
            sha256: hashFile(packageLockPath),
          }
        : null,
      dependencyCounts: {
        production: Object.keys(pkg.dependencies || {}).length,
        development: Object.keys(pkg.devDependencies || {}).length,
      },
    },
    scans: [
      runNpmAudit('Production dependencies', ['--omit=dev']),
      runNpmAudit('All dependencies', []),
    ],
    notes: [
      'This report records package-manager vulnerability evidence only.',
      'A finding still requires DFP NEO context review before it is treated as exploitable or accepted.',
      'Do not attach package-lock contents, secrets, environment variables, or production data to external evidence packs.',
    ],
  };
}

function statusForScan(scan) {
  if (!scan.advisoriesAvailable) return 'ERROR';
  if (scan.vulnerabilities.critical > 0) return 'FAIL';
  if (scan.vulnerabilities.high > 0 || scan.vulnerabilities.moderate > 0) return 'WARN';
  return 'PASS';
}

function formatMarkdown(report) {
  const lines = [
    '# DFP NEO Dependency Security Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Phase: ${report.phase}`,
    '',
    '## Package Baseline',
    '',
    `- Package: ${report.package.name}`,
    `- Version: ${report.package.version}`,
    `- Private package: ${report.package.private ? 'yes' : 'no'}`,
    `- Production dependencies: ${report.package.dependencyCounts.production}`,
    `- Development dependencies: ${report.package.dependencyCounts.development}`,
    `- Lockfile: ${report.package.lockfile ? `${report.package.lockfile.file} (${report.package.lockfile.sha256})` : 'missing'}`,
    '',
    '## Scan Summary',
    '',
    '| Scope | Status | Critical | High | Moderate | Low | Info | Total | Duration |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const scan of report.scans) {
    lines.push(
      `| ${scan.label} | ${statusForScan(scan)} | ${scan.vulnerabilities.critical} | ${scan.vulnerabilities.high} | ${scan.vulnerabilities.moderate} | ${scan.vulnerabilities.low} | ${scan.vulnerabilities.info} | ${scan.vulnerabilities.total} | ${scan.durationMs} ms |`
    );
  }

  for (const scan of report.scans) {
    lines.push('', `## ${scan.label}`, '', `Command: \`${scan.command}\``, '');

    if (!scan.advisoriesAvailable) {
      lines.push(`Audit output could not be parsed: ${scan.parseError || 'no audit output returned'}`);
      continue;
    }

    if (scan.topFindings.length === 0) {
      lines.push('No package vulnerabilities were reported by npm audit for this scope.');
      continue;
    }

    lines.push('| Package | Severity | Direct | Fix available | Via |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const finding of scan.topFindings) {
      lines.push(
        `| ${finding.package} | ${finding.severity} | ${finding.direct ? 'yes' : 'no'} | ${finding.fixAvailable} | ${finding.via.join('; ') || 'n/a'} |`
      );
    }
  }

  lines.push('', '## Evidence Notes', '');
  for (const note of report.notes) lines.push(`- ${note}`);

  return lines.join('\n');
}

const report = buildReport();

if (format === '--json') {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(formatMarkdown(report));
}

if (process.env.CI === 'true') {
  const criticalFindings = report.scans.some((scan) => scan.vulnerabilities.critical > 0);
  if (criticalFindings) process.exitCode = 1;
}
