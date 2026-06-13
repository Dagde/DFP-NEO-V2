import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appSource = readFileSync(resolve(root, 'App.tsx'), 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const findIndex = (text) => {
  const index = appSource.indexOf(text);
  assert(index >= 0, `Missing scheduler contract text: ${text}`);
  return index;
};

const airCombatBlockStart = findIndex('if (isAirCombatBuild) {');
const flightSchoolGuardStart = findIndex('if (!isAirCombatBuild) {');
const flightSchoolFirstPass = findIndex('// Step 3a: Schedule day flights.');

assert(
  airCombatBlockStart < flightSchoolGuardStart && flightSchoolGuardStart < flightSchoolFirstPass,
  'Flight School scheduling passes must be guarded away from Air Combat builds.'
);

const airCombatNightTaskingCall = findIndex('scheduleTaskingPriorityEvents(airCombatNightTaskingEvents);');
const airCombatNightCurrencyCall = findIndex("scheduleCurrencyPriorityEvents(airCombatNightCurrencyEvents, 'night');");
const airCombatNightTrainingCall = findIndex("scheduleAirCombatTrainingPriorityEvents('night');");
const airCombatDayTaskingCall = findIndex('scheduleTaskingPriorityEvents(airCombatDayTaskingEvents);');
const airCombatDayCurrencyCall = findIndex("scheduleCurrencyPriorityEvents(airCombatDayCurrencyEvents, 'day');");
const airCombatDayTrainingCall = findIndex("scheduleAirCombatTrainingPriorityEvents('day');");

assert(
  airCombatNightTaskingCall < airCombatNightCurrencyCall &&
    airCombatNightCurrencyCall < airCombatNightTrainingCall &&
    airCombatNightTrainingCall < airCombatDayTaskingCall &&
    airCombatDayTaskingCall < airCombatDayCurrencyCall &&
    airCombatDayCurrencyCall < airCombatDayTrainingCall,
  'Air Combat scheduling order must be night taskings/currency/training, then day taskings/currency/training.'
);

assert(
  appSource.includes('const airCombatNightTaskingEvents = activeTaskingPriorityEvents.filter(isAirCombatNightEvent);') &&
    appSource.includes('const airCombatDayTaskingEvents = activeTaskingPriorityEvents.filter(isAirCombatDayEvent);') &&
    appSource.includes('const airCombatNightCurrencyEvents = currencyPriorityEvents.filter(isAirCombatNightEvent);') &&
    appSource.includes('const airCombatDayCurrencyEvents = currencyPriorityEvents.filter(isAirCombatDayEvent);'),
  'Air Combat tasking and currency inputs must be split into day and night tables.'
);

assert(
  appSource.includes("scheduleAirCombatTrainingPriorityEvents('night')") &&
    appSource.includes("scheduleCurrencyPriorityEvents(airCombatNightCurrencyEvents, 'night')") &&
    appSource.includes('scheduleTaskingPriorityEvents(airCombatNightTaskingEvents)'),
  'Air Combat night scheduler must run tasking, currency, and course/package passes against night-only inputs.'
);

assert(
  appSource.includes("scheduleMode === 'night' ? item.dayNight === 'Night' : item.dayNight !== 'Night'"),
  'Air Combat training source tables must exclude night events from the day pass and day events from the night pass.'
);

assert(
  appSource.includes("if (!canAssignPersonForScheduledWindow(staff.name, startTime)) return 'DAY_NIGHT_SEPARATION';"),
  'Air Combat staff scheduling must enforce day/night separation.'
);

assert(
  appSource.includes('if (!isAirCombatBuild && earlyCurrencyPriorityEvents.length > 0)'),
  'Flight School early currency pass must not run during Air Combat builds.'
);

assert(
  appSource.includes('for (let tileTime = scheduleWindowStart; tileTime <= scheduleWindowEnd + 0.001 && attempt < placementLimit; tileTime += slotIncrement)'),
  'Air Combat course/package training must iterate across the active day or night window in 5-minute tiles.'
);

assert(
  appSource.includes('placeTrainingForKind(preferredKind, roundedTileTime)') &&
    appSource.includes('placeTrainingForKind(fallbackKind, roundedTileTime)'),
  'Air Combat weighted course/package placement must attempt the current tile only.'
);

assert(
  appSource.includes('const getScheduleEventBookingOffsets =') &&
    appSource.includes('return numeric > 24 ? numeric / 60 : numeric;'),
  'Air Combat/priority booking windows must normalise hour and minute pre/post values.'
);

const priorityPersonnelConflictStart = findIndex('const priorityPersonnelConflict =');
const priorityPersonnelConflictEnd = findIndex('const isCurrencyPriorityEvent =');
const priorityPersonnelConflictSource = appSource.slice(priorityPersonnelConflictStart, priorityPersonnelConflictEnd);
assert(
  !priorityPersonnelConflictSource.includes('event.startTime - (event.preStart || 0)') &&
    !priorityPersonnelConflictSource.includes('event.startTime + event.duration + (event.postEnd || 0)'),
  'Priority personnel conflict must use the shared booking-window resolver, not raw preStart/postEnd duration math.'
);

assert(
  appSource.includes('if (!isAirCombatBuild) {') && appSource.includes('compressCurrencyFlightPlacements();'),
  'Flight School currency compression must remain isolated from the Air Combat path.'
);

const pickNextKind = (coursePlaced, packagePlaced, weights, hasCourse = true, hasPackage = true) => {
  if (!hasCourse && !hasPackage) return null;
  if (!hasCourse) return 'training_package';
  if (!hasPackage) return 'course';
  const total = coursePlaced + packagePlaced + 1;
  const courseDeficit = (weights.courses / 100) * total - coursePlaced;
  const packageDeficit = (weights.trainingPackages / 100) * total - packagePlaced;
  return courseDeficit >= packageDeficit ? 'course' : 'training_package';
};

const sequence = [];
let coursePlaced = 0;
let packagePlaced = 0;
for (let index = 0; index < 10; index++) {
  const next = pickNextKind(coursePlaced, packagePlaced, { courses: 60, trainingPackages: 40 });
  sequence.push(next);
  if (next === 'course') coursePlaced++;
  if (next === 'training_package') packagePlaced++;
}

assert(coursePlaced === 6 && packagePlaced === 4, `Expected 60:40 weighted sequence, received ${sequence.join(', ')}`);

console.log('Air Combat scheduler contract checks passed.');
