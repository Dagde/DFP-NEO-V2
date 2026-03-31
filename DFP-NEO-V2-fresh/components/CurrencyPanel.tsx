import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MasterCurrency, CurrencyRequirement, PersonCurrencyStatus } from '../types';

interface CurrencyPanelProps {
  personId: string | undefined;        // DB string id (Personnel.id or Trainee.id)
  personType: 'instructor' | 'trainee';
  personName: string;
  masterCurrencies: MasterCurrency[];
  currencyRequirements: CurrencyRequirement[];
  initialCurrencyStatus?: PersonCurrencyStatus[];
  onCurrencyStatusChange?: (newStatus: PersonCurrencyStatus[]) => void;
}

// How many days before expiry is "approaching" (amber)
const AMBER_THRESHOLD_DAYS = 30;

type StatusBucket = 'expired' | 'approaching' | 'current' | 'unassigned';

interface CurrencyRowData {
  id: string;
  name: string;
  validityDays: number;
  lastRenewalDate: string;   // empty if unassigned
  expiryDate: string;        // empty if unassigned
  daysRemaining: number | null;  // null if unassigned
  bucket: StatusBucket;
  isActive: boolean;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' });
}

function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  if (!d) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDaysRemaining(expiryDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = parseDate(expiryDateStr);
  if (!expiry) return 0;
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
}

const BUCKET_ORDER: StatusBucket[] = ['expired', 'approaching', 'current', 'unassigned'];

const bucketColor: Record<StatusBucket, string> = {
  expired: 'text-red-400',
  approaching: 'text-amber-400',
  current: 'text-green-400',
  unassigned: 'text-gray-500',
};

const bucketBadgeBg: Record<StatusBucket, string> = {
  expired: 'bg-red-600/30 border border-red-500/60',
  approaching: 'bg-amber-600/30 border border-amber-500/60',
  current: 'bg-green-600/30 border border-green-500/60',
  unassigned: 'bg-gray-700/40 border border-gray-600/40',
};

const bucketDotColor: Record<StatusBucket, string> = {
  expired: 'bg-red-500',
  approaching: 'bg-amber-400',
  current: 'bg-green-500',
  unassigned: 'bg-gray-500',
};

const CurrencyPanel: React.FC<CurrencyPanelProps> = ({
  personId,
  personType,
  personName,
  masterCurrencies,
  currencyRequirements,
  initialCurrencyStatus,
  onCurrencyStatusChange,
}) => {
  const [currencyStatus, setCurrencyStatus] = useState<PersonCurrencyStatus[]>(initialCurrencyStatus || []);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({}); // id → lastRenewalDate
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load currency status from API on mount
  useEffect(() => {
    if (!personId) return;
    setIsLoading(true);
    const endpoint = personType === 'instructor'
      ? `/api/personnel/${personId}/currencies`
      : `/api/trainees/${personId}/currencies`;

    fetch(endpoint, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => {
        const status: PersonCurrencyStatus[] = Array.isArray(data.currencyStatus) ? data.currencyStatus : [];
        setCurrencyStatus(status);
      })
      .catch(err => {
        console.warn('[CurrencyPanel] Could not load from API, using initial:', err);
        if (initialCurrencyStatus) setCurrencyStatus(initialCurrencyStatus);
      })
      .finally(() => setIsLoading(false));
  }, [personId, personType]);

  // All visible currency definitions (masters + primitives), sorted by name
  const allCurrencies = useMemo(() => {
    return [...masterCurrencies.filter(c => c.isVisible), ...currencyRequirements.filter(c => c.isVisible)]
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [masterCurrencies, currencyRequirements]);

  // Build row data with computed status
  const rows: CurrencyRowData[] = useMemo(() => {
    return allCurrencies.map(def => {
      // currencyStatus uses currencyName which maps to the def.name (per CurrencyView.tsx)
      const record = currencyStatus.find(c => c.currencyName === def.name || c.currencyName === def.id);
      const lastRenewal = record?.lastEventDate || '';
      const validityDays = 'validityDays' in def ? def.validityDays : 365;
      const expiryDate = lastRenewal ? (record?.calculatedExpiry || addDays(lastRenewal, validityDays)) : '';
      const daysRemaining = expiryDate ? getDaysRemaining(expiryDate) : null;

      let bucket: StatusBucket = 'unassigned';
      if (daysRemaining !== null) {
        if (daysRemaining <= 0) bucket = 'expired';
        else if (daysRemaining <= AMBER_THRESHOLD_DAYS) bucket = 'approaching';
        else bucket = 'current';
      }

      return {
        id: def.id,
        name: def.name,
        validityDays,
        lastRenewalDate: lastRenewal,
        expiryDate,
        daysRemaining,
        bucket,
        isActive: !!lastRenewal,
      };
    });
  }, [allCurrencies, currencyStatus]);

  // Sort rows by bucket order
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ai = BUCKET_ORDER.indexOf(a.bucket);
      const bi = BUCKET_ORDER.indexOf(b.bucket);
      if (ai !== bi) return ai - bi;
      // Within same bucket, sort expired/approaching by days remaining asc, others by name
      if (a.bucket === 'expired' || a.bucket === 'approaching') {
        return (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0);
      }
      return a.name.localeCompare(b.name);
    });
  }, [rows]);

  const handleEditClick = () => {
    // Populate edit values
    const vals: Record<string, string> = {};
    sortedRows.forEach(r => {
      vals[r.id] = r.lastRenewalDate;
    });
    setEditValues(vals);
    setIsEditMode(true);
    setSaveError(null);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditValues({});
    setSaveError(null);
  };

  const handleSave = useCallback(async () => {
    if (!personId) return;
    setIsSaving(true);
    setSaveError(null);

    // Build new PersonCurrencyStatus array
    const newStatus: PersonCurrencyStatus[] = [];
    allCurrencies.forEach(def => {
      const date = editValues[def.id];
      if (date) {
        const validityDays = 'validityDays' in def ? def.validityDays : 365;
        const expiryDate = addDays(date, validityDays);
        const daysRem = getDaysRemaining(expiryDate);
        newStatus.push({
          currencyName: def.name,  // match what CurrencyView uses
          lastEventDate: date,
          calculatedExpiry: expiryDate,
          isCurrent: daysRem !== null && daysRem > 0,
        });
      }
    });

    const endpoint = personType === 'instructor'
      ? `/api/personnel/${personId}/currencies`
      : `/api/trainees/${personId}/currencies`;

    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currencyStatus: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setCurrencyStatus(newStatus);
      setIsEditMode(false);
      setEditValues({});
      onCurrencyStatusChange?.(newStatus);
    } catch (err: any) {
      setSaveError(err.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [personId, personType, allCurrencies, editValues, onCurrencyStatusChange]);

  const summaryCount = useMemo(() => {
    const counts = { expired: 0, approaching: 0, current: 0, unassigned: 0 };
    sortedRows.forEach(r => counts[r.bucket]++);
    return counts;
  }, [sortedRows]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-400 text-xs animate-pulse">Loading currency data…</div>
      </div>
    );
  }

  if (allCurrencies.length === 0) {
    return (
      <div className="text-gray-500 text-xs italic text-center py-6">
        No currency definitions configured. Set up currencies in the Currency Builder.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header row: summary badges + EDIT button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {summaryCount.expired > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600/40 text-red-300">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              {summaryCount.expired} Expired
            </span>
          )}
          {summaryCount.approaching > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-600/40 text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              {summaryCount.approaching} Expiring
            </span>
          )}
          {summaryCount.current > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-600/40 text-green-300">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              {summaryCount.current} Current
            </span>
          )}
          {summaryCount.unassigned > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-600/40 text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block" />
              {summaryCount.unassigned} Unassigned
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {!isEditMode ? (
            <button
              onClick={handleEditClick}
              className="w-[56px] h-[30px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed"
              title="Edit currency dates"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={handleCancelEdit}
                className="h-[30px] px-2 py-1 text-[10px] font-semibold rounded bg-gray-600 hover:bg-gray-500 text-white"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="h-[30px] px-2 py-1 text-[10px] font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {saveError && (
        <div className="text-red-400 text-[10px] bg-red-900/30 border border-red-700/40 rounded px-2 py-1">
          ⚠ {saveError}
        </div>
      )}

      {/* Currency grid - compact multi-column layout */}
      <div
        className="grid gap-x-2 gap-y-0.5"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        }}
      >
        {sortedRows.map(row => (
          <CurrencyRowItem
            key={row.id}
            row={row}
            isEditMode={isEditMode}
            editValue={editValues[row.id] ?? ''}
            onEditChange={(val) => setEditValues(prev => ({ ...prev, [row.id]: val }))}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Single currency row item ─────────────────────────────────────────────────

interface CurrencyRowItemProps {
  row: CurrencyRowData;
  isEditMode: boolean;
  editValue: string;
  onEditChange: (val: string) => void;
}

const CurrencyRowItem: React.FC<CurrencyRowItemProps> = ({ row, isEditMode, editValue, onEditChange }) => {
  const isActivated = isEditMode ? !!editValue : row.isActive;
  const bucket = isEditMode && editValue ? (() => {
    const expiry = addDays(editValue, row.validityDays);
    const days = getDaysRemaining(expiry);
    if (days <= 0) return 'expired' as StatusBucket;
    if (days <= AMBER_THRESHOLD_DAYS) return 'approaching' as StatusBucket;
    return 'current' as StatusBucket;
  })() : row.bucket;

  const displayExpiry = isEditMode && editValue
    ? formatDateDisplay(addDays(editValue, row.validityDays))
    : formatDateDisplay(row.expiryDate);

  const displayRenewal = isEditMode ? editValue : row.lastRenewalDate;

  return (
    <div className={`flex flex-col rounded px-1.5 py-1 ${bucketBadgeBg[isActivated ? bucket : 'unassigned']}`}>
      {/* Name + status dot */}
      <div className="flex items-center gap-1 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${bucketDotColor[isActivated ? bucket : 'unassigned']}`} />
        <span className={`text-[10px] font-medium truncate leading-tight ${bucketColor[isActivated ? bucket : 'unassigned']}`}
          title={row.name}>
          {row.name}
        </span>
      </div>

      {/* Dates row */}
      {isEditMode ? (
        <div className="flex items-center gap-1 mt-0.5 ml-2.5">
          <span className="text-[9px] text-gray-500 flex-shrink-0">Renewed:</span>
          <input
            type="date"
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            className="h-[18px] text-[9px] bg-gray-700 border border-gray-500 rounded px-1 text-white focus:outline-none focus:ring-1 focus:ring-sky-500 flex-1 min-w-0"
          />
          {editValue && (
            <span className="text-[9px] text-gray-400 flex-shrink-0">→ {displayExpiry}</span>
          )}
        </div>
      ) : (
        isActivated ? (
          <div className="flex items-center gap-1.5 mt-0.5 ml-2.5 flex-wrap">
            <span className="text-[9px] text-gray-500">Renewed: <span className="text-gray-300">{formatDateDisplay(displayRenewal)}</span></span>
            <span className="text-[9px] text-gray-500">Exp: <span className={`font-medium ${bucketColor[bucket]}`}>{displayExpiry}</span></span>
            {row.daysRemaining !== null && (
              <span className={`text-[9px] font-semibold ${bucketColor[bucket]}`}>
                {row.daysRemaining <= 0
                  ? `${Math.abs(row.daysRemaining)}d overdue`
                  : `${row.daysRemaining}d left`}
              </span>
            )}
          </div>
        ) : (
          <div className="ml-2.5 mt-0.5">
            <span className="text-[9px] text-gray-600 italic">Not set</span>
          </div>
        )
      )}
    </div>
  );
};

export default CurrencyPanel;