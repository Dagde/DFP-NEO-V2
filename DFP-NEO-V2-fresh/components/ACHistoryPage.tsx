import React, { useState, useEffect, useCallback } from 'react';
import CancellationCodesTable from './CancellationCodesTable';
import ACHistoryAnalytics from './ACHistoryAnalytics';
import ACHistoryAircraftAvailability from './ACHistoryAircraftAvailability';
import RecentCancellationsTable from './RecentCancellationsTable';
import { CancellationCode, CancellationRecord } from '../types';

interface ACHistoryPageProps {
  currentUserRole: string;
  cancellationRecords: CancellationRecord[];
  currentUserId?: string;
  currentAircraftAvailable?: number;
  totalAircraft?: number;
}

const ACHistoryPage: React.FC<ACHistoryPageProps> = ({
  currentUserRole,
  cancellationRecords,
  currentUserId,
  currentAircraftAvailable = 0,
  totalAircraft = 24,
}) => {
  const [cancellationCodes, setCancellationCodes] = useState<CancellationCode[]>([]);
  const [usedCodes, setUsedCodes] = useState<Set<string>>(new Set());
  const [codesLoading, setCodesLoading] = useState(true);
  const [codesError, setCodesError] = useState<string | null>(null);

  // Check if user has edit permissions (Admin or Super Admin)
  const canEdit = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';

  // ─── Load cancellation codes from the database ───────────────────────────
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
    } catch (err: any) {
      console.error('Failed to load cancellation codes from DB:', err);
      setCodesError('Failed to load cancellation codes.');
    } finally {
      setCodesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCodesFromDB();
  }, [loadCodesFromDB]);

  // Calculate which codes have been used in cancellations
  useEffect(() => {
    const used = new Set<string>();
    cancellationRecords.forEach(record => {
      used.add(record.cancellationCode);
      if (record.manualCodeEntry) {
        used.add(record.manualCodeEntry);
      }
    });
    setUsedCodes(used);
  }, [cancellationRecords]);

  // ─── DB-backed CRUD handlers ──────────────────────────────────────────────
  const handleAddCode = async (newCode: CancellationCode) => {
    // Check for duplicate locally first
    if (cancellationCodes.some(c => c.code === newCode.code)) {
      alert('A code with this identifier already exists.');
      return;
    }
    try {
      const res = await fetch('/api/cancellation-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...newCode, createdBy: currentUserId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to save code: ${err.error || 'Unknown error'}`);
        return;
      }
      const data = await res.json();
      if (data.success) {
        // Refresh from DB to get server-generated timestamps
        await loadCodesFromDB();
      }
    } catch (err: any) {
      console.error('Failed to add cancellation code:', err);
      alert('Failed to save code. Please try again.');
    }
  };

  const handleEditCode = async (oldCode: string, newCode: CancellationCode) => {
    try {
      // If the code string changed, delete old and insert new
      if (oldCode !== newCode.code) {
        await fetch(`/api/cancellation-codes/${encodeURIComponent(oldCode)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      }
      const res = await fetch('/api/cancellation-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...newCode, createdBy: currentUserId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to update code: ${err.error || 'Unknown error'}`);
        return;
      }
      await loadCodesFromDB();
    } catch (err: any) {
      console.error('Failed to edit cancellation code:', err);
      alert('Failed to update code. Please try again.');
    }
  };

  const handleToggleActive = async (code: string) => {
    try {
      const res = await fetch(`/api/cancellation-codes/${encodeURIComponent(code)}/toggle`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to toggle code: ${err.error || 'Unknown error'}`);
        return;
      }
      // Optimistic update: flip locally while waiting for DB refresh
      setCancellationCodes(prev =>
        prev.map(c => c.code === code ? { ...c, isActive: !c.isActive } : c)
      );
    } catch (err: any) {
      console.error('Failed to toggle cancellation code:', err);
      alert('Failed to update code. Please try again.');
    }
  };

  const handleDeleteCode = async (code: string) => {
    try {
      const res = await fetch(`/api/cancellation-codes/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to delete code: ${err.error || 'Unknown error'}`);
        return;
      }
      setCancellationCodes(prev => prev.filter(c => c.code !== code));
    } catch (err: any) {
      console.error('Failed to delete cancellation code:', err);
      alert('Failed to delete code. Please try again.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-white mb-1">AC History</h1>
        <p className="text-gray-400">
          View cancellation analytics, aircraft availability trends, and manage cancellation codes.
        </p>
      </div>

      {/* AC History - Aircraft Availability */}
      <ACHistoryAircraftAvailability
        currentUserId={currentUserId}
        currentAircraftAvailable={currentAircraftAvailable}
        totalAircraft={totalAircraft}
      />

      {/* Recent Cancellations Table */}
      <RecentCancellationsTable
        cancellationRecords={cancellationRecords}
        cancellationCodes={cancellationCodes}
      />

      {/* AC History Analytics */}
      <ACHistoryAnalytics
        cancellationRecords={cancellationRecords}
        cancellationCodes={cancellationCodes}
      />

      {/* ── Cancellation Codes Master Table (bottom) ── */}
      <div>
        {codesError && (
          <div className="mb-3 px-4 py-2 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm flex items-center gap-2">
            <span>⚠️ {codesError}</span>
            <button
              onClick={loadCodesFromDB}
              className="ml-auto text-xs underline hover:text-red-100"
            >
              Retry
            </button>
          </div>
        )}
        <CancellationCodesTable
          codes={cancellationCodes}
          onAddCode={handleAddCode}
          onEditCode={handleEditCode}
          onToggleActive={handleToggleActive}
          onDeleteCode={handleDeleteCode}
          canEdit={canEdit}
          usedCodes={usedCodes}
          isLoading={codesLoading}
        />
      </div>
    </div>
  );
};

export default ACHistoryPage;