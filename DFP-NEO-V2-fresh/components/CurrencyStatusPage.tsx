import React, { useState, useEffect, useCallback } from 'react';
import { Instructor, Trainee, MasterCurrency, CurrencyRequirement, CurrencyDefinition, PersonCurrencyStatus } from '../types';
import AuditButton from './AuditButton';

interface CurrencyStatusPageProps {
  person: Instructor | Trainee;
  masterCurrencies: MasterCurrency[];
  currencyRequirements: CurrencyRequirement[];
  onClose: () => void;
  registerDirtyCheck: (isDirty: () => boolean, onSave: () => void, onDiscard: () => void) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const CurrencyStatusPage: React.FC<CurrencyStatusPageProps> = ({
  person,
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

  // Save feedback
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  // Visible currency definitions (sorted)
  const visibleDefs: CurrencyDefinition[] = [...masterCurrencies, ...currencyRequirements]
    .filter(c => c.isVisible)
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── LOAD FROM DB ON MOUNT ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setIsEditing(false);
    setEditedDates({});

    fetch(`/api/personnel/${person.idNumber}/currencies`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const loaded: PersonCurrencyStatus[] = Array.isArray(data.currencyStatus) ? data.currencyStatus : [];
        setCurrencyStatus(loaded);
        setIsLoading(false);
        console.log(`✅ CurrencyStatusPage loaded ${loaded.length} entries for person ${person.idNumber}`);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('❌ CurrencyStatusPage load error:', err);
        setLoadError('Failed to load currency data. Please try again.');
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [person.idNumber]);

  // ── HELPERS ─────────────────────────────────────────────────────────
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

  const getStatusDotColor = (days: number | null): string => {
    if (days === null) return 'bg-gray-600';
    if (days <= 0) return 'bg-red-500';
    if (days <= 30) return 'bg-amber-400';
    return 'bg-green-500';
  };

  const getDaysTextColor = (days: number | null): string => {
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

  // ── EDIT MODE ────────────────────────────────────────────────────────
  const handleEditClick = () => {
    const initial: Record<string, string> = {};
    visibleDefs.forEach(def => {
      const s = getStatus(def.name);
      initial[def.name] = s?.lastEventDate || '';
    });
    setEditedDates(initial);
    setIsEditing(true);
    setSaveState('idle');
  };

  const handleCancelClick = useCallback(() => {
    setIsEditing(false);
    setEditedDates({});
    setSaveState('idle');
  }, []);

  // ── SAVE ─────────────────────────────────────────────────────────────
  const handleSaveClick = useCallback(async () => {
    // Build updated status from edited dates
    const newStatus: PersonCurrencyStatus[] = [];

    visibleDefs.forEach(def => {
      const date = editedDates[def.name];
      if (date && date.trim()) {
        newStatus.push({ currencyName: def.name, lastEventDate: date.trim() });
      }
    });

    // Preserve hidden currencies (not in visibleDefs)
    currencyStatus.forEach(existing => {
      const isVisible = visibleDefs.some(d => d.name === existing.currencyName);
      if (!isVisible) {
        newStatus.push(existing);
      }
    });

    // 1. Update local state IMMEDIATELY — user sees result right away
    setCurrencyStatus(newStatus);
    setIsEditing(false);
    setEditedDates({});
    setSaveState('saving');
    setSaveMessage('Saving...');

    // 2. Save to database via existing PATCH endpoint
    try {
      const response = await fetch(`/api/personnel/${person.idNumber}/currencies`, {
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
        console.log(`✅ CurrencyStatusPage saved ${newStatus.length} entries to DB`);
        setSaveState('saved');
        setSaveMessage(`✅ Saved ${newStatus.length} currency entries`);
        setTimeout(() => setSaveState('idle'), 3000);
      }
    } catch (err: any) {
      console.error('❌ CurrencyStatusPage network error:', err);
      setSaveState('error');
      setSaveMessage(`Network error: ${err.message}`);
    }
  }, [editedDates, visibleDefs, currencyStatus, person.idNumber]);

  // ── DIRTY CHECK ──────────────────────────────────────────────────────
  const isDirty = useCallback((): boolean => {
    if (!isEditing) return false;
    return visibleDefs.some(def => {
      const current = getStatus(def.name)?.lastEventDate || '';
      const edited = editedDates[def.name] || '';
      return current !== edited;
    });
  }, [isEditing, visibleDefs, getStatus, editedDates]);

  useEffect(() => {
    registerDirtyCheck(isDirty, handleSaveClick, handleCancelClick);
  }, [registerDirtyCheck, isDirty, handleSaveClick, handleCancelClick]);

  // ── PERSON NAME ──────────────────────────────────────────────────────
  const parts = (person.name || '').split(', ');
  const surname = parts[0] || '';
  const firstName = parts[1] || '';

  // ── RENDER ───────────────────────────────────────────────────────────
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {visibleDefs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic text-sm">
                        No currency items configured. Go to Settings → Currency Setup to add items.
                      </td>
                    </tr>
                  ) : (
                    visibleDefs.map(def => {
                      const validityDays = getValidityDays(def);
                      const displayDate = isEditing
                        ? (editedDates[def.name] || '')
                        : (getStatus(def.name)?.lastEventDate || '');

                      const daysRemaining = displayDate ? getDaysRemaining(displayDate, validityDays) : null;

                      const expiryDateStr = displayDate ? (() => {
                        const d = new Date(displayDate);
                        d.setDate(d.getDate() + validityDays);
                        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                      })() : '—';

                      return (
                        <tr key={def.id} className="hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className={`w-3 h-3 rounded-full ${getStatusDotColor(daysRemaining)}`} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-white">{def.name}</div>
                            {def.description && <div className="text-xs text-gray-500 mt-0.5">{def.description}</div>}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                type="date"
                                value={editedDates[def.name] || ''}
                                onChange={e => setEditedDates(prev => ({ ...prev, [def.name]: e.target.value }))}
                                className="bg-gray-700 border border-gray-500 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                              />
                            ) : (
                              <span className="text-sm text-gray-300">
                                {displayDate ? formatDisplayDate(displayDate) : <span className="text-gray-600 italic">Not set</span>}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-300">{expiryDateStr}</span>
                          </td>
                          <td className="px-4 py-3">
                            {daysRemaining !== null ? (
                              <span className={`text-sm font-semibold ${getDaysTextColor(daysRemaining)}`}>
                                {daysRemaining <= 0 ? 'EXPIRED' : `${daysRemaining} days`}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-600 italic">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
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