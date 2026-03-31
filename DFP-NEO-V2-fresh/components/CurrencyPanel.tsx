import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MasterCurrency, CurrencyRequirement, PersonCurrencyStatus } from '../types';

interface CurrencyPanelProps {
  personId: string | undefined;        // DB string UUID (Personnel.id or Trainee.id) — falls back to idNumber
  idNumber?: number;                   // Numeric idNumber — used as fallback when personId is undefined
  personType: 'instructor' | 'trainee';
  personName: string;
  masterCurrencies: MasterCurrency[];
  currencyRequirements: CurrencyRequirement[];
  initialCurrencyStatus?: PersonCurrencyStatus[];
  onCurrencyStatusChange?: (newStatus: PersonCurrencyStatus[]) => void;
  /** Called whenever edit/saving state changes so parent can render its own Edit/Save/Cancel buttons */
  onEditStateChange?: (state: { isEditing: boolean; isSaving: boolean; onEdit: () => void; onSave: () => void; onCancel: () => void }) => void;
  /** Auth user ID (AuthUser.id) for audit logging */
  currentUserId?: string;
  /** Display name of current user for audit logging */
  currentUserName?: string;
}

const AMBER_THRESHOLD_DAYS = 30;

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '---';
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });
}

function addDaysToDate(dateStr: string, days: number): string {
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

function getStatusDotColor(daysRemaining: number | null): string {
  if (daysRemaining === null) return 'bg-gray-600';
  if (daysRemaining <= 0) return 'bg-red-500';
  if (daysRemaining <= 7) return 'bg-amber-400';
  return 'bg-green-500';
}

function getDaysColor(days: number): string {
  if (days <= 0) return 'text-red-400';
  if (days < 30) return 'text-red-400';
  if (days < 61) return 'text-amber-400';
  return 'text-green-400';
}

function getPeriodText(validityDays: number | null): string {
  if (validityDays === null) return 'Complex';
  if (validityDays === 365) return '12 Months';
  return `${validityDays} Days`;
}

type StatusBucket = 'expired' | 'approaching' | 'current' | 'unassigned';

const BUCKET_ORDER: StatusBucket[] = ['expired', 'approaching', 'current', 'unassigned'];

function getBucket(daysRemaining: number | null): StatusBucket {
  if (daysRemaining === null) return 'unassigned';
  if (daysRemaining <= 0) return 'expired';
  if (daysRemaining <= AMBER_THRESHOLD_DAYS) return 'approaching';
  return 'current';
}

const CurrencyPanel: React.FC<CurrencyPanelProps> = ({
  personId,
  idNumber,
  personType,
  personName,
  masterCurrencies,
  currencyRequirements,
  initialCurrencyStatus,
  onCurrencyStatusChange,
  onEditStateChange,
  currentUserId,
  currentUserName,
}) => {
  // Use UUID if available, otherwise fall back to numeric idNumber
  const resolvedId = personId || (idNumber !== undefined ? String(idNumber) : undefined);
  const [currencyStatus, setCurrencyStatus] = useState<PersonCurrencyStatus[]>(initialCurrencyStatus || []);
  const [isEditing, setIsEditing] = useState(false);
  const [editedStatuses, setEditedStatuses] = useState<Map<string, string>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  

  // Load currency status from API on mount
  useEffect(() => {
    if (!resolvedId) return;
    setIsLoading(true);
    const endpoint = personType === 'instructor'
      ? `/api/personnel/${resolvedId}/currencies`
      : `/api/trainees/${resolvedId}/currencies`;

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
  }, [resolvedId, personType]);

  // All visible currency definitions (masters + primitives), sorted by name
  const visibleCurrencyDefinitions = useMemo(() => {
    return [...masterCurrencies.filter(c => c.isVisible), ...currencyRequirements.filter(c => c.isVisible)]
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [masterCurrencies, currencyRequirements]);

  const getCurrencyStatus = (currencyName: string): PersonCurrencyStatus | undefined => {
    return currencyStatus.find(c => c.currencyName === currencyName);
  };

  // Summary counts for the header badges
  const summaryCount = useMemo(() => {
    const counts = { expired: 0, approaching: 0, current: 0, unassigned: 0 };
    visibleCurrencyDefinitions.forEach(def => {
      const record = getCurrencyStatus(def.name);
      const lastEventDate = record?.lastEventDate || '';
      const validityDays = 'validityDays' in def ? def.validityDays : 365;
      const expiryDate = lastEventDate ? addDaysToDate(lastEventDate, validityDays) : '';
      const days = expiryDate ? getDaysRemaining(expiryDate) : null;
      counts[getBucket(days)]++;
    });
    return counts;
  }, [visibleCurrencyDefinitions, currencyStatus]);

  const handleEditClick = () => {
    const initialMap = new Map<string, string>();
    visibleCurrencyDefinitions.forEach(def => {
      const status = getCurrencyStatus(def.name);
      initialMap.set(def.name, status?.lastEventDate || '');
    });
    setEditedStatuses(initialMap);
    setIsEditing(true);
    setSaveError(null);
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setEditedStatuses(new Map());
    setSaveError(null);
  };

  const handleDateChange = (currencyName: string, date: string) => {
    setEditedStatuses(prev => new Map(prev).set(currencyName, date));
  };

  const handleSaveClick = useCallback(async () => {
    if (!resolvedId) return;
    setIsSaving(true);
    setSaveError(null);

    const newStatus: PersonCurrencyStatus[] = [];
    visibleCurrencyDefinitions.forEach(def => {
      const editedDate = editedStatuses.get(def.name);
      if (editedDate) {
        const validityDays = 'validityDays' in def ? def.validityDays : 365;
        const expiryDate = addDaysToDate(editedDate, validityDays);
        const daysRem = getDaysRemaining(expiryDate);
        newStatus.push({
          currencyName: def.name,
          lastEventDate: editedDate,
          calculatedExpiry: expiryDate,
          isCurrent: daysRem > 0,
        });
      }
    });

    // Preserve statuses for currencies not in visible list
    currencyStatus.forEach(status => {
      if (!visibleCurrencyDefinitions.some(def => def.name === status.currencyName)) {
        if (!editedStatuses.has(status.currencyName)) {
          newStatus.push(status);
        }
      }
    });

    const endpoint = personType === 'instructor'
      ? `/api/personnel/${resolvedId}/currencies`
      : `/api/trainees/${resolvedId}/currencies`;

    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currencyStatus: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || `HTTP ${res.status}`);
      }
      setCurrencyStatus(newStatus);
      setIsEditing(false);
      setEditedStatuses(new Map());
      onCurrencyStatusChange?.(newStatus);

      // Write audit entry to DB (fire-and-forget)
      try {
        const changes: { currencyName: string; oldDate: string; newDate: string }[] = [];
        editedStatuses.forEach((newDate, currencyName) => {
          const oldRecord = currencyStatus.find(c => c.currencyName === currencyName);
          const oldDate = oldRecord?.lastEventDate || '';
          if (newDate !== oldDate) {
            changes.push({ currencyName, oldDate, newDate });
          }
        });
        currencyStatus.forEach(s => {
          if (!editedStatuses.has(s.currencyName) &&
              visibleCurrencyDefinitions.some(d => d.name === s.currencyName)) {
            changes.push({ currencyName: s.currencyName, oldDate: s.lastEventDate, newDate: '' });
          }
        });
        if (changes.length > 0) {
          fetch('/api/audit/currency', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personId: resolvedId,
              personName,
              personType,
              userId: currentUserId,
              userName: currentUserName || 'Unknown',
              changes,
            }),
          }).catch(e => console.warn('[CurrencyPanel] Audit log failed:', e));
        }
      } catch (auditErr) {
        console.warn('[CurrencyPanel] Audit log error:', auditErr);
      }
    } catch (err: any) {
      setSaveError(err.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [resolvedId, personType, visibleCurrencyDefinitions, editedStatuses, currencyStatus, onCurrencyStatusChange, personName, currentUserId, currentUserName]);

  // Notify parent of current edit state and control handlers
  useEffect(() => {
    onEditStateChange?.({
      isEditing,
      isSaving,
      onEdit: handleEditClick,
      onSave: handleSaveClick,
      onCancel: handleCancelClick,
    });
  }, [isEditing, isSaving]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-400 text-xs animate-pulse">Loading currency data…</div>
      </div>
    );
  }

  if (visibleCurrencyDefinitions.length === 0) {
    return (
      <div className="text-gray-500 text-xs italic text-center py-6">
        No currency definitions configured. Set up currencies in the Currency Builder.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Summary badges row */}
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
            {summaryCount.unassigned} Unset
          </span>
        )}
      </div>

      {saveError && (
        <div className="text-red-400 text-[10px] bg-red-900/30 border border-red-700/40 rounded px-2 py-1">
          ⚠ {saveError}
        </div>
      )}

      {/* Currency Table — matches CurrencyView layout, compressed */}
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        <table className="min-w-full divide-y divide-gray-700 text-[11px]">
          <thead className="bg-gray-700/50">
            <tr>
              <th scope="col" className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wider w-8"></th>
              <th scope="col" className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider">Currency</th>
              <th scope="col" className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Period</th>
              <th scope="col" className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Last Event</th>
              <th scope="col" className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Expires</th>
              <th scope="col" className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Days Rem.</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700/60">
            {visibleCurrencyDefinitions.map(def => {
              const periodInDays = 'validityDays' in def ? def.validityDays : null;
              const periodText = getPeriodText(periodInDays);
              const validityDays = periodInDays ?? 365;

              // In edit mode, use editedStatuses; otherwise use saved currencyStatus
              const statusDateStr = isEditing
                ? editedStatuses.get(def.name)
                : getCurrencyStatus(def.name)?.lastEventDate;

              const lastEventDate = statusDateStr ? parseDate(statusDateStr) : null;
              const expiryDateStr = statusDateStr ? addDaysToDate(statusDateStr, validityDays) : '';
              const expiryDate = expiryDateStr ? parseDate(expiryDateStr) : null;
              const daysRemaining = expiryDateStr ? getDaysRemaining(expiryDateStr) : null;

              const dotColor = getStatusDotColor(daysRemaining);
              const daysColor = daysRemaining !== null ? getDaysColor(daysRemaining) : 'text-gray-500';

              return (
                <tr key={def.name} className="hover:bg-gray-700/40 transition-colors">
                  {/* Status dot */}
                  <td className="px-2 py-1.5 text-center">
                    <div className={`w-2.5 h-2.5 rounded-sm mx-auto ${dotColor}`} />
                  </td>
                  {/* Currency name */}
                  <td className="px-2 py-1.5 font-medium text-gray-200 max-w-[160px]">
                    <span className="block truncate" title={def.name}>{def.name}</span>
                  </td>
                  {/* Period */}
                  <td className="px-2 py-1.5 text-center text-gray-400 whitespace-nowrap">{periodText}</td>
                  {/* Last Event — date input in edit mode */}
                  <td className="px-2 py-1.5 text-center text-gray-300 font-mono">
                    {isEditing ? (
                      <input
                        type="date"
                        value={editedStatuses.get(def.name) || ''}
                        onChange={(e) => handleDateChange(def.name, e.target.value)}
                        className="h-[20px] text-[10px] bg-gray-700 border border-gray-600 rounded px-1 text-white focus:outline-none focus:ring-1 focus:ring-sky-500 w-[110px]"
                        style={{ colorScheme: 'dark' }}
                      />
                    ) : (
                      lastEventDate
                        ? lastEventDate.toLocaleDateString('en-GB', { timeZone: 'UTC' })
                        : '---'
                    )}
                  </td>
                  {/* Expires */}
                  <td className="px-2 py-1.5 text-center text-gray-300 font-mono whitespace-nowrap">
                    {expiryDate
                      ? expiryDate.toLocaleDateString('en-GB', { timeZone: 'UTC' })
                      : '---'}
                  </td>
                  {/* Days Remaining */}
                  <td className={`px-2 py-1.5 text-center font-bold whitespace-nowrap ${daysColor}`}>
                    {daysRemaining !== null ? daysRemaining : '---'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CurrencyPanel;