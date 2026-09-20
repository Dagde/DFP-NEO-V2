import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const rootDir = resolve(new URL('..', import.meta.url).pathname);
const format = String(process.argv[2] || '--markdown').trim().toLowerCase();

const EXCLUDED_DIRS = new Set([
  '.git',
  '.next',
  '.browser_data',
  'node_modules',
  'DFP-NEO-V2',
  'DFP-NEO-Hybrid-V3',
  'DFP-NEO-Website',
  'DFP-NEO-iOS',
  'dfp-neo-platform/public/flight-school-app',
  'snapshots',
  'tmp',
]);

const INCLUDED_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx']);
const RAW_CALL_PATTERN = /\.(\$queryRawUnsafe|\$executeRawUnsafe|\$queryRaw|\$executeRaw)\s*\(/g;

function isExcludedPath(path) {
  const rel = relative(rootDir, path).split(sep).join('/');
  const segments = rel.split('/');
  if (segments.some((segment) => EXCLUDED_DIRS.has(segment))) return true;
  return Array.from(EXCLUDED_DIRS).some((excluded) => rel === excluded || rel.startsWith(`${excluded}/`));
}

function extensionFor(path) {
  const match = path.match(/\.[^.]+$/);
  return match?.[0] || '';
}

function listSourceFiles(dir, files = []) {
  if (!existsSync(dir) || isExcludedPath(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry);
    if (isExcludedPath(fullPath)) continue;
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      listSourceFiles(fullPath, files);
    } else if (stat.isFile() && INCLUDED_EXTENSIONS.has(extensionFor(fullPath))) {
      files.push(fullPath);
    }
  }
  return files;
}

function lineNumberFor(content, index) {
  return content.slice(0, index).split('\n').length;
}

function extractCall(content, openParenIndex) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = openParenIndex; index < content.length; index += 1) {
    const char = content[index];
    const previous = content[index - 1];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote && !(quote === '`' && previous === '$')) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) return content.slice(openParenIndex, index + 1);
    }
  }
  return content.slice(openParenIndex, openParenIndex + 500);
}

function firstArgument(callText) {
  const inner = callText.replace(/^\(/, '').replace(/\)$/, '');
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    const previous = inner[index - 1];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote && !(quote === '`' && previous === '$')) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') quote = char;
    else if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth -= 1;
    else if (char === ',' && depth === 0) return inner.slice(0, index).trim();
  }
  return inner.trim();
}

function hasTopLevelComma(callText) {
  return firstArgument(callText).length < callText.replace(/^\(/, '').replace(/\)$/, '').trim().length;
}

function classifyFinding(method, callText) {
  const firstArg = firstArgument(callText);
  const unsafe = method.endsWith('Unsafe');
  const taggedTemplate = !unsafe;
  const staticSql = /^`[^$]*`$/.test(firstArg) || /^'[^']*'$/.test(firstArg) || /^"[^"]*"$/.test(firstArg);
  const interpolatedTemplate = /^`[\s\S]*\$\{/.test(firstArg);
  const parameterisedUnsafe = unsafe && hasTopLevelComma(callText);
  const dynamicIdentifier = unsafe && /^[A-Za-z_$][\w$]*$/.test(firstArg);
  const concatenated = unsafe && /\+/.test(firstArg);

  let risk = 'review';
  let reason = 'Raw SQL should be reviewed for parameterisation and caller controls.';
  if (taggedTemplate) {
    risk = 'low';
    reason = 'Uses Prisma tagged template raw API.';
  } else if (parameterisedUnsafe) {
    risk = 'medium';
    reason = 'Uses unsafe raw API with positional parameters; confirm SQL text is not user-controlled.';
  } else if (staticSql) {
    risk = 'medium';
    reason = 'Uses unsafe raw API with static SQL; prefer tagged template or Prisma client API where practical.';
  } else if (dynamicIdentifier || concatenated || interpolatedTemplate) {
    risk = 'high';
    reason = 'Uses unsafe raw API with dynamic SQL text; requires focused injection review.';
  }

  return {
    method,
    risk,
    reason,
    firstArgument: firstArg.replace(/\s+/g, ' ').slice(0, 180),
  };
}

function buildReport() {
  const files = listSourceFiles(rootDir);
  const findings = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    RAW_CALL_PATTERN.lastIndex = 0;
    let match;
    while ((match = RAW_CALL_PATTERN.exec(content))) {
      const method = match[1];
      const openParenIndex = content.indexOf('(', match.index);
      const callText = extractCall(content, openParenIndex);
      const classification = classifyFinding(method, callText);
      findings.push({
        file: relative(rootDir, file).split(sep).join('/'),
        line: lineNumberFor(content, match.index),
        ...classification,
      });
    }
  }

  const summary = findings.reduce((acc, finding) => {
    acc.total += 1;
    acc.byRisk[finding.risk] = (acc.byRisk[finding.risk] || 0) + 1;
    acc.byMethod[finding.method] = (acc.byMethod[finding.method] || 0) + 1;
    return acc;
  }, { total: 0, byRisk: {}, byMethod: {} });

  return {
    generatedAt: new Date().toISOString(),
    phase: 'Phase 4 - Raw SQL Review',
    scope: 'Live source files only; excludes generated output, node_modules, .next and archived repo copies.',
    summary,
    findings: findings.sort((a, b) => {
      const riskOrder = { high: 0, review: 1, medium: 2, low: 3 };
      return (riskOrder[a.risk] ?? 9) - (riskOrder[b.risk] ?? 9) || a.file.localeCompare(b.file) || a.line - b.line;
    }),
    notes: [
      'This is an inventory and triage report, not proof that every query is exploitable or safe.',
      'High-risk findings require manual review of the SQL text source, route permissions and user-controlled inputs.',
      'Prefer Prisma model APIs or tagged template raw APIs where practical.',
    ],
  };
}

function formatMarkdown(report) {
  const findingsByFile = report.findings.reduce((acc, finding) => {
    acc[finding.file] = (acc[finding.file] || 0) + 1;
    return acc;
  }, {});
  const highFindings = report.findings.filter((finding) => finding.risk === 'high');

  const lines = [
    '# DFP NEO Raw SQL Security Review',
    '',
    `Generated: ${report.generatedAt}`,
    `Phase: ${report.phase}`,
    `Scope: ${report.scope}`,
    '',
    '## Summary',
    '',
    `- Raw SQL calls found: ${report.summary.total}`,
    `- High risk: ${report.summary.byRisk.high || 0}`,
    `- Review: ${report.summary.byRisk.review || 0}`,
    `- Medium risk: ${report.summary.byRisk.medium || 0}`,
    `- Low risk: ${report.summary.byRisk.low || 0}`,
    '',
    '## Calls By Method',
    '',
    '| Method | Count |',
    '| --- | ---: |',
  ];

  for (const [method, count] of Object.entries(report.summary.byMethod).sort()) {
    lines.push(`| ${method} | ${count} |`);
  }

  lines.push('', '## Files With Raw SQL', '', '| File | Calls |');
  lines.push('| --- | ---: |');
  for (const [file, count] of Object.entries(findingsByFile).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 40)) {
    lines.push(`| ${file} | ${count} |`);
  }

  lines.push('', '## High-Risk Findings', '', '| File | Line | Method | Reason | First Argument |');
  lines.push('| --- | --- | ---: | --- | --- | --- |');
  if (highFindings.length === 0) {
    lines.push('| None |  |  |  |  |');
  } else {
    for (const finding of highFindings) {
      lines.push(`| ${finding.file} | ${finding.line} | ${finding.method} | ${finding.reason} | \`${finding.firstArgument.replace(/`/g, "'")}\` |`);
    }
  }

  lines.push('', 'Full finding detail is available with `npm run security:sql -- --json`.');

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

if (process.env.CI === 'true' && report.summary.byRisk.high > 0) {
  process.exitCode = 1;
}
