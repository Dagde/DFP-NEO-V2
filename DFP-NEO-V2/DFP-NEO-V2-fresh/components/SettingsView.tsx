

import React, { useState, useEffect, useMemo } from 'react';
import { initDB, getAllFiles, addFile, getFile, deleteFile } from '../utils/db';
import UploadFileFlyout from './UploadFileFlyout';
import SelectDestinationFlyout from './SelectDestinationFlyout';
import DownloadConfirmationFlyout from './DownloadConfirmationFlyout';
import DeleteFileConfirmationFlyout from './DeleteFileConfirmationFlyout';
import UpdateConfirmationFlyout from './UpdateConfirmationFlyout';
import NewRecordConfirmationFlyout from './NewRecordConfirmationFlyout';
import PermissionsManagerFlyout from './PermissionsManagerFlyout';
import UpdateErrorFlyout from './UpdateErrorFlyout';
import UpdateSummaryFlyout from './UpdateSummaryFlyout';
import ScoringMatrixFlyout from './ScoringMatrixFlyout';
import CourseSelectionFlyout from './CourseSelectionFlyout';
import { CourseSelectionDialog } from './CourseSelectionDialog';
import { Instructor, Trainee, SyllabusItemDetail, InstructorRank, InstructorCategory, SeatConfig, TraineeRank, EventLimits, PhraseBank, MasterCurrency, CurrencyRequirement, FormationCallsign, CancellationRecord, CancellationCode } from '../types';
import ACHistoryPage from './ACHistoryPage';
import FormationCallsignsSection from './FormationCallsignsSection';
import PermissionsManagerWindow from './PermissionsManagerWindow';
import AuditButton from './AuditButton';
import { logAudit } from '../utils/auditLogger';
import { debouncedAuditLog } from '../utils/auditDebounce';
import DutyTurnaroundSection from './DutyTurnaroundSection';
import AircraftAvailabilitySettings from './AircraftAvailabilitySettings';
import EmergencyPage from './EmergencyPage';


declare var XLSX: any;

interface SettingsViewProps {
    hideHeader?: boolean;
    activeSection?: 'scoring-matrix' | 'location' | 'units' | 'duty-turnaround' | 'sct-events' | 'currencies' | 'business-rules' | 'data-loaders' | 'event-limits' | 'permissions' | 'validation' | 'timezone' | 'data-sources' | 'trainee-database' | 'trainee-mockdata' | 'user-list' | 'staff-database' | 'staff-mockdata' | 'staff-combined-data' | 'organisation' | 'appearance' | 'emergency';
    locations: string[];
    onUpdateLocations: (locations: string[]) => void;
    locationAbbreviations?: Record<string, string>;
    onUpdateLocationAbbreviations?: (abbrevs: Record<string, string>) => void;
    serviceDefinitions?: Array<{ longName: string; shortName: string }>;
    onUpdateServiceDefinitions?: (defs: Array<{ longName: string; shortName: string }>) => void;
    units: string[];
    onUpdateUnits: (units: string[]) => void;
    unitLocations: Record<string, string>;
    onUpdateUnitLocations: (locations: Record<string, string>) => void;
    locationOpAreas?: Record<string, string[]>;
    onUpdateLocationOpAreas?: (areas: Record<string, string[]>) => void;
    instructorsData: Instructor[];
    traineesData: Trainee[];
    syllabusDetails: SyllabusItemDetail[];
    onBulkUpdateInstructors: (instructors: Instructor[]) => void;
    onReplaceInstructors: (instructors: Instructor[]) => void;
    onBulkUpdateTrainees: (trainees: Trainee[]) => void;
    onReplaceTrainees: (trainees: Trainee[]) => void;
    onUpdateSyllabus: (syllabus: SyllabusItemDetail[]) => void;
    onShowSuccess: (message: string) => void;
    eventLimits: EventLimits;
    onUpdateEventLimits: (limits: EventLimits) => void;
    phraseBank: PhraseBank;
    onUpdatePhraseBank: (newBank: PhraseBank) => void;
    onNavigate: (view: string) => void;
    masterCurrencies: MasterCurrency[];
    currencyRequirements: CurrencyRequirement[];
    sctEvents: string[];
    onUpdateSctEvents: (events: string[]) => void;
    preferredDutyPeriod: number;
    onUpdatePreferredDutyPeriod: (value: number) => void;
    timezoneOffset: number;
    onUpdateTimezoneOffset: (offset: number) => void;
    maxCrewDutyPeriod: number;
    onUpdateMaxCrewDutyPeriod: (value: number) => void;
    
    flightTurnaround: number;
    onUpdateFlightTurnaround: (value: number) => void;
    ftdTurnaround: number;
    onUpdateFtdTurnaround: (value: number) => void;
    cptTurnaround: number;
    onUpdateCptTurnaround: (value: number) => void;
    currentUserPermission: 'Super Admin' | 'Admin' | 'Staff' | 'Trainee' | 'Ops' | 'Scheduler' | 'Course Supervisor';
    scoringMatrixActiveTab?: 'Airmanship' | 'Preparation' | 'Technique' | 'Elements';
    scoringMatrixReadOnly?: boolean;
    maxDispatchPerHour: number;
    onUpdateMaxDispatchPerHour: (value: number) => void;
    formationCallsigns: FormationCallsign[];
    onUpdateFormationCallsigns: (callsigns: FormationCallsign[]) => void;
    courseColors: { [key: string]: string };
    setCourseColors: (colors: { [key: string]: string }) => void;
    onUpdateTraineeLMPs: (lmpMap: Map<string, SyllabusItemDetail[]>) => void;
    cancellationRecords?: CancellationRecord[];
    cancellationCodes?: CancellationCode[];
    currentAircraftAvailable?: number;
    totalAircraft?: number;
}

// ─── Inline Scoring Matrix Component ────────────────────────────────────────
const INITIAL_ELEMENTS_LIST_INLINE = [
    'Generic Flying Elements',
    'Pre-Post Flight', 'Walk Around', 'Strap-in', 'Ground Checks', 'Airborne Checks',
    'Stationary', 'Visual', 'Effects of Control', 'Trimming', 'Straight and Level',
    'Level medium Turn', 'Level Steep turn', 'Visual - Initial & Pitch', 'Landing',
    'Crosswind', 'Radio Comms', 'Situational Awareness', 'Lookout', 'Knowledge'
];

interface ScoringMatrixInlineProps {
    activeTab: 'Airmanship' | 'Preparation' | 'Technique' | 'Elements';
    phraseBank: PhraseBank;
    onUpdatePhraseBank: (newBank: PhraseBank) => void;
    readOnly?: boolean;
}

const ScoringMatrixInline: React.FC<ScoringMatrixInlineProps> = ({ activeTab, phraseBank, onUpdatePhraseBank, readOnly = false }) => {
    const [showAddElementFlyout, setShowAddElementFlyout] = useState(false);
    const [showDeleteElementFlyout, setShowDeleteElementFlyout] = useState(false);
    const [newElementName, setNewElementName] = useState('');
    const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());
    // Edit mode state for each grade - grades in this set are in edit mode
    const [editModeGrades, setEditModeGrades] = useState<Set<number>>(new Set());

    const toggleEditMode = (grade: number) => {
        const newSet = new Set(editModeGrades);
        if (newSet.has(grade)) {
            newSet.delete(grade);
        } else {
            newSet.add(grade);
        }
        setEditModeGrades(newSet);
    };

    const [flightElements, setFlightElements] = useState<string[]>(() => {
        const customElements = Object.keys(phraseBank).filter(key =>
            !['Airmanship', 'Preparation', 'Technique'].includes(key) && !INITIAL_ELEMENTS_LIST_INLINE.includes(key)
        );
        return [...INITIAL_ELEMENTS_LIST_INLINE, ...customElements];
    });

    const [selectedElement, setSelectedElement] = useState<string>(flightElements[0]);

    const currentDimension = activeTab === 'Elements' ? selectedElement : activeTab;

    const handlePhraseChange = (grade: number, index: number, value: string) => {
        const currentPhrases = (phraseBank && phraseBank[currentDimension]) || {};
        const gradePhrases = currentPhrases[grade] || [];
        const newGradePhrases = [...gradePhrases];
        newGradePhrases[index] = value;
        onUpdatePhraseBank({ ...phraseBank, [currentDimension]: { ...currentPhrases, [grade]: newGradePhrases } });
    };

    const handleAddPhrase = (grade: number) => {
        const currentPhrases = (phraseBank && phraseBank[currentDimension]) || {};
        const gradePhrases = currentPhrases[grade] || [];
        onUpdatePhraseBank({ ...phraseBank, [currentDimension]: { ...currentPhrases, [grade]: [...gradePhrases, ''] } });
    };

    const handleDeletePhrase = (grade: number, index: number) => {
        const currentPhrases = (phraseBank && phraseBank[currentDimension]) || {};
        const gradePhrases = currentPhrases[grade] || [];
        onUpdatePhraseBank({ ...phraseBank, [currentDimension]: { ...currentPhrases, [grade]: gradePhrases.filter((_, i) => i !== index) } });
    };

    const handleSaveNewElement = () => {
        const name = newElementName.trim();
        if (!name) return;
        if (flightElements.includes(name)) { alert('An element with this name already exists.'); return; }
        setFlightElements(prev => [...prev, name]);
        onUpdatePhraseBank({ ...phraseBank, [name]: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] } });
        setSelectedElement(name);
        setNewElementName('');
        setShowAddElementFlyout(false);
    };

    const handleDeleteElements = () => {
        if (selectedToDelete.size === 0) { alert('Please select at least one element to delete.'); return; }
        const newFlightElements = flightElements.filter(el => !selectedToDelete.has(el));
        setFlightElements(newFlightElements);
        const newPhraseBank = { ...phraseBank };
        selectedToDelete.forEach(el => { delete newPhraseBank[el]; });
        onUpdatePhraseBank(newPhraseBank);
        if (selectedToDelete.has(selectedElement)) setSelectedElement(newFlightElements[0] || 'Generic Flying Elements');
        setSelectedToDelete(new Set());
        setShowDeleteElementFlyout(false);
    };

    const getGradeColor = (grade: number) => {
        if (grade >= 4) return 'border-green-500/30 bg-green-900/10';
        if (grade >= 2) return 'border-yellow-500/30 bg-yellow-900/10';
        return 'border-red-500/30 bg-red-900/10';
    };

    const getGradeLabel = (grade: number) => {
        switch(grade) {
            case 5: return '5 - Excellent';
            case 4: return '4 - High Satisfactory';
            case 3: return '3 - Satisfactory';
            case 2: return '2 - Low Satisfactory';
            case 1: return '1 - Marginal';
            case 0: return '0 - Unsatisfactory';
            default: return String(grade);
        }
    };

    return (
        <div className="flex overflow-hidden" style={{ minHeight: '600px' }}>
            {/* Elements sidebar - only shown when Elements tab is active */}
            {activeTab === 'Elements' && (
                <div className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0 overflow-y-auto">
                    <div className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-900/50 flex justify-between items-center">
                        <span>Flight Elements</span>
                        {!readOnly && (
                            <div className="flex space-x-1">
                                <button
                                    onClick={() => setShowDeleteElementFlyout(true)}
                                    className="p-1 rounded-full bg-gray-700 hover:bg-gray-600"
                                    title="Delete flight element(s)"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setShowAddElementFlyout(true)}
                                    className="p-1 rounded-full bg-gray-700 hover:bg-gray-600"
                                    title="Add new flight element"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-sky-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                    {flightElements.map((el) => (
                        <button
                            key={el}
                            onClick={() => setSelectedElement(el)}
                            className={`text-left px-4 py-3 border-l-4 transition-colors font-medium text-sm ${
                                selectedElement === el
                                    ? 'border-sky-500 bg-gray-700 text-white'
                                    : 'border-transparent text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                            }`}
                        >
                            {el}
                        </button>
                    ))}
                </div>
            )}

            {/* Phrase editing area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-900">
                <div className="mb-4">
                    <h3 className="text-2xl font-bold text-sky-400">{currentDimension}</h3>
                    <p className="text-gray-400 text-sm">Define standardized phrases for each grade level.</p>
                </div>

                {[5, 4, 3, 2, 1, 0].map(grade => (
                    <div key={grade} className={`border rounded-lg overflow-hidden ${getGradeColor(grade)}`}>
                        <div className="px-4 py-2 font-bold text-sm border-b border-gray-700/30 flex justify-between items-center">
                            <span className="text-white opacity-90">{getGradeLabel(grade)}</span>
                            {!readOnly && (
                                <div className="flex items-center space-x-2">
                                    {editModeGrades.has(grade) ? (
                                        <>
                                            <button
                                                onClick={() => toggleEditMode(grade)}
                                                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors border border-green-500 font-semibold"
                                            >
                                                ✓ Save
                                            </button>
                                            <button
                                                onClick={() => handleAddPhrase(grade)}
                                                className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors border border-gray-600"
                                            >
                                                + Add Phrase
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => toggleEditMode(grade)}
                                            className="text-xs bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded transition-colors border border-sky-500 font-semibold"
                                        >
                                            ✎ Edit
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-4 space-y-2">
                            {(phraseBank && phraseBank[currentDimension] && phraseBank[currentDimension][grade]) ? (
                                phraseBank[currentDimension][grade].map((phrase, idx) => (
                                    <div key={idx} className="flex items-start space-x-2 group">
                                        <textarea
                                            value={phrase}
                                            onChange={(e) => { if (!readOnly && editModeGrades.has(grade)) handlePhraseChange(grade, idx, e.target.value); }}
                                            readOnly={readOnly || !editModeGrades.has(grade)}
                                            rows={1}
                                            className={`flex-1 rounded p-2 text-sm resize-none overflow-hidden transition-colors ${
                                                readOnly
                                                    ? 'bg-gray-800/50 border border-gray-700 text-gray-400 cursor-default'
                                                    : editModeGrades.has(grade)
                                                        ? 'bg-gray-800 border border-gray-600 text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500'
                                                        : 'bg-transparent border border-transparent text-gray-300 cursor-default'
                                            }`}
                                            style={{ minHeight: '38px', height: 'auto' }}
                                            onInput={(e) => {
                                                const target = e.currentTarget;
                                                target.style.height = 'auto';
                                                target.style.height = `${target.scrollHeight}px`;
                                            }}
                                        />
                                        {!readOnly && editModeGrades.has(grade) && (
                                            <button
                                                onClick={() => handleDeletePhrase(grade, idx)}
                                                className="p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Delete phrase"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-gray-500 italic pl-1">No phrases defined.</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Element Flyout */}
            {!readOnly && showAddElementFlyout && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center" onClick={() => setShowAddElementFlyout(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                            <h2 className="text-xl font-bold text-white">Add New Flight Element</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400">Element Name</label>
                                <input
                                    type="text"
                                    value={newElementName}
                                    onChange={e => setNewElementName(e.target.value)}
                                    autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveNewElement(); }}
                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                            <button onClick={() => setShowAddElementFlyout(false)} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancel</button>
                            <button onClick={handleSaveNewElement} disabled={!newElementName.trim()} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:bg-gray-500 disabled:cursor-not-allowed">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Element Flyout */}
            {!readOnly && showDeleteElementFlyout && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center" onClick={() => setShowDeleteElementFlyout(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                            <h2 className="text-xl font-bold text-white">Delete Flight Elements</h2>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            {flightElements.length > 0 ? (
                                <ul className="space-y-2">
                                    {flightElements.map(element => (
                                        <li key={element}>
                                            <label className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedToDelete.has(element)}
                                                    onChange={() => {
                                                        const newSet = new Set(selectedToDelete);
                                                        if (newSet.has(element)) newSet.delete(element); else newSet.add(element);
                                                        setSelectedToDelete(newSet);
                                                    }}
                                                    className="h-4 w-4 accent-red-500 bg-gray-600"
                                                />
                                                <span className="text-sm text-gray-300">{element}</span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500 text-center italic">No elements to delete.</p>
                            )}
                        </div>
                        <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                            <button onClick={() => setShowDeleteElementFlyout(false)} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancel</button>
                            <button onClick={handleDeleteElements} disabled={selectedToDelete.size === 0} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-500 disabled:cursor-not-allowed">Delete Selected</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
// ─────────────────────────────────────────────────────────────────────────────

const FolderIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-400 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
);

const FileIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
);

const UpdateIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
    </svg>
);


// FIX: Export the component to make it available for import.
export const SettingsView: React.FC<SettingsViewProps> = ({ 
    hideHeader = false,
    locations, onUpdateLocations,
    locationAbbreviations = {}, onUpdateLocationAbbreviations,
    serviceDefinitions = [
        { longName: 'Air Force', shortName: 'RAAF' },
        { longName: 'Navy',      shortName: 'RAN'  },
        { longName: 'Army',      shortName: 'ARA'  },
    ], onUpdateServiceDefinitions,
    units, onUpdateUnits, 
    unitLocations, onUpdateUnitLocations,
    locationOpAreas = {}, onUpdateLocationOpAreas,
    instructorsData, traineesData, syllabusDetails,
    onBulkUpdateInstructors, onReplaceInstructors,
    onBulkUpdateTrainees, onReplaceTrainees,
    onUpdateSyllabus, onShowSuccess,
    eventLimits, onUpdateEventLimits,
    phraseBank, onUpdatePhraseBank,
    onNavigate,
    masterCurrencies,
    currencyRequirements,
    sctEvents,
    onUpdateSctEvents,
    preferredDutyPeriod,
    onUpdatePreferredDutyPeriod,
    maxCrewDutyPeriod,
    onUpdateMaxCrewDutyPeriod,
    flightTurnaround,
    onUpdateFlightTurnaround,
    ftdTurnaround,
    onUpdateFtdTurnaround,
    cptTurnaround,
    onUpdateCptTurnaround,
    currentUserPermission,
    activeSection = 'scoring-matrix',
    scoringMatrixActiveTab,
    scoringMatrixReadOnly = false,
    maxDispatchPerHour,
    onUpdateMaxDispatchPerHour,
    timezoneOffset,
    onUpdateTimezoneOffset,
    
    formationCallsigns,
    onUpdateFormationCallsigns,
    courseColors,
    setCourseColors,
    onUpdateTraineeLMPs,
    cancellationRecords,
    cancellationCodes,
    currentAircraftAvailable,
    totalAircraft
}) => {
    // --- STATE ---
    
    // Permission Check - Only Super Admin, Admin, and Scheduler can edit Settings
    const canEditSettings = ['Super Admin', 'Admin', 'Scheduler'].includes(currentUserPermission);
    
    // Location State
    const [isEditingLocations, setIsEditingLocations] = useState(false);
    const [tempLocations, setTempLocations] = useState<string[]>([]);
    const [newLocation, setNewLocation] = useState('');
    const [tempLocationAbbreviations, setTempLocationAbbreviations] = useState<Record<string, string>>({});

    // Services state
    const [isEditingServices, setIsEditingServices] = useState(false);
    const [tempServiceDefs, setTempServiceDefs] = useState<Array<{ longName: string; shortName: string }>>([]);
    const [newServiceLong, setNewServiceLong] = useState('');
    const [newServiceShort, setNewServiceShort] = useState('');

    // Op Areas State
    const [isEditingOpAreas, setIsEditingOpAreas] = useState(false);
    const [selectedOpAreaLocation, setSelectedOpAreaLocation] = useState<string>('');
    const [tempOpAreas, setTempOpAreas] = useState<Record<string, string[]>>({});
    const [newOpArea, setNewOpArea] = useState('');

    // Unit State
    const [isEditingUnits, setIsEditingUnits] = useState(false);
    const [tempUnits, setTempUnits] = useState<string[]>([]);
    const [newUnit, setNewUnit] = useState('');
    const [tempUnitLocations, setTempUnitLocations] = useState<Record<string, string>>({});
    
    // SCT Events State
    const [isEditingSctEvents, setIsEditingSctEvents] = useState(false);
    
    // Permissions Manager State
    const [showPermissionsManager, setShowPermissionsManager] = useState(false);
    const [tempSctEvents, setTempSctEvents] = useState<string[]>([]);
    const [newSctEvent, setNewSctEvent] = useState('');
    
    // Currency Details Panel State
    const [selectedCurrency, setSelectedCurrency] = useState<MasterCurrency | null>(null);
    
    // Event Limits State
    const [isEditingLimits, setIsEditingLimits] = useState(false);
    const [tempLimits, setTempLimits] = useState<EventLimits>(eventLimits);

    // Scoring Matrix State
    const [showScoringMatrix, setShowScoringMatrix] = useState(false);
    const [scoringMatrixTab, setScoringMatrixTab] = useState<'Airmanship' | 'Preparation' | 'Technique' | 'Elements'>('Airmanship');

    // Data Loader State
    const [repoFiles, setRepoFiles] = useState<{ id: string; name: string; folderId: string }[]>([]);
    const [folders] = useState([
        { id: 'instructor_loads', name: 'Instructor Loads' },
        { id: 'trainee_loads', name: 'Trainee Loads' },
        { id: 'lmp_loads', name: 'LMP Loads' },
        { id: 'logbook_templates', name: 'Logbook Template' },
        { id: 'miscellaneous', name: 'Miscellaneous' },
        { id: 'trainee_data', name: 'Trainee Data' },
        { id: 'trainee_logbook', name: 'Logbook', isSub: true },
        { id: 'staff_data', name: 'Staff Data' },
        { id: 'staff_logbook', name: 'Logbook', isSub: true },
    ]);
    const [showUpload, setShowUpload] = useState(false);
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    const [showSelectDestination, setShowSelectDestination] = useState(false);
    const [fileToDownload, setFileToDownload] = useState<{ id: string; name: string } | null>(null);
    const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);

    // Update process state
    const [fileToProcess, setFileToProcess] = useState<{ id: string; name: string; folderId: string } | null>(null);
    const [showUpdateConfirmation, setShowUpdateConfirmation] = useState(false);
    const [showCourseSelection, setShowCourseSelection] = useState(false);
    const [selectedUpdateType, setSelectedUpdateType] = useState<'bulk' | 'minor'>('minor');
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [coursesFromFile, setCoursesFromFile] = useState<string[]>([]);
    const [showNewRecordConfirm, setShowNewRecordConfirm] = useState(false);
    const [unmatchedRowData, setUnmatchedRowData] = useState<any>(null);
    const [showUpdateError, setShowUpdateError] = useState(false);
    const [updateErrorMessage, setUpdateErrorMessage] = useState('');
    const [showUpdateSummary, setShowUpdateSummary] = useState(false);
    const [updateSummary, setUpdateSummary] = useState({ added: 0, updated: 0, replaced: 0, skipped: 0, type: '' });
    
    // State for iterative 'minor' update
    const [isMinorUpdateInProgress, setIsMinorUpdateInProgress] = useState(false);
    const [rowsToProcess, setRowsToProcess] = useState<any[]>([]);
    const [updatedRecords, setUpdatedRecords] = useState<any[]>([]);
    const [newRecords, setNewRecords] = useState<any[]>([]);
    const [skippedCount, setSkippedCount] = useState(0);

    // --- COMPUTED / MEMOIZED ---
    const folderIds = useMemo(() => new Set(folders.map(f => f.id)), [folders]);
    const uncategorizedFiles = useMemo(() => repoFiles.filter(file => !folderIds.has(file.folderId)), [repoFiles, folderIds]);

    // Derive active courses from courseColors (same as CourseRosterView)
    const activeCourses = useMemo(() => {
        return Object.keys(courseColors).sort((a, b) => a.localeCompare(b));
    }, [courseColors]);

    // Helper function for safe name sorting
    const safeNameSort = (a: any, b: any) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
    };

    const visibleCurrencies = useMemo(() => {
        return [...masterCurrencies, ...currencyRequirements]
            .filter(c => c.isVisible)
            .sort(safeNameSort);
    }, [masterCurrencies, currencyRequirements]);


    // --- EFFECTS ---
    useEffect(() => {
        const initAndFetch = async () => {
            try {
                await initDB();
                refreshFiles();
            } catch (error) {
                console.error("Failed to initialize DB:", error);
            }
        };
        initAndFetch();
    }, []);
    
    useEffect(() => {
        if (isMinorUpdateInProgress && rowsToProcess.length > 0) {
            processNextRow();
        } else if (isMinorUpdateInProgress && rowsToProcess.length === 0) {
            // Processing finished
            finishMinorUpdate();
        }
    }, [isMinorUpdateInProgress, rowsToProcess]);


    // --- HANDLERS ---
    
    // Helper function to check if a section should be displayed
    const shouldShowSection = (sectionName: string) => {
        // If no activeSection is set, show all sections (standalone mode)
        if (!activeSection) return true;
        // Otherwise, only show the active section
        return activeSection === sectionName;
    };
    
    const refreshFiles = async () => {
        const files = await getAllFiles();
        setRepoFiles(files);
    };

    // Op Areas Handlers
    const handleEditOpAreas = () => {
        setTempOpAreas({ ...locationOpAreas });
        setSelectedOpAreaLocation(locations[0] || '');
        setIsEditingOpAreas(true);
    };
    const handleSaveOpAreas = () => {
        if (onUpdateLocationOpAreas) onUpdateLocationOpAreas(tempOpAreas);
        setIsEditingOpAreas(false);
        logAudit('Settings - Op Areas', 'Update', 'Updated operating areas per location');
    };
    const handleCancelOpAreas = () => {
        setIsEditingOpAreas(false);
        setNewOpArea('');
    };
    const handleAddOpArea = () => {
        const val = newOpArea.trim().toUpperCase();
        if (!val || !selectedOpAreaLocation) return;
        const existing = tempOpAreas[selectedOpAreaLocation] || [];
        if (existing.includes(val)) return;
        setTempOpAreas({ ...tempOpAreas, [selectedOpAreaLocation]: [...existing, val].sort() });
        setNewOpArea('');
    };
    const handleRemoveOpArea = (loc: string, area: string) => {
        const existing = tempOpAreas[loc] || [];
        setTempOpAreas({ ...tempOpAreas, [loc]: existing.filter(a => a !== area) });
    };

    // Location Handlers
    const handleEditLocations = () => {
        setTempLocations([...locations]);
        setTempLocationAbbreviations({ ...locationAbbreviations });
        setIsEditingLocations(true);
    };

    const handleSaveLocations = () => {
        const oldLocations = locations.join(', ');
        const newLocations = tempLocations.join(', ');
        onUpdateLocations(tempLocations);
        if (onUpdateLocationAbbreviations) onUpdateLocationAbbreviations(tempLocationAbbreviations);
        setIsEditingLocations(false);
        logAudit({
            page: 'Settings - Location',
            action: 'update',
            description: 'Updated operating locations',
            changes: `From: [${oldLocations}] To: [${newLocations}]`
        });
    };

    const handleCancelLocations = () => {
        setNewLocation('');
        setIsEditingLocations(false);
    };

    // Services Handlers
    const handleEditServices = () => {
        setTempServiceDefs([...serviceDefinitions]);
        setIsEditingServices(true);
    };

    const handleSaveServices = () => {
        if (onUpdateServiceDefinitions) onUpdateServiceDefinitions(tempServiceDefs);
        setIsEditingServices(false);
        logAudit({
            page: 'Settings - Services',
            action: 'update',
            description: 'Updated service definitions',
            changes: tempServiceDefs.map(s => `${s.longName} (${s.shortName})`).join(', ')
        });
    };

    const handleCancelServices = () => {
        setNewServiceLong('');
        setNewServiceShort('');
        setIsEditingServices(false);
    };

    const handleAddService = () => {
        const ln = newServiceLong.trim();
        const sn = newServiceShort.trim().toUpperCase();
        if (!ln || !sn) return;
        if (tempServiceDefs.some(s => s.shortName === sn)) return; // no duplicates
        setTempServiceDefs([...tempServiceDefs, { longName: ln, shortName: sn }]);
        setNewServiceLong('');
        setNewServiceShort('');
    };

    const handleRemoveService = (shortName: string) => {
        setTempServiceDefs(tempServiceDefs.filter(s => s.shortName !== shortName));
    };
    
    const handleAddLocation = () => {
        if (newLocation && !tempLocations.includes(newLocation)) {
            setTempLocations([...tempLocations, newLocation]);
            setNewLocation('');
        }
    };

    const handleRemoveLocation = (locationToRemove: string) => {
        setTempLocations(tempLocations.filter(loc => loc !== locationToRemove));
    };

    // Unit Handlers
    const handleEditUnits = () => {
        setTempUnits([...units]);
        setTempUnitLocations({...unitLocations});
        setIsEditingUnits(true);
    };
    
    const handleSaveUnits = () => {
        const oldUnits = units.join(', ');
        const newUnits = tempUnits.join(', ');
        onUpdateUnits(tempUnits);
        
        const newUnitLocations: Record<string, string> = {};
        for(const unit of tempUnits) {
            newUnitLocations[unit] = tempUnitLocations[unit];
        }
        onUpdateUnitLocations(newUnitLocations);

        setIsEditingUnits(false);
        logAudit({
            page: 'Settings - Units',
            action: 'update',
            description: 'Updated organizational units and locations',
            changes: `From: [${oldUnits}] To: [${newUnits}]`
        });
    };

    const handleCancelUnits = () => {
        setNewUnit('');
        setIsEditingUnits(false);
    };

    const handleAddUnit = () => {
        if (newUnit && !tempUnits.includes(newUnit)) {
            setTempUnits([...tempUnits, newUnit]);
            setTempUnitLocations(prev => ({...prev, [newUnit]: locations[0] || ''}));
            setNewUnit('');
        }
    };

    const handleRemoveUnit = (unitToRemove: string) => {
        setTempUnits(tempUnits.filter(unit => unit !== unitToRemove));
        const newTempLocations = {...tempUnitLocations};
        delete newTempLocations[unitToRemove];
        setTempUnitLocations(newTempLocations);
    };

    // SCT Events Handlers
    const handleEditSctEvents = () => {
        setTempSctEvents([...sctEvents]);
        setIsEditingSctEvents(true);
    };

    const handleSaveSctEvents = () => {
        const oldEvents = sctEvents.join(', ');
        const newEvents = tempSctEvents.join(', ');
        onUpdateSctEvents(tempSctEvents);
        setIsEditingSctEvents(false);
        logAudit({
            page: 'Settings - SCT Events',
            action: 'update',
            description: 'Updated SCT event types',
            changes: `From: [${oldEvents}] To: [${newEvents}]`
        });
    };

    const handleCancelSctEvents = () => {
        setNewSctEvent('');
        setIsEditingSctEvents(false);
    };

    const handleAddSctEvent = () => {
        if (newSctEvent && !tempSctEvents.includes(newSctEvent)) {
            setTempSctEvents([...tempSctEvents, newSctEvent]);
            setNewSctEvent('');
        }
    };

    const handleRemoveSctEvent = (eventToRemove: string) => {
        setTempSctEvents(tempSctEvents.filter(evt => evt !== eventToRemove));
    };

    const handleTempUnitLocationChange = (unit: string, location: string) => {
        setTempUnitLocations(prev => ({
            ...prev,
            [unit]: location
        }));
    };

    // Event Limits Handlers
    const handleEditLimits = () => {
        setTempLimits(JSON.parse(JSON.stringify(eventLimits)));
        setIsEditingLimits(true);
    };

    const handleSaveLimits = () => {
        onUpdateEventLimits(tempLimits);
        setIsEditingLimits(false);
        onShowSuccess('Events limits updated');
        logAudit({
            page: 'Settings - Event Limits',
            action: 'update',
            description: 'Updated event scheduling limits',
            changes: 'Updated limits for QFI, Staff, Trainee, and SIM IP categories'
        });
    };

    // Duty & Turnaround Handlers with Audit Logging
    const handleUpdatePreferredDutyPeriod = (value: number) => {
        onUpdatePreferredDutyPeriod(value);
        logAudit({
            page: 'Settings - Duty & Turnaround',
            action: 'update',
            description: 'Updated preferred duty period',
            changes: `Set to: ${value} hours`
        });
    };

    const handleUpdateMaxCrewDutyPeriod = (value: number) => {
        onUpdateMaxCrewDutyPeriod(value);
        logAudit({
            page: 'Settings - Duty & Turnaround',
            action: 'update',
            description: 'Updated max crew duty period',
            changes: `Set to: ${value} hours`
        });
    };

    const handleUpdateFlightTurnaround = (value: number) => {
        onUpdateFlightTurnaround(value);
        logAudit({
            page: 'Settings - Duty & Turnaround',
            action: 'update',
            description: 'Updated flight turnaround time',
            changes: `Set to: ${value} minutes`
        });
    };

    const handleUpdateFtdTurnaround = (value: number) => {
        onUpdateFtdTurnaround(value);
        logAudit({
            page: 'Settings - Duty & Turnaround',
            action: 'update',
            description: 'Updated FTD turnaround time',
            changes: `Set to: ${value} minutes`
        });
    };

    const handleUpdateCptTurnaround = (value: number) => {
        onUpdateCptTurnaround(value);
        logAudit({
            page: 'Settings - Duty & Turnaround',
            action: 'update',
            description: 'Updated CPT turnaround time',
            changes: `Set to: ${value} minutes`
        });
    };

    // Scoring Matrix Handlers
    const handleOpenScoringMatrix = (tab: 'Airmanship' | 'Preparation' | 'Technique' | 'Elements') => {
        setScoringMatrixTab(tab);
        setShowScoringMatrix(true);
    };

    const handleUpdatePhraseBank = (newBank: PhraseBank) => {
        onUpdatePhraseBank(newBank);
        // Use debounced audit log - waits 3 seconds after last change before recording
        // This prevents multiple entries when typing in a textarea
        debouncedAuditLog(
            'scoring-matrix-phrase-bank',
            {
                page: 'Settings - Scoring Matrix',
                action: 'update',
                description: 'Updated scoring matrix phrase bank',
                changes: 'Modified scoring criteria and phrases'
            },
            (page, action, description, changes) => logAudit({ page, action, description, changes })
        );
    };

    // Data Loader Handlers
    const handleUploadClick = () => {
        setShowUpload(true);
    };

    const handleUploadConfirm = (file: File) => {
        setFileToUpload(file);
        setShowUpload(false);
        setShowSelectDestination(true);
    };
    
    const handleDestinationConfirm = async (folderId: string) => {
        if (fileToUpload) {
            const now = new Date();
            const year = now.getFullYear().toString().slice(-2);
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const formattedDate = `${year}${month}${day}`;

            const folder = folders.find(f => f.id === folderId);
            const folderName = folder ? folder.name.replace(/\s+/g, '_') : 'Uncategorized';

            const originalFileName = fileToUpload.name;
            const newFileName = `${formattedDate}_${folderName}_${originalFileName}`;

            await addFile(fileToUpload, folderId, newFileName);
            refreshFiles();
            logAudit({
                page: 'Settings - Data Loaders',
                action: 'create',
                description: `Uploaded file to ${folderName}`,
                changes: `File: ${newFileName}`
            });
        }
        setShowSelectDestination(false);
        setFileToUpload(null);
    };

    const handleDownloadClick = (file: { id: string; name: string }) => {
        setFileToDownload(file);
    };

    const handleDownloadConfirm = async () => {
        if (fileToDownload) {
            const record = await getFile(fileToDownload.id);
            if (record) {
                const url = URL.createObjectURL(record.content);
                const a = document.createElement('a');
                a.href = url;
                a.download = record.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            setFileToDownload(null);
        }
    };

    const handleDeleteClick = (file: { id: string; name: string }) => {
        setFileToDelete(file);
    };

    const handleDeleteConfirm = async () => {
        if (fileToDelete) {
            await deleteFile(fileToDelete.id);
            refreshFiles();
            logAudit({
                page: 'Settings - Data Loaders',
                action: 'delete',
                description: 'Deleted file from data loaders',
                changes: `File: ${fileToDelete.name}`
            });
            setFileToDelete(null);
        }
    };

    const handleDownloadInstructorTemplate = () => {
        const link = document.createElement('a');
        link.href = '/Staff_Bulk_Update_Template.xlsx';
        link.download = 'Staff_Bulk_Update_Template.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadTraineeTemplate = () => {
        const link = document.createElement('a');
        link.href = '/Trainee_Bulk_Update_Template.xlsx';
        link.download = 'Trainee_Bulk_Update_Template.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleDownloadLmpTemplate = () => {
        const link = document.createElement('a');
        link.href = '/LMP_Syllabus_Template.xlsx';
        link.download = 'LMP_Syllabus_Template.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadLogbookTemplate = () => {
        const headers = ['Date', 'Aircraft', 'Pilot', 'Student', 'Sortie', 'Duration', 'Result'];
        const ws = XLSX.utils.json_to_sheet([{}], { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Logbook");
        XLSX.writeFile(wb, "Logbook_Template.xlsx");
    };
    
    const handleDownloadManual = () => {
        const manualHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Daily Flying Program (DFP) Scheduler - User Manual</title>
                <style>
                    body { font-family: Calibri, sans-serif; line-height: 1.6; color: #333; }
                    h1, h2, h3, h4 { font-family: 'Cambria', serif; color: #2F5496; }
                    h1 { font-size: 24pt; border-bottom: 2px solid #4472C4; padding-bottom: 5px; }
                    h2 { font-size: 18pt; border-bottom: 1px solid #A9A9A9; padding-bottom: 3px; margin-top: 2em; }
                    h3 { font-size: 14pt; color: #4472C4; margin-top: 1.5em; }
                    p { margin: 0 0 1em 0; }
                    ul { margin-bottom: 1em; }
                    strong { color: #1F3864; }
                    .image-placeholder {
                        border: 2px dashed #A9A9A9;
                        padding: 20px;
                        margin: 20px 0;
                        background-color: #F0F0F0;
                        text-align: center;
                        font-style: italic;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <h1>Daily Flying Program (DFP) Scheduler - User Manual</h1>
                <p>...</p> 
            </body>
            </html>
        `;

        const blob = new Blob([manualHtml], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'DFP_User_Manual.doc';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- Data Update Logic ---
    const handleUpdateIconClick = (file: { id: string, name: string, folderId: string }) => {
        setFileToProcess(file);
        setShowUpdateConfirmation(true);
    };

    const handleUpdateConfirm = async (pin: string, updateType: 'bulk' | 'minor') => {
        if (pin !== '1111') { 
            onShowSuccess('Incorrect PIN.');
            return;
        }
        setShowUpdateConfirmation(false);
        setSelectedUpdateType(updateType);
        
        // For trainee updates, extract courses from file and show course selection
        if (fileToProcess?.folderId === 'trainee_loads') {
            await extractCoursesFromFile();
            setShowCourseSelection(true);
        } else {
            // For instructor and LMP updates, proceed directly
            processFileUpdate(updateType, '');
        }
    };

    const extractCoursesFromFile = async () => {
        if (!fileToProcess) return;
        
        try {
            const fileRecord = await getFile(fileToProcess.id);
            if (!fileRecord) return;
            
            const data = await fileRecord.content.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet);
            
            // Extract unique courses from the file
            const coursesInFile = new Set<string>();
            jsonRows.forEach(row => {
                // Try to get course from combined Course Prefix + Course Number
                const coursePrefix = getStr(row, ['Course Prefix', 'coursePrefix']);
                const courseNumber = getStr(row, ['Course Number', 'courseNumber']);
                if (coursePrefix && courseNumber) {
                    coursesInFile.add(`${coursePrefix}${courseNumber}`);
                } else {
                    // Fallback to single Course column
                    const course = getStr(row, ['Course']);
                    if (course) coursesInFile.add(course);
                }
            });
            
            setCoursesFromFile(Array.from(coursesInFile));
        } catch (error) {
            console.error("Error extracting courses from file:", error);
        }
    };

    const handleCourseSelection = (course: string) => {
        setSelectedCourse(course);
        setShowCourseSelection(false);
        processFileUpdate(selectedUpdateType, course);
    };

    const processFileUpdate = async (updateType: 'bulk' | 'minor', course: string) => {
        if (!fileToProcess) return;

        try {
            const fileRecord = await getFile(fileToProcess.id);
            if (!fileRecord) throw new Error('File not found');

            const data = await fileRecord.content.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet);

            if (updateType === 'bulk') {
                handleBulkUpdate(jsonRows, course);
            } else {
                startMinorUpdate(jsonRows, course);
            }
        } catch (error) {
            console.error("File processing error:", error);
            onShowSuccess(`Error processing file: ${(error as Error).message}`);
        }
    };
    
    // Helper to get a value from a row with fuzzy key matching
    const getValueFromRow = (row: any, possibleKeys: string[]): any => {
        for (const pKey of possibleKeys) {
            // Try exact match first
            if (row[pKey] !== undefined) return row[pKey];
        }
        // Then try case-insensitive, space-insensitive match
        const rowKeys = Object.keys(row);
        for (const pKey of possibleKeys) {
            const lowerPKey = pKey.toLowerCase().replace(/[\s/]/g, '');
            for (const rowKey of rowKeys) {
                if (rowKey.toLowerCase().replace(/[\s/]/g, '') === lowerPKey) {
                    return row[rowKey];
                }
            }
        }
        return undefined;
    };

    const parseBoolean = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
        return !!value;
    };

    const getStr = (row: any, keys: string[]) => {
        const val = getValueFromRow(row, keys);
        return val !== undefined ? String(val).trim() : undefined;
    };
    const getNum = (row: any, keys: string[]) => {
        const val = getValueFromRow(row, keys);
        if (val === undefined || val === null || String(val).trim() === '') return undefined;
        // Handle numbers with trailing letters (e.g., '1.2D')
        const num = parseFloat(String(val).replace(/[A-Za-z]/g, '').trim());
        return isNaN(num) ? undefined : num;
    };
    const getStrArray = (row: any, keys: string[]) => {
        const val = getValueFromRow(row, keys);
        if (val === undefined || val === null) return undefined;
        return String(val).split(';').map(s => s.trim()).filter(Boolean);
    };

    const parseInstructorRow = (row: any): Partial<Instructor> | null => {
        const idValue = getNum(row, ['PMKeys/ID', 'idNumber']);
        if (idValue === undefined) return null;

        const parsed: Partial<Instructor> = { idNumber: idValue };
        
        const surname = getStr(row, ['Srname', 'Surname', 'Last Name']);
        const firstname = getStr(row, ['First name', 'Firstname', 'Given Name']);
        if (surname && firstname) parsed.name = `${surname}, ${firstname}`;

        const rank = getStr(row, ['Rank']); if (rank) parsed.rank = rank as InstructorRank;
        const callsign = getNum(row, ['callsign number', 'callsignnumber']); if (callsign !== undefined) parsed.callsignNumber = callsign;
        const service = getStr(row, ['Service']); if (service) parsed.service = service as 'RAAF' | 'RAN' | 'ARA';
        const category = getStr(row, ['Category']); if (category) parsed.category = category as InstructorCategory;
        const seatConfig = getStr(row, ['Seat config', 'seatConfig']); if (seatConfig) parsed.seatConfig = seatConfig as SeatConfig;
        
        const rolesStr = getStr(row, ['Roles']);
        if (rolesStr) {
            const rolesLower = rolesStr.toLowerCase();
            parsed.isExecutive = rolesLower.includes('executive');
            parsed.isFlyingSupervisor = rolesLower.includes('supervisor');
            parsed.isTestingOfficer = rolesLower.includes('testing');
            parsed.isIRE = rolesLower.includes('ire');
        }

        return parsed;
    };

    const parseTraineeRow = (row: any): Partial<Trainee> | null => {
        const rowKeys = Object.keys(row);
        
        // Try to find PMKeys/ID with detailed logging
        const idValue = getNum(row, ['PMKeys/ID', 'idNumber']);
        if (idValue === undefined) {
            // Check what keys exist related to ID
            const idRelatedKeys = rowKeys.filter(k => k.toLowerCase().includes('id') || k.toLowerCase().includes('pm') || k.toLowerCase().includes('key'));
            console.warn('🔴 [PARSE] Row missing idNumber. Row keys:', rowKeys.join(', '));
            console.warn('🔴 [PARSE] ID-related keys found:', idRelatedKeys.join(', '));
            console.warn('🔴 [PARSE] Full row:', JSON.stringify(row));
            return null;
        }

        const parsed: Partial<Trainee> = { idNumber: idValue };

        // Try to get name from combined "Name" column first
        // The template column is "Name\n [Surname, Firstname]" — try multiple variants
        const nameField = getStr(row, [
            'Name\n [Surname, Firstname]',
            'Name [Surname, Firstname]',
            'Name  [Surname, Firstname]',
            'Name',
            'Full Name',
            'FullName'
        ]);
        if (nameField) {
            parsed.name = nameField;
            console.log(`✅ [PARSE] ID=${idValue} name from combined field: "${nameField}"`);
        } else {
            // Fallback to separate Surname and Firstname columns
            const surname = getStr(row, ['Surname', 'Last Name']);
            const firstname = getStr(row, ['First Name', 'Firstname', 'Given Name']);
            if (surname && firstname) {
                parsed.name = `${surname}, ${firstname}`;
                console.log(`✅ [PARSE] ID=${idValue} name from Surname+Firstname: "${parsed.name}"`);
            } else {
                // Last resort: check all keys for any name-like field
                const nameKey = rowKeys.find(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('surname'));
                if (nameKey && row[nameKey]) {
                    parsed.name = String(row[nameKey]);
                    console.warn(`🟡 [PARSE] ID=${idValue} name from fallback key "${nameKey}": "${parsed.name}"`);
                } else {
                    console.error(`🔴 [PARSE] ID=${idValue} — NO NAME FOUND. Row keys: ${rowKeys.join(', ')}`);
                    console.error(`🔴 [PARSE] Row values:`, JSON.stringify(row));
                }
            }
        }

        // Course: Combine Course Prefix + Course Number
        const coursePrefix = getStr(row, ['Course Prefix', 'coursePrefix']);
        const courseNumber = getStr(row, ['Course Number', 'courseNumber']);
        if (coursePrefix && courseNumber) {
            parsed.course = `${coursePrefix}${courseNumber}`;
        } else {
            // Fallback to single Course column if exists
            const course = getStr(row, ['Course']); 
            if (course) parsed.course = course;
        }

        // LMP Type
        const lmpType = getStr(row, ['LMP', 'lmpType']); 
        if (lmpType) parsed.lmpType = lmpType;

        const rank = getStr(row, ['Rank']); if (rank) parsed.rank = rank as TraineeRank;
        
        // Callsign - updated to match template column name
        const callsign = getStr(row, ['Callsign', 'callsign']); 
        if (callsign) parsed.callsignNumber = parseInt(callsign) || undefined;
        
        const serviceRaw = getStr(row, ['Service']);
        if (serviceRaw) {
            // Normalise free-text service values to the exact enum the DB expects
            const svc = serviceRaw.trim().toLowerCase();
            if (svc === 'raaf' || svc === 'air force' || svc === 'airforce' || svc === 'royal australian air force') {
                parsed.service = 'RAAF';
            } else if (svc === 'ran' || svc === 'navy' || svc === 'royal australian navy') {
                parsed.service = 'RAN';
            } else if (svc === 'ara' || svc === 'army' || svc === 'australian army') {
                parsed.service = 'ARA';
            } else {
                // Pass through as-is (may be already correct enum value)
                parsed.service = serviceRaw as 'RAAF' | 'RAN' | 'ARA';
            }
        }
        const unit = getStr(row, ['Unit']); if (unit) parsed.unit = unit;
        
        // Flight - new field
        const flight = getStr(row, ['Flight', 'flight']); 
        if (flight) parsed.flight = flight;
        
        const location = getStr(row, ['Location']); if (location) parsed.location = location;
        const seatConfigRaw = getStr(row, ['Seat Config', 'seatConfig', 'Seat config']);
        if (seatConfigRaw) {
            // Normalise seat config to valid enum values
            const sc = seatConfigRaw.trim().toLowerCase();
            if (sc === 'normal' || sc === 'norm') {
                parsed.seatConfig = 'Normal';
            } else if (sc === 'fwd/short' || sc === 'forward/short' || sc === 'fwd' || sc === 'front') {
                parsed.seatConfig = 'FWD/SHORT';
            } else if (sc === 'rear/short' || sc === 'rear') {
                parsed.seatConfig = 'REAR/SHORT';
            } else if (sc === 'fwd/long' || sc === 'forward/long' || sc === 'long') {
                parsed.seatConfig = 'FWD/LONG';
            } else {
                parsed.seatConfig = seatConfigRaw as SeatConfig;
            }
        }
        const phone = getStr(row, ['Phone Number', 'phoneNumber']); if (phone) parsed.phoneNumber = phone;
        const email = getStr(row, ['Email']); if (email) parsed.email = email;
        
        // Primary/Secondary Instructor - only set if provided in file
        // Support comma-separated list of instructors (stored as array)
        const primary = getStr(row, ['Primary Instructor', 'primaryInstructor']); 
        if (primary) parsed.primaryInstructor = primary.split(',').map((s: string) => s.trim()).filter(Boolean);
        const secondary = getStr(row, ['Secondary Instructor', 'secondaryInstructor']); 
        if (secondary) parsed.secondaryInstructor = secondary.split(',').map((s: string) => s.trim()).filter(Boolean);
        
        // Permissions - parse newline-separated list
        const permissionsStr = getStr(row, ['Permissions', 'permissions']);
        if (permissionsStr) {
            // Split by newlines and filter out empty strings
            parsed.permissions = permissionsStr.split(/\r?\n/).map(p => p.trim()).filter(Boolean);
        }

        const isPaused = getValueFromRow(row, ['Is Paused', 'isPaused']);
        if (isPaused !== undefined) parsed.isPaused = parseBoolean(isPaused);
        
        // Set required fields with defaults if not provided
        if (!parsed.isPaused) parsed.isPaused = false;
        if (!parsed.unit) parsed.unit = '';
        if (!parsed.rank) parsed.rank = 'FLGOFF' as TraineeRank; // Default rank
        if (!parsed.seatConfig) parsed.seatConfig = 'Normal' as SeatConfig; // Default seat config
        if (!parsed.unavailability) parsed.unavailability = [];
        
        if (parsed.name && parsed.course) {
            parsed.fullName = `${parsed.name} – ${parsed.course}`;
        } else if (parsed.name) {
            // If course is missing, still set fullName to just the name
            parsed.fullName = parsed.name;
        }
        
        return parsed;
    };

    const parseLmpRow = (row: any): Partial<SyllabusItemDetail> | null => {
        const code = getStr(row, ['Code']);
        if (!code) return null;
        
        const parsed: Partial<SyllabusItemDetail> = { code };

        const phase = getStr(row, ['Phase']); if (phase) parsed.phase = phase;
        const module = getStr(row, ['Module']); if (module) parsed.module = module;
        const desc = getStr(row, ['Event description', 'eventDescription']); if (desc) parsed.eventDescription = desc;
        const prereqGround = getStrArray(row, ['Pre-requisite Events (Ground School)', 'prerequisitesGround']); if (prereqGround) parsed.prerequisitesGround = prereqGround;
        const prereqFlying = getStrArray(row, ['Pre-requisite Events (Sim/Flying)', 'prerequisitesFlying']); if (prereqFlying) parsed.prerequisitesFlying = prereqFlying;
        if (prereqGround || prereqFlying) parsed.prerequisites = [...(prereqGround || []), ...(prereqFlying || [])];
        const detailsCommon = getStrArray(row, ['Event Details - Common', 'eventDetailsCommon']); if (detailsCommon) parsed.eventDetailsCommon = detailsCommon;
        const detailsSortie = getStrArray(row, ['Event Details - Sortie', 'eventDetailsSortie']); if (detailsSortie) parsed.eventDetailsSortie = detailsSortie;
        const totalHours = getNum(row, ['Total Event Hours', 'totalEventHours']); if(totalHours !== undefined) parsed.totalEventHours = totalHours;
        const flightSimHours = getNum(row, ['Flight or Sim Hours', 'flightOrSimHours']);
        if(flightSimHours !== undefined) {
             parsed.flightOrSimHours = flightSimHours;
             parsed.duration = flightSimHours;
        }
        const delivery = getStrArray(row, ['Method/s of Delivery', 'methodOfDelivery']); if (delivery) parsed.methodOfDelivery = delivery;
        const assessment = getStrArray(row, ['Type/s and Method/s of Assessment', 'methodOfAssessment']); if (assessment) parsed.methodOfAssessment = assessment;
        const resourcesPhy = getStrArray(row, ['Resources Required (physical)', 'resourcesPhysical']); if (resourcesPhy) parsed.resourcesPhysical = resourcesPhy;
        const resourcesHum = getStrArray(row, ['Resources Required (Human)', 'resourcesHuman']); if (resourcesHum) parsed.resourcesHuman = resourcesHum;
        
        return parsed;
    };


    const handleBulkUpdate = (rows: any[], course: string) => {
        if (!fileToProcess) return;

        let processedCount = 0;
        let finalRows: any[] = [];
        switch (fileToProcess.folderId) {
            case 'instructor_loads':
                finalRows = rows.map(parseInstructorRow).filter(i => i && i.idNumber);
                onReplaceInstructors(finalRows as Instructor[]);
                break;
            case 'trainee_loads':
                // For trainee bulk update with course selection
                if (course) {
                    const parsedRows = rows.map(parseTraineeRow);
                    console.log('🔵 [BULK] Raw Excel rows:', rows.length);
                    console.log('🔵 [BULK] First raw row keys:', rows[0] ? Object.keys(rows[0]) : 'NO ROWS');
                    console.log('🔵 [BULK] First raw row values:', rows[0]);
                    console.log('🔵 [BULK] Parsed rows:', parsedRows.length);
                    console.log('🔵 [BULK] First parsed row:', JSON.stringify(parsedRows[0]));
                    console.log('🔵 [BULK] Rows with null result:', parsedRows.filter(r => r === null).length);
                    console.log('🔵 [BULK] Rows missing idNumber:', parsedRows.filter(r => r && !r.idNumber).length);
                    console.log('🔵 [BULK] Rows missing name:', parsedRows.filter(r => r && r.idNumber && !r.name).length);
                    finalRows = parsedRows.filter(t => t && t.idNumber && t.name);
                    console.log('🔵 [BULK] Filtered rows (with ID and name):', finalRows.length);
                    if (finalRows.length === 0) {
                        console.error('🔴 [BULK] NO ROWS PASSED FILTER!');
                        console.error('🔴 [BULK] All parsed rows:', JSON.stringify(parsedRows.slice(0, 3)));
                        console.error('🔴 [BULK] All raw rows:', JSON.stringify(rows.slice(0, 3)));
                    }
                    // Remove all existing trainees from the selected course
                    const otherCourseTrainees = traineesData.filter(t => t.course !== course);
                    console.log('🔵 [BULK] Other course trainees (kept):', otherCourseTrainees.length);
                    // Add new trainees from file (override course with selected course)
                    const newTrainees = finalRows.map(t => ({ ...t, course } as Trainee));
                    console.log('🔵 [BULK] New trainees to add:', newTrainees.length);
                    console.log('🔵 [BULK] Sample new trainee:', JSON.stringify(newTrainees[0]));
                    console.log('🔵 [BULK] Total trainees after update:', otherCourseTrainees.length + newTrainees.length);
                    console.log('🔵 [BULK] Calling onReplaceTrainees with', [...otherCourseTrainees, ...newTrainees].length, 'total trainees');
                    onReplaceTrainees([...otherCourseTrainees, ...newTrainees]);
                } else {
                    // Legacy behavior: replace all trainees
                    console.warn('🟡 [BULK] No course selected — replacing ALL trainees');
                    finalRows = rows.map(parseTraineeRow).filter(t => t && t.idNumber && t.name);
                    console.log('🔵 [BULK] Legacy replace — rows:', finalRows.length);
                    onReplaceTrainees(finalRows as Trainee[]);
                }
                break;
            case 'lmp_loads':
                finalRows = rows.map(parseLmpRow).filter(s => s && s.code);
                onUpdateSyllabus(finalRows as SyllabusItemDetail[]); // LMP update is always a merge/replace for now
                break;
        }
        processedCount = finalRows.length;
        setUpdateSummary({ type: 'Bulk', replaced: processedCount, added: 0, updated: 0, skipped: rows.length - processedCount });
        setShowUpdateSummary(true);
        
        // Log audit for bulk update
        const dataType = fileToProcess.folderId === 'instructor_loads' ? 'Instructors' : 
                        fileToProcess.folderId === 'trainee_loads' ? 'Trainees' : 'LMP Data';
        const courseInfo = course ? ` for course: ${course}` : '';
        logAudit({
            page: 'Settings - Data Loaders',
            action: 'update',
            description: `Bulk update: ${dataType}${courseInfo}`,
            changes: `Replaced ${processedCount} records from file: ${fileToProcess.name}`
        });
        
        setFileToProcess(null);
    };
    
    const startMinorUpdate = (rows: any[], course: string) => {
        setRowsToProcess(rows);
        setUpdatedRecords([]);
        setNewRecords([]);
        setSkippedCount(0);
        setSelectedCourse(course);
        setIsMinorUpdateInProgress(true);
    };
    
    const processNextRow = () => {
        if (!fileToProcess) {
            setIsMinorUpdateInProgress(false);
            return;
        }

        const [row, ...remainingRows] = rowsToProcess;
        setRowsToProcess(remainingRows);
        
        let parsedData: any;
        let existingRecord: any;

        switch (fileToProcess.folderId) {
            case 'instructor_loads':
                parsedData = parseInstructorRow(row);
                if (!parsedData?.idNumber) { setSkippedCount(prev => prev + 1); return; }
                existingRecord = instructorsData.find(i => i.idNumber === parsedData.idNumber);
                break;
            case 'trainee_loads':
                parsedData = parseTraineeRow(row);
                if (!parsedData?.idNumber) { setSkippedCount(prev => prev + 1); return; }
                // For course-specific minor update, only match trainees in the selected course
                   if (selectedCourse) {
                       existingRecord = traineesData.find(t => t.idNumber === parsedData.idNumber && t.course === selectedCourse);
                       // Set the course for the parsed data
                       parsedData.course = selectedCourse;
                   } else {
                       existingRecord = traineesData.find(t => t.idNumber === parsedData.idNumber);
                   }
                break;
            case 'lmp_loads':
                parsedData = parseLmpRow(row);
                if (!parsedData?.code) { setSkippedCount(prev => prev + 1); return; }
                existingRecord = syllabusDetails.find(s => 
                    s.code.trim().replace(/\s/g, '').toLowerCase() === String(parsedData.code).trim().replace(/\s/g, '').toLowerCase()
                );
                break;
            default:
                setSkippedCount(prev => prev + 1);
                return;
        }

        if (existingRecord) {
            const updated = { ...existingRecord, ...parsedData };
            
            // Special handling for trainee Primary/Secondary Instructor:
            // If uploaded file doesn't have them, preserve existing values
            if (fileToProcess.folderId === 'trainee_loads') {
                if (!parsedData.primaryInstructor && existingRecord.primaryInstructor) {
                    updated.primaryInstructor = existingRecord.primaryInstructor;
                }
                if (!parsedData.secondaryInstructor && existingRecord.secondaryInstructor) {
                    updated.secondaryInstructor = existingRecord.secondaryInstructor;
                }
            }
            
            setUpdatedRecords(prev => [...prev, updated]);
        } else {
               // NEW LOGIC: Automatically add new records without confirmation
               setNewRecords(prev => [...prev, parsedData]);
        }
    };
    
    const finishMinorUpdate = () => {
        setIsMinorUpdateInProgress(false);
        if (!fileToProcess) return;

        let finalUpdatedList: any[] = [];

        switch(fileToProcess.folderId) {
            case 'instructor_loads':
                finalUpdatedList = [...instructorsData];
                updatedRecords.forEach(ur => {
                    const index = finalUpdatedList.findIndex(i => i.idNumber === ur.idNumber);
                    if (index !== -1) finalUpdatedList[index] = ur;
                });
                   // Remove duplicates: filter out any records from finalUpdatedList that have same ID as newRecords
                   const filteredFinalList = finalUpdatedList.filter(existing => !newRecords.some(nr => nr.idNumber === existing.idNumber));
                   console.log(`[DEBUG] Filtered out ${finalUpdatedList.length - filteredFinalList.length} duplicate records`);
                onBulkUpdateInstructors([...filteredFinalList, ...newRecords]);
                break;
               case 'trainee_loads':
                    finalUpdatedList = [...traineesData];
                    // For course-specific minor update, only update trainees in the selected course
                    if (selectedCourse) {
                        updatedRecords.forEach(ur => {
                            const index = finalUpdatedList.findIndex(t => t.idNumber === ur.idNumber && t.course === selectedCourse);
                            if (index !== -1) finalUpdatedList[index] = ur;
                        });
                        // Add new records with the selected course
                        const newRecordsWithCourse = newRecords.map(nr => ({ ...nr, course: selectedCourse }));
                        onBulkUpdateTrainees([...finalUpdatedList, ...newRecordsWithCourse]);
                           
                           // Initialize LMP data for new trainees
                           console.log(`[DEBUG] About to initialize LMP for ${newRecordsWithCourse.length} new trainees`);
                           console.log(`[DEBUG] onUpdateTraineeLMPs function available:`, typeof onUpdateTraineeLMPs);
                           console.log(`[DEBUG] New trainees:`, newRecordsWithCourse.map(t => ({ name: t.fullName, lmpType: t.lmpType, course: t.course })));
                           
                           onUpdateTraineeLMPs && onUpdateTraineeLMPs((prevLMPs: Map<string, SyllabusItemDetail[]>) => {
                               console.log(`[DEBUG] LMP initialization started. Previous LMPs count: ${prevLMPs.size}`);
                               const newLMPs = new Map(prevLMPs);
                               
                               // Process new records and initialize their LMP data
                               newRecordsWithCourse.forEach(trainee => {
                                   console.log(`[DEBUG] Processing trainee: ${trainee.fullName}, LMP Type: ${trainee.lmpType}`);
                                   if (trainee.fullName && trainee.lmpType) {
                                       // Find the Master LMP for this trainee's LMP type
                                       const masterLMP = syllabusDetails.filter(item => {
                                           return item.courses.includes(trainee.lmpType);
                                       });
                                       
                                       console.log(`[DEBUG] Found ${masterLMP.length} master LMP items for ${trainee.lmpType}`);
                                       
                                       if (masterLMP.length > 0) {
                                           newLMPs.set(trainee.fullName, [...masterLMP]);
                                           console.log(`[Individual LMP] Initialized ${trainee.fullName}'s Individual LMP with ${trainee.lmpType} (${masterLMP.length} events)`);
                                       } else {
                                           console.warn(`[Individual LMP] No Master LMP found for LMP type: ${trainee.lmpType}`);
                                       }
                                   } else {
                                       console.warn(`[DEBUG] Skipping trainee ${trainee.fullName} - missing fullName or lmpType`);
                                   }
                               });
                               
                               console.log(`[DEBUG] LMP initialization complete. New LMPs count: ${newLMPs.size}`);
                               return newLMPs;
                           });
                        
                        // Update courseColors to include the selected course if it's not already there
                        if (selectedCourse && !courseColors[selectedCourse]) {
                            const defaultColors = ['#e74c3c', '#3498db', '#9b59b6', '#1abc9c', '#f39c12', '#34495e', '#16a085', '#27ae60', '#2980b9'];
                            const colorIndex = Object.keys(courseColors).length % defaultColors.length;
                            const newCourseColors = {
                                ...courseColors,
                                [selectedCourse]: defaultColors[colorIndex]
                            };
                            setCourseColors(newCourseColors);
                            console.log(`\ud83c\udfa8 Added color for course ${selectedCourse}: ${defaultColors[colorIndex]}`);
                        }
                    } else {
                        updatedRecords.forEach(ur => {
                            const index = finalUpdatedList.findIndex(t => t.idNumber === ur.idNumber);
                            if (index !== -1) finalUpdatedList[index] = ur;
                        });
                        onBulkUpdateTrainees([...finalUpdatedList, ...newRecords]);
                    }
                   break;
            case 'lmp_loads':
                const updatedMap = new Map(updatedRecords.map(s => [s.code.trim().replace(/\s/g, '').toLowerCase(), s]));
                const finalSyllabus = syllabusDetails.map(s => {
                    const key = s.code.trim().replace(/\s/g, '').toLowerCase();
                    return updatedMap.get(key) || s;
                });
                onUpdateSyllabus([...finalSyllabus, ...newRecords]);
                break;
        }
        
        setUpdateSummary({ type: 'Minor', added: newRecords.length, updated: updatedRecords.length, skipped: skippedCount, replaced: 0 });
        setShowUpdateSummary(true);

        // Log audit for minor update
        const dataType = fileToProcess.folderId === 'instructor_loads' ? 'Instructors' : 
                        fileToProcess.folderId === 'trainee_loads' ? 'Trainees' : 'LMP Data';
        const courseInfo = selectedCourse ? ` for course: ${selectedCourse}` : '';
        logAudit({
            page: 'Settings - Data Loaders',
            action: 'update',
            description: `Minor update: ${dataType}${courseInfo}`,
            changes: `Added ${newRecords.length}, Updated ${updatedRecords.length}, Skipped ${skippedCount} from file: ${fileToProcess.name}`
        });

        // Reset state
        setFileToProcess(null);
        setRowsToProcess([]);
        setNewRecords([]);
        setUpdatedRecords([]);
        setSkippedCount(0);
    };

    const handleConfirmNewRecord = () => {
        if (unmatchedRowData) {
            setNewRecords(prev => [...prev, unmatchedRowData]);
        }
        setShowNewRecordConfirm(false);
        setUnmatchedRowData(null);
        setIsMinorUpdateInProgress(true); // Resume
    };

    const handleRejectNewRecord = () => {
        setSkippedCount(prev => prev + 1);
        setShowNewRecordConfirm(false);
        setUnmatchedRowData(null);
        setIsMinorUpdateInProgress(true); // Resume
    };


    const FileListItem: React.FC<{file: {id: string; name: string; folderId: string}}> = ({ file }) => (
         <li key={file.id} className="flex items-center justify-between p-2 bg-gray-700/50 rounded text-sm group">
            <div className="flex items-center truncate">
                <FileIcon />
                <span className="truncate text-white" title={file.name}>{file.name}</span>
            </div>
            <div className="flex space-x-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleUpdateIconClick(file)} className="p-1 text-gray-400 hover:text-green-400" aria-label="Update from file">
                    <UpdateIcon />
                </button>
                <button onClick={() => handleDownloadClick(file)} className="p-1 text-gray-400 hover:text-sky-400" aria-label="Download file"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                <button onClick={() => handleDeleteClick(file)} className="p-1 text-gray-400 hover:text-red-400" aria-label="Delete file"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
            </div>
        </li>
    );

    return (
        <>
            <div className="space-y-6">
                {/* AC History */}
                {shouldShowSection('validation') && (
                <div className="space-y-6">
                   <ACHistoryPage
                       currentUserRole={currentUserPermission}
                       cancellationRecords={cancellationRecords || []}
                       currentAircraftAvailable={currentAircraftAvailable}
                       totalAircraft={totalAircraft}
                   />
                </div>
                )}
                {/* Timezone Settings Window */}
                {shouldShowSection('timezone') && (
                <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6 w-96">
                    <div className="p-4 flex justify-between items-center border-b border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-200">Timezone Settings</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Timezone Offset (UTC)
                            </label>
                            <select 
                                value={timezoneOffset} 
                                onChange={(e) => onUpdateTimezoneOffset(parseFloat(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="-12">UTC-12:00</option>
                                <option value="-11">UTC-11:00</option>
                                <option value="-10">UTC-10:00 (Hawaii)</option>
                                <option value="-9">UTC-09:00 (Alaska)</option>
                                <option value="-8">UTC-08:00 (Pacific)</option>
                                <option value="-7">UTC-07:00 (Mountain)</option>
                                <option value="-6">UTC-06:00 (Central)</option>
                                <option value="-5">UTC-05:00 (Eastern)</option>
                                <option value="-4">UTC-04:00</option>
                                <option value="-3">UTC-03:00</option>
                                <option value="-2">UTC-02:00</option>
                                <option value="-1">UTC-01:00</option>
                                <option value="0">UTC+00:00 (GMT/UTC)</option>
                                <option value="1">UTC+01:00 (CET)</option>
                                <option value="2">UTC+02:00</option>
                                <option value="3">UTC+03:00</option>
                                <option value="4">UTC+04:00</option>
                                <option value="5">UTC+05:00</option>
                                <option value="5.5">UTC+05:30 (India)</option>
                                <option value="6">UTC+06:00</option>
                                <option value="7">UTC+07:00</option>
                                <option value="8">UTC+08:00 (Singapore/Perth)</option>
                                <option value="9">UTC+09:00 (Japan/Korea)</option>
                                <option value="9.5">UTC+09:30 (Adelaide)</option>
                                <option value="10">UTC+10:00 (AEST Sydney/Brisbane)</option>
                                <option value="10.5">UTC+10:30</option>
                                <option value="11">UTC+11:00 (AEDT Sydney)</option>
                                <option value="12">UTC+12:00 (New Zealand)</option>
                                <option value="13">UTC+13:00 (NZDT)</option>
                            </select>
                            <p className="mt-2 text-xs text-gray-400">
                                Current server time: {new Date().toUTCString()}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                                Your local time: {new Date(Date.now() + timezoneOffset * 60 * 60 * 1000).toUTCString()}
                            </p>
                        </div>
                    </div>
                </div>
                )}

                {/* Scoring Matrix - Inline Content */}
                {shouldShowSection('scoring-matrix') && (
                    <ScoringMatrixInline
                        activeTab={scoringMatrixActiveTab || 'Airmanship'}
                        phraseBank={phraseBank}
                        onUpdatePhraseBank={handleUpdatePhraseBank}
                        readOnly={scoringMatrixReadOnly}
                    />
                )}

                    {/* Location Window */}
                   {shouldShowSection('location') && (
                    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-80 h-fit">
                        <div className="p-4 flex justify-between items-center border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-200">Location</h2>
                            {isEditingLocations ? (
                                <div className="flex space-x-2">
                                    <button onClick={handleSaveLocations} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">Save</button>
                                    <button onClick={handleCancelLocations} className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-semibold">Cancel</button>
                                </div>
                            ) : (
                                <button 
                                   onClick={handleEditLocations} 
                                   disabled={!canEditSettings}
                                   className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                       canEditSettings 
                                           ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer' 
                                           : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                   }`}
                               >
                                   Edit
                               </button>
                            )}
                        </div>
                        <div className="p-4 space-y-4">
                            {isEditingLocations ? (
                                <>
                                    <p className="text-sm text-gray-400">Manage available operating locations and their abbreviation codes.</p>
                                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                                        {tempLocations.map(loc => (
                                            <li key={loc} className="flex items-center gap-2 p-2 bg-gray-700/50 rounded">
                                                <span className="text-white flex-1 text-sm">{loc}</span>
                                                <input
                                                    type="text"
                                                    maxLength={5}
                                                    value={tempLocationAbbreviations[loc] || ''}
                                                    onChange={e => setTempLocationAbbreviations(prev => ({ ...prev, [loc]: e.target.value.toUpperCase() }))}
                                                    placeholder="Code"
                                                    title="Short code (e.g. ESL)"
                                                    className="w-16 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-yellow-300 text-xs font-mono font-bold uppercase text-center focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                />
                                                <button onClick={() => handleRemoveLocation(loc)} className="p-1 text-gray-400 hover:text-red-400 flex-shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg></button>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="flex space-x-2">
                                        <input type="text" value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="New location name" className="flex-grow bg-gray-700 border-gray-600 rounded-md py-1 px-2 text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        <button onClick={handleAddLocation} className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold">Add</button>
                                    </div>
                                    <p className="text-xs text-gray-500">Enter a short code (e.g. ESL) for each location so the app can match either name or code when filtering by locality.</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-400">Configured operating locations.</p>
                                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                                        {locations.map(loc => (
                                            <li key={loc} className="flex items-center justify-between p-2 bg-gray-700/50 rounded text-white">
                                                <span className="text-sm">{loc}</span>
                                                {locationAbbreviations[loc] && (
                                                    <span className="text-xs font-mono font-bold text-yellow-400 bg-gray-600 px-2 py-0.5 rounded">{locationAbbreviations[loc]}</span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    </div>
                   )}

                      {/* Services Window */}
                      {shouldShowSection('location') && (
                        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-80 h-fit">
                            <div className="p-4 flex justify-between items-center border-b border-gray-700">
                                <h2 className="text-lg font-semibold text-gray-200">Services</h2>
                                {isEditingServices ? (
                                    <div className="flex space-x-2">
                                        <button onClick={handleSaveServices} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">Save</button>
                                        <button onClick={handleCancelServices} className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-semibold">Cancel</button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleEditServices}
                                        disabled={!canEditSettings}
                                        className={`px-3 py-1 rounded-md text-xs font-semibold ${canEditSettings ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                    >
                                        Edit
                                    </button>
                                )}
                            </div>
                            <div className="p-4 space-y-4">
                                {isEditingServices ? (
                                    <>
                                        <p className="text-sm text-gray-400">Define service branches with long name and short code. Both are recognised when filtering by service.</p>
                                        <ul className="space-y-2 max-h-40 overflow-y-auto">
                                            {tempServiceDefs.map(svc => (
                                                <li key={svc.shortName} className="flex items-center gap-2 p-2 bg-gray-700/50 rounded">
                                                    <span className="text-xs font-mono font-bold text-yellow-300 bg-gray-600 px-2 py-0.5 rounded w-14 text-center">{svc.shortName}</span>
                                                    <span className="text-white text-sm flex-1">{svc.longName}</span>
                                                    <button onClick={() => handleRemoveService(svc.shortName)} className="p-1 text-gray-400 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg></button>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newServiceShort}
                                                onChange={e => setNewServiceShort(e.target.value.toUpperCase())}
                                                placeholder="Code (e.g. RAAF)"
                                                maxLength={6}
                                                className="w-28 bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-yellow-300 text-sm font-mono uppercase focus:outline-none focus:ring-sky-500"
                                            />
                                            <input
                                                type="text"
                                                value={newServiceLong}
                                                onChange={e => setNewServiceLong(e.target.value)}
                                                placeholder="Long name (e.g. Air Force)"
                                                className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-sm focus:outline-none focus:ring-sky-500"
                                            />
                                            <button onClick={handleAddService} className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold">Add</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm text-gray-400">Configured service branches.</p>
                                        <ul className="space-y-2 max-h-40 overflow-y-auto">
                                            {serviceDefinitions.map(svc => (
                                                <li key={svc.shortName} className="flex items-center gap-3 p-2 bg-gray-700/50 rounded">
                                                    <span className="text-xs font-mono font-bold text-yellow-400 bg-gray-600 px-2 py-0.5 rounded w-14 text-center">{svc.shortName}</span>
                                                    <span className="text-white text-sm">{svc.longName}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>
                        </div>
                      )}

                      {/* Op Areas Window */}
                      {shouldShowSection('location') && (
                        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-80 h-fit">
                            <div className="p-4 flex justify-between items-center border-b border-gray-700">
                                <h2 className="text-lg font-semibold text-gray-200">Op Areas</h2>
                                {isEditingOpAreas ? (
                                    <div className="flex space-x-2">
                                        <button onClick={handleSaveOpAreas} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">Save</button>
                                        <button onClick={handleCancelOpAreas} className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-semibold">Cancel</button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleEditOpAreas}
                                        disabled={!canEditSettings}
                                        className={`px-3 py-1 rounded-md text-xs font-semibold ${canEditSettings ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                    >
                                        Edit
                                    </button>
                                )}
                            </div>
                            <div className="p-4 space-y-3">
                                {isEditingOpAreas ? (
                                    <>
                                        <p className="text-sm text-gray-400">Set training areas available for each location.</p>
                                        <div className="flex gap-1 flex-wrap">
                                            {locations.map(loc => (
                                                <button
                                                    key={loc}
                                                    onClick={() => setSelectedOpAreaLocation(loc)}
                                                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${selectedOpAreaLocation === loc ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                                >
                                                    {loc}
                                                </button>
                                            ))}
                                        </div>
                                        {selectedOpAreaLocation && (
                                            <>
                                                <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{selectedOpAreaLocation}</div>
                                                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                                                    {(tempOpAreas[selectedOpAreaLocation] || []).map(area => (
                                                        <span key={area} className="flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-white text-xs">
                                                            {area}
                                                            <button onClick={() => handleRemoveOpArea(selectedOpAreaLocation, area)} className="text-gray-400 hover:text-red-400 ml-1">×</button>
                                                        </span>
                                                    ))}
                                                    {(tempOpAreas[selectedOpAreaLocation] || []).length === 0 && (
                                                        <span className="text-gray-500 text-xs italic">No areas configured</span>
                                                    )}
                                                </div>
                                                <div className="flex space-x-2">
                                                    <input
                                                        type="text"
                                                        value={newOpArea}
                                                        onChange={e => setNewOpArea(e.target.value.toUpperCase())}
                                                        onKeyDown={e => e.key === 'Enter' && handleAddOpArea()}
                                                        maxLength={4}
                                                        placeholder="Area (e.g. A)"
                                                        className="flex-grow bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-sm focus:outline-none focus:ring-sky-500 uppercase"
                                                    />
                                                    <button onClick={handleAddOpArea} className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold">Add</button>
                                                </div>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm text-gray-400">Configured operating areas per location.</p>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {locations.map(loc => (
                                                <div key={loc} className="p-2 bg-gray-700/50 rounded">
                                                    <div className="text-xs text-gray-400 font-semibold uppercase mb-1">{loc}</div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(locationOpAreas[loc] || []).map(area => (
                                                            <span key={area} className="px-2 py-0.5 bg-gray-600 rounded text-white text-xs">{area}</span>
                                                        ))}
                                                        {(locationOpAreas[loc] || []).length === 0 && (
                                                            <span className="text-gray-500 text-xs italic">None</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                      )}

                      {/* Formation Callsigns Window */}
                      {shouldShowSection('location') && (
                          <FormationCallsignsSection
                              callsigns={formationCallsigns}
                              onUpdateCallsigns={onUpdateFormationCallsigns}
                              units={units}
                              locations={locations}
                              canEditSettings={canEditSettings}
                              onAuditLog={logAudit}
                          />
                      )}
                    {/* Units Window */}
                   {shouldShowSection('units') && (
                    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-80 h-fit">
                        <div className="p-4 flex justify-between items-center border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-200">Units</h2>
                            {isEditingUnits ? (
                                <div className="flex space-x-2">
                                    <button onClick={handleSaveUnits} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">Save</button>
                                    <button onClick={handleCancelUnits} className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-semibold">Cancel</button>
                                </div>
                            ) : (
                                <button 
                                onClick={handleEditUnits} 
                                disabled={!canEditSettings}
                                className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                    canEditSettings 
                                        ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer' 
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                Edit
                            </button>
                            )}
                        </div>
                        <div className="p-4 space-y-4">
                            {isEditingUnits ? (
                                <>
                                    <p className="text-sm text-gray-400">Manage units and their primary locations.</p>
                                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                                        {tempUnits.map(unit => (
                                            <li key={unit} className="p-2 bg-gray-700/50 rounded">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-white">{unit}</span>
                                                    <button onClick={() => handleRemoveUnit(unit)} className="p-1 text-gray-400 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg></button>
                                                </div>
                                                <select
                                                    value={tempUnitLocations[unit] || ''}
                                                    onChange={(e) => handleTempUnitLocationChange(unit, e.target.value)}
                                                    className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md py-1 px-2 text-white text-xs"
                                                >
                                                    {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                                </select>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="flex space-x-2">
                                        <input type="text" value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="New unit name" className="flex-grow bg-gray-700 border-gray-600 rounded-md py-1 px-2 text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        <button onClick={handleAddUnit} className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold">Add</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-400">Configured units and their locations.</p>
                                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                                        {units.map(unit => (
                                            <li key={unit} className="p-2 bg-gray-700/50 rounded text-white flex justify-between">
                                                <span>{unit}</span>
                                                <span className="text-gray-400">{unitLocations[unit]}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    </div>

                   )}
                       {/* Duty & Turnaround Window */}
                   {shouldShowSection('duty-turnaround') && (
                    <DutyTurnaroundSection
                        preferredDutyPeriod={preferredDutyPeriod}
                        onUpdatePreferredDutyPeriod={handleUpdatePreferredDutyPeriod}
                        maxCrewDutyPeriod={maxCrewDutyPeriod}
                        onUpdateMaxCrewDutyPeriod={handleUpdateMaxCrewDutyPeriod}
                        flightTurnaround={flightTurnaround}
                        onUpdateFlightTurnaround={handleUpdateFlightTurnaround}
                        ftdTurnaround={ftdTurnaround}
                        onUpdateFtdTurnaround={handleUpdateFtdTurnaround}
                        cptTurnaround={cptTurnaround}
                        onUpdateCptTurnaround={handleUpdateCptTurnaround}
                    />
                   )}

                          {/* SCT Events Window */}
                   {shouldShowSection('sct-events') && (
                       <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-80 h-fit">
                           <div className="p-4 flex justify-between items-center border-b border-gray-700">
                               <h2 className="text-lg font-semibold text-gray-200">SCT Events</h2>
                               {isEditingSctEvents ? (
                                   <div className="flex space-x-2">
                                       <button onClick={handleSaveSctEvents} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">Save</button>
                                       <button onClick={handleCancelSctEvents} className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-semibold">Cancel</button>
                                   </div>
                               ) : (
                                   <button 
                                   onClick={handleEditSctEvents} 
                                   disabled={!canEditSettings}
                                   className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                       canEditSettings 
                                           ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer' 
                                           : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                   }`}
                               >
                                   Edit
                               </button>
                               )}
                           </div>
                           <div className="p-4 space-y-4">
                               {isEditingSctEvents ? (
                                   <>
                                       <p className="text-sm text-gray-400">Manage SCT event types.</p>
                                       <ul className="space-y-2 max-h-40 overflow-y-auto">
                                           {tempSctEvents.map(evt => (
                                               <li key={evt} className="flex items-center justify-between p-2 bg-gray-700/50 rounded">
                                                   <span className="text-white">{evt}</span>
                                                   <button onClick={() => handleRemoveSctEvent(evt)} className="p-1 text-gray-400 hover:text-red-400">
                                                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                           <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                       </svg>
                                                   </button>
                                               </li>
                                           ))}
                                       </ul>
                                       <div className="flex space-x-2">
                                           <input 
                                               type="text" 
                                               value={newSctEvent} 
                                               onChange={e => setNewSctEvent(e.target.value)} 
                                               placeholder="New SCT event name" 
                                               className="flex-grow bg-gray-700 border-gray-600 rounded-md py-1 px-2 text-white text-sm focus:outline-none focus:ring-sky-500" 
                                           />
                                           <button onClick={handleAddSctEvent} className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold">+</button>
                                       </div>
                                   </>
                               ) : (
                                   <>
                                       <p className="text-sm text-gray-400">Configured SCT event types.</p>
                                       <ul className="space-y-2 max-h-40 overflow-y-auto">
                                           {sctEvents.map(evt => (
                                               <li key={evt} className="p-2 bg-gray-700/50 rounded text-white">
                                                   {evt}
                                               </li>
                                           ))}
                                       </ul>
                                   </>
                               )}
                           </div>
                       </div>

                   )}
                    {/* Currencies Window */}
                   {shouldShowSection('currencies') && (
                    <div className="flex gap-4">
                        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-[40rem] h-fit flex flex-col">
                            <div className="p-4 flex justify-between items-center shrink-0">
                                <h2 className="text-lg font-semibold text-gray-200">Currencies</h2>
                            </div>
                             <div className="flex-1 overflow-y-auto max-h-[400px]">
                                <table className="w-full text-left text-sm">
                                    <thead className="sticky top-0 bg-gray-800">
                                        <tr>
                                            <th className="font-medium text-gray-400 px-4 pt-0 pb-2 border-b border-gray-700">Currency</th>
                                            <th className="font-medium text-gray-400 px-4 pt-0 pb-2 border-b border-gray-700">Type</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleCurrencies.map((c, i) => (
                                            <tr 
                                                key={c.id} 
                                                className={`border-t border-gray-700 cursor-pointer transition-colors ${
                                                    selectedCurrency?.id === c.id ? 'bg-sky-900/30' : 'hover:bg-gray-700'
                                                }`}
                                                onClick={() => setSelectedCurrency(c)}
                                                onMouseEnter={() => setSelectedCurrency(c)}
                                            >
                                                <td className="py-2 px-4 text-gray-200">{c.name}</td>
                                                <td className="py-2 px-4 text-gray-300 capitalize">{c.type}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 border-t border-gray-700 shrink-0">
                                <button onClick={() => onNavigate('CurrencyBuilder')} className="w-full px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold">
                                    Currency Builder
                                </button>
                            </div>
                        </div>
                        
                        {/* Currency Details Panel */}
                        {selectedCurrency && (
                            <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-[40rem] h-fit flex flex-col">
                                <div className="p-4 flex justify-between items-center shrink-0 border-b border-gray-700">
                                    <h2 className="text-lg font-semibold text-gray-200">Currency Details</h2>
                                    <button 
                                        onClick={() => setSelectedCurrency(null)}
                                        className="text-gray-400 hover:text-white transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-400 block mb-1">Name</label>
                                        <p className="text-gray-200">{selectedCurrency.name}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-400 block mb-1">Type</label>
                                        <p className="text-gray-200 capitalize">{selectedCurrency.type}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-400 block mb-1">Description</label>
                                        <p className="text-gray-300 whitespace-pre-wrap">{selectedCurrency.description || 'No description'}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-400 block mb-1">Visible</label>
                                        <p className="text-gray-200">{selectedCurrency.isVisible ? 'Yes' : 'No'}</p>
                                    </div>
                                    {selectedCurrency.type === 'primitive' && (
                                        <>
                                            <div>
                                                <label className="text-sm font-medium text-gray-400 block mb-1">Validity Days</label>
                                                <p className="text-gray-200">{(selectedCurrency as CurrencyRequirement).validityDays} days</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-400 block mb-1">Required Count</label>
                                                <p className="text-gray-200">{(selectedCurrency as CurrencyRequirement).requiredCount}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-400 block mb-1">Event Codes</label>
                                                <p className="text-gray-300">
                                                    {(selectedCurrency as CurrencyRequirement).eventCodes.length > 0 
                                                        ? (selectedCurrency as CurrencyRequirement).eventCodes.join(', ') 
                                                        : 'None'}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-400 block mb-1">Expiry Rule</label>
                                                <p className="text-gray-200 capitalize">{(selectedCurrency as CurrencyRequirement).expiryRule}</p>
                                            </div>
                                        </>
                                    )}
                                    {selectedCurrency.type === 'composite' && (
                                        <>
                                            <div>
                                                <label className="text-sm font-medium text-gray-400 block mb-1">Logic Tree</label>
                                                <pre className="bg-gray-900 p-3 rounded text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                                                    {JSON.stringify((selectedCurrency as MasterCurrency).logicTree, null, 2)}
                                                </pre>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-400 block mb-1">Expiry Calculation</label>
                                                <pre className="bg-gray-900 p-3 rounded text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                                                    {JSON.stringify((selectedCurrency as MasterCurrency).expiryCalculation, null, 2)}
                                                </pre>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                   )}
                    {/* Business Rules Window */}
                   {shouldShowSection('business-rules') && (
                    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-[40rem] h-fit">
                        <div className="p-4 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-gray-200">Business Rules</h2>
                        </div>
                        <div className="p-4 border-t border-gray-700">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Max dispatch / hr
                                    </label>
                                    <select 
                                        value={maxDispatchPerHour}
                                        onChange={(e) => onUpdateMaxDispatchPerHour(parseInt(e.target.value))}
                                        disabled={!canEditSettings}
                                        className={`w-full px-3 py-2 rounded-md border focus:ring-sky-500 focus:border-sky-500 ${
                                            canEditSettings 
                                                ? 'bg-gray-700 border-gray-600 text-white' 
                                                : 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed'
                                        }`}
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map(value => (
                                            <option key={value} value={value}>{value}</option>
                                        ))}
                                    </select>
                                    {canEditSettings && (
                                        <p className="mt-1 text-xs text-gray-400">
                                            Maximum number of dispatches allowed per hour
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                   )}
                    {/* Data Loaders Window */}
                   {shouldShowSection('data-loaders') && (
                    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-[30rem] h-fit">
                        <div className="p-4 flex justify-between items-center border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-200">Data Loaders</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <fieldset className="p-3 border border-gray-600 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Templates</legend>
                                <div className="mt-2 space-y-2">
                                    <p className="text-xs text-gray-400">Download templates to ensure correct formatting for bulk uploads.</p>
                                    <button onClick={handleDownloadInstructorTemplate} className="w-full px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold">
                                        Download Staff Template (.xlsx)
                                    </button>
                                    <button onClick={handleDownloadTraineeTemplate} className="w-full px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold">
                                        Download Trainee Template (.xlsx)
                                    </button>
                                    <button onClick={handleDownloadLmpTemplate} className="w-full px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold">
                                        Download LMP Template (.xlsx)
                                    </button>
                                    <button onClick={handleDownloadLogbookTemplate} className="w-full px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold">
                                        Download Logbook Template (.xlsx)
                                    </button>
                                </div>
                            </fieldset>
                            <fieldset className="p-3 border border-gray-600 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Data Storage</legend>
                                <div className="mt-2 space-y-3">
                                    <p className="text-xs text-gray-400">Manage files stored in the local browser repository for bulk updates or other operations.</p>
                                    <div className="max-h-60 overflow-y-auto pr-2">
                                        <div className="space-y-4">
                                            {folders.map(folder => {
                                                const filesInFolder = repoFiles.filter(file => file.folderId === folder.id);
                                                const isSub = (folder as any).isSub;
                                                return (
                                                    <div key={folder.id} className={isSub ? "ml-8" : ""}>
                                                        <div className="flex items-center mb-1">
                                                            <FolderIcon />
                                                            <h4 className="text-sm font-semibold text-gray-300">{folder.name}</h4>
                                                        </div>
                                                        <div className="pl-4 border-l-2 border-gray-600 ml-2.5">
                                                            {filesInFolder.length > 0 ? (
                                                                <ul className="space-y-1 pt-2">
                                                                    {filesInFolder.sort((a, b) => a.name.localeCompare(b.name)).map(file => (
                                                                        <FileListItem key={file.id} file={file} />
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <p className="text-xs text-gray-500 italic pl-3 pt-1">Empty</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {uncategorizedFiles.length > 0 && (
                                                <div key="uncategorized">
                                                    <div className="flex items-center mb-1">
                                                        <FolderIcon />
                                                        <h4 className="text-sm font-semibold text-gray-300">Uncategorized</h4>
                                                    </div>
                                                    <div className="pl-4 border-l-2 border-gray-600 ml-2.5">
                                                        <ul className="space-y-1 pt-2">
                                                            {uncategorizedFiles.sort((a,b) => a.name.localeCompare(b.name)).map(file => (
                                                                <FileListItem key={file.id} file={file} />
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={handleUploadClick} className="w-full mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-semibold">
                                        Upload File
                                    </button>
                                </div>
                            </fieldset>
                        </div>
                    </div>

                   )}
                    {/* Events Limits Window */}
                   {shouldShowSection('event-limits') && (
                    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-96 h-fit">
                        <div className="p-4 flex justify-between items-center border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-200">Events Limits</h2>
                            {isEditingLimits ? (
                                <button onClick={handleSaveLimits} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">Save</button>
                            ) : (
                                <button 
                                onClick={handleEditLimits} 
                                disabled={!canEditSettings}
                                className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                    canEditSettings 
                                        ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer' 
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                Edit
                            </button>
                            )}
                        </div>
                        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                            {/* Execs */}
                            <fieldset className="p-3 border border-gray-600 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Execs</legend>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max Flight/FTD:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.exec.maxFlightFtd} onChange={e => setTempLimits({...tempLimits, exec: {...tempLimits.exec, maxFlightFtd: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">1</span>}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max Duty Sup:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.exec.maxDutySup} onChange={e => setTempLimits({...tempLimits, exec: {...tempLimits.exec, maxDutySup: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max total all events:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.exec.maxTotal || 2} onChange={e => setTempLimits({...tempLimits, exec: {...tempLimits.exec, maxTotal: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                </div>
                            </fieldset>
                            {/* Staff */}
                            <fieldset className="p-3 border border-gray-600 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Staff</legend>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max Flight/FTD:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.instructor.maxFlightFtd || 2} onChange={e => setTempLimits({...tempLimits, instructor: {...tempLimits.instructor, maxFlightFtd: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-400">Staff (Flying Supervisor role assigned) - Max Duty Sup:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.instructor.maxDutySup} onChange={e => setTempLimits({...tempLimits, instructor: {...tempLimits.instructor, maxDutySup: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max total all events:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.instructor.maxTotal || 3} onChange={e => setTempLimits({...tempLimits, instructor: {...tempLimits.instructor, maxTotal: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">3</span>}
                                    </div>
                                </div>
                            </fieldset>
                            {/* Trainees */}
                            <fieldset className="p-3 border border-gray-600 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Trainees</legend>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max Flight/FTD:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.trainee.maxFlightFtd || 1} onChange={e => setTempLimits({...tempLimits, trainee: {...tempLimits.trainee, maxFlightFtd: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">1</span>}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max total all events:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.trainee.maxTotal || 2} onChange={e => setTempLimits({...tempLimits, trainee: {maxTotal: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                </div>
                            </fieldset>
                            {/* SIM IPs */}
                            <fieldset className="p-3 border border-gray-600 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">SIM IPs</legend>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max FTD:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.simIp.maxFtd || 2} onChange={e => setTempLimits({...tempLimits, simIp: {...tempLimits.simIp, maxFtd: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max total all events:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.simIp.maxTotal || 2} onChange={e => setTempLimits({...tempLimits, simIp: {maxTotal: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                </div>
                            </fieldset>
                        </div>
                    </div>

                   )}
                   {/* Permissions Manager Window */}
                   {shouldShowSection('permissions') && (
                   <PermissionsManagerWindow
                       instructors={instructorsData}
                       trainees={traineesData}
                       onUpdateInstructorPermission={(idNumber, permissionLevel) => {
                           const instructor = instructorsData.find(inst => inst.idNumber === idNumber);
                           const oldPermission = instructor?.permissions?.[0] || 'None';
                           const updatedInstructors = instructorsData.map(inst => 
                               inst.idNumber === idNumber 
                                   ? { ...inst, permissions: [permissionLevel] }
                                   : inst
                           );
                           onBulkUpdateInstructors(updatedInstructors);
                           logAudit({
                               page: 'Settings - Permissions',
                               action: 'update',
                               description: `Updated instructor permission: ${instructor?.name}`,
                               changes: `From: ${oldPermission} To: ${permissionLevel}`
                           });
                       }}
                       onUpdateTraineePermission={(idNumber, permissionLevel) => {
                           const trainee = traineesData.find(t => t.idNumber === idNumber);
                           const oldPermission = trainee?.permissions?.[0] || 'None';
                           const updatedTrainees = traineesData.map(t => 
                               t.idNumber === idNumber 
                                   ? { ...t, permissions: [permissionLevel] }
                                   : t
                           );
                           onBulkUpdateTrainees(updatedTrainees);
                           logAudit({
                               page: 'Settings - Permissions',
                               action: 'update',
                               description: `Updated trainee permission: ${trainee?.name}`,
                               changes: `From: ${oldPermission} To: ${permissionLevel}`
                           });
                       }}
                       onShowSuccess={onShowSuccess}
                          currentUserPermission={currentUserPermission}
                   />

                   )}
                   {/* Emergency Page */}
                   {shouldShowSection('emergency') && (
                   <EmergencyPage
                       currentUserRole={currentUserPermission}
                       onShowSuccess={onShowSuccess}
                   />
                   )}
               </div>
               {showScoringMatrix && <ScoringMatrixFlyout onClose={() => setShowScoringMatrix(false)} phraseBank={phraseBank} onUpdatePhraseBank={handleUpdatePhraseBank} initialTab={scoringMatrixTab} />}
            {showUpload && <UploadFileFlyout onClose={() => setShowUpload(false)} onConfirm={handleUploadConfirm} />}
            {showSelectDestination && fileToUpload && <SelectDestinationFlyout onClose={() => setShowSelectDestination(false)} onConfirm={handleDestinationConfirm} fileName={fileToUpload.name} folders={folders.filter(f => !(f as any).isSub)} />}
            {fileToDownload && <DownloadConfirmationFlyout fileName={fileToDownload.name} onConfirm={handleDownloadConfirm} onClose={() => setFileToDownload(null)} />}
            {fileToDelete && <DeleteFileConfirmationFlyout fileName={fileToDelete.name} onConfirm={handleDeleteConfirm} onClose={() => setFileToDelete(null)} />}
            {showUpdateConfirmation && fileToProcess && <UpdateConfirmationFlyout fileName={fileToProcess.name} onConfirm={handleUpdateConfirm} onClose={() => setShowUpdateConfirmation(false)} />}
            {showCourseSelection && <CourseSelectionFlyout courses={activeCourses} onConfirm={handleCourseSelection} onClose={() => setShowCourseSelection(false)} updateType={selectedUpdateType} />}
            {showNewRecordConfirm && unmatchedRowData && <NewRecordConfirmationFlyout rowData={unmatchedRowData} onConfirm={handleConfirmNewRecord} onCancel={handleRejectNewRecord} />}
            {showUpdateError && <UpdateErrorFlyout message={updateErrorMessage} onClose={() => setShowUpdateError(false)} />}
            {showUpdateSummary && <UpdateSummaryFlyout summary={updateSummary} onClose={() => setShowUpdateSummary(false)} />}
        </>
    );
};export default SettingsView;
