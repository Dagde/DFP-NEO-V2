import fs from 'node:fs';
import path from 'node:path';
import { answerNeoGuideQuestion } from '../utils/neoGuideEngine.ts';

const repoRoot = process.cwd();
const runtimeModelPath = path.join(repoRoot, 'public', 'neo-guide', 'dfp-neo-knowledge-model.json');
const fullModelPath = path.join(repoRoot, 'docs', 'neo-guide', 'dfp-neo-knowledge-model.full.json');
const reportJsonPath = path.join(repoRoot, 'data', 'neo-guide', 'askability-audit-report.json');
const reportMarkdownPath = path.join(repoRoot, 'docs', 'neo-guide', 'askability-audit-report.md');

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for', 'from',
  'how', 'i', 'in', 'is', 'it', 'of', 'on', 'or', 'set', 'the', 'to', 'use', 'what',
  'where', 'why', 'with',
]);

const IMPORTANT_TERMS = /(account|aircraft|archive|area|authori|availability|callsign|cancel|commander|course|crew|currency|delete|dispatch|duty|event|export|flight|formation|grade|instructor|lmp|message|permission|pilot|post[- ]?flight|priority|publish|qualification|rank|record|report|restore|schedule|score|service|settings|staff|syllabus|trainee|training|turnaround|unavailability|validation)/i;

const ACTION_PREFIX = /^(add|archive|cancel|clear|configure|delete|download|export|generate|import|open|pause|publish|remove|restore|save|send|sign|submit|sync|upload|validate)\b/i;
const INTERNAL_LABEL_PATTERN = /[{}$`?=><]|\bformat[A-Z]|\brender[A-Z]|\b[a-zA-Z]+\.[a-zA-Z]|\b[A-Za-z]+Id\b|\b[A-Za-z]+Label\b/;
const GENERIC_LABEL_PATTERN = /^(0(?:\.\d+)?|a\/c|add|all|apply|back|both|button|custom|edit|from|high|input|label|low|medium|name|none|option|other|pending|proceed|qty|refresh|save|select|submit|type|use)$/i;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalise(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensOf(value) {
  return normalise(value)
    .split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function isCleanUserLabel(label) {
  const value = String(label || '').trim();
  if (value.length < 3 || value.length > 90) return false;
  if (INTERNAL_LABEL_PATTERN.test(value)) return false;
  if (GENERIC_LABEL_PATTERN.test(value)) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9 /&().,'’:+-]+$/.test(value)) return false;
  return true;
}

function questionForCandidate(candidate) {
  if (ACTION_PREFIX.test(candidate.label)) return `how do i use ${candidate.label}`;
  if (/Settings|Configuration|Setup|Catalogue|Table|View|Panel|Flyout|Modal/.test(candidate.file)) return `where do i set ${candidate.label}`;
  return `what is ${candidate.label}`;
}

function buildCandidates(fullModel) {
  const byKey = new Map();
  for (const control of fullModel.applicationSurface?.controls || []) {
    const label = String(control.label || '').trim();
    if (!isCleanUserLabel(label)) continue;
    if (!IMPORTANT_TERMS.test(`${label} ${control.file}`)) continue;
    const key = `${normalise(label)}|${control.file}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        label,
        source: 'control',
        file: control.file,
        line: control.line,
        tagName: control.tagName,
      });
    }
  }

  for (const target of fullModel.applicationSurface?.guideTargets || []) {
    const label = String(target.id || '').replace(/-/g, ' ');
    if (!isCleanUserLabel(label)) continue;
    const key = `${normalise(label)}|${target.file}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        label,
        source: 'guide-target',
        file: target.file,
        line: target.line,
        tagName: target.tagName,
      });
    }
  }

  return Array.from(byKey.values())
    .sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line)
    .slice(0, 1200);
}

function answerLooksUnsafe(answer) {
  return /App\.tsx|component|manual enrichment|function\.|server\.js|\/api\//i.test(answer || '');
}

function scoreCandidate(candidate, guideAnswer) {
  const top = guideAnswer.matches?.[0];
  const subjectTokens = tokensOf(candidate.label);
  const topText = normalise([
    top?.name,
    ...(top?.function?.aliases || []),
    top?.function?.purpose,
    top?.function?.location?.page,
  ].filter(Boolean).join(' '));
  const overlap = subjectTokens.length > 0
    ? subjectTokens.filter((token) => topText.includes(token)).length / subjectTokens.length
    : 0;
  const weak = guideAnswer.confidence === 'low'
    || answerLooksUnsafe(guideAnswer.answer)
    || /I don.?t know the answer to that yet/i.test(guideAnswer.answer)
    || (overlap < 0.5 && !guideAnswer.needsClarification);

  let risk = 0;
  if (/archive|delete|remove|authori|publish|permission|password|pin|cancel|restore/i.test(candidate.label)) risk += 4;
  if (/Settings|Configuration|Setup|Flyout|Modal|Report|Profile|Roster|Progress|View/.test(candidate.file)) risk += 2;
  if (guideAnswer.confidence === 'low') risk += 2;
  if (answerLooksUnsafe(guideAnswer.answer)) risk += 3;
  if (overlap < 0.5) risk += 2;
  if (guideAnswer.needsClarification) risk -= 1;

  return {
    weak,
    risk,
    overlap: Number(overlap.toFixed(2)),
    top,
  };
}

function main() {
  const runtimeModel = readJson(runtimeModelPath);
  const fullModel = readJson(fullModelPath);
  const candidates = buildCandidates(fullModel);
  const results = [];

  for (const candidate of candidates) {
    const question = questionForCandidate(candidate);
    const answer = answerNeoGuideQuestion(question, runtimeModel);
    const score = scoreCandidate(candidate, answer);
    if (!score.weak && score.risk < 5) continue;
    results.push({
      ...candidate,
      question,
      confidence: answer.confidence,
      needsClarification: Boolean(answer.needsClarification),
      topMatch: score.top ? {
        id: score.top.functionId,
        name: score.top.name,
        score: score.top.score,
        reasons: score.top.reasons,
      } : null,
      subjectOverlap: score.overlap,
      riskScore: score.risk,
      answerPreview: String(answer.answer || '').replace(/\s+/g, ' ').slice(0, 260),
    });
  }

  results.sort((left, right) => right.riskScore - left.riskScore || left.subjectOverlap - right.subjectOverlap || left.file.localeCompare(right.file));

  const report = {
    generatedAt: new Date().toISOString(),
    candidateCount: candidates.length,
    weakOrRiskyCount: results.length,
    results,
  };

  fs.mkdirSync(path.dirname(reportJsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(reportMarkdownPath), { recursive: true });
  fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    '# NEO Guide Askability Audit',
    '',
    `Generated: ${report.generatedAt}`,
    `Candidates tested: ${report.candidateCount}`,
    `Weak or risky answers: ${report.weakOrRiskyCount}`,
    '',
    'This audit asks generated plain-English questions from real controls and Guide targets, then flags answers that are weak, misleading, or too loosely matched. It is designed to catch misses such as a visible Settings term not being recognised by NEO Guide.',
    '',
  ];
  for (const item of results.slice(0, 120)) {
    lines.push(`- ${item.label} (${item.file}:${item.line})`);
    lines.push(`  - Question: ${item.question}`);
    lines.push(`  - Top match: ${item.topMatch?.name || 'none'} (${item.confidence}, overlap ${item.subjectOverlap})`);
    lines.push(`  - Preview: ${item.answerPreview}`);
  }
  fs.writeFileSync(reportMarkdownPath, `${lines.join('\n').trimEnd()}\n`);

  console.log('# NEO Guide Askability Audit');
  console.log(`Candidates tested: ${report.candidateCount}`);
  console.log(`Weak or risky answers: ${report.weakOrRiskyCount}`);
  console.log(`Wrote ${path.relative(repoRoot, reportJsonPath)}`);
  console.log(`Wrote ${path.relative(repoRoot, reportMarkdownPath)}`);
  if (results.length > 0) {
    console.log('Top findings:');
    for (const item of results.slice(0, 12)) {
      console.log(`- ${item.label} -> ${item.topMatch?.name || 'none'} (${item.confidence}, overlap ${item.subjectOverlap})`);
    }
  }
}

main();
