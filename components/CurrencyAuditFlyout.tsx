import React, { useState, useEffect } from 'react';

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
          <button
            onClick={onClose}
            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-lg btn-aluminium-brushed text-black"
            title="Close"
          >
            Close
          </button>
        </div>

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
