import React, { useState, useEffect, useCallback } from 'react';
import { Instructor, Trainee, MasterCurrency, CurrencyRequirement, CurrencyDefinition, PersonCurrencyStatus } from '../types';
import AuditButton from './AuditButton';
import { logAudit } from '../utils/auditLogger';

interface CurrencyStatusPageProps {
  person: Instructor | Trainee;
  personType?: 'instructor' | 'trainee'; // optional — detected from person shape if omitted
  masterCurrencies: MasterCurrency[];
  currencyRequirements: CurrencyRequirement[];
  onClose: () => void;
  registerDirtyCheck: (isDirty: () => boolean, onSave: () => void, onDiscard: () => void) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const CurrencyStatusPage: React.FC<CurrencyStatusPageProps> = ({
  person,
  personType: personTypeProp,
  masterCurrencies,
  currencyRequirements,
  onClose,
  registerDirtyCheck,
}) => {
  // All data lives here — loaded from DB on mount, saved to DB on save
  const [currencyStatus, setCurrencyStatus] = useState<PersonCurrencyStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editedDates, setEditedDates] = useState<Record<string, string>>({});
  // Track which currencies are toggled inactive during edit
  const [editedInactive, setEditedInactive] = useState<Record<string, boolean>>({});

  // Save feedback
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  // All visible currency definitions (sorted alphabetically)
  const allVisibleDefs: CurrencyDefinition[] = [...masterCurrencies, ...currencyRequirements]
    .filter(c => c.isVisible)
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── DETECT PERSON TYPE ────────────────────────────────────────────────────
  const personType: 'instructor' | 'trainee' = personTypeProp
    || ('course' in person ? 'trainee' : 'instructor');

  // ── BUILD API ENDPOINT ───────────────────────────────────────────────────
  const dbId = (person as any).id || person.idNumber;
  const currencyEndpoint = personType === 'trainee'
    ? `/api/trainees/${dbId}/currencies`
    : `/api/personnel/${dbId}/currencies`;

  console.log(`[CurrencyStatusPage] personType=${personType}, dbId=${dbId}, endpoint=${currencyEndpoint}`);

  // ── LOAD FROM DB ON MOUNT ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setIsEditing(false);
    setEditedDates({});
    setEditedInactive({});

    fetch(currencyEndpoint, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const loaded: PersonCurrencyStatus[] = Array.isArray(data.currencyStatus) ? data.currencyStatus : [];
        setCurrencyStatus(loaded);
        setIsLoading(false);
        console.log(`✅ CurrencyStatusPage loaded ${loaded.length} entries for ${personType} ${dbId}`);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('❌ CurrencyStatusPage load error:', err);
        setLoadError('Failed to load currency data. Please try again.');
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [currencyEndpoint]);

  // ── HELPERS ──────────────────────────────────────────────────────────────
  const getStatus = useCallback((name: string): PersonCurrencyStatus | undefined => {
    return currencyStatus.find(s => s.currencyName === name);
  }, [currencyStatus]);

  const getValidityDays = (def: CurrencyDefinition): number => {
    if (def.type === 'primitive') return (def as any).validityDays || 90;
    return 90;
  };

  const getDaysRemaining = (lastEventDate: string, validityDays: number): number => {
    const last = new Date(lastEventDate);
    last.setDate(last.getDate() + validityDays);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    last.setHours(0, 0, 0, 0);
    return Math.ceil((last.getTime() - today.getTime()) / 86400000);
  };

  const getStatusDotColor = (days: number | null, inactive: boolean): string => {
    if (inactive) return 'bg-gray-600';
    if (days === null) return 'bg-gray-600';
    if (days <= 0) return 'bg-red-500';
    if (days <= 30) return 'bg-amber-400';
    return 'bg-green-500';
  };

  const getDaysTextColor = (days: number | null, inactive: boolean): string => {
    if (inactive) return 'text-gray-500';
    if (days === null) return 'text-gray-400';
    if (days <= 0) return 'text-red-400';
    if (days <= 30) return 'text-amber-400';
    return 'text-green-400';
  };

  const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // ── SORTED DEFINITIONS ───────────────────────────────────────────────────
  // During editing: use editedInactive state. Otherwise: use saved isInactive flag.
  // Active currencies at top, inactive at bottom. Each group sorted alphabetically.
  const getSortedDefs = useCallback(() => {
    const active: CurrencyDefinition[] = [];
    const inactive: CurrencyDefinition[] = [];
    allVisibleDefs.forEach(def => {
      const isInactive = isEditing
        ? !!editedInactive[def.name]
        : !!(getStatus(def.name)?.isInactive);
      if (isInactive) {
        inactive.push(def);
      } else {
        active.push(def);
      }
    });
    return { active, inactive };
  }, [allVisibleDefs, isEditing, editedInactive, getStatus]);

  // ── EDIT MODE ────────────────────────────────────────────────────────────
  const handleEditClick = () => {
    const initialDates: Record<string, string> = {};
    const initialInactive: Record<string, boolean> = {};
    allVisibleDefs.forEach(def => {
      const s = getStatus(def.name);
      initialDates[def.name] = s?.lastEventDate || '';
      initialInactive[def.name] = !!s?.isInactive;
    });
    setEditedDates(initialDates);
    setEditedInactive(initialInactive);
    setIsEditing(true);
    setSaveState('idle');
  };

  const handleCancelClick = useCallback(() => {
    setIsEditing(false);
    setEditedDates({});
    setEditedInactive({});
    setSaveState('idle');
  }, []);

  const toggleInactive = (name: string) => {
    setEditedInactive(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // ── SAVE ────────────────────────────────────────────────────────────────
  const handleSaveClick = useCallback(async () => {
    // ─── Step 1: Fetch the LATEST currency status from DB ──────────────────
    let latestStatus: PersonCurrencyStatus[] = [...currencyStatus];
    try {
      const freshRes = await fetch(currencyEndpoint, { credentials: 'include' });
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        if (Array.isArray(freshData.currencyStatus)) {
          latestStatus = freshData.currencyStatus;
          console.log(`[CurrencyStatusPage] Fetched fresh before save: ${latestStatus.length} records`);
        }
      }
    } catch (freshErr) {
      console.warn('[CurrencyStatusPage] Could not fetch fresh before save, using loaded state:', freshErr);
    }

    // ─── Step 2: Build updated status ─────────────────────────────────────
    const newStatus: PersonCurrencyStatus[] = [...latestStatus];

    // Track changes for audit log
    const auditChanges: string[] = [];
    const personName = person.name || `${personType} ${dbId}`;

    allVisibleDefs.forEach(def => {
      const date = editedDates[def.name];
      const isNowInactive = !!editedInactive[def.name];
      const existingIdx = newStatus.findIndex(s => s.currencyName === def.name);
      const hadRecordAtEditStart = currencyStatus.find(s => s.currencyName === def.name);
      const wasInactive = !!(hadRecordAtEditStart?.isInactive);

      if (date !== undefined && date.trim()) {
        // User entered/kept a non-empty date — update or add
        const newRecord: PersonCurrencyStatus = existingIdx >= 0
          ? { ...newStatus[existingIdx], currencyName: def.name, lastEventDate: date.trim(), isInactive: isNowInactive }
          : { currencyName: def.name, lastEventDate: date.trim(), isInactive: isNowInactive };

        const oldDate = hadRecordAtEditStart?.lastEventDate || '';
        if (oldDate !== date.trim()) {
          auditChanges.push(`${def.name}: date ${oldDate ? formatDisplayDate(oldDate) : '(none)'} → ${formatDisplayDate(date.trim())}`);
        }
        if (wasInactive !== isNowInactive) {
          auditChanges.push(`${def.name}: ${isNowInactive ? 'set inactive' : 'set active'}`);
        }

        if (existingIdx >= 0) {
          newStatus[existingIdx] = newRecord;
        } else {
          newStatus.push(newRecord);
        }
      } else if (date === '') {
        const hadRecordAtEditStart2 = currencyStatus.find(s => s.currencyName === def.name);
        if (!hadRecordAtEditStart2) {
          // Field was empty when edit started — preserve any latestStatus record (e.g. from Post Flight)
          // But still apply inactive flag change if this record now exists in latestStatus
          if (existingIdx >= 0) {
            const updated = { ...newStatus[existingIdx], isInactive: isNowInactive };
            if (wasInactive !== isNowInactive) {
              auditChanges.push(`${def.name}: ${isNowInactive ? 'set inactive' : 'set active'}`);
            }
            newStatus[existingIdx] = updated;
          }
        } else {
          // User had a date and cleared it — remove it
          if (existingIdx >= 0) {
            auditChanges.push(`${def.name}: date removed (was ${formatDisplayDate(hadRecordAtEditStart2.lastEventDate)})`);
            newStatus.splice(existingIdx, 1);
          }
        }
      } else if (date === undefined && existingIdx >= 0) {
        // Not in editedDates map — still apply inactive toggle if it changed
        if (wasInactive !== isNowInactive) {
          newStatus[existingIdx] = { ...newStatus[existingIdx], isInactive: isNowInactive };
          auditChanges.push(`${def.name}: ${isNowInactive ? 'set inactive' : 'set active'}`);
        }
      }
    });

    // 1. Update local state IMMEDIATELY — user sees result right away
    setCurrencyStatus(newStatus);
    setIsEditing(false);
    setEditedDates({});
    setEditedInactive({});
    setSaveState('saving');
    setSaveMessage('Saving...');

    // 2. Log to audit trail
    if (auditChanges.length > 0) {
      logAudit(
        'Currency Status',
        'Edit',
        `Updated currency status for ${personName}`,
        auditChanges.join('; ')
      );
    }

    // 3. Save to database via PATCH endpoint
    try {
      const response = await fetch(currencyEndpoint, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currencyStatus: newStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ CurrencyStatusPage save failed:', data);
        setSaveState('error');
        setSaveMessage(`Save failed: ${data.error || response.statusText}`);
      } else {
        console.log(`✅ CurrencyStatusPage saved ${newStatus.length} entries to DB via ${currencyEndpoint}`);
        setSaveState('saved');
        setSaveMessage(`✅ Saved ${newStatus.length} currency entries`);
        setTimeout(() => setSaveState('idle'), 3000);
      }
    } catch (err: any) {
      console.error('❌ CurrencyStatusPage network error:', err);
      setSaveState('error');
      setSaveMessage(`Network error: ${err.message}`);
    }
  }, [editedDates, editedInactive, allVisibleDefs, currencyStatus, currencyEndpoint, person, personType, dbId]);

  // ── DIRTY CHECK ──────────────────────────────────────────────────────────
  const isDirty = useCallback((): boolean => {
    if (!isEditing) return false;
    return allVisibleDefs.some(def => {
      const current = getStatus(def.name)?.lastEventDate || '';
      const edited = editedDates[def.name] || '';
      const currentInactive = !!(getStatus(def.name)?.isInactive);
      const editedInactiveVal = !!editedInactive[def.name];
      return current !== edited || currentInactive !== editedInactiveVal;
    });
  }, [isEditing, allVisibleDefs, getStatus, editedDates, editedInactive]);

  useEffect(() => {
    registerDirtyCheck(isDirty, handleSaveClick, handleCancelClick);
  }, [registerDirtyCheck, isDirty, handleSaveClick, handleCancelClick]);

  // ── PERSON NAME ──────────────────────────────────────────────────────────
  const parts = (person.name || '').split(', ');
  const surname = parts[0] || '';
  const firstName = parts[1] || '';

  const { active: activeDefs, inactive: inactiveDefs } = getSortedDefs();

  // ── RENDER ROW ───────────────────────────────────────────────────────────
  const renderRow = (def: CurrencyDefinition, isInactiveRow: boolean) => {
    const validityDays = getValidityDays(def);
    const isInactive = isEditing ? !!editedInactive[def.name] : isInactiveRow;

    const displayDate = isEditing
      ? (editedDates[def.name] || '')
      : (getStatus(def.name)?.lastEventDate || '');

    const daysRemaining = (!isInactive && displayDate) ? getDaysRemaining(displayDate, validityDays) : null;

    const expiryDateStr = (!isInactive && displayDate) ? (() => {
      const d = new Date(displayDate);
      d.setDate(d.getDate() + validityDays);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    })() : '—';

    const rowOpacity = isInactive && !isEditing ? 'opacity-40' : '';

    return (
      <tr key={def.id} className={`hover:bg-gray-700/30 transition-colors ${rowOpacity}`}>
        {/* Status dot */}
        <td className="px-4 py-3">
          <div className={`w-3 h-3 rounded-full ${getStatusDotColor(daysRemaining, isInactive)}`} />
        </td>
        {/* Currency name */}
        <td className="px-4 py-3">
          <div className={`text-sm font-medium ${isInactive && !isEditing ? 'text-gray-500' : 'text-white'}`}>
            {def.name}
            {isInactive && !isEditing && (
              <span className="ml-2 text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Inactive</span>
            )}
          </div>
          {def.description && <div className="text-xs text-gray-500 mt-0.5">{def.description}</div>}
        </td>
        {/* Last Event Date */}
        <td className="px-4 py-3">
          {isEditing ? (
            <input
              type="date"
              value={editedDates[def.name] || ''}
              onChange={e => setEditedDates(prev => ({ ...prev, [def.name]: e.target.value }))}
              className="bg-gray-700 border border-gray-500 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          ) : (
            <span className={`text-sm ${isInactive ? 'text-gray-500' : 'text-gray-300'}`}>
              {displayDate ? formatDisplayDate(displayDate) : <span className="text-gray-600 italic">Not set</span>}
            </span>
          )}
        </td>
        {/* Expiry Date */}
        <td className="px-4 py-3">
          <span className={`text-sm ${isInactive ? 'text-gray-500' : 'text-gray-300'}`}>{expiryDateStr}</span>
        </td>
        {/* Days Remaining */}
        <td className="px-4 py-3">
          {isInactive ? (
            <span className="text-sm text-gray-500 italic">—</span>
          ) : daysRemaining !== null ? (
            <span className={`text-sm font-semibold ${getDaysTextColor(daysRemaining, false)}`}>
              {daysRemaining <= 0 ? 'EXPIRED' : `${daysRemaining} days`}
            </span>
          ) : (
            <span className="text-sm text-gray-600 italic">—</span>
          )}
        </td>
        {/* Active/Inactive toggle (edit mode only) */}
        {isEditing && (
          <td className="px-4 py-3">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <div
                onClick={() => toggleInactive(def.name)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                  editedInactive[def.name]
                    ? 'bg-gray-600'
                    : 'bg-sky-600'
                }`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  editedInactive[def.name] ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
              <span className={`text-xs font-medium ${editedInactive[def.name] ? 'text-gray-400' : 'text-sky-400'}`}>
                {editedInactive[def.name] ? 'Inactive' : 'Active'}
              </span>
            </label>
          </td>
        )}
      </tr>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-white">Currency Status</h1>
          <p className="text-sm text-gray-400">{person.rank} {firstName} {surname}</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md"
          >
            ← Back
          </button>
          <AuditButton pageName="Currency Status" />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">

          {/* Personal Details + Action Buttons */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-4 mb-6 border border-gray-700 grid grid-cols-2 md:grid-cols-6 gap-4 items-center">
            <div className="text-sm"><span className="text-gray-400">ID: </span><span className="font-semibold text-white">{person.idNumber}</span></div>
            <div className="text-sm"><span className="text-gray-400">First Name: </span><span className="font-semibold text-white">{firstName}</span></div>
            <div className="text-sm"><span className="text-gray-400">Surname: </span><span className="font-semibold text-white">{surname}</span></div>
            <div className="text-sm"><span className="text-gray-400">Rank: </span><span className="font-semibold text-white">{person.rank}</span></div>
            <div className="text-sm"><span className="text-gray-400">Course: </span><span className="font-semibold text-white">{'course' in person ? (person as any).course : 'N/A'}</span></div>
            <div className="flex justify-end space-x-2">
              {isEditing ? (
                <>
                  <button onClick={handleSaveClick}
                    className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold shadow-md">
                    Save
                  </button>
                  <button onClick={handleCancelClick}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md">
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={handleEditClick} disabled={isLoading}
                  className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-sm font-semibold shadow-md disabled:opacity-50">
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* Save State Banner */}
          {saveState === 'saving' && (
            <div className="mb-4 px-4 py-2 bg-sky-900/50 border border-sky-600 rounded-md text-sky-300 text-sm">
              ⏳ {saveMessage}
            </div>
          )}
          {saveState === 'saved' && (
            <div className="mb-4 px-4 py-2 bg-green-900/50 border border-green-600 rounded-md text-green-300 text-sm font-semibold">
              {saveMessage}
            </div>
          )}
          {saveState === 'error' && (
            <div className="mb-4 px-4 py-2 bg-red-900/50 border border-red-600 rounded-md text-red-300 text-sm">
              ❌ {saveMessage}
            </div>
          )}

          {/* Edit mode hint */}
          {isEditing && (
            <div className="mb-4 px-4 py-2 bg-amber-900/30 border border-amber-700 rounded-md text-amber-300 text-xs">
              💡 Use the toggle in the last column to mark a currency as <strong>Active</strong> or <strong>Inactive</strong>. Inactive currencies are excluded from overall currency calculations and appear greyed out at the bottom of the list.
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center text-gray-400 text-sm">
              Loading currency data...
            </div>
          )}

          {/* Load Error */}
          {loadError && (
            <div className="bg-red-900/30 rounded-lg p-4 border border-red-700 text-red-300 text-sm">
              {loadError}
            </div>
          )}

          {/* Currency Table */}
          {!isLoading && !loadError && (
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-8">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Currency</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Event Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Expiry Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Days Remaining</th>
                    {isEditing && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Active / Inactive</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {allVisibleDefs.length === 0 ? (
                    <tr>
                      <td colSpan={isEditing ? 6 : 5} className="px-4 py-8 text-center text-gray-500 italic text-sm">
                        No currency items configured. Go to Settings → Currency Setup to add items.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {/* Active currencies */}
                      {activeDefs.map(def => renderRow(def, false))}

                      {/* Divider if there are both active and inactive */}
                      {activeDefs.length > 0 && inactiveDefs.length > 0 && (
                        <tr>
                          <td colSpan={isEditing ? 6 : 5} className="px-4 py-2 bg-gray-700/30">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-px bg-gray-600" />
                              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Inactive Currencies</span>
                              <div className="flex-1 h-px bg-gray-600" />
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Inactive currencies */}
                      {inactiveDefs.map(def => renderRow(def, true))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default CurrencyStatusPage;