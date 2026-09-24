import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const modelPath = path.join(repoRoot, 'public', 'neo-guide', 'dfp-neo-knowledge-model.json');
const enrichmentPath = path.join(repoRoot, 'data', 'neo-guide', 'dfp-neo-guide-enrichment.json');
const reportJsonPath = path.join(repoRoot, 'data', 'neo-guide', 'intent-coverage-gap-report.json');
const reportMarkdownPath = path.join(repoRoot, 'docs', 'neo-guide', 'intent-coverage-gap-report.md');

const ACTION_TERMS = new Set([
  'add', 'archive', 'assign', 'authorise', 'authorize', 'build', 'cancel', 'change', 'check',
  'complete', 'configure', 'create', 'delete', 'download', 'edit', 'export', 'import', 'lock',
  'open', 'pause', 'publish', 'remove', 'restore', 'save', 'select', 'send', 'set', 'sign',
  'submit', 'sync', 'upload', 'validate', 'view',
]);

const DOMAIN_TERMS = new Set([
  'aircraft', 'authorisation', 'authorization', 'course', 'currency', 'dfp', 'duty',
  'event', 'flight', 'instructor', 'lmp', 'message', 'neo', 'package', 'permission',
  'pilot', 'priority', 'report', 'schedule', 'settings', 'staff', 'syllabus', 'trainee',
  'training', 'unavailability', 'validation',
]);

const INTERNAL_PATTERNS = [
  /^\/api\//i,
  /\bserver\.js\b/i,
  /\bapp\.tsx\b/i,
  /\bcomponent\b/i,
  /\bmanual enrichment\b/i,
  /\bfunction\./i,
  /\$\{/,
  /\?\s*['"`]/,
  /=>/,
  /\bconsole\b/i,
  /\bclassName\b/,
  /\bundefined\b/i,
];

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'for', 'from',
  'has', 'have', 'in', 'is', 'it', 'later', 'of', 'on', 'or', 'the', 'this',
  'to', 'with', 'your',
]);

const normalise = (value) => String(value || '')
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokensOf = (value) => normalise(value)
  .split(' ')
  .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isInternalOrNoisy(fn) {
  const name = String(fn.name || '').trim();
  const route = String(fn.location?.route || '').trim();
  const component = String(fn.location?.component || '').trim();
  if (!name || name.length < 3 || name.length > 120) return true;
  if (INTERNAL_PATTERNS.some((pattern) => pattern.test(name) || pattern.test(route) || pattern.test(component))) return true;
  if (!component.startsWith('components/') && !String(fn.id || '').startsWith('control.')) return true;
  if (/^[A-Z_]+$/.test(name) && name.length < 10) return true;
  if (/^[0-9:./ -]+$/.test(name)) return true;
  return false;
}

function isCandidateUserFacing(fn) {
  if (String(fn.id || '').startsWith('function.curated.')) return false;
  if (isInternalOrNoisy(fn)) return false;
  const text = normalise([
    fn.name,
    ...(fn.aliases || []),
    fn.purpose,
    fn.location?.component,
  ].filter(Boolean).join(' '));
  const tokens = new Set(tokensOf(text));
  const hasAction = [...tokens].some((token) => ACTION_TERMS.has(token));
  const hasDomain = [...tokens].some((token) => DOMAIN_TERMS.has(token));
  const component = String(fn.location?.component || '');
  const inImportantSurface = /(Flyout|Modal|View|Panel|Settings|Table|Confirmation|Roster|Schedule|Report|Profile)/.test(component);
  return (hasAction && hasDomain) || (inImportantSurface && hasDomain);
}

function curatedCoverage(enrichment) {
  const curated = [];
  for (const fn of enrichment.functions || []) {
    const text = [
      fn.name,
      ...(fn.aliases || []),
      fn.purpose,
      ...(fn.procedureSteps || []),
      ...(fn.outputs || []),
      ...(fn.businessRules || []),
      ...(fn.failureConditions || []),
      fn.location?.component,
      fn.location?.anchor,
    ].filter(Boolean).join(' ');
    curated.push({
      id: fn.id,
      name: fn.name,
      text: normalise(text),
      tokens: new Set(tokensOf(text)),
    });
  }
  return curated;
}

function bestCoverage(candidate, curated) {
  const candidateText = normalise([candidate.name, ...(candidate.aliases || [])].join(' '));
  const candidateTokens = new Set(tokensOf(candidateText));
  let best = null;
  for (const item of curated) {
    let score = 0;
    if (candidateText.length >= 4 && item.text.includes(candidateText)) score += 1;
    const overlap = [...candidateTokens].filter((token) => item.tokens.has(token)).length;
    const ratio = candidateTokens.size > 0 ? overlap / candidateTokens.size : 0;
    score += ratio;
    if (!best || score > best.score) {
      best = { id: item.id, name: item.name, score, overlap, ratio };
    }
  }
  return best;
}

function riskScore(candidate, coverage) {
  const name = normalise(candidate.name);
  const tokens = new Set(tokensOf(name));
  let score = 0;
  if ([...tokens].some((token) => ACTION_TERMS.has(token))) score += 2;
  if ([...tokens].some((token) => DOMAIN_TERMS.has(token))) score += 2;
  if (/(Flyout|Modal|Confirmation)/.test(String(candidate.location?.component || ''))) score += 2;
  if (/(archive|delete|remove|restore|authori|publish|cancel|pause|upload|import|export|password|permission)/i.test(candidate.name)) score += 3;
  if ((coverage?.score || 0) < 0.55) score += 2;
  return score;
}

function main() {
  const model = readJson(modelPath);
  const enrichment = readJson(enrichmentPath);
  const curated = curatedCoverage(enrichment);
  const functions = [
    ...(model.curatedKnowledge?.functions || []),
    ...(model.functions || []),
  ];

  const gaps = functions
    .filter(isCandidateUserFacing)
    .map((fn) => {
      const coverage = bestCoverage(fn, curated);
      return {
        id: fn.id,
        name: fn.name,
        component: fn.location?.component || null,
        page: fn.location?.page || null,
        route: fn.location?.route || null,
        bestCuratedMatch: coverage,
        riskScore: riskScore(fn, coverage),
      };
    })
    .filter((gap) => gap.riskScore >= 5 && (gap.bestCuratedMatch?.score || 0) < 0.85)
    .sort((left, right) => right.riskScore - left.riskScore || String(left.component).localeCompare(String(right.component)))
    .slice(0, 200);

  const grouped = gaps.reduce((acc, gap) => {
    const key = gap.component || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(gap);
    return acc;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    curatedFunctionCount: curated.length,
    candidateGapCount: gaps.length,
    gaps,
  };
  fs.mkdirSync(path.dirname(reportJsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(reportMarkdownPath), { recursive: true });
  fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    '# NEO Guide Intent Coverage Gap Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Curated functions: ${report.curatedFunctionCount}`,
    `Candidate gaps: ${report.candidateGapCount}`,
    '',
    'This report flags user-facing controls and generated functions that look insufficiently covered by the curated NEO Guide intent library. It is a triage aid, not proof that every listed item needs a new intent.',
    '',
  ];
  for (const [component, componentGaps] of Object.entries(grouped).slice(0, 50)) {
    lines.push(`## ${component}`, '');
    for (const gap of componentGaps.slice(0, 12)) {
      lines.push(`- ${gap.name}`);
      lines.push(`  - Risk score: ${gap.riskScore}`);
      lines.push(`  - Best curated match: ${gap.bestCuratedMatch?.name || 'none'} (${gap.bestCuratedMatch?.score?.toFixed(2) || '0.00'})`);
    }
    lines.push('');
  }
  fs.writeFileSync(reportMarkdownPath, `${lines.join('\n').trimEnd()}\n`);

  console.log(`# NEO Guide Intent Coverage Gap Report`);
  console.log(`Curated functions: ${report.curatedFunctionCount}`);
  console.log(`Candidate gaps: ${report.candidateGapCount}`);
  console.log(`Wrote ${path.relative(repoRoot, reportJsonPath)}`);
  console.log(`Wrote ${path.relative(repoRoot, reportMarkdownPath)}`);
}

main();
