import React, { useState, useMemo } from 'react';
import { ScheduleEvent, PersonCurrencyStatus, MasterCurrency, CurrencyRequirement, Instructor, Trainee } from '../types';
import AuthorisationConfirmation from './AuthorisationConfirmation';
import PinEntryFlyout from './PinEntryFlyout';
import ClearAuthConfirmation from './ClearAuthConfirmation';
import StaffSearchDropdown from './StaffSearchDropdown';
import { useSystemFreeze } from '../hooks/useSystemFreeze';
import { handleEditableTextBeforeInput, handleEditableTextKeyDownCapture, stopEditableKeyPropagation } from '../utils/editableKeyEvents';

// ─── Currency helpers (mirrors CurrencyPanel logic) ─────────────────────────

const AMBER_THRESHOLD_DAYS = 30;

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  return d;
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

interface CurrencyCounts {
  expired: number;
  approaching: number;
  current: number;
  grey: number;
}

function computeCurrencyCounts(
  currencyStatus: PersonCurrencyStatus[] | undefined,
  allDefs: Array<{ name: string; validityDays: number | null }>
): CurrencyCounts {
  const counts: CurrencyCounts = { expired: 0, approaching: 0, current: 0, grey: 0 };

  for (const def of allDefs) {
    const record = currencyStatus?.find(s => s.currencyName === def.name);

    // Inactive → grey
    if (record?.isInactive) {
      counts.grey++;
      continue;
    }

    // No record or no date → grey (unassigned)
    if (!record || !record.lastEventDate) {
      counts.grey++;
      continue;
    }

    if (def.validityDays === null) {
      // Composite currency — use calculatedExpiry if present
      if (record.calculatedExpiry) {
        const days = getDaysRemaining(record.calculatedExpiry);
        if (days <= 0) counts.expired++;
        else if (days <= AMBER_THRESHOLD_DAYS) counts.approaching++;
        else counts.current++;
      } else if (record.isCurrent === false) {
        counts.expired++;
      } else if (record.isCurrent === true) {
        counts.current++;
      } else {
        counts.grey++;
      }
    } else {
      const expiryStr = addDaysToDate(record.lastEventDate, def.validityDays);
      if (!expiryStr) { counts.grey++; continue; }
      const days = getDaysRemaining(expiryStr);
      if (days <= 0) counts.expired++;
      else if (days <= AMBER_THRESHOLD_DAYS) counts.approaching++;
      else counts.current++;
    }
  }

  return counts;
}

// ─── Traffic Light Circle ────────────────────────────────────────────────────

const TrafficCircle: React.FC<{ color: 'red' | 'amber' | 'green' | 'grey'; count: number }> = ({ color, count }) => {
  const filled = count > 0;

  const solidClass = {
    red:   'bg-red-500 border-red-500 text-white',
    amber: 'bg-amber-400 border-amber-400 text-white',
    green: 'bg-green-500 border-green-500 text-white',
    grey:  'bg-gray-500 border-gray-500 text-white',
  }[color];

  const outlineClass = {
    red:   'bg-transparent border-red-500 text-red-400',
    amber: 'bg-transparent border-amber-400 text-amber-300',
    green: 'bg-transparent border-green-500 text-green-400',
    grey:  'bg-transparent border-gray-500 text-gray-400',
  }[color];

  return (
    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-sm ${filled ? solidClass : outlineClass}`}>
      <span className="text-sm font-bold leading-none">{count}</span>
    </div>
  );
};

// ─── Person currency row ─────────────────────────────────────────────────────

const PersonCurrencyRow: React.FC<{ label: string; counts: CurrencyCounts }> = ({ label, counts }) => (
  <div className="flex items-center gap-3 py-2.5">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-200 truncate">{label}</p>
    </div>
    <div className="flex items-center gap-4 shrink-0">
      <TrafficCircle color="red"   count={counts.expired} />
      <TrafficCircle color="amber" count={counts.approaching} />
      <TrafficCircle color="green" count={counts.current} />
      <TrafficCircle color="grey"  count={counts.grey} />
    </div>
  </div>
);

// ─── Props ───────────────────────────────────────────────────────────────────

interface AuthorisationFlyoutProps {
  event: ScheduleEvent;
  onClose: () => void;
  onAuthorise: (eventId: string, notes: string, role: 'autho' | 'captain', isVerbal: boolean, selectedPersonName: string) => void;
  onClearAuth: (eventId: string) => void;
  instructorsList: { name: string; rank: string; unit?: string; pin?: string }[];
  currentUserName: string;
  currentUserRank: string;
  currentUserUnit?: string;
  // Currency data (optional — box is hidden if not provided)
  instructorsData?: Instructor[];
  traineesData?: Trainee[];
  masterCurrencies?: MasterCurrency[];
  currencyRequirements?: CurrencyRequirement[];
}

const InfoRow: React.FC<{ label: string; value: string | undefined }> = ({ label, value }) => (
    <div className="flex justify-between text-sm py-1 border-b border-gray-700/50">
        <span className="text-gray-400 font-medium">{label}:</span>
        <span className="text-gray-200">{value || 'N/A'}</span>
    </div>
);

// ─── Main component ──────────────────────────────────────────────────────────

const AuthorisationFlyout: React.FC<AuthorisationFlyoutProps> = ({ 
  event, 
  onClose, 
  onAuthorise, 
  onClearAuth, 
  instructorsList, 
  currentUserName, 
  currentUserRank, 
  currentUserUnit,
  instructorsData = [],
  traineesData = [],
  masterCurrencies = [],
  currencyRequirements = [],
}) => {
  const { isFrozen, allowedActions: freezeAllowedActions } = useSystemFreeze();
  const [notes, setNotes] = useState(event.authNotes ?? '');
  const [showAuthConfirmation, setShowAuthConfirmation] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [signingRole, setSigningRole] = useState<'autho' | 'captain' | null>(null);
  const [isVerbal, setIsVerbal] = useState(event.isVerbalAuth ?? false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [isClearingAuth, setIsClearingAuth] = useState(false);
  
  const picName = useMemo(() => event.instructor || event.pilot, [event]);
  
  const currentUserDisplayName = useMemo(() => `${currentUserRank} ${currentUserName}`, [currentUserRank, currentUserName]);
  
  const defaultAutho = useMemo(() => currentUserDisplayName, [currentUserDisplayName]);
  const defaultCaptain = useMemo(() => {
    if (event.instructor) {
      const instructor = instructorsList.find(staff => staff.name === event.instructor);
      return instructor ? `${instructor.rank} ${instructor.name}` : event.instructor;
    }
    if (event.pilot) {
      const pilot = instructorsList.find(staff => staff.name === event.pilot);
      return pilot ? `${pilot.rank} ${pilot.name}` : event.pilot;
    }
    return '';
  }, [event.instructor, event.pilot, instructorsList]);

  const [selectedAutho, setSelectedAutho] = useState(() => event.authoSignedBy || defaultAutho);
  const [selectedCaptain, setSelectedCaptain] = useState(() => event.captainSignedBy || defaultCaptain);

  // ─── Currency computation ────────────────────────────────────────────────

  const allCurrencyDefs = useMemo((): Array<{ name: string; validityDays: number | null }> => {
    const defs: Array<{ name: string; validityDays: number | null }> = [];
    for (const req of currencyRequirements) {
      if (req.isVisible !== false) {
        defs.push({ name: req.name, validityDays: req.validityDays ?? null });
      }
    }
    for (const master of masterCurrencies) {
      if (master.isVisible !== false) {
        defs.push({ name: master.name, validityDays: null });
      }
    }
    return defs;
  }, [currencyRequirements, masterCurrencies]);

  const instructorRecord = useMemo(() => {
    const name = event.instructor || event.pilot;
    if (!name) return null;
    return instructorsData.find(i => i.name === name) ?? null;
  }, [event.instructor, event.pilot, instructorsData]);

  const studentName = useMemo(() => {
    if (!event.student) return null;
    return event.student.split(' – ')[0] || event.student;
  }, [event.student]);

  const studentRecord = useMemo(() => {
    if (!studentName) return null;
    const trainee = traineesData.find(t => t.name === studentName || t.fullName === studentName);
    if (trainee) return { name: trainee.name || trainee.fullName, currencyStatus: trainee.currencyStatus, isTrainee: true };
    const inst = instructorsData.find(i => i.name === studentName);
    if (inst) return { name: inst.name, currencyStatus: inst.currencyStatus, isTrainee: false };
    return null;
  }, [studentName, traineesData, instructorsData]);

  const instructorCounts = useMemo(
    () => computeCurrencyCounts(instructorRecord?.currencyStatus, allCurrencyDefs),
    [instructorRecord, allCurrencyDefs]
  );

  const studentCounts = useMemo(
    () => computeCurrencyCounts(studentRecord?.currencyStatus, allCurrencyDefs),
    [studentRecord, allCurrencyDefs]
  );

  const hasCurrencyData = allCurrencyDefs.length > 0 && (instructorRecord !== null || studentRecord !== null);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const getAircraftType = (resourceId: string | undefined) => {
    if (!resourceId) return '';
    const spaceIndex = resourceId.lastIndexOf(' ');
    if (spaceIndex > 0) {
      const lastPart = resourceId.substring(spaceIndex + 1);
      if (!isNaN(Number(lastPart))) return resourceId.substring(0, spaceIndex);
    }
    return resourceId;
  };

  const getStudentName = (student: string | undefined) => {
    if (!student) return '';
    return student.split(' – ')[0] || student;
  };

  const formatAuthTime = (timestamp: string | undefined) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-GB', { month: 'short' });
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${minutes}`;
  };

  // ─── Action handlers ─────────────────────────────────────────────────────

  const handleSignClick = (role: 'autho' | 'captain') => {
    if (role === 'autho' && !selectedAutho) return;
    if (role === 'captain' && !selectedCaptain) return;
    setSigningRole(role);
    if (role === 'autho') setShowAuthConfirmation(true);
    else setShowPinEntry(true);
  };

  const handleConfirmAuthForSign = () => { setShowAuthConfirmation(false); setShowPinEntry(true); };
  const handleCancelAuthForSign  = () => { setShowAuthConfirmation(false); setSigningRole(null); };

  const handleCorrectPinForSign = () => {
    if (signingRole) {
      const selectedPerson = signingRole === 'autho' ? selectedAutho : selectedCaptain;
      onAuthorise(event.id, notes, signingRole, isVerbal, selectedPerson);
    }
    setShowPinEntry(false);
    setSigningRole(null);
  };

  const handleProceedToPinForClear = () => { setShowClearConfirmation(false); setIsClearingAuth(true); setShowPinEntry(true); };
  const handleCorrectPinForClear  = () => { onClearAuth(event.id); setShowPinEntry(false); setIsClearingAuth(false); };
  const handleCancelPin           = () => { setShowPinEntry(false); setSigningRole(null); setIsClearingAuth(false); };

  const handleVerbalAuthChange = (checked: boolean) => {
    setIsVerbal(checked);
  };

  const normaliseSigner = (value: string | undefined) => value?.trim().toLowerCase() || '';

  const isSameSigner = (a: string | undefined, b: string | undefined) => {
    const left = normaliseSigner(a);
    const right = normaliseSigner(b);
    if (!left || !right) return false;
    return left === right || left.endsWith(` ${right}`) || right.endsWith(` ${left}`);
  };

  const dualSignatureAnnotation = (() => {
    if (!isVerbal) return '';
    if (signingRole === 'autho' && event.captainSignedBy) {
      const signer = event.captainSignedOnBehalfBy || event.captainSignedBy;
      return `${signer} will be recorded as signing AUTHO authorisation on behalf of ${selectedAutho} under verbal AUTH.`;
    }
    if (signingRole === 'captain' && event.authoSignedBy) {
      const signer = event.authoSignedOnBehalfBy || event.authoSignedBy;
      return `${signer} will be recorded as signing PIC authorisation on behalf of ${selectedCaptain} under verbal AUTH.`;
    }
    if (signingRole === 'autho' && isSameSigner(selectedAutho, event.captainSignedBy)) {
      return `${selectedAutho} will be recorded as signing both AUTHO and PIC for this verbal authorisation.`;
    }
    if (signingRole === 'captain' && isSameSigner(selectedCaptain, event.authoSignedBy)) {
      return `${selectedCaptain} will be recorded as signing both AUTHO and PIC for this verbal authorisation.`;
    }
    return '';
  })();

  const hasAnySignature  = !!(event.authoSignedBy ?? event.captainSignedBy);
  const isFullyAuthorised = !!(event.authoSignedBy && event.captainSignedBy);
  const getPinForStaffSelection = (selectedPersonName: string) => {
    const selected = selectedPersonName.trim();
    const matchingStaff = instructorsList.find(staff =>
      staff.name === selected ||
      `${staff.rank} ${staff.name}` === selected
    );
    return matchingStaff?.pin || '1111';
  };
  const pinForVerification = signingRole === 'autho'
    ? getPinForStaffSelection(isVerbal && event.captainSignedBy ? (event.captainSignedOnBehalfBy || event.captainSignedBy) : selectedAutho)
    : signingRole === 'captain'
      ? getPinForStaffSelection(isVerbal && event.authoSignedBy ? (event.authoSignedOnBehalfBy || event.authoSignedBy) : selectedCaptain)
      : '1111';

  // ─── Currencies Box (inline component — accesses outer scope) ────────────

  const CurrenciesBox = () => {
    if (!hasCurrencyData) return null;

    const getInstructorLabel = () => {
      if (!instructorRecord) return null;
      const inst = instructorsData.find(i => i.name === instructorRecord.name);
      return inst ? `${inst.rank} ${inst.name}` : instructorRecord.name;
    };

    const getStudentLabel = () => {
      if (!studentRecord) return null;
      if (studentRecord.isTrainee) {
        const t = traineesData.find(t => t.name === studentRecord.name || t.fullName === studentRecord.name);
        return t ? `${t.rank} ${t.name || t.fullName}` : studentRecord.name;
      }
      const inst = instructorsData.find(i => i.name === studentRecord.name);
      return inst ? `${inst.rank} ${inst.name}` : studentRecord.name;
    };

    const instructorLabel = getInstructorLabel();
    const studentLabel    = getStudentLabel();

    return (
      <fieldset className="p-4 border border-gray-600 rounded-lg">
        <legend className="px-2 text-sm font-semibold text-gray-300">Currencies</legend>

        {/* Column headers */}
        <div className="flex items-end justify-end gap-4 mb-1 pr-1">
          {(
            ['Expired', 'Due', 'Current', 'Inactive'] as const
          ).map((label) => (
            <div key={label} className="w-10 flex justify-center">
              <span className="text-xs font-medium text-gray-400 leading-tight">{label}</span>
            </div>
          ))}
        </div>

        <div className="divide-y divide-gray-700/50">
          {instructorLabel && (
            <PersonCurrencyRow
              label={instructorLabel}
              counts={instructorCounts}
            />
          )}
          {studentLabel && (
            <PersonCurrencyRow
              label={studentLabel}
              counts={studentCounts}
            />
          )}
        </div>

        <p className="text-[9px] text-gray-600 mt-2 text-right">
          {allCurrencyDefs.length} currencies tracked
        </p>
      </fieldset>
    );
  };

  // ─── Render: fully authorised ─────────────────────────────────────────────

  if (isFullyAuthorised) {
    return (
      <>
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-900">
                    <div className="flex items-center space-x-2">
                        <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h2 className="text-lg font-bold text-green-400">Flight Authorisation Complete</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-4 space-y-4 relative">
                    {isFrozen && !freezeAllowedActions.flightAuthorisation && (
                        <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                    )}
                    <div className="bg-gray-700/50 rounded-lg p-3 text-center border border-gray-600">
                        <div className="flex items-center justify-center mb-1">
                            <svg className="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <p className="text-green-400 font-semibold">Authorisation Approved</p>
                        </div>
                        <p className="text-gray-400 text-xs">This flight has been fully authorised and is cleared to proceed</p>
                        {event.dualAuthSignedAnnotation && (
                            <p className="mt-2 text-xs font-semibold text-amber-300">{event.dualAuthSignedAnnotation}</p>
                        )}
                    </div>

                    <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                        <h3 className="text-sm font-semibold text-gray-300 mb-2">Flight Summary</h3>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-gray-400">Syllabus:</span><span className="text-white font-medium">{event.flightNumber}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Start Time:</span><span className="text-white font-medium">{Math.floor(event.startTime)}:{String(Math.round((event.startTime % 1) * 60)).padStart(2, '0')}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Instructor:</span><span className="text-white font-medium">{event.instructor}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Student:</span><span className="text-white font-medium">{getStudentName(event.student)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Aircraft:</span><span className="text-white font-medium">{getAircraftType(event.resourceId)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Route:</span><span className="text-white font-medium">{event.origin}-{event.destination}</span></div>
                        </div>
                    </div>

                    {event.authNotes?.trim() && (
                        <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                            <h3 className="text-sm font-semibold text-gray-300 mb-2">AUTH Notes</h3>
                            <p className="text-sm text-gray-200 whitespace-pre-wrap">{event.authNotes}</p>
                        </div>
                    )}

                    <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                        <div className="flex items-center mb-2">
                            <svg className="h-4 w-4 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            <h3 className="text-sm font-semibold text-gray-300">Authorising Officer (AUTHO)</h3>
                        </div>
                        <p className="text-green-400 font-bold text-base ml-6">{event.authoSignedBy}</p>
                        <p className="text-gray-400 text-xs ml-6">Signed: {formatAuthTime(event.authoSignedAt)}</p>
                        {event.authoSignedOnBehalfBy && (
                            <p className="text-amber-300 text-xs font-semibold ml-6 mt-1">
                                Signed by {event.authoSignedOnBehalfBy} on behalf of AUTHO under verbal AUTH.
                            </p>
                        )}
                    </div>

                    <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                        <div className="flex items-center mb-2">
                            <svg className="h-4 w-4 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            <h3 className="text-sm font-semibold text-gray-300">Captain (PIC)</h3>
                        </div>
                        <p className="text-green-400 font-bold text-base ml-6">{event.captainSignedBy}</p>
                        <p className="text-gray-400 text-xs ml-6">Signed: {formatAuthTime(event.captainSignedAt)}</p>
                        {event.captainSignedOnBehalfBy && (
                            <p className="text-amber-300 text-xs font-semibold ml-6 mt-1">
                                Signed by {event.captainSignedOnBehalfBy} on behalf of PIC under verbal AUTH.
                            </p>
                        )}
                    </div>
                </div>

                <div className="px-4 py-3 bg-gray-900 border-t border-gray-700 flex justify-between items-center">
                    <button onClick={() => setShowClearConfirmation(true)} className="px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700 transition-colors">Clear Auth</button>
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded text-sm font-semibold hover:bg-gray-700 transition-colors">Close</button>
                </div>
            </div>
        </div>
        {showPinEntry && <PinEntryFlyout correctPin={pinForVerification} onConfirm={handleCorrectPinForClear} onCancel={handleCancelPin} />}
        {showClearConfirmation && <ClearAuthConfirmation onConfirm={handleProceedToPinForClear} onCancel={() => setShowClearConfirmation(false)} />}
      </>
    );
  }

  // ─── Render: in-progress authorisation ───────────────────────────────────

  return (
    <>
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h2 className="text-xl font-bold text-amber-400">Flight Authorisation</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto relative">
                    {isFrozen && !freezeAllowedActions.flightAuthorisation && (
                        <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                    )}

                    {/* Flight Summary */}
                    <fieldset className="p-4 border border-gray-600 rounded-lg">
                        <legend className="px-2 text-sm font-semibold text-gray-300">Flight Summary</legend>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                            <InfoRow label="Syllabus"   value={event.flightNumber} />
                            <InfoRow label="Start Time" value={`${Math.floor(event.startTime)}:${String(Math.round((event.startTime % 1) * 60)).padStart(2, '0')}`} />
                            <InfoRow label="Instructor" value={event.instructor} />
                            <InfoRow label="Student"    value={getStudentName(event.student)} />
                            <InfoRow label="Aircraft"   value={getAircraftType(event.resourceId)} />
                            <InfoRow label="Route"      value={`${event.origin}-${event.destination}`} />
                        </div>
                    </fieldset>

                    {/* ── Currencies box (between Flight Summary and Notes) ── */}
                    <CurrenciesBox />

                    {/* Notes */}
                    <div>
                        <label htmlFor="auth-notes" className="block text-sm font-medium text-gray-400">Notes</label>
                        <textarea
                            id="auth-notes"
                            rows={3}
                            value={notes}
                            onBeforeInput={(event) => handleEditableTextBeforeInput(event, setNotes)}
                            onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, setNotes)}
                            onKeyDown={stopEditableKeyPropagation}
                            onChange={e => setNotes(e.target.value)}
                            disabled={!!(event.authoSignedBy ?? event.captainSignedBy)}
                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                            placeholder="Enter any authorisation notes here..."
                        />
                    </div>

                    {/* Signature blocks */}
                    <div className="space-y-3">
                        {/* AUTHO */}
                        <div className="p-3 bg-gray-900/50 rounded-lg">
                             <div className="mb-3">
                                <h3 className="font-semibold text-gray-300 mb-2">Authorising Officer (AUTHO)</h3>
                                {!event.authoSignedBy ? (
                                    <div className="space-y-2">
                                        <StaffSearchDropdown
                                            staff={instructorsList}
                                            selectedStaff={selectedAutho}
                                            onSelect={setSelectedAutho}
                                            placeholder="Select Authorising Officer..."
                                        />
                                        <button 
                                            onClick={() => handleSignClick('autho')} 
                                            disabled={!selectedAutho}
                                            className="w-full px-3 py-1.5 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed"
                                        >
                                            Sign as AUTHO
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-green-400">{event.authoSignedBy}</p>
                                        <p className="text-xs text-gray-400">{formatAuthTime(event.authoSignedAt)}</p>
                                    </div>
                                )}
                             </div>
                        </div>

                        {/* PIC */}
                        <div className="p-3 bg-gray-900/50 rounded-lg">
                             <div className="mb-3">
                                <h3 className="font-semibold text-gray-300 mb-2">Captain (PIC) - {picName}</h3>
                                {!event.captainSignedBy ? (
                                    <div className="space-y-2">
                                        <StaffSearchDropdown
                                            staff={instructorsList}
                                            selectedStaff={selectedCaptain}
                                            onSelect={setSelectedCaptain}
                                            placeholder="Select Captain (PIC)..."
                                            disabled={!!(event.authoSignedBy && !event.isVerbalAuth)}
                                        />
                                        <button
                                            onClick={() => handleSignClick('captain')}
                                            disabled={!selectedCaptain || !(event.authoSignedBy || event.isVerbalAuth || isVerbal)}
                                            className="w-full px-3 py-1.5 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed"
                                        >
                                            Sign as PIC
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-green-400">{event.captainSignedBy}</p>
                                        <p className="text-xs text-gray-400">{formatAuthTime(event.captainSignedAt)}</p>
                                    </div>
                                )}
                             </div>
                             {!event.captainSignedBy && (
                                <label className="flex items-center space-x-2 mt-3 pt-3 border-t border-gray-700/50">
                                    <input
                                        type="checkbox"
                                        checked={isVerbal}
                                        onChange={e => handleVerbalAuthChange(e.target.checked)}
                                        disabled={!!event.authoSignedBy}
                                        className="h-4 w-4 bg-gray-700 border-gray-600 rounded focus:ring-amber-500 focus:ring-offset-gray-800 accent-amber-500 disabled:accent-gray-600"
                                    />
                                    <span className={`text-sm ${event.authoSignedBy ? 'text-gray-500' : 'text-gray-300'}`}>
                                        Verbal AUTH received. See Notes.
                                        {isVerbal && (
                                            <span className="ml-2 text-amber-400 font-medium">
                                                (AUTHO or PIC may sign either box)
                                            </span>
                                        )}
                                    </span>
                                </label>
                             )}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-between items-center">
                    <div>
                        {hasAnySignature && (
                            <button onClick={() => setShowClearConfirmation(true)} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-semibold">
                                Clear Auth
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">Close</button>
                </div>
            </div>
        </div>
        {showAuthConfirmation && (
            <AuthorisationConfirmation
                onConfirm={handleConfirmAuthForSign}
                onCancel={handleCancelAuthForSign}
                annotation={dualSignatureAnnotation}
            />
        )}
        {showPinEntry && (
            <PinEntryFlyout
                correctPin={pinForVerification}
                onConfirm={isClearingAuth ? handleCorrectPinForClear : handleCorrectPinForSign}
                onCancel={handleCancelPin}
                annotation={dualSignatureAnnotation || undefined}
            />
        )}
        {showClearConfirmation && <ClearAuthConfirmation onConfirm={handleProceedToPinForClear} onCancel={() => setShowClearConfirmation(false)} />}
    </>
  );
};

export default AuthorisationFlyout;
