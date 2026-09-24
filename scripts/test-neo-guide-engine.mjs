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
const terminology = new Set((model.terminologyIndex || []).map(entry => entry.normalised || String(entry.term || '').toLowerCase()));

assert.ok((model.terminologyIndex || []).length > 1000, 'Generated terminology index should contain substantial app vocabulary.');
assert.ok(terminology.has('auth') || terminology.has('flight auth'), 'Terminology should include auth wording from the implementation.');
assert.ok(terminology.has('unavailability'), 'Terminology should include unavailability from schema/UI.');
assert.ok(terminology.has('course commander'), 'Terminology should include course commander wording.');
assert.ok(terminology.has('flight authorisation') || terminology.has('flight authorization'), 'Terminology should include flight authorisation wording.');

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

const buildAnswer = ask('how do I build the schedule automatically');
assert.match(buildAnswer.answer, /Click NEO Build/i, 'NEO Build answer should include the NEO Build action step.');
assert.match(buildAnswer.answer, /Validation Check/i, 'NEO Build answer should mention validating before publishing.');

const archiveCourseAnswer = ask('where do I archive a course');
assert.match(archiveCourseAnswer.answer, /Open Training Records/i, 'Archive course answer should include Training Records steps.');
assert.match(archiveCourseAnswer.answer, /Archived Courses/i, 'Archive course answer should mention Archived Courses.');

const turnaroundAnswer = ask('where change ac turnround');
assert.match(turnaroundAnswer.answer, /Open Settings/i, 'Turnaround answer should include Settings steps.');
assert.match(turnaroundAnswer.answer, /turnaround/i, 'Turnaround answer should mention the turnaround setting.');

const messagesAnswer = ask('where do I open messages');
assert.equal(messagesAnswer.matches[0]?.functionId, 'function.curated.messaging.my-home-messages');
assert.match(messagesAnswer.answer, /Open My Home/i, 'Messages answer should send the user to My Home.');
assert.match(messagesAnswer.answer, /Open Messages/i, 'Messages answer should include opening Messages.');

const aircraftAvailabilityAnswer = ask('where do I change aircraft availability');
assert.equal(aircraftAvailabilityAnswer.matches[0]?.functionId, 'function.curated.scheduling.aircraft-availability');
assert.match(aircraftAvailabilityAnswer.answer, /Aircraft Available/i, 'Aircraft availability answer should mention the toolbar action.');

const publishAnswer = ask('how do I publish the schedule');
assert.equal(publishAnswer.matches[0]?.functionId, 'function.curated.scheduling.publish-dfp');
assert.match(publishAnswer.answer, /Validation Check/i, 'Publish answer should mention validation before publishing.');

const riskEventsAnswer = ask('why are there no low risk events');
assert.equal(riskEventsAnswer.matches[0]?.functionId, 'function.curated.analytics.build-intelligence-risk-events');
assert.match(riskEventsAnswer.answer, /high-grade|low-variance|minimum-attempt/i, 'Low risk answer should explain the criteria.');

const autoNotificationAnswer = ask('who gets an auto message after a failed event');
assert.equal(autoNotificationAnswer.matches[0]?.functionId, 'function.curated.messaging.auto-notifications');
assert.match(autoNotificationAnswer.answer, /Course Commander|Deputy Course Commander|DFP-NEO Alerts/i, 'Auto notification answer should explain recipient/source logic.');

const authoriseFlightAnswer = ask('how can I authorise a flight');
assert.equal(authoriseFlightAnswer.matches[0]?.functionId, 'function.curated.duty-pilot.flight-authorisation');
assert.match(authoriseFlightAnswer.answer, /Open Duty Pilot/i, 'Flight authorisation answer should start from Duty Pilot.');
assert.match(authoriseFlightAnswer.answer, /AUTHO/i, 'Flight authorisation answer should mention AUTHO.');
assert.match(authoriseFlightAnswer.answer, /PIC|captain/i, 'Flight authorisation answer should mention PIC/captain.');

const authFlightAnswer = ask('how do I auth a flight');
assert.equal(authFlightAnswer.matches[0]?.functionId, 'function.curated.duty-pilot.flight-authorisation');
assert.match(authFlightAnswer.answer, /PIN/i, 'Auth flight shorthand should resolve to flight authorisation steps.');

const primaryInstructorAnswer = ask('what is primary instructor');
assert.equal(primaryInstructorAnswer.matches[0]?.functionId, 'function.curated.people.instructor-assignment');
assert.match(primaryInstructorAnswer.answer, /Primary Instructor|Secondary Instructor|NEO Build/i, 'Primary instructor answer should explain instructor assignment and scheduling relevance.');

const authWarningAnswer = ask('where set authorisation warning minutes');
assert.equal(authWarningAnswer.matches[0]?.functionId, 'function.curated.settings.flight-authorisation-warnings');
assert.match(authWarningAnswer.answer, /amber warning|red urgent|Flight authorisation required/i, 'Authorisation warning answer should explain warning minute settings.');

const multiSelectAnswer = ask('can I select multiple tiles at one time');
assert.equal(multiSelectAnswer.matches[0]?.functionId, 'function.curated.scheduling.multi-select');
assert.match(multiSelectAnswer.answer, /Multi Select/i, 'Multi Select answer should explain the toolbar control.');
assert.match(multiSelectAnswer.answer, /Click schedule tiles|drag a selection box/i, 'Multi Select answer should explain how to select tiles.');
assert.doesNotMatch(multiSelectAnswer.answer, /App\.tsx|manual enrichment|component/i, 'Multi Select answer must not leak audit/source-code wording.');

const unknownAnswer = ask('where is the purple banana override');
assert.match(unknownAnswer.answer, /I don't know the answer to that yet/i, 'Unknown answers should be plain English.');
assert.doesNotMatch(unknownAnswer.answer, /App\.tsx|manual enrichment|component|source/i, 'Unknown answers must not leak implementation jargon.');

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
