import React, { useState } from 'react';

interface TestingFunctionsSettingsProps {
  onShowSuccess?: (message: string) => void;
}

const REQUIRED_CONFIRMATION = 'RESET DATABASE';

const TestingFunctionsSettings: React.FC<TestingFunctionsSettingsProps> = ({ onShowSuccess }) => {
  const [confirmation, setConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canReset = confirmation.trim() === REQUIRED_CONFIRMATION && !isResetting;

  const resetDatabase = async () => {
    if (!canReset) return;
    setIsResetting(true);
    setMessage('');
    setError('');

    try {
      const sessionToken = localStorage.getItem('dfp_session_token') || '';
      const response = await fetch('/api/testing-functions/reset-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ confirmation: REQUIRED_CONFIRMATION }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'The test database could not be reset.');
      }

      localStorage.removeItem('dfp_session_token');
      localStorage.removeItem('dfp_current_user');
      const successMessage = payload.message || 'Test database reset. Sign in again with the initial Organisation Administrator account.';
      setMessage(successMessage);
      onShowSuccess?.(successMessage);
    } catch (resetError: any) {
      setError(resetError?.message || 'The test database could not be reset.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="rounded-lg border border-red-800/50 bg-gray-800 shadow-lg">
      <div className="border-b border-red-900/50 bg-red-950/30 px-5 py-4">
        <h3 className="text-lg font-bold text-white">Testing Functions</h3>
        <p className="mt-1 max-w-3xl text-sm text-red-100/80">
          Temporary tools for customer testbeds. These controls are intended for setup testing only and should be removed before final product release.
        </p>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-md border border-red-700/50 bg-red-950/25 p-4">
          <h4 className="text-sm font-bold uppercase tracking-widest text-red-200">Reset Test Database</h4>
          <p className="mt-2 text-sm leading-6 text-gray-200">
            This clears the current test database back to first-delivery state. It removes configured organisations, units, people,
            schedules, settings, sessions and imported data, then recreates the initial Organisation Administrator account from the deployment settings.
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
  );
};

export default TestingFunctionsSettings;
