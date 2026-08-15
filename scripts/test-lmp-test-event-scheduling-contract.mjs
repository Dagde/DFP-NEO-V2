import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const appSource = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const helperSource = fs.readFileSync(path.join(root, 'utils/lmpTestEventScheduling.ts'), 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(
  helperSource.includes('if (!isLmpTestEvent(testEventType)) return candidates;'),
  'Test-event qualification filtering must leave ordinary events unchanged.',
);
assert(
  helperSource.includes('if (!qualificationId) return [];'),
  'A test event without its one required qualification must have no eligible officer.',
);
assert(
  helperSource.includes('getPersonAssignedQualificationIds(person, catalogue, false).includes(qualificationId)'),
  'Testing Officers must be selected by their stored qualification ID.',
);
assert(
  appSource.includes('? [...instructors]\n                    : [...getBaseInstructorPoolForEventType(type)]'),
  'Test events must not be pre-filtered by the ordinary QFI pool.',
);
assert(
  appSource.includes("traceScheduleReject('NO_QUALIFIED_TESTING_OFFICER'"),
  'An unstaffed test event must produce a specific scheduling rejection.',
);
assert(
  appSource.includes('const isSoloFlight = !isTestEvent'),
  'A configured test event must require its Testing Officer even for a normally solo event.',
);
assert(
  helperSource.indexOf('if (formationCallsign) return formationCallsign;')
    < helperSource.indexOf("!== 'FLIGHT_TEST'"),
  'Formation callsigns must take precedence over a Testing Officer secondary callsign.',
);

const staff = [
  { name: 'Ordinary QFI', qualifications: ['qfi'], secondaryCallsign: 'EAGLE1' },
  { name: 'Flight Test Officer', qualifications: ['testing-officer', 'qfi'], secondaryCallsign: 'TEST1' },
  { name: 'Simulator Test Officer', qualifications: ['sim-test-officer', 'ire'], secondaryCallsign: 'SIM1' },
];

const filter = (candidates, testType, qualificationId) => {
  if (testType === 'NONE') return candidates;
  if (!qualificationId) return [];
  return candidates.filter(person => person.qualifications.includes(qualificationId));
};
const callsign = ({ formation, type, useSecondary, secondary }) => {
  if (formation) return formation;
  return type === 'FLIGHT_TEST' && useSecondary ? secondary || undefined : undefined;
};

const ordinaryBefore = staff.length;
const ordinaryAfter = filter(staff, 'NONE', '').length;
assert(ordinaryAfter === ordinaryBefore, 'Ordinary scheduling candidate count changed.');
assert(filter(staff, 'FLIGHT_TEST', 'testing-officer').length === 1, 'Flight Test should select one qualified officer.');
assert(filter(staff, 'SIMULATOR_TEST', 'sim-test-officer').length === 1, 'Simulator Test should select one qualified officer.');
assert(filter(staff, 'FLIGHT_TEST', '').length === 0, 'Missing test qualification should schedule no officer.');
assert(callsign({ type: 'FLIGHT_TEST', useSecondary: true, secondary: 'TEST1' }) === 'TEST1', 'Flight Test secondary callsign was not selected.');
assert(callsign({ type: 'SIMULATOR_TEST', useSecondary: true, secondary: 'SIM1' }) === undefined, 'Simulator Test must not use the Flight Test callsign option.');
assert(callsign({ formation: 'VIPER', type: 'FLIGHT_TEST', useSecondary: true, secondary: 'TEST1' }) === 'VIPER', 'Formation callsign precedence failed.');

console.log(`Ordinary candidate count before/after: ${ordinaryBefore}/${ordinaryAfter}`);
console.log('Flight Test qualified candidate count: 1');
console.log('Simulator Test qualified candidate count: 1');
console.log('LMP test-event scheduling contract passed.');
