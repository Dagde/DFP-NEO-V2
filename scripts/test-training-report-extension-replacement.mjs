import assert from 'node:assert/strict';

import {
  normaliseTrainingReportExtendedTiming,
  replaceTrainingReportNextEventExtension,
} from '../utils/trainingReportExtensions.ts';

const applyExtension = (overrides = {}) => replaceTrainingReportNextEventExtension({
  extensionKey: 'report-new',
  requestedExtension: 0.4,
  flightOrSimHours: 1,
  duration: 1,
  totalEventHours: 1,
  extensionLedger: {},
  ...overrides,
});

const initial = applyExtension({ requestedExtension: 0.3 });
assert.equal(initial.duration, 1.3);
assert.deepEqual(initial.extensionLedger, { 'report-new': 0.3 });

const replacement = applyExtension({
  flightOrSimHours: 1.3,
  duration: 1.3,
  totalEventHours: 1.3,
  extensionLedger: { 'report-old': 0.3 },
});
assert.equal(replacement.duration, 1.4);
assert.deepEqual(replacement.extensionLedger, { 'report-new': 0.4 });

const accumulatedLegacyValue = applyExtension({
  flightOrSimHours: 1.7,
  duration: 1.7,
  totalEventHours: 1.7,
  extensionLedger: { 'report-old': 0.3, 'report-new': 0.4 },
});
assert.equal(accumulatedLegacyValue.duration, 1.4);
assert.deepEqual(accumulatedLegacyValue.extensionLedger, { 'report-new': 0.4 });

const rerun = applyExtension({
  flightOrSimHours: 1.4,
  duration: 1.4,
  totalEventHours: 1.4,
  extensionLedger: { 'report-new': 0.4 },
});
assert.equal(rerun.duration, 1.4);
assert.equal(rerun.changed, false);

const staleComposedTiming = normaliseTrainingReportExtendedTiming(
  {
    type: 'Flight',
    flightOrSimHours: 3,
    duration: 3,
    totalEventHours: 3,
    trainingReportLastExtendedByAssessmentId: 'report-new',
    trainingReportExtensionAssessmentIds: ['report-old', 'report-new'],
    trainingReportNextEventExtensions: { 'report-old': 0.3, 'report-new': 0.4 },
  },
  {
    type: 'Flight',
    flightOrSimHours: 1,
    duration: 1,
    totalEventHours: 1,
  },
);
assert.equal(staleComposedTiming.flightOrSimHours, 1.4);
assert.equal(staleComposedTiming.duration, 1.4);
assert.equal(staleComposedTiming.totalEventHours, 1.4);

const staleComposedTimingWithoutLedger = normaliseTrainingReportExtendedTiming(
  {
    type: 'Flight',
    flightOrSimHours: 2.6,
    duration: 2.6,
    totalEventHours: 2.6,
    trainingReportLastExtendedByAssessmentId: 'report-missing-ledger',
  },
  {
    type: 'Flight',
    flightOrSimHours: 1,
    duration: 1,
    totalEventHours: 1,
  },
);
assert.equal(staleComposedTimingWithoutLedger.duration, 1);

console.log('Training report extension replacement contract passed.');
