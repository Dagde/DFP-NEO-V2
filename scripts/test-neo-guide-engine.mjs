import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answerNeoGuideQuestion, detectIntent } from '../utils/neoGuideEngine.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const modelPath = path.join(repoRoot, 'public', 'neo-guide', 'dfp-neo-knowledge-model.json');
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));

const ask = (question, context = {}) => answerNeoGuideQuestion(question, model, context);
const topId = (question, context = {}) => ask(question, context).matches[0]?.functionId;

assert.equal(detectIntent('How do I make a trainee unavailable?'), 'HOW_TO');
assert.equal(detectIntent('Why are my course scores blank?'), 'WHY');
assert.equal(detectIntent('Where do I change aircraft turnround?'), 'NAVIGATE');

assert.equal(
  topId('How do I make a trainee unavailable?'),
  'function.curated.people.trainee-unavailability',
  'Trainee unavailability question should resolve to trainee unavailability.'
);

assert.equal(
  topId('where change ac turnround'),
  'function.curated.settings.turnaround',
  'Compressed wording and turnround spelling should resolve to turnaround settings.'
);

assert.equal(
  topId('Why are course scores blank?'),
  'function.curated.training.course-progress',
  'Course score troubleshooting should resolve to Course Progress.'
);

assert.equal(
  topId('Where do I archive a course?'),
  'function.curated.training.archive-course',
  'Archive course question should resolve to archive course workflow.'
);

assert.equal(
  topId('how do i build the schedule automatically'),
  'function.curated.scheduling.neo-build',
  'Build schedule wording should resolve to NEO Build.'
);

const answer = ask('How do I stop Smith flying tomorrow?');
assert.equal(answer.intent, 'HOW_TO');
assert.equal(answer.navigationAction?.anchor, 'trainee-availability');
assert.ok(!/\bAI\b|ChatGPT|Artificial Intelligence/i.test(answer.answer), 'Guide answer must not describe itself with prohibited assistant terms.');

const contextAnswer = ask('Where is this?', { page: 'Course Progress' });
assert.ok(Array.isArray(contextAnswer.matches), 'Contextual answer should produce a match list.');

console.log('NEO Guide engine tests passed.');
