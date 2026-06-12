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

const airCombatTaskingCall = findIndex('scheduleTaskingPriorityEvents(activeTaskingPriorityEvents);');
const airCombatCurrencyCall = findIndex('scheduleCurrencyPriorityEvents(currencyPriorityEvents);');
const airCombatTrainingCall = findIndex('scheduleAirCombatTrainingPriorityEvents();');

assert(
  airCombatTaskingCall < airCombatCurrencyCall && airCombatCurrencyCall < airCombatTrainingCall,
  'Air Combat scheduling order must be taskings, then currency, then course/package training.'
);

assert(
  appSource.includes('if (!isAirCombatBuild && earlyCurrencyPriorityEvents.length > 0)'),
  'Flight School early currency pass must not run during Air Combat builds.'
);

assert(
  appSource.includes('for (let tileTime = flyingStartTime; tileTime <= flyingEndTime + 0.001 && attempt < placementLimit; tileTime += slotIncrement)'),
  'Air Combat course/package training must iterate across the day window in 5-minute tiles.'
);

assert(
  appSource.includes('placeTrainingForKind(preferredKind, roundedTileTime)') &&
    appSource.includes('placeTrainingForKind(fallbackKind, roundedTileTime)'),
  'Air Combat weighted course/package placement must attempt the current tile only.'
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
