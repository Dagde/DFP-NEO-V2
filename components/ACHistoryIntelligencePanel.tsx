import React, { useCallback, useEffect, useState } from 'react';
import ACHistoryAnalytics from './ACHistoryAnalytics';
import ACHistoryAircraftAvailability from './ACHistoryAircraftAvailability';
import RecentCancellationsTable from './RecentCancellationsTable';
import { CancellationCode, CancellationRecord } from '../types';

interface ACHistoryIntelligencePanelProps {
  cancellationRecords: CancellationRecord[];
  currentUserId?: string;
  currentAircraftAvailable?: number;
  totalAircraft?: number;
  currentUserRole?: string;
  timezoneOffset?: number;
  dayFlyingStart?: string;
  dayFlyingEnd?: string;
}

const ACHistoryIntelligencePanel: React.FC<ACHistoryIntelligencePanelProps> = ({
  cancellationRecords,
  currentUserId,
  currentAircraftAvailable = 0,
  totalAircraft = 24,
  currentUserRole,
  timezoneOffset = 0,
  dayFlyingStart = '08:00',
  dayFlyingEnd = '17:00',
}) => {
  const [cancellationCodes, setCancellationCodes] = useState<CancellationCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(true);
  const [codesError, setCodesError] = useState<string | null>(null);

  const loadCodesFromDB = useCallback(async () => {
    setCodesLoading(true);
    setCodesError(null);
    try {
      const res = await fetch('/api/cancellation-codes', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.codes)) {
        setCancellationCodes(data.codes);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Failed to load cancellation codes for AC History intelligence:', err);
      setCodesError('Cancellation code details could not be loaded. Recent cancellations and analytics will still show recorded code values.');
    } finally {
      setCodesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCodesFromDB();
  }, [loadCodesFromDB]);

  return (
    <div className="space-y-6">
      {codesError && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <span>{codesError}</span>
          <button
            onClick={loadCodesFromDB}
            className="ml-auto rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Retry
          </button>
        </div>
      )}

      {codesLoading && (
        <div className="rounded-lg border border-cyan-500/20 bg-slate-900/80 px-4 py-3 text-sm text-slate-300 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
          Loading cancellation code details...
        </div>
      )}

      <ACHistoryAircraftAvailability
        currentUserId={currentUserId}
        currentAircraftAvailable={currentAircraftAvailable}
        totalAircraft={totalAircraft}
        currentUserRole={currentUserRole}
        timezoneOffset={timezoneOffset}
        dayFlyingStart={dayFlyingStart}
        dayFlyingEnd={dayFlyingEnd}
      />

      <RecentCancellationsTable
        cancellationRecords={cancellationRecords}
        cancellationCodes={cancellationCodes}
      />

      <ACHistoryAnalytics
        cancellationRecords={cancellationRecords}
        cancellationCodes={cancellationCodes}
      />
    </div>
  );
};

export default ACHistoryIntelligencePanel;
