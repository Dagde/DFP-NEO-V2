import React, { useState, useMemo } from 'react';
import { ScheduleEvent } from '../types';
import AuthorisationConfirmation from './AuthorisationConfirmation';
import PinEntryFlyout from './PinEntryFlyout';
import ClearAuthConfirmation from './ClearAuthConfirmation';
import StaffSearchDropdown from './StaffSearchDropdown';

interface AuthorisationFlyoutProps {
  event: ScheduleEvent;
  onClose: () => void;
  onAuthorise: (eventId: string, notes: string, role: 'autho' | 'captain', isVerbal: boolean, selectedPersonName: string) => void;
  onClearAuth: (eventId: string) => void;
  instructorsList: { name: string; rank: string; unit?: string }[];
  currentUserName: string;
  currentUserRank: string;
  currentUserUnit?: string;
}

const InfoRow: React.FC<{ label: string; value: string | undefined }> = ({ label, value }) => (
    <div className="flex justify-between text-sm py-1 border-b border-gray-700/50">
        <span className="text-gray-400 font-medium">{label}:</span>
        <span className="text-gray-200">{value || 'N/A'}</span>
    </div>
);

const AuthorisationFlyout: React.FC<AuthorisationFlyoutProps> = ({ 
  event, 
  onClose, 
  onAuthorise, 
  onClearAuth, 
  instructorsList, 
  currentUserName, 
  currentUserRank, 
  currentUserUnit 
}) => {
  const [notes, setNotes] = useState(event.authNotes ?? '');
  const [showAuthConfirmation, setShowAuthConfirmation] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [signingRole, setSigningRole] = useState<'autho' | 'captain' | null>(null);
  const [isVerbal, setIsVerbal] = useState(event.isVerbalAuth ?? false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [isClearingAuth, setIsClearingAuth] = useState(false);
  
  const picName = useMemo(() => event.instructor || event.pilot, [event]);
  
  // Current user display name
  const currentUserDisplayName = useMemo(() => `${currentUserRank} ${currentUserName}`, [currentUserRank, currentUserName]);
  
  // Default values when no signatures exist
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

  // State for selected signers - properly initialized with defaults
  const [selectedAutho, setSelectedAutho] = useState(() => {
    return event.authoSignedBy || defaultAutho;
  });
  const [selectedCaptain, setSelectedCaptain] = useState(() => {
    return event.captainSignedBy || defaultCaptain;
  });

  // Effect to sync AUTHO with Captain when verbal auth is enabled
  React.useEffect(() => {
    if (isVerbal && !event.authoSignedBy && !event.captainSignedBy) {
      // When verbal auth is enabled and not yet signed, sync AUTHO to Captain
      setSelectedAutho(selectedCaptain);
    }
  }, [isVerbal, selectedCaptain, event.authoSignedBy, event.captainSignedBy]);

  const handleSignClick = (role: 'autho' | 'captain') => {
    // Check if a signer is selected
    if (role === 'autho' && !selectedAutho) {
      return;
    }
    if (role === 'captain' && !selectedCaptain) {
      return;
    }
    
    // For verbal auth, both AUTHO and PIC must use the same person
    if (isVerbal && selectedAutho !== selectedCaptain) {
      return;
    }
    
    setSigningRole(role);
    if (role === 'autho') {
        setShowAuthConfirmation(true);
    } else {
        setShowPinEntry(true);
    }
  };

  const handleConfirmAuthForSign = () => {
    setShowAuthConfirmation(false);
    setShowPinEntry(true);
  };

  const handleCancelAuthForSign = () => {
    setShowAuthConfirmation(false);
    setSigningRole(null);
  };

  const handleCorrectPinForSign = () => {
    if (signingRole) {
      // Use the correct selected person based on the role being signed
      const selectedPerson = signingRole === 'autho' ? selectedAutho : selectedCaptain;
      // Extract just the name from the display string (e.g., "SQNLDR Smith" -> "Smith")
      const signerName = selectedPerson.split(' ').slice(1).join(' ') || selectedPerson;
      onAuthorise(event.id, notes, signingRole, isVerbal, selectedPerson);
    }
    setShowPinEntry(false);
    setSigningRole(null);
  };
  
  const handleProceedToPinForClear = () => {
    setShowClearConfirmation(false);
    setIsClearingAuth(true);
    setShowPinEntry(true);
  };

  const handleCorrectPinForClear = () => {
    onClearAuth(event.id);
    setShowPinEntry(false);
    setIsClearingAuth(false);
  };

  const handleCancelPin = () => {
    setShowPinEntry(false);
    setSigningRole(null);
    setIsClearingAuth(false);
  };

  const formatAuthTime = (timestamp: string | undefined) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-GB', { month: 'short' }).toUpperCase();
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day} ${month} ${year} ${hours}:${minutes}`;
  };
  
  const hasAnySignature = !!(event.authoSignedBy ?? event.captainSignedBy);
  const isFullyAuthorised = !!(event.authoSignedBy && event.captainSignedBy);

  // Default PIN for all users is 1111
  const pinForVerification = '1111';

  // Handle verbal auth checkbox change
  const handleVerbalAuthChange = (checked: boolean) => {
    setIsVerbal(checked);
    if (checked && !event.authoSignedBy && !event.captainSignedBy) {
      // When enabling verbal auth and not yet signed, sync AUTHO to Captain
      setSelectedAutho(selectedCaptain);
    }
  };

  // Helper function to extract aircraft type without line number
  const getAircraftType = (resourceId: string | undefined) => {
    if (!resourceId) return '';
    // Check if resourceId has a space followed by a number (e.g., "PC-21 2")
    const spaceIndex = resourceId.lastIndexOf(' ');
    if (spaceIndex > 0) {
      const lastPart = resourceId.substring(spaceIndex + 1);
      if (!isNaN(Number(lastPart))) {
        // Last part after space is a number, remove it
        return resourceId.substring(0, spaceIndex);
      }
    }
    return resourceId;
  };

  // Helper function to extract student name without course
  const getStudentName = (student: string | undefined) => {
    if (!student) return '';
    return student.split(' – ')[0] || student;
  };

  // Render completed authorisation view
  if (isFullyAuthorised) {
    return (
      <>
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
                {/* Header */}
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

                <div className="p-4 space-y-4">
                    {/* Approval Banner */}
                    <div className="bg-gray-700/50 rounded-lg p-3 text-center border border-gray-600">
                        <div className="flex items-center justify-center mb-1">
                            <svg className="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <p className="text-green-400 font-semibold">Authorisation Approved</p>
                        </div>
                        <p className="text-gray-400 text-xs">This flight has been fully authorised and is cleared to proceed</p>
                    </div>

                    {/* Flight Summary */}
                    <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                        <h3 className="text-sm font-semibold text-gray-300 mb-2">Flight Summary</h3>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Syllabus:</span>
                                <span className="text-white font-medium">{event.flightNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Start Time:</span>
                                <span className="text-white font-medium">{Math.floor(event.startTime)}:{String(Math.round((event.startTime % 1) * 60)).padStart(2, '0')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Instructor:</span>
                                <span className="text-white font-medium">{event.instructor}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Student:</span>
                                <span className="text-white font-medium">{getStudentName(event.student)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Aircraft:</span>
                                <span className="text-white font-medium">{getAircraftType(event.resourceId)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Route:</span>
                                <span className="text-white font-medium">{event.origin}-{event.destination}</span>
                            </div>
                        </div>
                    </div>

                    {/* Authorising Officer */}
                    <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                        <div className="flex items-center mb-2">
                            <svg className="h-4 w-4 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <h3 className="text-sm font-semibold text-gray-300">Authorising Officer (AUTHO)</h3>
                        </div>
                        <p className="text-green-400 font-bold text-base ml-6">{event.authoSignedBy}</p>
                        <p className="text-gray-400 text-xs ml-6">Signed: {formatAuthTime(event.authoSignedAt)}</p>
                    </div>

                    {/* Captain (PIC) */}
                    <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600">
                        <div className="flex items-center mb-2">
                            <svg className="h-4 w-4 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <h3 className="text-sm font-semibold text-gray-300">Captain (PIC)</h3>
                        </div>
                        <p className="text-green-400 font-bold text-base ml-6">{event.captainSignedBy}</p>
                        <p className="text-gray-400 text-xs ml-6">Signed: {formatAuthTime(event.captainSignedAt)}</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-gray-900 border-t border-gray-700 flex justify-between items-center">
                    <button
                        onClick={() => setShowClearConfirmation(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700 transition-colors"
                    >
                        Clear Auth
                    </button>
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded text-sm font-semibold hover:bg-gray-700 transition-colors">Close</button>
                </div>
            </div>
        </div>
        {showPinEntry && (
            <PinEntryFlyout
                correctPin={pinForVerification}
                onConfirm={handleCorrectPinForClear}
                onCancel={handleCancelPin}
            />
        )}
        {showClearConfirmation && <ClearAuthConfirmation onConfirm={handleProceedToPinForClear} onCancel={() => setShowClearConfirmation(false)} />}
      </>
    );
  }

  // Render in-progress authorisation view
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

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <fieldset className="p-4 border border-gray-600 rounded-lg">
                        <legend className="px-2 text-sm font-semibold text-gray-300">Flight Summary</legend>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                            <InfoRow label="Syllabus" value={event.flightNumber} />
                            <InfoRow label="Start Time" value={`${Math.floor(event.startTime)}:${String(Math.round((event.startTime % 1) * 60)).padStart(2, '0')}`} />
                            <InfoRow label="Instructor" value={event.instructor} />
                            <InfoRow label="Student" value={getStudentName(event.student)} />
                            <InfoRow label="Aircraft" value={getAircraftType(event.resourceId)} />
                             <InfoRow label="Route" value={`${event.origin}-${event.destination}`} />
                        </div>
                    </fieldset>
                    
                    
                    
                    <div>
                        <label htmlFor="auth-notes" className="block text-sm font-medium text-gray-400">Notes</label>
                        <textarea
                            id="auth-notes"
                            rows={3}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            disabled={!!(event.authoSignedBy ?? event.captainSignedBy)}
                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                            placeholder="Enter any authorisation notes here..."
                        />
                    </div>
                    
                    <div className="space-y-3">
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
                                            disabled={isVerbal}
                                        />
                                        <button 
                                            onClick={() => handleSignClick('autho')} 
                                            disabled={!selectedAutho || (isVerbal && selectedAutho !== selectedCaptain)}
                                            className="w-full px-3 py-1.5 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed"
                                        >
                                            Sign as AUTHO {isVerbal && "(Locked to PIC)"}
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
                        
                        <div className="p-3 bg-gray-900/50 rounded-lg">
                             <div className="mb-3">
                                <h3 className="font-semibold text-gray-300 mb-2">Captain (PIC) - {picName}</h3>
                                {!event.captainSignedBy ? (
                                    <div className="space-y-2">
                                        <StaffSearchDropdown
                                            staff={instructorsList}
                                            selectedStaff={selectedCaptain}
                                            onSelect={(newSelection) => {
                                                setSelectedCaptain(newSelection);
                                                if (isVerbal && !event.authoSignedBy) {
                                                    // When verbal auth is enabled, sync AUTHO to Captain
                                                    setSelectedAutho(newSelection);
                                                }
                                            }}
                                            placeholder="Select Captain (PIC)..."
                                            disabled={!!(event.authoSignedBy && !event.isVerbalAuth)}
                                        />
                                        <button
                                            onClick={() => handleSignClick('captain')}
                                            disabled={!selectedCaptain || !(event.authoSignedBy || event.isVerbalAuth) || (isVerbal && selectedAutho !== selectedCaptain)}
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
                                                (Both AUTHO and PIC must be same person)
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
                            <button
                                onClick={() => setShowClearConfirmation(true)}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-semibold"
                            >
                                Clear Auth
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">Close</button>
                </div>
            </div>
        </div>
        {showAuthConfirmation && <AuthorisationConfirmation onConfirm={handleConfirmAuthForSign} onCancel={handleCancelAuthForSign} />}
        {showPinEntry && (
            <PinEntryFlyout
                correctPin={pinForVerification}
                onConfirm={isClearingAuth ? handleCorrectPinForClear : handleCorrectPinForSign}
                onCancel={handleCancelPin}
            />
        )}
        {showClearConfirmation && <ClearAuthConfirmation onConfirm={handleProceedToPinForClear} onCancel={() => setShowClearConfirmation(false)} />}
    </>
  );
};

export default AuthorisationFlyout;