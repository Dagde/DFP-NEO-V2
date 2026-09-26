import React, { useEffect, useMemo, useState } from 'react';
import { showDarkAlert, showDarkConfirm, showDarkPrompt } from './DarkMessageModal';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';

interface TestingFunctionsSettingsProps {
  onShowSuccess?: (message: string) => void;
  activeUnitCode?: string;
  activeCompositeUnitCode?: string;
}

type TestingPreview = {
  snapshotKey?: string;
  date?: string;
  unitCode?: string;
  counts?: {
    scheduleEvents: number;
    authorisableFlights: number;
    postFlightEvents: number;
    trainingReportEvents: number;
    existingCompletions: number;
    existingTrainingReports: number;
  };
  samples?: Array<{ id: string; type: string; event: string; instructor?: string; trainee?: string; startTime?: number }>;
};

const REQUIRED_CONFIRMATION = 'RESET DATABASE';

const todayIso = () => new Date().toISOString().slice(0, 10);
const normaliseUnitInput = (value: string) => String(value || '').trim().toUpperCase();
const getSelectedTestingUnit = (activeCompositeUnitCode = '', activeUnitCode = '') => (
  normaliseUnitInput(activeCompositeUnitCode) || normaliseUnitInput(activeUnitCode)
);

const TestingFunctionsSettings: React.FC<TestingFunctionsSettingsProps> = ({
  onShowSuccess,
  activeUnitCode = '',
  activeCompositeUnitCode = '',
}) => {
  const [confirmation, setConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testDate, setTestDate] = useState(todayIso());
  const [testUnit, setTestUnit] = useState(getSelectedTestingUnit(activeCompositeUnitCode, activeUnitCode));
  const [authoriseFlights, setAuthoriseFlights] = useState(true);
  const [postFlightTimes, setPostFlightTimes] = useState(true);
  const [completeReports, setCompleteReports] = useState(true);
  const [scoreReports, setScoreReports] = useState(true);
  const [scoreDistributionRows, setScoreDistributionRows] = useState([
    { score: 3, percent: 80 },
    { score: 2, percent: 10 },
    { score: 4, percent: 10 },
  ]);
  const [preview, setPreview] = useState<TestingPreview | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const selectedUnit = getSelectedTestingUnit(activeCompositeUnitCode, activeUnitCode);
    if (selectedUnit) setTestUnit(selectedUnit);
  }, [activeCompositeUnitCode, activeUnitCode]);

  const effectiveUnit = useMemo(() => (
    normaliseUnitInput(testUnit) || getSelectedTestingUnit(activeCompositeUnitCode, activeUnitCode)
  ), [activeCompositeUnitCode, activeUnitCode, testUnit]);

  const scoreDistribution = useMemo(() => (
    scoreDistributionRows.reduce<Record<string, number>>((distribution, row) => {
      const score = Number(row.score);
      const percent = Number(row.percent);
      if (Number.isFinite(score) && Number.isFinite(percent) && percent > 0) {
        distribution[String(score)] = percent;
      }
      return distribution;
    }, {})
  ), [scoreDistributionRows]);

  const scoreDistributionText = scoreDistributionRows
    .filter(row => Number(row.percent) > 0)
    .map(row => `${row.percent}% score ${row.score}`)
    .join(', ');
  const previewHasNoScheduleEvents = Boolean(preview?.counts && preview.counts.scheduleEvents === 0);

  const canReset = confirmation.trim() === REQUIRED_CONFIRMATION && !isResetting;

  const authHeaders = () => {
    const sessionToken = localStorage.getItem('dfp_session_token') || '';
    return {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    };
  };

  const resetDatabase = async () => {
    if (!canReset) return;
    setMessage('');
    setError('');

    try {
      const password = await showDarkPrompt({
        title: 'Testing Functions Password Required',
        message: 'Enter your current password to continue with the test database reset.',
        inputLabel: 'Password',
        inputType: 'password',
        inputPlaceholder: 'Enter password',
        confirmText: 'Continue',
        cancelText: 'Cancel',
        variant: 'warning',
      });
      if (!password) return;

      const passwordAccepted = await verifyCurrentUserPassword(password);
      if (!passwordAccepted) {
        await showDarkAlert('The password was not accepted. The database was not reset.', 'Password Required', 'warning');
        return;
      }

      const finalConfirmation = await showDarkConfirm(
        'This will erase this test database and return it to first-delivery state.\n\nThis cannot be undone.',
        'Erase Test Database?',
        'warning',
      );
      if (!finalConfirmation) return;

      setIsResetting(true);
      const response = await fetch('/api/testing-functions/reset-database', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ confirmation: REQUIRED_CONFIRMATION, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'The test database could not be reset.');
      }

      localStorage.removeItem('dfp_session_token');
      localStorage.removeItem('dfp_current_user');
      const successMessage = payload.message || 'Test database reset. Sign in again with the initial Organisation Administrator account.';
      setMessage(successMessage);
      setConfirmation('');
      onShowSuccess?.(successMessage);
    } catch (resetError: any) {
      setError(resetError?.message || 'The test database could not be reset.');
    } finally {
      setIsResetting(false);
    }
  };

  const previewBulkDay = async () => {
    setError('');
    setMessage('');
    setResult(null);
    setPreview(null);
    if (!testDate) {
      setError('Select a date first.');
      return;
    }
    if (!effectiveUnit) {
      setError('Enter or select the unit to test.');
      return;
    }
    try {
      setIsWorking(true);
      const response = await fetch('/api/testing-functions/bulk-day-preview', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ date: testDate, unitCode: effectiveUnit }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not preview test day.');
      setPreview(payload);
      setMessage(`Preview loaded for ${payload.snapshotKey || testDate}.`);
    } catch (previewError: any) {
      setError(previewError?.message || 'Could not preview test day.');
    } finally {
      setIsWorking(false);
    }
  };

  const runBulkDay = async () => {
    setError('');
    setMessage('');
    setResult(null);
    if (!testDate || !effectiveUnit) {
      setError('Select a date and unit first.');
      return;
    }
    if (!authoriseFlights && !postFlightTimes && !completeReports) {
      setError('Select at least one testing action.');
      return;
    }

    const confirmed = await showDarkConfirm(
      `This will write test data for ${effectiveUnit} on ${testDate}.\n\nSelected actions:\n${authoriseFlights ? '- Bulk authorise flights\n' : ''}${postFlightTimes ? '- Bulk post-flight times for flights and simulators\n' : ''}${completeReports ? `- Complete training reports (${scoreReports ? 'with generated scores' : 'complete only'})\n` : ''}\nContinue?`,
      'Run Bulk Test Actions?',
      'warning',
    );
    if (!confirmed) return;

    try {
      setIsWorking(true);
      const response = await fetch('/api/testing-functions/bulk-day', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          date: testDate,
          unitCode: effectiveUnit,
          actions: {
            authoriseFlights,
            postFlightTimes,
            completeReports,
          },
          trainingReports: {
            scoreMode: scoreReports ? 'score' : 'completeOnly',
            scoreDistribution,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Bulk test action failed.');
      setResult(payload);
      setPreview(payload.preview || null);
      const successMessage = `Bulk test data written: ${payload.summary?.authorisedFlights || 0} authorised, ${payload.summary?.eventCompletions || 0} completions, ${payload.summary?.trainingReports || 0} trainee reports, ${payload.summary?.staffTrainingReports || 0} staff reports.`;
      setMessage(successMessage);
      onShowSuccess?.(successMessage);
    } catch (runError: any) {
      setError(runError?.message || 'Bulk test action failed.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-orange-500/40 bg-gray-800 shadow-lg">
        <div className="border-b border-orange-900/50 bg-orange-950/20 px-5 py-4">
          <h3 className="text-lg font-bold text-white">Temporary Testing Functions</h3>
          <p className="mt-1 max-w-3xl text-sm text-orange-100/80">
            Customer testbed tools for rapidly creating realistic operational records. Remove this page and the matching `/api/testing-functions/*` routes before final production release.
          </p>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Test date</span>
              <input
                type="date"
                value={testDate}
                onChange={(event) => setTestDate(event.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Unit</span>
              <input
                type="text"
                value={testUnit}
                onChange={(event) => setTestUnit(normaliseUnitInput(event.target.value))}
                placeholder={getSelectedTestingUnit(activeCompositeUnitCode, activeUnitCode) || 'e.g. 1FTS+CFS'}
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={previewBulkDay}
                disabled={isWorking}
                className="rounded-md border border-sky-500/70 bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-700 disabled:text-gray-400"
              >
                {isWorking ? 'Working...' : 'Preview Day'}
              </button>
              <button
                type="button"
                onClick={runBulkDay}
                disabled={isWorking}
                className="rounded-md border border-orange-500/70 bg-orange-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-700 disabled:text-gray-400"
              >
                Run Selected
              </button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <label className="rounded-md border border-gray-700 bg-gray-900/60 p-3 text-sm text-gray-200">
              <input type="checkbox" checked={authoriseFlights} onChange={(event) => setAuthoriseFlights(event.target.checked)} className="mr-2" />
              Bulk authorise all flight tiles
            </label>
            <label className="rounded-md border border-gray-700 bg-gray-900/60 p-3 text-sm text-gray-200">
              <input type="checkbox" checked={postFlightTimes} onChange={(event) => setPostFlightTimes(event.target.checked)} className="mr-2" />
              Bulk post-flight times for flights and simulators
            </label>
            <label className="rounded-md border border-gray-700 bg-gray-900/60 p-3 text-sm text-gray-200">
              <input type="checkbox" checked={completeReports} onChange={(event) => setCompleteReports(event.target.checked)} className="mr-2" />
              Complete training reports for all event types
            </label>
          </div>

          <div className="rounded-md border border-gray-700 bg-gray-900/60 p-4">
            <label className="flex items-start gap-2 text-sm text-gray-200">
              <input type="checkbox" checked={scoreReports} onChange={(event) => setScoreReports(event.target.checked)} className="mt-1" disabled={!completeReports} />
              <span>
                Generate scores where reports are completed. Current distribution: {scoreDistributionText || 'no score distribution configured'}. Overall and element scores are the same for each individual report.
              </span>
            </label>
            {scoreReports && completeReports ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {scoreDistributionRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-2 gap-2 rounded-md border border-gray-700 bg-gray-950/60 p-3">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Score</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.score}
                        onChange={(event) => setScoreDistributionRows(current => current.map((item, rowIndex) => (
                          rowIndex === index ? { ...item, score: Number(event.target.value) } : item
                        )))}
                        className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm font-bold text-white outline-none focus:border-orange-400"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Percent</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.percent}
                        onChange={(event) => setScoreDistributionRows(current => current.map((item, rowIndex) => (
                          rowIndex === index ? { ...item, percent: Number(event.target.value) } : item
                        )))}
                        className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm font-bold text-white outline-none focus:border-orange-400"
                      />
                    </label>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {preview?.counts && (
            <>
              {previewHasNoScheduleEvents ? (
                <div className="rounded-md border border-amber-500/60 bg-amber-950/30 p-3 text-sm text-amber-100">
                  No schedule events were found for <strong>{preview.unitCode || effectiveUnit}</strong> on <strong>{preview.date || testDate}</strong>.
                  {preview.snapshotKey ? <> Snapshot checked: <strong>{preview.snapshotKey}</strong>.</> : null}
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-3">
                {Object.entries(preview.counts).map(([key, value]) => (
                  <div key={key} className="rounded-md border border-slate-700 bg-slate-950/50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</div>
                    <div className="mt-1 text-2xl font-bold text-white">{value}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {preview?.samples && preview.samples.length > 0 ? (
            <div className="rounded-md border border-slate-700 bg-slate-950/40 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sample Events Found</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {preview.samples.slice(0, 6).map(sample => (
                  <div key={sample.id} className="rounded border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-200">
                    <span className="font-bold text-white">{sample.event || sample.type}</span>
                    {sample.startTime != null ? <span className="ml-2 text-slate-400">{sample.startTime}</span> : null}
                    <div className="text-slate-400">{sample.instructor || 'No instructor'} / {sample.trainee || 'No trainee'}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {result?.summary && (
            <div className="rounded-md border border-emerald-600/50 bg-emerald-950/30 p-3 text-sm text-emerald-100">
              <div className="font-bold">Last run complete</div>
              <div className="mt-1">
                Authorised: {result.summary.authorisedFlights || 0} | Post-flight completions: {result.summary.eventCompletions || 0} | Trainee reports: {result.summary.trainingReports || 0} | Staff reports: {result.summary.staffTrainingReports || 0}
              </div>
              <div className="mt-1 text-xs text-emerald-200/80">
                Skipped without trainee/staff match: {Math.max(result.summary.skippedTrainingReportsNoTrainee || 0, result.summary.skippedTrainingReportsNoStaff || 0)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-red-800/50 bg-gray-800 shadow-lg">
        <div className="border-b border-red-900/50 bg-red-950/30 px-5 py-4">
          <h3 className="text-lg font-bold text-white">Reset Test Database</h3>
          <p className="mt-1 max-w-3xl text-sm text-red-100/80">
            Clears the current test database back to first-delivery state. Keep this separate from the bulk test-data actions.
          </p>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-md border border-red-700/50 bg-red-950/25 p-4">
            <p className="text-sm leading-6 text-gray-200">
              This removes configured organisations, units, people, schedules, settings, sessions and imported data, then recreates the initial Organisation Administrator account from deployment settings.
            </p>
            <p className="mt-2 text-sm font-semibold text-red-100">
              You will be signed out after the reset because saved sessions are removed with the database data.
            </p>
          </div>

          <label className="block max-w-xl">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Type RESET DATABASE to continue
            </span>
            <input
              type="text"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-red-400 focus:ring-1 focus:ring-red-400"
              placeholder={REQUIRED_CONFIRMATION}
              autoComplete="off"
            />
          </label>

          {error ? (
            <div className="rounded-md border border-red-600/60 bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-100">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="rounded-md border border-emerald-600/50 bg-emerald-950/30 px-3 py-2 text-sm font-semibold text-emerald-100">
              {message}
            </div>
          ) : null}

          <button
            type="button"
            onClick={resetDatabase}
            disabled={!canReset}
            className="rounded-md border border-red-500/70 bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-700 disabled:text-gray-400"
          >
            {isResetting ? 'Resetting database...' : 'Reset Test Database'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestingFunctionsSettings;
