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
        <div className="px-4 py-2 bg-amber-900/30 border border-amber-700/60 rounded text-amber-200 text-sm flex items-center gap-3">
          <span>{codesError}</span>
          <button
            onClick={loadCodesFromDB}
            className="ml-auto px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {codesLoading && (
        <div className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-gray-300 text-sm">
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
