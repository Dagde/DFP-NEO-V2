import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  answerNeoGuideClarificationNone,
  answerNeoGuideClarificationSelection,
  answerNeoGuideQuestion,
  detectIntent,
} from '../utils/neoGuideEngine.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const modelPath = path.join(repoRoot, 'public', 'neo-guide', 'dfp-neo-knowledge-model.json');
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));

const ask = (question, context = {}) => answerNeoGuideQuestion(question, model, context);
const topId = (question, context = {}) => ask(question, context).matches[0]?.functionId;
const terminology = new Set((model.terminologyIndex || []).map(entry => entry.normalised || String(entry.term || '').toLowerCase()));
const countMatches = (value, pattern) => (value.match(pattern) || []).length;

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
assert.equal(newTopicAfterCourseCommander.needsClarification, true, 'Generic unavailability wording should clarify trainee or staff.');
const selectedUnavailability = answerNeoGuideClarificationSelection(
  'function.curated.people.trainee-unavailability',
  model,
  { conversation: newTopicAfterCourseCommander.conversation }
);
assert.match(selectedUnavailability.answer, /Add Unavailability/i, 'Selected unavailability answer should include practical steps.');

const staffUnavailabilityFollowUp = ask('what about a staff', { conversation: selectedUnavailability.conversation });
assert.equal(
  staffUnavailabilityFollowUp.matches[0]?.functionId,
  'function.curated.people.staff-unavailability',
  'Staff follow-up after an unavailability question should switch to staff unavailability.'
);
assert.match(staffUnavailabilityFollowUp.answer, /Open Staff/i, 'Staff unavailability answer should include Staff page steps.');
assert.match(staffUnavailabilityFollowUp.answer, /Add Unavailability/i, 'Staff unavailability answer should include Add Unavailability steps.');

const deleteStaffAnswer = ask('how do I delete a staff member');
assert.equal(
  deleteStaffAnswer.matches[0]?.functionId,
  'function.curated.people.delete-staff',
  'Delete staff wording should resolve to staff deletion, not staff unavailability.'
);
assert.match(deleteStaffAnswer.answer, /Delete/i, 'Delete staff answer should include the delete action.');
assert.match(deleteStaffAnswer.answer, /different from making them unavailable/i, 'Delete staff answer should distinguish deletion from unavailability.');
assert.doesNotMatch(deleteStaffAnswer.answer, /Add Unavailability/i, 'Delete staff answer must not give unavailability steps.');

const archiveTraineeAnswer = ask('how do I archive a trainee');
assert.equal(
  archiveTraineeAnswer.matches[0]?.functionId,
  'function.curated.people.archive-delete-trainee',
  'Archive trainee wording should resolve to Delete or Archive Trainee.'
);
assert.match(archiveTraineeAnswer.answer, /Archive Trainee \(Recommended\)/i, 'Archive trainee answer should mention the recommended archive option.');
assert.match(archiveTraineeAnswer.answer, /Open Trainee/i, 'Archive trainee answer should start from Trainee.');
assert.match(archiveTraineeAnswer.answer, /password/i, 'Archive trainee answer should mention password confirmation.');
assert.doesNotMatch(archiveTraineeAnswer.answer, /Staff|Course management/i, 'Archive trainee answer must not give staff or course workflow.');
assert.equal(
  countMatches(archiveTraineeAnswer.answer, /Archive Trainee is recommended/i),
  0,
  'Archive trainee answer should not repeat the archive/delete warning after the numbered steps.'
);
assert.equal(
  countMatches(archiveTraineeAnswer.answer, /Delete Permanently/i),
  1,
  'Archive trainee answer should not repeat the permanent-delete warning.'
);

const deleteTraineeAnswer = ask('how do I delete a trainee');
assert.equal(
  deleteTraineeAnswer.matches[0]?.functionId,
  'function.curated.people.archive-delete-trainee',
  'Delete trainee wording should resolve to Delete or Archive Trainee.'
);
assert.match(deleteTraineeAnswer.answer, /Delete Permanently/i, 'Delete trainee answer should mention the permanent delete option.');

const staffUnavailableAnswer = ask('how do I make a staff member unavailable');
assert.equal(
  staffUnavailableAnswer.matches[0]?.functionId,
  'function.curated.people.staff-unavailability',
  'Staff unavailable wording should still resolve to staff unavailability.'
);
assert.match(staffUnavailableAnswer.answer, /Add Unavailability/i, 'Staff unavailable answer should keep the unavailability workflow.');

const cancelFlightAnswer = ask('how do I cancel a flight');
assert.equal(
  cancelFlightAnswer.matches[0]?.functionId,
  'function.curated.scheduling.cancel-restore-delete-event',
  'Cancel flight wording should resolve to the scheduled-event cancellation workflow.'
);
assert.match(cancelFlightAnswer.answer, /Cancel Flight/i, 'Cancel flight answer should mention the Cancel Flight action.');
assert.match(cancelFlightAnswer.answer, /cancellation code|reason/i, 'Cancel flight answer should explain cancellation details.');

const restoreFlightAnswer = ask('how do I restore a cancelled flight');
assert.equal(
  restoreFlightAnswer.matches[0]?.functionId,
  'function.curated.scheduling.cancel-restore-delete-event',
  'Restore cancelled flight wording should resolve to the scheduled-event restore workflow.'
);
assert.match(restoreFlightAnswer.answer, /Restore to Schedule/i, 'Restore flight answer should mention Restore to Schedule.');

const pauseOpsAnswer = ask('how do I pause flight ops');
assert.equal(
  pauseOpsAnswer.matches[0]?.functionId,
  'function.curated.scheduling.pause-flight-ops',
  'Pause flight ops wording should resolve to the pause-flight-ops workflow.'
);
assert.match(pauseOpsAnswer.answer, /Pause Flight Ops/i, 'Pause flight ops answer should name the control.');
assert.match(pauseOpsAnswer.answer, /NEO BUILD|PUBLISH/i, 'Pause flight ops answer should mention post-pause build/publish actions.');

const archivedStaffAnswer = ask('where are archived staff');
assert.equal(
  archivedStaffAnswer.matches[0]?.functionId,
  'function.curated.people.archived-staff',
  'Archived staff wording should resolve to archived staff, not archived courses or trainee archive.'
);
assert.match(archivedStaffAnswer.answer, /Open Staff/i, 'Archived staff answer should start from Staff.');
assert.match(archivedStaffAnswer.answer, /Archived Staff|archived staff/i, 'Archived staff answer should mention the archived staff list.');

const moveTraineeCourseAnswer = ask('how do I move a trainee to another course');
assert.equal(
  moveTraineeCourseAnswer.matches[0]?.functionId,
  'function.curated.people.move-trainee-course',
  'Move trainee wording should resolve to the move-trainee-course workflow.'
);
assert.match(moveTraineeCourseAnswer.answer, /Move to different course|target course/i, 'Move trainee answer should mention the target course control.');

const deleteMessageAnswer = ask('how do I delete a message');
assert.equal(
  deleteMessageAnswer.matches[0]?.functionId,
  'function.curated.messaging.delete-message',
  'Delete message wording should resolve to messages, not staff/trainee deletion.'
);
assert.match(deleteMessageAnswer.answer, /Open My Home/i, 'Delete message answer should start from My Home.');
assert.match(deleteMessageAnswer.answer, /Delete/i, 'Delete message answer should mention the delete action.');

const configurationReportAnswer = ask('where do I export the configuration report');
assert.equal(
  configurationReportAnswer.matches[0]?.functionId,
  'function.curated.settings.configuration-report',
  'Configuration report wording should resolve to platform configuration report.'
);
assert.match(configurationReportAnswer.answer, /Open Settings/i, 'Configuration report answer should start from Settings.');
assert.match(configurationReportAnswer.answer, /Export Configuration Report/i, 'Configuration report answer should name the export control.');

const deleteCurrencyAnswer = ask('how do I delete a currency');
assert.equal(
  deleteCurrencyAnswer.matches[0]?.functionId,
  'function.curated.settings.currency-builder',
  'Delete currency wording should resolve to the currency builder workflow.'
);
assert.match(deleteCurrencyAnswer.answer, /Currency Builder|Delete Currency/i, 'Currency answer should mention Currency Builder or Delete Currency.');

const syllabusPackageAnswer = ask('how do I add a syllabus package');
assert.equal(
  syllabusPackageAnswer.matches[0]?.functionId,
  'function.curated.training.syllabus-management',
  'Add syllabus package wording should resolve to syllabus management.'
);
assert.match(syllabusPackageAnswer.answer, /Add Package/i, 'Syllabus package answer should mention Add Package.');

const remedialPackageAnswer = ask('how do I add a remedial package');
assert.equal(
  remedialPackageAnswer.matches[0]?.functionId,
  'function.curated.training.remedial-packages',
  'Add remedial package wording should resolve to remedial packages.'
);
assert.match(remedialPackageAnswer.answer, /Add Remedial Package|Add Events to Package/i, 'Remedial package answer should mention the package/event controls.');

const removeUnavailableAnswer = ask('how do I remove staff leave');
assert.equal(
  removeUnavailableAnswer.matches[0]?.functionId,
  'function.curated.people.remove-unavailability',
  'Remove leave wording should resolve to removing unavailability.'
);
assert.match(removeUnavailableAnswer.answer, /Remove unavailability|delete\/remove/i, 'Remove unavailability answer should mention the remove action.');

const unarchiveCourseAnswer = ask('how do I restore an archived course');
assert.equal(
  unarchiveCourseAnswer.matches[0]?.functionId,
  'function.curated.training.unarchive-course',
  'Restore archived course wording should resolve to unarchive course.'
);
assert.match(unarchiveCourseAnswer.answer, /Archived Courses/i, 'Unarchive course answer should mention Archived Courses.');
assert.match(unarchiveCourseAnswer.answer, /Unarchive Course|Restore/i, 'Unarchive course answer should mention restoring/unarchiving.');

const addFlightTileAnswer = ask('how do I manually add a flight');
assert.equal(
  addFlightTileAnswer.matches[0]?.functionId,
  'function.curated.scheduling.add-flight-tile',
  'Manually add flight wording should resolve to Add Flight Tile.'
);
assert.match(addFlightTileAnswer.answer, /Add Flight Tile/i, 'Add flight answer should mention Add Flight Tile.');

const addGroundEventAnswer = ask('how do I add a ground event');
assert.equal(
  addGroundEventAnswer.matches[0]?.functionId,
  'function.curated.scheduling.add-ground-event',
  'Add ground event wording should resolve to Add Ground Tile/Event.'
);
assert.match(addGroundEventAnswer.answer, /Add Ground Tile|ground event/i, 'Add ground event answer should mention the ground-event workflow.');

const priorityCurrencyAnswer = ask('how do I delete a crew currency request');
assert.equal(
  priorityCurrencyAnswer.matches[0]?.functionId,
  'function.curated.scheduling.priority-currency-requests',
  'Crew currency request wording should resolve to priorities/currency requests.'
);
assert.match(priorityCurrencyAnswer.answer, /Open Priorities/i, 'Priority currency answer should start from Priorities.');

const currencyAuditAnswer = ask('where do I view the currency audit log');
assert.equal(
  currencyAuditAnswer.matches[0]?.functionId,
  'function.curated.people.currency-audit-and-dates',
  'Currency audit wording should resolve to currency audit and dates.'
);
assert.match(currencyAuditAnswer.answer, /View currency audit log/i, 'Currency audit answer should mention the audit log control.');

const sctAnswer = ask('how do I add special continuation training');
assert.equal(
  sctAnswer.matches[0]?.functionId,
  'function.curated.scheduling.sct-request',
  'Special continuation training wording should resolve to SCT request.'
);
assert.match(sctAnswer.answer, /continuation|SCT/i, 'SCT answer should mention continuation/SCT.');

const completeTrainingAnswer = ask('how do I mark training complete');
assert.equal(
  completeTrainingAnswer.matches[0]?.functionId,
  'function.curated.training.complete-training',
  'Mark training complete wording should resolve to Complete Training.'
);
assert.match(completeTrainingAnswer.answer, /Complete Training/i, 'Complete training answer should mention Complete Training.');

const flightDetailFieldsAnswer = ask('what is aircraft count in flight details');
assert.equal(
  flightDetailFieldsAnswer.matches[0]?.functionId,
  'function.curated.scheduling.flight-detail-fields',
  'Flight detail field wording should resolve to flight detail fields.'
);
assert.match(flightDetailFieldsAnswer.answer, /flight details window|aircraft/i, 'Flight detail field answer should explain the flight details area.');

const courseSetupAnswer = ask('where do I set course lmp type');
assert.equal(
  courseSetupAnswer.matches[0]?.functionId,
  'function.curated.training.course-setup-fields',
  'Course LMP type wording should resolve to course setup fields.'
);
assert.match(courseSetupAnswer.answer, /Courses Management|LMP type/i, 'Course setup answer should mention Courses Management and LMP type.');

const trainingReportFieldsAnswer = ask('what does keep notes on this report only mean');
assert.equal(
  trainingReportFieldsAnswer.matches[0]?.functionId,
  'function.curated.training.training-report-fields',
  'Training report notes wording should resolve to training report fields.'
);
assert.match(trainingReportFieldsAnswer.answer, /report notes|training report/i, 'Training report fields answer should mention report notes/training report.');

const auditLogSettingsAnswer = ask('where are audit log recording settings');
assert.equal(
  auditLogSettingsAnswer.matches[0]?.functionId,
  'function.curated.settings.audit-log-recording',
  'Audit log recording wording should resolve to audit-log recording settings.'
);
assert.match(auditLogSettingsAnswer.answer, /Audit|Audit Log/i, 'Audit settings answer should mention Audit or Audit Log.');

const postFlightInputsAnswer = ask('where do I enter post-flight aircraft number');
assert.equal(
  postFlightInputsAnswer.matches[0]?.functionId,
  'function.curated.training.post-flight-inputs',
  'Post-flight aircraft number wording should resolve to post-flight inputs.'
);
assert.match(postFlightInputsAnswer.answer, /post-flight|aircraft/i, 'Post-flight answer should mention post-flight and aircraft details.');

const callsignAnswer = ask('where do I configure unit callsigns');
assert.equal(
  callsignAnswer.matches[0]?.functionId,
  'function.curated.settings.unit-callsigns',
  'Unit callsign wording should resolve to unit callsigns.'
);
assert.match(callsignAnswer.answer, /Open Settings|callsign/i, 'Callsign answer should mention Settings and callsigns.');
assert.equal(callsignAnswer.navigationAction?.settingsSectionId, 'platform-rank-terminology', 'Unit callsign links should open the rank/terminology settings section.');
assert.equal(callsignAnswer.navigationAction?.settingsFocusSubsectionId, 'platform-unit-callsigns', 'Unit callsign links should scroll to the unit callsign subsection.');

const formationCallsignAnswer = ask('where do I set formation callsigns');
assert.equal(
  formationCallsignAnswer.matches[0]?.functionId,
  'function.curated.settings.formation-callsigns',
  'Formation callsign wording should resolve to formation callsigns, not generic unit callsigns.'
);
assert.equal(formationCallsignAnswer.navigationAction?.settingsSectionId, 'platform-rank-terminology', 'Formation callsign links should open the rank/terminology settings section.');
assert.equal(formationCallsignAnswer.navigationAction?.settingsFocusSubsectionId, 'platform-formation-callsigns', 'Formation callsign links should scroll to the formation callsign subsection.');

const rankTerminologyAnswer = ask('where do i set rank');
assert.equal(
  rankTerminologyAnswer.matches[0]?.functionId,
  'function.curated.settings.rank-terminology',
  'Generic rank wording should resolve to Rank, Terminology & Labels settings.'
);
assert.match(rankTerminologyAnswer.answer, /Rank, Terminology & Labels/i, 'Rank answer should name the settings section.');
assert.equal(rankTerminologyAnswer.navigationAction?.settingsSectionId, 'platform-rank-terminology', 'Rank links should open the rank/terminology settings section.');
assert.equal(rankTerminologyAnswer.navigationAction?.settingsFocusSubsectionId, 'platform-staff-rank-equivalency', 'Generic rank links should focus the staff rank equivalency subsection first.');
assert.doesNotMatch(rankTerminologyAnswer.answer, /Program Schedule|Multi Select|Flight details/i, 'Rank answer must not drift into unrelated schedule options.');

const staffRankAnswer = ask('where do i set staff ranks');
assert.equal(
  staffRankAnswer.matches[0]?.functionId,
  'function.curated.settings.staff-rank-equivalency',
  'Staff rank wording should resolve to Staff Rank Equivalency Table.'
);
assert.equal(staffRankAnswer.navigationAction?.settingsSectionId, 'platform-rank-terminology', 'Staff rank links should open the rank/terminology settings section.');
assert.equal(staffRankAnswer.navigationAction?.settingsFocusSubsectionId, 'platform-staff-rank-equivalency', 'Staff rank links should scroll to staff rank equivalency.');

const traineeRankAnswer = ask('where do i set trainee rank');
assert.equal(
  traineeRankAnswer.matches[0]?.functionId,
  'function.curated.settings.trainee-rank-order',
  'Trainee rank wording should resolve to Trainee Rank Order.'
);
assert.equal(traineeRankAnswer.navigationAction?.settingsSectionId, 'platform-rank-terminology', 'Trainee rank links should open the rank/terminology settings section.');
assert.equal(traineeRankAnswer.navigationAction?.settingsFocusSubsectionId, 'platform-trainee-rank-equivalency', 'Trainee rank links should scroll to trainee rank order.');

const authorisationNotesAnswer = ask('where do I enter auth notes');
assert.equal(
  authorisationNotesAnswer.matches[0]?.functionId,
  'function.curated.duty-pilot.authorisation-notes',
  'Auth notes wording should resolve to authorisation notes.'
);
assert.match(authorisationNotesAnswer.answer, /notes|authorisation|authorization/i, 'Authorisation notes answer should mention notes and authorisation.');

const buildAnswer = ask('how do I build the schedule automatically');
assert.match(buildAnswer.answer, /Click NEO Build/i, 'NEO Build answer should include the NEO Build action step.');
assert.match(buildAnswer.answer, /Validation Check/i, 'NEO Build answer should mention validating before publishing.');

const archiveCourseAnswer = ask('where do I archive a course');
assert.match(archiveCourseAnswer.answer, /Open Training Records/i, 'Archive course answer should include Training Records steps.');
assert.match(archiveCourseAnswer.answer, /Archived Courses/i, 'Archive course answer should mention Archived Courses.');

const archivedCoursesAnswer = ask('where are archived courses');
assert.ok(
  [
    'function.curated.training.archive-course',
    'function.curated.training.unarchive-course',
    'function.curated.training.course-management',
  ].includes(archivedCoursesAnswer.matches[0]?.functionId),
  'Archived Courses wording should resolve to course management/archive workflows, not Trainee Roster.'
);
assert.doesNotMatch(archivedCoursesAnswer.answer, /Open Trainee|Trainee Roster/i, 'Archived Courses answer must not send the user to Trainee Roster.');

const searchArchivedStaffAnswer = ask('where do I search archived staff');
assert.equal(
  searchArchivedStaffAnswer.matches[0]?.functionId,
  'function.curated.people.archived-staff',
  'Archived staff wording should resolve to archived staff.'
);
assert.match(searchArchivedStaffAnswer.answer, /Open Staff/i, 'Archived staff answer should start from Staff.');

const personnelQualificationsAnswer = ask('where do I set personnel qualifications');
assert.equal(
  personnelQualificationsAnswer.matches[0]?.functionId,
  'function.curated.settings.personnel-qualifications',
  'Personnel Qualifications wording should resolve to Personnel Qualifications settings.'
);
assert.equal(personnelQualificationsAnswer.navigationAction?.settingsSectionId, 'platform-rank-terminology', 'Personnel Qualifications should open the rank/terminology settings section.');
assert.equal(personnelQualificationsAnswer.navigationAction?.settingsFocusSubsectionId, 'platform-staff-qualifications', 'Personnel Qualifications should scroll to the personnel qualifications subsection.');

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
assert.match(riskEventsAnswer.answer, /strong grades|low variance|enough attempts|high-grade|low-variance|minimum-attempt/i, 'Low risk answer should explain the criteria.');

const autoNotificationAnswer = ask('who gets an auto message after a failed event');
assert.equal(autoNotificationAnswer.matches[0]?.functionId, 'function.curated.messaging.auto-notifications');
assert.match(autoNotificationAnswer.answer, /Course Commander|Deputy Course Commander|DFP-NEO Alerts/i, 'Auto notification answer should explain recipient/source logic.');

const authoriseFlightAnswer = ask('how can I authorise a flight');
assert.equal(authoriseFlightAnswer.matches[0]?.functionId, 'function.curated.duty-pilot.flight-authorisation');
assert.match(authoriseFlightAnswer.answer, /multiple ways|Which method/i, 'Broad flight authorisation answer should ask which method the user wants.');
assert.match(authoriseFlightAnswer.answer, /Duty Pilot AUTH window/i, 'Flight authorisation choices should include Duty Pilot.');
assert.match(authoriseFlightAnswer.answer, /DFP tile context menu/i, 'Flight authorisation choices should include DFP tile context menu.');
assert.match(authoriseFlightAnswer.answer, /Mobile app/i, 'Flight authorisation choices should include mobile app.');

const authFlightAnswer = ask('how do I auth a flight');
assert.equal(authFlightAnswer.matches[0]?.functionId, 'function.curated.duty-pilot.flight-authorisation');
assert.match(authFlightAnswer.answer, /Which method/i, 'Auth flight shorthand should ask which method to use.');

const dutyPilotAuthAnswer = ask('how do I authorise a flight from duty pilot');
assert.equal(dutyPilotAuthAnswer.matches[0]?.functionId, 'function.curated.duty-pilot.flight-authorisation');
assert.match(dutyPilotAuthAnswer.answer, /Open Duty Pilot/i, 'Duty Pilot flight authorisation answer should start from Duty Pilot.');
assert.match(dutyPilotAuthAnswer.answer, /PIN/i, 'Duty Pilot flight authorisation answer should include PIN signing.');

const dfpTileAuthAnswer = ask('how do I authorise a flight from the DFP tile');
assert.equal(dfpTileAuthAnswer.matches[0]?.functionId, 'function.curated.duty-pilot.flight-authorisation');
assert.match(dfpTileAuthAnswer.answer, /Open DFP/i, 'DFP tile flight authorisation answer should start from DFP.');
assert.match(dfpTileAuthAnswer.answer, /context menu|Flight Authorisation/i, 'DFP tile answer should mention the context menu authorisation path.');

const dfpTileFollowUpAnswer = ask('dfp tile', { conversation: authoriseFlightAnswer.conversation });
assert.equal(dfpTileFollowUpAnswer.matches[0]?.functionId, 'function.curated.duty-pilot.flight-authorisation');
assert.match(dfpTileFollowUpAnswer.answer, /Open DFP/i, 'DFP tile follow-up should continue the pending flight authorisation workflow.');
assert.match(dfpTileFollowUpAnswer.answer, /Flight Authorisation/i, 'DFP tile follow-up should explain the authorisation route.');
assert.doesNotMatch(dfpTileFollowUpAnswer.answer, /Multi Select/i, 'DFP tile follow-up must not be reinterpreted as Multi Select.');

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
assert.equal(unknownAnswer.clarificationOptions, undefined, 'Nonsense questions should not show irrelevant clarification choices.');

const ambiguousSingleWordAnswer = ask('where do I set reason');
assert.match(ambiguousSingleWordAnswer.answer, /I don't know the answer to that yet|include the page or area/i, 'Ambiguous single-word labels should not produce a confident unrelated procedure.');
assert.doesNotMatch(ambiguousSingleWordAnswer.answer, /Cancel Flight|Restore to Schedule|Remove from Schedule/i, 'Ambiguous reason wording must not be treated as the cancellation workflow without context.');

const ambiguousArchiveAnswer = ask('make inactive');
assert.equal(ambiguousArchiveAnswer.needsClarification, true, 'Ambiguous inactive wording should ask for clarification.');
assert.equal(ambiguousArchiveAnswer.resolutionStage, 1, 'Ambiguous archive wording should start at Stage 1.');
assert.ok((ambiguousArchiveAnswer.clarificationOptions || []).length > 0, 'Stage 1 should include clickable options.');
assert.equal(
  new Set((ambiguousArchiveAnswer.clarificationOptions || []).map((option) => option.intentId)).size,
  (ambiguousArchiveAnswer.clarificationOptions || []).length,
  'Stage 1 options should not duplicate intent IDs.'
);

const selectedClarification = answerNeoGuideClarificationSelection(
  ambiguousArchiveAnswer.clarificationOptions[0].intentId,
  model,
  { conversation: ambiguousArchiveAnswer.conversation }
);
assert.equal(selectedClarification.confidence, 'high', 'Selecting a clarification option should confirm the intent.');
assert.equal(selectedClarification.matches[0]?.functionId, ambiguousArchiveAnswer.clarificationOptions[0].intentId);

const stageTwo = answerNeoGuideClarificationNone(model, { conversation: ambiguousArchiveAnswer.conversation });
assert.equal(stageTwo.resolutionStage, 2, 'None of these from Stage 1 should move to Stage 2.');
assert.ok(stageTwo.clarificationOptions?.length > 0, 'Stage 2 should show new options when available.');
const stageOneIds = new Set((ambiguousArchiveAnswer.clarificationOptions || []).map((option) => option.intentId));
for (const option of stageTwo.clarificationOptions || []) {
  assert.equal(stageOneIds.has(option.intentId), false, 'Stage 2 must not repeat Stage 1 intent IDs.');
}

const stageThree = answerNeoGuideClarificationNone(model, { conversation: stageTwo.conversation });
if (stageThree.resolutionStage) {
  assert.equal(stageThree.resolutionStage, 3, 'Second None of these should move to Stage 3 when options remain.');
  const priorIds = new Set([
    ...(ambiguousArchiveAnswer.clarificationOptions || []).map((option) => option.intentId),
    ...(stageTwo.clarificationOptions || []).map((option) => option.intentId),
  ]);
  for (const option of stageThree.clarificationOptions || []) {
    assert.equal(priorIds.has(option.intentId), false, 'Stage 3 must not repeat prior intent IDs.');
  }
}
const allClarificationLabels = [
  ...(ambiguousArchiveAnswer.clarificationOptions || []),
  ...(stageTwo.clarificationOptions || []),
  ...(stageThree.clarificationOptions || []),
].map((option) => option.label);
assert.equal(
  allClarificationLabels.some((label) => /\/api\/|server\.js|function\.|app\.tsx/i.test(label)),
  false,
  'Clarification options must not expose internal API routes or implementation artefacts.'
);

const learnedDeleteStaff = ask('get rid of an old employee', {
  learnedAssociations: [
    {
      phrase: 'get rid of an old employee',
      normalisedPhrase: 'get rid of an old employee',
      intentId: 'function.curated.people.delete-staff',
      count: 2,
    },
  ],
});
assert.equal(
  learnedDeleteStaff.matches[0]?.functionId,
  'function.curated.people.delete-staff',
  'Learned wording should boost the selected intent on future matching.'
);

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
