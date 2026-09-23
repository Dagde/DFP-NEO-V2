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
  'function.curated.training.course-score-table',
  'Course score troubleshooting should resolve to the Course Scores table.'
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

assert.equal(
  topId('where is course commander ticked'),
  'function.curated.training.course-leadership',
  'Course commander wording should resolve to course leadership assignments.'
);

assert.equal(
  topId('why are there no scores in course scores'),
  'function.curated.training.course-score-table',
  'Course score table troubleshooting should resolve to Course Scores table.'
);

assert.equal(
  topId('why is flight tracking not showing in duty pilot'),
  'function.curated.duty-pilot.flight-tracking',
  'Flight tracking troubleshooting should resolve to Duty Pilot flight tracking.'
);

assert.equal(
  topId('where do i configure master lmp access'),
  'function.curated.settings.master-lmp-access',
  'Master LMP access wording should resolve to Master LMP Access settings.'
);

const answer = ask('How do I stop Smith flying tomorrow?');
assert.equal(answer.intent, 'HOW_TO');
assert.equal(answer.navigationAction?.anchor, 'trainee-availability');
assert.ok(!/\bAI\b|ChatGPT|Artificial Intelligence/i.test(answer.answer), 'Guide answer must not describe itself with prohibited assistant terms.');

const courseCommanderAnswer = ask('where is course commander ticked');
assert.match(courseCommanderAnswer.answer, /Steps:/, 'Course commander answer should provide plain-English steps.');
assert.match(courseCommanderAnswer.answer, /Open Trainee/i, 'Course commander answer should tell the user to open Trainee.');
assert.match(courseCommanderAnswer.answer, /course card/i, 'Course commander answer should mention the course card.');
assert.match(courseCommanderAnswer.answer, /pencil|edit/i, 'Course commander answer should mention editing the course card.');
assert.match(courseCommanderAnswer.answer, /Course Leadership/i, 'Course commander answer should mention Course Leadership.');
assert.match(courseCommanderAnswer.answer, /Save/i, 'Course commander answer should mention saving changes.');

const newTopicAfterCourseCommander = ask('how do I insert a unavailability', { conversation: courseCommanderAnswer.conversation });
assert.notEqual(
  newTopicAfterCourseCommander.matches[0]?.functionId,
  'function.curated.training.course-leadership',
  'A short new question with a clear topic should not stay stuck on the previous course leadership topic.'
);
assert.ok(
  [
    'function.curated.people.trainee-unavailability',
    'function.curated.people.staff-unavailability',
  ].includes(newTopicAfterCourseCommander.matches[0]?.functionId),
  'Unavailability wording after another topic should resolve to an unavailability workflow.'
);
assert.match(newTopicAfterCourseCommander.answer, /Add Unavailability/i, 'Unavailability answer should include practical steps.');

const staffUnavailabilityFollowUp = ask('what about a staff', { conversation: newTopicAfterCourseCommander.conversation });
assert.equal(
  staffUnavailabilityFollowUp.matches[0]?.functionId,
  'function.curated.people.staff-unavailability',
  'Staff follow-up after an unavailability question should switch to staff unavailability.'
);
assert.match(staffUnavailabilityFollowUp.answer, /Open Staff/i, 'Staff unavailability answer should include Staff page steps.');
assert.match(staffUnavailabilityFollowUp.answer, /Add Unavailability/i, 'Staff unavailability answer should include Add Unavailability steps.');

const staffFollowUp = ask('what about staff?', { conversation: answer.conversation });
assert.equal(
  staffFollowUp.matches[0]?.functionId,
  'function.curated.people.staff-unavailability',
  'Short follow-up should retain the unavailability topic and switch to staff.'
);

const referentialFollowUp = ask('where is that?', { conversation: answer.conversation });
assert.equal(
  referentialFollowUp.matches[0]?.functionId,
  'function.curated.people.trainee-unavailability',
  'Referential follow-up should preserve the previous matched function.'
);

const contextAnswer = ask('Where is this?', { page: 'Course Progress' });
assert.ok(Array.isArray(contextAnswer.matches), 'Contextual answer should produce a match list.');

console.log('NEO Guide engine tests passed.');
