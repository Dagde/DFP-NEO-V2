import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MasterCurrency, CurrencyRequirement, PersonCurrencyStatus } from '../types';

// Module-level cache: survives component unmount/remount
// Key: resolvedId (UUID or idNumber string), Value: last successfully saved currency status
// Exported so external saves (e.g. Post Flight) can invalidate the cache
// ensuring CurrencyPanel always fetches fresh data after an external update
export const savedCurrencyCache = new Map<string, PersonCurrencyStatus[]>();

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

  // On mount, initialise state from module-level cache (survives tab close/reopen)
  // Falls back to initialCurrencyStatus prop, then empty array
  const cachedStatus = resolvedId ? (savedCurrencyCache.get(resolvedId) ?? null) : null;

  const [currencyStatus, setCurrencyStatus] = useState<PersonCurrencyStatus[]>(
    cachedStatus || initialCurrencyStatus || []
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editedStatuses, setEditedStatuses] = useState<Map<string, string>>(new Map());
  // Track active/inactive state per currency in edit mode
  const [editedInactive, setEditedInactive] = useState<Map<string, boolean>>(new Map());
  // Track the original values at the time Edit was clicked
  const [originalStatuses, setOriginalStatuses] = useState<Map<string, string>>(new Map());
  const [originalInactive, setOriginalInactive] = useState<Map<string, boolean>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Load currency status from API on mount
  useEffect(() => {
    if (!resolvedId) return;

    // Always fetch fresh from the API — this ensures Post Flight saves
    // (and any other external saves) are always reflected.
    // The cache is used only to pre-populate state immediately (no flicker)
    // but we still fetch to get the latest DB data.
    const endpoint = personType === 'instructor'
      ? `/api/personnel/${resolvedId}/currencies`
      : `/api/trainees/${resolvedId}/currencies`;

    console.log(`[CurrencyPanel] Fetching currencies from: ${endpoint} (resolvedId=${resolvedId})`);
    setIsLoading(true);

    fetch(endpoint, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => {
        const status: PersonCurrencyStatus[] = Array.isArray(data.currencyStatus) ? data.currencyStatus : [];
        console.log(`[CurrencyPanel] Fetched ${status.length} currency record(s):`, JSON.stringify(status));
        setCurrencyStatus(status);
      })
      .catch(err => {
        console.warn('[CurrencyPanel] Could not load from API, using initial:', err);
        if (initialCurrencyStatus) setCurrencyStatus(initialCurrencyStatus);
      })
      .finally(() => setIsLoading(false));
  }, [resolvedId, personType]);

  // All visible currency definitions (masters + primitives)
  // Sorted: active currencies alphabetically first, then inactive currencies alphabetically at the bottom
  // Uses saved currencyStatus isInactive flag for sort order (editedInactive used only per-row in render)
  const visibleCurrencyDefinitions = useMemo(() => {
    const all = [...masterCurrencies.filter(c => c.isVisible), ...currencyRequirements.filter(c => c.isVisible)];
    return all.sort((a, b) => {
      const aInactive = !!currencyStatus.find(s => s.currencyName === a.name)?.isInactive;
      const bInactive = !!currencyStatus.find(s => s.currencyName === b.name)?.isInactive;
      if (aInactive !== bInactive) return aInactive ? 1 : -1; // active first
      return a.name.localeCompare(b.name); // then alphabetical within each group
    });
  }, [masterCurrencies, currencyRequirements, currencyStatus]);

  // Sorted list for rendering — in edit mode, re-sort using editedInactive so toggling
  // immediately moves rows to active/inactive section without needing to save first
  const sortedCurrencyDefinitions = useMemo(() => {
    if (!isEditing || editedInactive.size === 0) return visibleCurrencyDefinitions;
    return [...visibleCurrencyDefinitions].sort((a, b) => {
      const aInactive = !!editedInactive.get(a.name);
      const bInactive = !!editedInactive.get(b.name);
      if (aInactive !== bInactive) return aInactive ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [visibleCurrencyDefinitions, isEditing, editedInactive]);

  const getCurrencyStatus = (currencyName: string): PersonCurrencyStatus | undefined => {
    return currencyStatus.find(c => c.currencyName === currencyName);
  };

  // Summary counts for the header badges — inactive currencies are excluded
  const summaryCount = useMemo(() => {
    const counts = { expired: 0, approaching: 0, current: 0, unassigned: 0 };
    visibleCurrencyDefinitions.forEach(def => {
      const record = getCurrencyStatus(def.name);
      // Skip inactive currencies — they don't count toward overall currency status
      if (record?.isInactive) return;
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
    const inactiveMap = new Map<string, boolean>();
    visibleCurrencyDefinitions.forEach(def => {
      const status = getCurrencyStatus(def.name);
      initialMap.set(def.name, status?.lastEventDate || '');
      inactiveMap.set(def.name, !!status?.isInactive);
    });
    setEditedStatuses(new Map(initialMap));
    setOriginalStatuses(new Map(initialMap));
    setEditedInactive(new Map(inactiveMap));
    setOriginalInactive(new Map(inactiveMap));
    setIsEditing(true);
    setSaveError(null);
    setSaveSuccessMessage(null);
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setEditedStatuses(new Map());
    setOriginalStatuses(new Map());
    setEditedInactive(new Map());
    setOriginalInactive(new Map());
    setSaveError(null);
  };

  const handleToggleInactive = (currencyName: string) => {
    setEditedInactive(prev => {
      const next = new Map(prev);
      next.set(currencyName, !prev.get(currencyName));
      return next;
    });
  };

  const handleDateChange = (currencyName: string, date: string) => {
    setEditedStatuses(prev => new Map(prev).set(currencyName, date));
  };

  const handleSaveClick = useCallback(async () => {
    if (!resolvedId) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccessMessage(null);

    const newStatus: PersonCurrencyStatus[] = [];
    console.log('[CurrencyPanel] handleSaveClick — currencyStatus before save:', JSON.stringify(currencyStatus));
    console.log('[CurrencyPanel] editedStatuses:', JSON.stringify(Array.from(editedStatuses.entries())));
    console.log('[CurrencyPanel] originalStatuses:', JSON.stringify(Array.from(originalStatuses.entries())));

    visibleCurrencyDefinitions.forEach(def => {
      const editedDate = editedStatuses.get(def.name);
      const originalDate = originalStatuses.get(def.name);
      const isNowInactive = !!editedInactive.get(def.name);

      if (editedDate !== undefined) {
        if (editedDate) {
          const validityDays = 'validityDays' in def ? def.validityDays : 365;
          const expiryDate = addDaysToDate(editedDate, validityDays);
          const daysRem = getDaysRemaining(expiryDate);
          newStatus.push({
            currencyName: def.name,
            lastEventDate: editedDate,
            calculatedExpiry: expiryDate,
            isCurrent: !isNowInactive && daysRem > 0,
            isInactive: isNowInactive || undefined,
          });
        } else {
          if (originalDate) {
            // User actively cleared a field that had a value — honour the clear (remove it)
            // But preserve isInactive flag if set
            console.log('[CurrencyPanel] User cleared ' + def.name + ' (was: ' + originalDate + ')');
            if (isNowInactive) {
              newStatus.push({ currencyName: def.name, lastEventDate: '', isInactive: true });
            }
          } else {
            // Field was already empty when edit started — preserve any existing DB record
            const existing = currencyStatus.find(s => s.currencyName === def.name);
            if (existing) {
              console.log('[CurrencyPanel] Preserving existing ' + def.name + ':', existing.lastEventDate);
              newStatus.push({ ...existing, isInactive: isNowInactive || existing.isInactive });
            } else if (isNowInactive) {
              newStatus.push({ currencyName: def.name, lastEventDate: '', isInactive: true });
            }
          }
        }
      } else {
        const existing = currencyStatus.find(s => s.currencyName === def.name);
        if (existing) {
          newStatus.push({ ...existing, isInactive: isNowInactive || existing.isInactive });
        }
      }
    });

    // Preserve statuses for currencies not in visible list
    currencyStatus.forEach(status => {
      if (!visibleCurrencyDefinitions.some(def => def.name === status.currencyName)) {
        newStatus.push(status);
      }
    });

    console.log('[CurrencyPanel] newStatus to save:', JSON.stringify(newStatus));

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

      console.log('[CurrencyPanel] ✅ Save successful — updating local state with', newStatus.length, 'records');

      // Store in module-level cache — survives component unmount/remount
      // This means closing and reopening the tab will show saved data immediately
      if (resolvedId) {
        savedCurrencyCache.set(resolvedId, newStatus);
        console.log(`[CurrencyPanel] Cached saved status for ${resolvedId}`);
      }

      // Update local state immediately — this is what the user sees
      setCurrencyStatus(newStatus);
      setIsEditing(false);
      setEditedStatuses(new Map());
      setOriginalStatuses(new Map());
      setSaveSuccessMessage(`✅ Saved ${newStatus.length} currency entries`);

      // Notify parent with the new status — parent should store this
      onCurrencyStatusChange?.(newStatus);

      // Write audit entry to DB (fire-and-forget)
      try {
        const changes: { currencyName: string; oldDate: string; newDate: string; activeChanged?: boolean; isNowInactive?: boolean }[] = [];
        editedStatuses.forEach((newDate, currencyName) => {
          const oldRecord = currencyStatus.find(c => c.currencyName === currencyName);
          const oldDate = oldRecord?.lastEventDate || '';
          const wasInactive = !!oldRecord?.isInactive;
          const isNowInactive = !!editedInactive.get(currencyName);
          const dateChanged = newDate !== oldDate;
          const activeChanged = wasInactive !== isNowInactive;
          if (dateChanged || activeChanged) {
            changes.push({ currencyName, oldDate, newDate, activeChanged, isNowInactive });
          }
        });
        // Also check any currency not in editedStatuses (e.g. only inactive toggled)
        visibleCurrencyDefinitions.forEach(def => {
          if (!editedStatuses.has(def.name)) {
            const oldRecord = currencyStatus.find(c => c.currencyName === def.name);
            const wasInactive = !!oldRecord?.isInactive;
            const isNowInactive = !!editedInactive.get(def.name);
            if (wasInactive !== isNowInactive) {
              changes.push({ currencyName: def.name, oldDate: oldRecord?.lastEventDate || '', newDate: oldRecord?.lastEventDate || '', activeChanged: true, isNowInactive });
            }
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
      console.error('[CurrencyPanel] ❌ Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [resolvedId, personType, visibleCurrencyDefinitions, editedStatuses, editedInactive, originalInactive, currencyStatus, onCurrencyStatusChange, personName, currentUserId, currentUserName, originalStatuses]);

  // Notify parent of current edit state and control handlers
  // IMPORTANT: handleSaveClick must be in deps so parent always has the latest version
  // (which captures the current editedStatuses map with user's entered dates)
  useEffect(() => {
    onEditStateChange?.({
      isEditing,
      isSaving,
      onEdit: handleEditClick,
      onSave: handleSaveClick,
      onCancel: handleCancelClick,
    });
  }, [isEditing, isSaving, handleSaveClick]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-clear success message after 4 seconds
  useEffect(() => {
    if (!saveSuccessMessage) return;
    const t = setTimeout(() => setSaveSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [saveSuccessMessage]);

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

      {saveSuccessMessage && (
        <div className="text-green-400 text-[10px] bg-green-900/30 border border-green-700/40 rounded px-2 py-1">
          {saveSuccessMessage}
        </div>
      )}

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
              {isEditing && (
                <th scope="col" className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700/60">
            {sortedCurrencyDefinitions.map((def, idx) => {
              const record = getCurrencyStatus(def.name);
              // In edit mode, use editedInactive map; otherwise use saved record
              const isInactive = isEditing ? !!editedInactive.get(def.name) : !!record?.isInactive;

              // Show a divider row before the first inactive currency
              const prevIsInactive = idx > 0
                ? (isEditing ? !!editedInactive.get(sortedCurrencyDefinitions[idx - 1].name) : !!currencyStatus.find(s => s.currencyName === sortedCurrencyDefinitions[idx - 1].name)?.isInactive)
                : false;
              const showDivider = isInactive && !prevIsInactive && idx > 0;
              const periodInDays = 'validityDays' in def ? def.validityDays : null;
              const periodText = getPeriodText(periodInDays);
              const validityDays = periodInDays ?? 365;

              // In edit mode, use editedStatuses; otherwise use saved currencyStatus
              const statusDateStr = isEditing
                ? editedStatuses.get(def.name)
                : record?.lastEventDate;

              const lastEventDate = statusDateStr ? parseDate(statusDateStr) : null;
              const expiryDateStr = (!isInactive && statusDateStr) ? addDaysToDate(statusDateStr, validityDays) : '';
              const expiryDate = expiryDateStr ? parseDate(expiryDateStr) : null;
              const daysRemaining = (!isInactive && expiryDateStr) ? getDaysRemaining(expiryDateStr) : null;

              const dotColor = isInactive ? 'bg-gray-600' : getStatusDotColor(daysRemaining);
              const daysColor = isInactive ? 'text-gray-400' : (daysRemaining !== null ? getDaysColor(daysRemaining) : 'text-gray-500');
              const rowClass = isInactive ? 'bg-gray-800/50 hover:bg-gray-700/40 transition-colors' : 'hover:bg-gray-700/40 transition-colors';

              return (
                <React.Fragment key={def.name}>
                  {showDivider && (
                    <tr>
                      <td colSpan={isEditing ? 7 : 6} className="px-2 py-1 bg-gray-700/30">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-px bg-gray-600/60" />
                          <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Inactive Currencies</span>
                          <div className="flex-1 h-px bg-gray-600/60" />
                        </div>
                      </td>
                    </tr>
                  )}
                <tr className={rowClass}>
                  {/* Status dot */}
                  <td className="px-2 py-1.5 text-center">
                    <div className={`w-2.5 h-2.5 rounded-sm mx-auto ${dotColor}`} />
                  </td>
                  {/* Currency name */}
                  <td className="px-2 py-1.5 font-medium max-w-[160px]">
                    <div className="flex items-center">
                      <span className={`${isInactive ? 'text-gray-400' : 'text-gray-200'}`} title={def.name}>{def.name}</span>
                      {isInactive && <span className="ml-2 text-[9px] text-gray-400 font-normal">Inactive</span>}
                    </div>
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
                    {isInactive ? '---' : expiryDate
                      ? expiryDate.toLocaleDateString('en-GB', { timeZone: 'UTC' })
                      : '---'}
                  </td>
                  {/* Days Remaining */}
                  <td className={`px-2 py-1.5 text-center font-bold whitespace-nowrap ${daysColor}`}>
                    {isInactive ? '---' : daysRemaining !== null ? daysRemaining : '---'}
                  </td>
                  {/* Active/Inactive toggle — only in edit mode */}
                  {isEditing && (
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleInactive(def.name)}
                        title={isInactive ? 'Set Active' : 'Set Inactive'}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isInactive ? 'bg-gray-600' : 'bg-sky-600'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isInactive ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <div className={`text-[9px] mt-0.5 font-medium ${isInactive ? 'text-gray-400' : 'text-sky-400'}`}>
                        {isInactive ? 'Inactive' : 'Active'}
                      </div>
                    </td>
                  )}
                </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CurrencyPanel;