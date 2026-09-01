import React, { useState, useEffect } from 'react';
import {
  AUDIT_RECORDING_ACTIONS,
  getAuditRecordingSettingsForPage,
  saveAuditRecordingSettingsForPage,
} from '../utils/auditLogger';
import { AuditAction } from '../types/audit';

interface AuditEntry {
  id: string;
  createdAt: string;
  userName: string;
  summary: string;
  personName: string;
  details: { currencyName: string; oldDate: string; newDate: string; activeChanged?: boolean; isNowInactive?: boolean }[];
}

interface CurrencyAuditFlyoutProps {
  personId: string;         // resolvedId (UUID or idNumber string)
  personName: string;
  onClose: () => void;
}

const CurrencyAuditFlyout: React.FC<CurrencyAuditFlyoutProps> = ({ personId, personName, onClose }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageName = 'Currency Audit Log';
  const [showRecordingSettings, setShowRecordingSettings] = useState(false);
  const [recordingSettings, setRecordingSettings] = useState<Record<AuditAction, boolean>>(() => (
    getAuditRecordingSettingsForPage(pageName)
  ));

  useEffect(() => {
    if (!personId) return;
    setIsLoading(true);
    fetch(`/api/audit/currency/${personId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => {
        setEntries(data.auditEntries || []);
      })
      .catch(err => setError(String(err)))
      .finally(() => setIsLoading(false));
  }, [personId]);

  function formatDateTime(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      });
    } catch {
      return dateStr;
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr + 'T00:00:00Z');
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' });
    } catch {
      return dateStr;
    }
  }

  const recordingActionOptions = AUDIT_RECORDING_ACTIONS.filter(action => (
    ['View', 'Edit', 'Add', 'Delete', 'Save'].includes(action)
  ));

  const setRecordingAction = (action: AuditAction, enabled: boolean) => {
    const nextSettings = { ...recordingSettings, [action]: enabled };
    setRecordingSettings(nextSettings);
    saveAuditRecordingSettingsForPage(pageName, nextSettings);
  };

  const setAllRecordingActions = (enabled: boolean) => {
    const nextSettings = recordingActionOptions.reduce((settings, action) => {
      settings[action] = enabled;
      return settings;
    }, { ...recordingSettings } as Record<AuditAction, boolean>);
    setRecordingSettings(nextSettings);
    saveAuditRecordingSettingsForPage(pageName, nextSettings);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-white">Currency Audit Log</h3>
            <p className="text-[11px] text-gray-400">{personName}</p>
          </div>
          <div className="flex items-center gap-px">
            <button
              onClick={() => setShowRecordingSettings(!showRecordingSettings)}
              className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-black"
              title="Audit Log Recording Settings"
            >
              Settings
            </button>
            <button
              onClick={onClose}
              className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-lg btn-aluminium-brushed text-black"
              title="Close"
            >
              Close
            </button>
          </div>
        </div>

        {showRecordingSettings && (
          <div className="mx-4 mt-3 rounded-md border border-cyan-500/70 bg-cyan-950/15 px-4 py-3 shadow-[0_0_0_1px_rgba(8,145,178,0.18)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-300">Audit Recording Settings</div>
                <div className="text-[11px] text-gray-500">Applies to currency audit history.</div>
              </div>
              <div className="flex items-center gap-px">
                <button
                  type="button"
                  onClick={() => setAllRecordingActions(true)}
                  className="rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-700"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setAllRecordingActions(false)}
                  className="rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-700"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {recordingActionOptions.map(action => (
                <label
                  key={action}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-700 bg-gray-800/70 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={recordingSettings[action] !== false}
                    onChange={(event) => setRecordingAction(action, event.target.checked)}
                    className="h-4 w-4 accent-sky-500"
                  />
                  {action}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              These choices control future audit entries only. Existing audit history is retained unchanged.
            </p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && (
            <div className="text-gray-400 text-xs text-center py-8 animate-pulse">Loading audit history…</div>
          )}
          {error && (
            <div className="text-red-400 text-xs text-center py-4">⚠ Failed to load: {error}</div>
          )}
          {!isLoading && !error && entries.length === 0 && (
            <div className="text-gray-500 text-xs italic text-center py-8">
              No currency changes recorded yet.
            </div>
          )}
          {!isLoading && entries.map(entry => (
            <div key={entry.id} className="bg-gray-700/50 border border-gray-600/50 rounded-lg p-3">
              {/* Entry header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
                  <span className="text-[11px] font-semibold text-sky-300">{entry.userName}</span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">{formatDateTime(entry.createdAt)}</span>
              </div>
              {/* Summary */}
              {entry.summary && (
                <p className="text-[11px] text-gray-300 mb-2 leading-relaxed">{entry.summary}</p>
              )}
              {/* Detail rows */}
              {entry.details && entry.details.length > 0 && (
                <div className="space-y-1">
                  {entry.details.map((d, i) => (
                    <div key={i} className="flex flex-col gap-0.5 text-[10px] border-l-2 border-gray-600 pl-2">
                      <span className="text-gray-300 font-medium truncate" title={d.currencyName}>
                        {d.currencyName}
                      </span>
                      {d.activeChanged && (
                        <span className={`font-semibold ${d.isNowInactive ? 'text-gray-400' : 'text-sky-400'}`}>
                          {d.isNowInactive ? '⊘ Set Inactive' : '✓ Set Active'}
                        </span>
                      )}
                      {d.oldDate !== d.newDate && (
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="text-gray-500">
                            {d.oldDate ? formatDate(d.oldDate) : 'unset'}
                          </span>
                          <span className="text-gray-600">→</span>
                          <span className={`font-medium ${d.newDate ? 'text-green-400' : 'text-red-400 italic'}`}>
                            {d.newDate ? formatDate(d.newDate) : 'cleared'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CurrencyAuditFlyout;
