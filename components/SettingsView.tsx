

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initDB, getAllFiles, addFile, getFile, deleteFile } from '../utils/db';
import UpdateConfirmationFlyout from './UpdateConfirmationFlyout';
import NewRecordConfirmationFlyout from './NewRecordConfirmationFlyout';
import UpdateErrorFlyout from './UpdateErrorFlyout';
import UpdateSummaryFlyout from './UpdateSummaryFlyout';
import ScoringMatrixFlyout from './ScoringMatrixFlyout';
import CourseSelectionFlyout from './CourseSelectionFlyout';
import { CourseSelectionDialog } from './CourseSelectionDialog';
import { Instructor, Trainee, SyllabusItemDetail, InstructorRank, InstructorCategory, SeatConfig, TraineeRank, EventLimits, PhraseBank, MasterCurrency, CurrencyRequirement, CancellationRecord, CancellationCode, CrewRequirement } from '../types';
import ACHistoryPage from './ACHistoryPage';
import AuditButton from './AuditButton';
import { logAudit } from '../utils/auditLogger';
import { debouncedAuditLog } from '../utils/auditDebounce';
import { stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import DutyTurnaroundSection from './DutyTurnaroundSection';
import AircraftAvailabilitySettings from './AircraftAvailabilitySettings';
import EmergencyPage from './EmergencyPage';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import {
    DEFAULT_TILE_STATUS_SETTINGS,
    normaliseTileStatusSettings,
    type TileStatusSettings,
} from '../utils/tileStatusSettings';
import {
    DEFAULT_DISPATCH_STAGGER_SETTINGS,
    normaliseDispatchStaggerSettings,
    type DispatchStaggerSettings,
} from '../utils/dispatchStagger';
import { isFixedCrewLikeOperationalModel } from '../utils/platformConfigService';


declare var XLSX: any;

const TEMPLATE_OVERRIDE_FOLDER_ID = 'template_overrides';

interface SettingsViewProps {
    hideHeader?: boolean;
    activeSection?: 'scoring-matrix' | 'duty-turnaround' | 'sct-events' | 'currencies' | 'business-rules' | 'data-loaders' | 'event-limits' | 'validation' | 'trainee-database' | 'user-list' | 'staff-database' | 'organisation' | 'appearance' | 'emergency';
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
    onScoringMatrixElementAdded?: (elementName: string) => void;
    activeOperationalModel?: string;
    activeUnitHasTrainees?: boolean;
    maxDispatchPerHour: number;
    onUpdateMaxDispatchPerHour: (value: number) => void;
    dispatchStaggerSettings?: DispatchStaggerSettings;
    onUpdateDispatchStaggerSettings?: (settings: DispatchStaggerSettings) => void;
    tileStatusSettings?: TileStatusSettings;
    onUpdateTileStatusSettings?: (settings: TileStatusSettings) => void;
    courseColors: { [key: string]: string };
    setCourseColors: (colors: { [key: string]: string }) => void;
    onUpdateTraineeLMPs: (lmpMap: Map<string, SyllabusItemDetail[]>) => void;
    cancellationRecords?: CancellationRecord[];
    cancellationCodes?: CancellationCode[];
    currentAircraftAvailable?: number;
    totalAircraft?: number;
    dayFlyingStart?: string;
    dayFlyingEnd?: string;
    resourceDisplayNames?: ResourceDisplayNames;
}

// ─── Inline Scoring Matrix Component ────────────────────────────────────────
const INITIAL_ELEMENTS_LIST_INLINE = [
    'Generic Flying Elements',
    'Pre-Post Flight', 'Walk Around', 'Strap-in', 'Ground Checks', 'Airborne Checks',
    'Stationary', 'Visual', 'Effects of Control', 'Trimming', 'Straight and Level',
    'Level medium Turn', 'Level Steep turn', 'Visual - Initial & Pitch', 'Landing',
    'Crosswind', 'Radio Comms', 'Situational Awareness', 'Lookout', 'Knowledge'
];
const SCORING_MATRIX_ELEMENT_LIST_KEY = '__scoringMatrixElements';
const SCORING_MATRIX_ELEMENT_GROUPS_KEY = '__scoringMatrixElementGroups';
const DEFAULT_SCORING_MATRIX_SECTIONS = [
    'Core Dimensions',
    'Procedural Framework',
    'Takeoff',
    'Departure',
    'Core Handling Skills',
    'Turns',
    'Recovery',
    'Landing',
    'Domestics',
    'Additional Elements',
];
const DEFAULT_SCORING_MATRIX_ELEMENT_GROUPS: Record<string, string> = {
    Airmanship: 'Core Dimensions',
    Preparation: 'Core Dimensions',
    Technique: 'Core Dimensions',
    'Pre-Post Flight': 'Procedural Framework',
    'Walk Around': 'Procedural Framework',
    'Strap-in': 'Procedural Framework',
    'Ground Checks': 'Procedural Framework',
    'Airborne Checks': 'Procedural Framework',
    Stationary: 'Takeoff',
    Visual: 'Departure',
    'Effects of Control': 'Core Handling Skills',
    Trimming: 'Core Handling Skills',
    'Straight and Level': 'Core Handling Skills',
    'Level medium Turn': 'Turns',
    'Level Steep turn': 'Turns',
    'Visual - Initial & Pitch': 'Recovery',
    Landing: 'Landing',
    Crosswind: 'Landing',
    'Radio Comms': 'Domestics',
    'Situational Awareness': 'Domestics',
    Lookout: 'Domestics',
    Knowledge: 'Domestics',
};
const SCORING_MATRIX_SECTION_HELP = 'Choose where this element appears in the training report. Type a new section name to add it. A section stays in the dropdown while at least one element uses it. To rename a section, change each element using the old name to the new name.';

const getConfiguredScoringMatrixElements = (phraseBank: PhraseBank): string[] => {
    const savedElements = (phraseBank as any)?.[SCORING_MATRIX_ELEMENT_LIST_KEY];
    if (Array.isArray(savedElements)) {
        return savedElements
            .map(element => String(element || '').trim())
            .filter(Boolean)
            .filter((element, index, arr) => arr.findIndex(candidate => candidate.toLowerCase() === element.toLowerCase()) === index);
    }
    const customElements = Object.keys(phraseBank || {}).filter(key =>
        key !== SCORING_MATRIX_ELEMENT_LIST_KEY &&
        !['Airmanship', 'Preparation', 'Technique'].includes(key) &&
        !INITIAL_ELEMENTS_LIST_INLINE.includes(key)
    );
    return [...INITIAL_ELEMENTS_LIST_INLINE, ...customElements];
};

interface ScoringMatrixInlineProps {
    activeTab: 'Airmanship' | 'Preparation' | 'Technique' | 'Elements';
    phraseBank: PhraseBank;
    onUpdatePhraseBank: (newBank: PhraseBank) => void;
    readOnly?: boolean;
    onElementAdded?: (elementName: string) => void;
}

const ScoringMatrixInline: React.FC<ScoringMatrixInlineProps> = ({ activeTab, phraseBank, onUpdatePhraseBank, readOnly = false, onElementAdded }) => {
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
        return getConfiguredScoringMatrixElements(phraseBank);
    });

    const [selectedElement, setSelectedElement] = useState<string>(flightElements[0]);

    const currentDimension = activeTab === 'Elements' ? selectedElement : activeTab;
    const configuredElementGroups = ((phraseBank as any)?.[SCORING_MATRIX_ELEMENT_GROUPS_KEY] || {}) as Record<string, string>;
    const currentElementGroup = configuredElementGroups[selectedElement] || DEFAULT_SCORING_MATRIX_ELEMENT_GROUPS[selectedElement] || 'Additional Elements';
    const sectionOptions = Array.from(new Set([
        ...DEFAULT_SCORING_MATRIX_SECTIONS,
        ...Object.values(configuredElementGroups).map(value => String(value || '').trim()).filter(Boolean),
        currentElementGroup,
    ]));

    const handleElementGroupChange = (element: string, group: string) => {
        onUpdatePhraseBank({
            ...phraseBank,
            [SCORING_MATRIX_ELEMENT_GROUPS_KEY]: {
                ...configuredElementGroups,
                [element]: group,
            },
        } as PhraseBank);
    };

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
        const nextElements = [...flightElements, name];
        setFlightElements(nextElements);
        onUpdatePhraseBank({
            ...phraseBank,
            [SCORING_MATRIX_ELEMENT_LIST_KEY]: nextElements,
            [SCORING_MATRIX_ELEMENT_GROUPS_KEY]: {
                ...configuredElementGroups,
                [name]: 'Additional Elements',
            },
            [name]: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] }
        } as PhraseBank);
        setSelectedElement(name);
        setNewElementName('');
        setShowAddElementFlyout(false);
        onElementAdded?.(name);
    };

    const handleDeleteElements = () => {
        if (selectedToDelete.size === 0) { alert('Please select at least one element to delete.'); return; }
        const newFlightElements = flightElements.filter(el => !selectedToDelete.has(el));
        setFlightElements(newFlightElements);
        const newPhraseBank = { ...phraseBank };
        selectedToDelete.forEach(el => { delete newPhraseBank[el]; });
        const nextGroups = { ...configuredElementGroups };
        selectedToDelete.forEach(el => { delete nextGroups[el]; });
        (newPhraseBank as any)[SCORING_MATRIX_ELEMENT_LIST_KEY] = newFlightElements;
        (newPhraseBank as any)[SCORING_MATRIX_ELEMENT_GROUPS_KEY] = nextGroups;
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

                {activeTab === 'Elements' && (
                    <div className="border border-gray-700 rounded-lg bg-gray-800/70 p-4">
                        <div className="mb-2 flex items-center gap-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
                                Training report section
                            </label>
                            <span className="group relative inline-flex">
                                <span
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-sky-500/60 bg-sky-500/10 text-[10px] font-bold text-sky-300"
                                    title={SCORING_MATRIX_SECTION_HELP}
                                >
                                    i
                                </span>
                                <span className="pointer-events-none absolute left-1/2 top-6 z-30 hidden w-72 -translate-x-1/2 rounded-md border border-sky-500/40 bg-gray-950 px-3 py-2 text-xs normal-case leading-relaxed tracking-normal text-gray-200 shadow-xl group-hover:block">
                                    {SCORING_MATRIX_SECTION_HELP}
                                </span>
                            </span>
                        </div>
                        <div className="w-full max-w-full overflow-x-auto pb-1">
                            <div className="grid min-w-[460px] grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)] gap-3">
                                <input
                                    type="text"
                                    value={currentElementGroup}
                                    onChange={(event) => handleElementGroupChange(selectedElement, event.target.value)}
                                    onKeyDown={(event) => event.stopPropagation()}
                                    readOnly={readOnly}
                                    className="w-full min-w-0 bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 read-only:text-gray-400"
                                />
                                <select
                                    value={sectionOptions.includes(currentElementGroup) ? currentElementGroup : ''}
                                    onChange={(event) => handleElementGroupChange(selectedElement, event.target.value)}
                                    disabled={readOnly}
                                    className="w-full min-w-0 bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 disabled:text-gray-400"
                                >
                                    {!sectionOptions.includes(currentElementGroup) && <option value="">Custom section</option>}
                                    {sectionOptions.map(section => (
                                        <option key={section} value={section}>{section}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            This controls which heading this element appears under on the training report.
                        </p>
                    </div>
                )}

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

// FIX: Export the component to make it available for import.
export const SettingsView: React.FC<SettingsViewProps> = ({ 
    hideHeader = false,
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
    onScoringMatrixElementAdded,
    activeOperationalModel,
    activeUnitHasTrainees = true,
    maxDispatchPerHour,
    onUpdateMaxDispatchPerHour,
    dispatchStaggerSettings = DEFAULT_DISPATCH_STAGGER_SETTINGS,
    onUpdateDispatchStaggerSettings,
    tileStatusSettings = DEFAULT_TILE_STATUS_SETTINGS,
    onUpdateTileStatusSettings,
    timezoneOffset,
    courseColors,
    setCourseColors,
    onUpdateTraineeLMPs,
    cancellationRecords,
    cancellationCodes,
    currentAircraftAvailable,
    totalAircraft,
    dayFlyingStart = '08:00',
    dayFlyingEnd = '17:00',
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES
}) => {
    // --- STATE ---
    
    // Permission Check - Only Super Admin, Admin, and Scheduler can edit Settings
    const canEditSettings = ['Super Admin', 'Admin', 'Scheduler'].includes(currentUserPermission);
    const isFixedCrewModel = isFixedCrewLikeOperationalModel(activeOperationalModel);
    const resolvedDispatchStaggerSettings = normaliseDispatchStaggerSettings(dispatchStaggerSettings);
    const handleDispatchStaggerChange = (updates: Partial<DispatchStaggerSettings>) => {
        if (!onUpdateDispatchStaggerSettings) return;
        onUpdateDispatchStaggerSettings(normaliseDispatchStaggerSettings({
            ...resolvedDispatchStaggerSettings,
            ...updates,
        }));
    };
    const resolvedTileStatusSettings = normaliseTileStatusSettings(tileStatusSettings);
    const handleTileStatusMinutesChange = (key: keyof TileStatusSettings, value: number) => {
        if (!onUpdateTileStatusSettings) return;
        onUpdateTileStatusSettings(normaliseTileStatusSettings({
            ...resolvedTileStatusSettings,
            [key]: value,
        }));
    };
    
    // SCT Events State
    const [isEditingSctEvents, setIsEditingSctEvents] = useState(false);
    
    const [tempSctEvents, setTempSctEvents] = useState<string[]>([]);
    const [newSctEvent, setNewSctEvent] = useState('');
    
    // Currency Details Panel State
    const [selectedCurrency, setSelectedCurrency] = useState<MasterCurrency | null>(null);
    
    // Event Limits State
    const [isEditingLimits, setIsEditingLimits] = useState(false);
    const [tempLimits, setTempLimits] = useState<EventLimits>(eventLimits);
    const canEditTraineeLimits = isEditingLimits && activeUnitHasTrainees;

    // Scoring Matrix State
    const [showScoringMatrix, setShowScoringMatrix] = useState(false);
    const [scoringMatrixTab, setScoringMatrixTab] = useState<'Airmanship' | 'Preparation' | 'Technique' | 'Elements'>('Airmanship');

    // Data Loader State
    const [repoFiles, setRepoFiles] = useState<{ id: string; name: string; folderId: string }[]>([]);
    const [pendingTemplateOverride, setPendingTemplateOverride] = useState<{ key: string; label: string } | null>(null);
    const templateOverrideInputRef = useRef<HTMLInputElement>(null);
    const directUploadInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [dragUploadType, setDragUploadType] = useState<string | null>(null);

    // Update process state
    const [fileToProcess, setFileToProcess] = useState<{ name: string; folderId: string; file: File } | null>(null);
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

    const getTemplateOverride = (templateKey: string) => (
        repoFiles.find(file => file.folderId === TEMPLATE_OVERRIDE_FOLDER_ID && file.name.startsWith(`${templateKey}::`))
    );

    const getTemplateOverrideDisplayName = (templateKey: string) => {
        const override = getTemplateOverride(templateKey);
        return override ? override.name.replace(`${templateKey}::`, '') : '';
    };

    const downloadStoredTemplate = async (templateKey: string): Promise<boolean> => {
        const override = getTemplateOverride(templateKey);
        if (!override) return false;
        const record = await getFile(override.id);
        if (!record) return false;
        const url = URL.createObjectURL(record.content);
        const link = document.createElement('a');
        link.href = url;
        link.download = record.name.replace(`${templateKey}::`, '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
    };

    const downloadPublicTemplate = (href: string, fileName: string) => {
        const link = document.createElement('a');
        link.href = href;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleChangeTemplateClick = (template: { key: string; label: string }) => {
        setPendingTemplateOverride(template);
        if (templateOverrideInputRef.current) templateOverrideInputRef.current.value = '';
        templateOverrideInputRef.current?.click();
    };

    const handleTemplateOverrideSelected = async (file?: File | null) => {
        if (!file || !pendingTemplateOverride) return;
        const existingOverrides = repoFiles.filter(existingFile => (
            existingFile.folderId === TEMPLATE_OVERRIDE_FOLDER_ID
            && existingFile.name.startsWith(`${pendingTemplateOverride.key}::`)
        ));
        await Promise.all(existingOverrides.map(existingFile => deleteFile(existingFile.id)));
        await addFile(file, TEMPLATE_OVERRIDE_FOLDER_ID, `${pendingTemplateOverride.key}::${file.name}`);
        await refreshFiles();
        logAudit({
            page: 'Settings - Data Loaders',
            action: 'update',
            description: `Changed ${pendingTemplateOverride.label} download template`,
            changes: `Template file: ${file.name}`,
        });
        onShowSuccess(`${pendingTemplateOverride.label} template updated.`);
        setPendingTemplateOverride(null);
    };

    const handleResetTemplateOverride = async (template: { key: string; label: string }) => {
        const existingOverrides = repoFiles.filter(existingFile => (
            existingFile.folderId === TEMPLATE_OVERRIDE_FOLDER_ID
            && existingFile.name.startsWith(`${template.key}::`)
        ));
        await Promise.all(existingOverrides.map(existingFile => deleteFile(existingFile.id)));
        await refreshFiles();
        logAudit({
            page: 'Settings - Data Loaders',
            action: 'update',
            description: `Reset ${template.label} download template`,
            changes: 'Restored built-in template download.',
        });
        onShowSuccess(`${template.label} template reset to built-in default.`);
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
            changes: 'Updated scheduling limit categories'
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
            description: `Updated ${resourceDisplayNames.ftd} turnaround time`,
            changes: `Set to: ${value} minutes`
        });
    };

    const handleUpdateCptTurnaround = (value: number) => {
        onUpdateCptTurnaround(value);
        logAudit({
            page: 'Settings - Duty & Turnaround',
            action: 'update',
            description: `Updated ${resourceDisplayNames.cpt} turnaround time`,
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
    const isSupportedDataUploadFile = (file: File): boolean => (
        /\.(xlsx|xls|csv)$/i.test(file.name)
    );

    const handleDirectDataUpload = (folderId: 'instructor_loads' | 'trainee_loads' | 'lmp_loads', file?: File | null) => {
        if (!file) return;
        if (!isSupportedDataUploadFile(file)) {
            onShowSuccess('Please select an .xlsx, .xls or .csv file.');
            return;
        }
        setCoursesFromFile([]);
        setFileToProcess({ name: file.name, folderId, file });
        setSelectedUpdateType('minor');
        setShowUpdateConfirmation(true);
    };

    const handleDownloadInstructorTemplate = async () => {
        if (await downloadStoredTemplate('staff')) return;
        downloadPublicTemplate('/Staff_Bulk_Update_Template.xlsx', 'Staff_Bulk_Update_Template.xlsx');
    };

    const handleDownloadTraineeTemplate = async () => {
        if (await downloadStoredTemplate('trainee')) return;
        downloadPublicTemplate('/Trainee_Bulk_Update_Template.xlsx', 'Trainee_Bulk_Update_Template.xlsx');
    };
    
    const handleDownloadLmpTemplate = async () => {
        if (await downloadStoredTemplate('lmp')) return;
        downloadPublicTemplate('/LMP_Syllabus_Template.xlsx', 'LMP_Syllabus_Template.xlsx');
    };

    const handleDownloadLogbookTemplate = async () => {
        if (await downloadStoredTemplate('logbook')) return;
        const headers = ['Date', 'Aircraft', 'Pilot', 'Student', 'Sortie', 'Duration', 'Result'];
        const ws = XLSX.utils.json_to_sheet([{}], { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Logbook");
        XLSX.writeFile(wb, "Logbook_Template.xlsx");
    };

    const handleDownloadOrganisationStructureTemplate = async () => {
        if (await downloadStoredTemplate('organisation-structure')) return;
        const rows = [
            ['Level', 'Level Name', 'Option'],
            [0, 'Department of the Air Force', 'Department of the Air Force'],
            [1, 'Headquarters', 'HQ USAF'],
            [2, 'Command', 'Air Force Global Strike Command'],
            [3, 'Numbered Force', 'Eighth Air Force'],
            [4, 'Wing', '2nd Bomb Wing'],
            [5, 'Group', '2nd Operations Group'],
            [6, 'Squadron', '96th Bomb Squadron'],
            [7, 'Flight', 'Flight'],
            [8, 'Crew', 'Aircrew'],
        ];
        if (typeof XLSX !== 'undefined') {
            const worksheet = XLSX.utils.aoa_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Organisation Structure');
            XLSX.writeFile(workbook, 'Organisation_Structure_Template.xlsx');
            return;
        }
        const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Organisation_Structure_Template.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const dataLoaderTemplateRows = [
        { key: 'staff', label: 'Staff', downloadLabel: 'Staff Template (.xlsx)', onDownload: handleDownloadInstructorTemplate },
        { key: 'trainee', label: 'Trainee', downloadLabel: 'Trainee Template (.xlsx)', onDownload: handleDownloadTraineeTemplate },
        { key: 'lmp', label: 'LMP', downloadLabel: 'LMP Template (.xlsx)', onDownload: handleDownloadLmpTemplate },
        { key: 'logbook', label: 'Logbook', downloadLabel: 'Logbook Template (.xlsx)', onDownload: handleDownloadLogbookTemplate },
        { key: 'organisation-structure', label: 'Organisational Structure', downloadLabel: 'Organisational Structure Template (.xlsx)', onDownload: handleDownloadOrganisationStructureTemplate },
    ];
    
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
            const data = await fileToProcess.file.arrayBuffer();
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
            const data = await fileToProcess.file.arrayBuffer();
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

    const splitImportList = (value: string): string[] =>
        value
            .split(/\r?\n|;|,/)
            .map(item => item.trim())
            .filter(Boolean);

    const normaliseImportedService = (value: string): Instructor['service'] | undefined => {
        const cleanValue = value.trim().toLowerCase();
        if (!cleanValue) return undefined;
        if (['raaf', 'air force', 'airforce', 'royal australian air force'].includes(cleanValue)) return 'RAAF';
        if (['ran', 'navy', 'royal australian navy'].includes(cleanValue)) return 'RAN';
        if (['ara', 'army', 'australian army'].includes(cleanValue)) return 'ARA';
        return value as Instructor['service'];
    };

    const normaliseImportedCategory = (value: string): InstructorCategory | undefined => {
        const cleanValue = value.trim().toLowerCase();
        if (!cleanValue) return undefined;
        if (['u', 'uncat', 'un cat', 'uncategorised', 'uncategorized'].includes(cleanValue)) return 'UnCat';
        const upperValue = value.trim().toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(upperValue)) return upperValue as InstructorCategory;
        return value as InstructorCategory;
    };

    const normaliseImportedSeatConfig = (value: string): SeatConfig | undefined => {
        const cleanValue = value.trim().toLowerCase();
        if (!cleanValue) return undefined;
        if (['n', 'normal', 'norm'].includes(cleanValue)) return 'Normal';
        if (['fwd/short', 'forward/short', 'fwd short', 'forward short', 'fwd', 'front'].includes(cleanValue)) return 'FWD/SHORT';
        if (['rear/short', 'rear short', 'rear'].includes(cleanValue)) return 'REAR/SHORT';
        if (['fwd/long', 'forward/long', 'fwd long', 'forward long', 'long'].includes(cleanValue)) return 'FWD/LONG';
        return value as SeatConfig;
    };

    const applyImportedQualifications = (parsed: Partial<Instructor>, value?: string): void => {
        if (!value) return;
        const rolesLower = splitImportList(value).join(' ').toLowerCase();
        parsed.isExecutive = rolesLower.includes('exec') || rolesLower.includes('executive');
        parsed.isFlyingSupervisor = rolesLower.includes('fly sup') || rolesLower.includes('flying supervisor') || rolesLower.includes('supervisor');
        parsed.isTestingOfficer = rolesLower.includes('testing') || rolesLower.includes('test officer');
        parsed.isIRE = rolesLower.includes('ire');
        parsed.isCFI = rolesLower.includes('cfi');
        parsed.isOFI = rolesLower.includes('ofi');
        parsed.isQFI = rolesLower.includes('qfi') || rolesLower.includes('instructor');
        parsed.isAdminStaff = rolesLower.includes('admin');
        if (rolesLower.includes('sim ip')) {
            parsed.role = 'SIM IP';
        } else if (rolesLower.includes('pilot')) {
            parsed.role = 'Pilot';
        } else if (rolesLower.includes('qfi') || rolesLower.includes('instructor')) {
            parsed.role = 'QFI';
        }
    };

    const parseInstructorRow = (row: any): Partial<Instructor> | null => {
        const idValue = getNum(row, ['PMKeys/ID', 'idNumber']);
        if (idValue === undefined) return null;

        const parsed: Partial<Instructor> = { idNumber: idValue };
        
        const surname = getStr(row, ['Srname', 'Surname', 'Last Name']);
        const firstname = getStr(row, ['First name', 'Firstname', 'Given Name']);
        if (surname && firstname) {
            parsed.name = `${surname}, ${firstname}`;
        } else {
            const fullName = getStr(row, [
                'Name',
                'Full Name',
                'Name (Surname, FirstName)',
                'Name (Surname. FirstName)',
                'Name [Surname, Firstname]',
            ]);
            if (fullName) parsed.name = fullName;
        }

        const rank = getStr(row, ['Rank']); if (rank) parsed.rank = rank as InstructorRank;
        const role = getStr(row, ['Role']); if (role) parsed.role = role as Instructor['role'];
        const callsign = getNum(row, ['callsign number', 'callsignnumber', 'Callsign No', 'Callsign Number', 'Callsign']); if (callsign !== undefined) parsed.callsignNumber = callsign;
        const service = getStr(row, ['Service']);
        const normalisedService = service ? normaliseImportedService(service) : undefined;
        if (normalisedService) parsed.service = normalisedService;
        const category = getStr(row, ['Category']);
        const normalisedCategory = category ? normaliseImportedCategory(category) : undefined;
        if (normalisedCategory) parsed.category = normalisedCategory;
        const location = getStr(row, ['Location', 'Base', 'Location Code']); if (location) parsed.location = location;
        const unit = getStr(row, ['Unit', 'Unit Code']); if (unit) parsed.unit = unit;
        const flight = getStr(row, ['Flight', 'flight', 'Flight/Sqn', 'Section']); if (flight) parsed.flight = flight;
        const seatConfig = getStr(row, ['Seat config', 'seatConfig', 'Seat Configuration']);
        const normalisedSeatConfig = seatConfig ? normaliseImportedSeatConfig(seatConfig) : undefined;
        if (normalisedSeatConfig) parsed.seatConfig = normalisedSeatConfig;
        const phone = getStr(row, ['Phone Number', 'phoneNumber', 'Phone', 'Mobile']); if (phone) parsed.phoneNumber = phone;
        const email = getStr(row, ['Email', 'Email Address']); if (email) parsed.email = email;
        const permissions = getStr(row, ['Permissions', 'permissions', 'Permission']);
        if (permissions) parsed.permissions = splitImportList(permissions);
        
        const rolesStr = getStr(row, ['Roles', 'Qualifications and Roles', 'Qualifications & Roles', 'Qualifications']);
        applyImportedQualifications(parsed, rolesStr);

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
        const parseCrewRequirement = (value: string): CrewRequirement | undefined => {
            const text = String(value || '').trim();
            if (!text) return undefined;
            if (/^(aircraft\s*)?default$/i.test(text)) return { mode: 'aircraft_default' };
            const roles = text
                .split(/\r?\n|;|,/)
                .map(part => part.trim())
                .filter(Boolean)
                .map(part => {
                    const match = part.match(/^(.+?)(?:\s*[:=x]\s*|\s+)(\d+)$/i);
                    const role = (match ? match[1] : part).trim();
                    const count = match ? Math.max(0, Math.round(Number(match[2]) || 0)) : 1;
                    return role && count > 0 ? { role, count } : null;
                })
                .filter((item): item is { role: string; count: number } => Boolean(item));
            return roles.length > 0 ? { mode: 'custom', roles } : undefined;
        };

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
        const resourceNumber = getNum(row, ['Resource Number', 'resourceNumber', 'Resources Required Number']);
        if (resourceNumber !== undefined) parsed.resourceNumber = Math.max(0, Math.round(resourceNumber));
        const resourcesHum = getStrArray(row, ['Resources Required (Human)', 'resourcesHuman']); if (resourcesHum) parsed.resourcesHuman = resourcesHum;
        const crewRequirementText = getStr(row, ['Crew Required', 'Crew Requirement', 'Crew Composition', 'crewRequirement']);
        const crewRequirement = parseCrewRequirement(crewRequirementText);
        if (crewRequirement) parsed.crewRequirement = crewRequirement;
        
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


    const DirectDataUploadCard: React.FC<{
        id: 'instructor_loads' | 'trainee_loads' | 'lmp_loads';
        title: string;
        description: string;
    }> = ({ id, title, description }) => (
        <div
            onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (canEditSettings) setDragUploadType(id);
            }}
            onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = canEditSettings ? 'copy' : 'none';
                if (canEditSettings) setDragUploadType(id);
            }}
            onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDragUploadType(current => current === id ? null : current);
            }}
            onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDragUploadType(null);
                if (canEditSettings) handleDirectDataUpload(id, event.dataTransfer.files?.[0]);
            }}
            className={`rounded-lg border border-dashed p-4 transition-colors ${
                dragUploadType === id
                    ? 'border-cyan-300 bg-cyan-500/15'
                    : 'border-gray-600 bg-gray-950/40'
            } ${canEditSettings ? '' : 'opacity-60'}`}
        >
            <input
                ref={(element) => { directUploadInputRefs.current[id] = element; }}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={!canEditSettings}
                onChange={(event) => {
                    handleDirectDataUpload(id, event.target.files?.[0]);
                    event.currentTarget.value = '';
                }}
            />
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-gray-100">{title}</h4>
                    <p className="mt-1 text-xs text-gray-400">{description}</p>
                </div>
                <button
                    type="button"
                    disabled={!canEditSettings}
                    onClick={() => directUploadInputRefs.current[id]?.click()}
                    className={`shrink-0 rounded-md px-3 py-2 text-xs font-bold ${
                        canEditSettings
                            ? 'bg-gray-100 text-gray-900 hover:bg-white'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    Select File
                </button>
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Drag and drop .xlsx, .xls or .csv
            </p>
        </div>
    );

    return (
        <div onKeyDownCapture={stopEditableKeyPropagation}>
            <div className="space-y-6">
                {/* AC History */}
                {shouldShowSection('validation') && (
                <div className="space-y-6">
                   <ACHistoryPage
                       currentUserRole={currentUserPermission}
                       cancellationRecords={cancellationRecords || []}
                       currentAircraftAvailable={currentAircraftAvailable}
                       totalAircraft={totalAircraft}
                       timezoneOffset={timezoneOffset}
                       dayFlyingStart={dayFlyingStart}
                       dayFlyingEnd={dayFlyingEnd}
                       resourceDisplayNames={resourceDisplayNames}
                   />
                </div>
                )}
                {/* Scoring Matrix - Inline Content */}
                {shouldShowSection('scoring-matrix') && (
                    <ScoringMatrixInline
                        activeTab={scoringMatrixActiveTab || 'Airmanship'}
                        phraseBank={phraseBank}
                        onUpdatePhraseBank={handleUpdatePhraseBank}
                        readOnly={scoringMatrixReadOnly}
                        onElementAdded={onScoringMatrixElementAdded}
                    />
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
                        resourceDisplayNames={resourceDisplayNames}
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
                                    <div>
                                        <label className="text-sm font-medium text-gray-400 block mb-1">Post-Flight Currency Panel</label>
                                        <p className="text-gray-200">{selectedCurrency.showInPostFlight ? 'Yes' : 'No'}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-400 block mb-1">Post-Flight Recency Checklist</label>
                                        <p className="text-gray-200">{selectedCurrency.showInPostFlightRecency ? 'Yes' : 'No'}</p>
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
                                <div className="pt-4 border-t border-gray-700">
                                    <div className="mb-3">
                                        <h3 className="text-sm font-semibold text-gray-200">Dispatch Stagger</h3>
                                        <p className="mt-1 text-xs text-gray-400">
                                            Minimum interval between event start times. Formation members may still share an authorised formation start.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="rounded-md border border-gray-700 bg-gray-900/35 p-3">
                                            <div className="mb-2 flex items-center justify-between gap-3">
                                                <span className="text-sm font-medium text-gray-300">Flights</span>
                                                <label className="flex items-center gap-2 text-xs text-gray-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={resolvedDispatchStaggerSettings.flightNoMinimum}
                                                        onChange={(event) => handleDispatchStaggerChange({ flightNoMinimum: event.target.checked })}
                                                        disabled={!canEditSettings || !onUpdateDispatchStaggerSettings}
                                                        className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed"
                                                    />
                                                    No minimum
                                                </label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={120}
                                                    step={1}
                                                    value={resolvedDispatchStaggerSettings.flightMinutes}
                                                    onChange={(event) => handleDispatchStaggerChange({ flightMinutes: Number(event.target.value) })}
                                                    disabled={!canEditSettings || !onUpdateDispatchStaggerSettings || resolvedDispatchStaggerSettings.flightNoMinimum}
                                                    className={`w-full px-3 py-2 rounded-md border focus:ring-sky-500 focus:border-sky-500 ${
                                                        canEditSettings && onUpdateDispatchStaggerSettings && !resolvedDispatchStaggerSettings.flightNoMinimum
                                                            ? 'bg-gray-700 border-gray-600 text-white'
                                                            : 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed'
                                                    }`}
                                                />
                                                <span className="text-xs text-gray-400">min</span>
                                            </div>
                                        </div>
                                        <div className="rounded-md border border-gray-700 bg-gray-900/35 p-3">
                                            <div className="mb-2 flex items-center justify-between gap-3">
                                                <span className="text-sm font-medium text-gray-300">Simulators</span>
                                                <label className="flex items-center gap-2 text-xs text-gray-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={resolvedDispatchStaggerSettings.simulatorNoMinimum}
                                                        onChange={(event) => handleDispatchStaggerChange({ simulatorNoMinimum: event.target.checked })}
                                                        disabled={!canEditSettings || !onUpdateDispatchStaggerSettings}
                                                        className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed"
                                                    />
                                                    No minimum
                                                </label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={120}
                                                    step={1}
                                                    value={resolvedDispatchStaggerSettings.simulatorMinutes}
                                                    onChange={(event) => handleDispatchStaggerChange({ simulatorMinutes: Number(event.target.value) })}
                                                    disabled={!canEditSettings || !onUpdateDispatchStaggerSettings || resolvedDispatchStaggerSettings.simulatorNoMinimum}
                                                    className={`w-full px-3 py-2 rounded-md border focus:ring-sky-500 focus:border-sky-500 ${
                                                        canEditSettings && onUpdateDispatchStaggerSettings && !resolvedDispatchStaggerSettings.simulatorNoMinimum
                                                            ? 'bg-gray-700 border-gray-600 text-white'
                                                            : 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed'
                                                    }`}
                                                />
                                                <span className="text-xs text-gray-400">min</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-gray-700">
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-200">Flight tile authorisation warnings</h3>
                                            <p className="mt-1 text-xs text-gray-400">
                                                Controls when unsigned flight tiles change border and crew-name colour on the current day's DFP.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <label className="block">
                                            <span className="block text-xs font-medium text-gray-400 mb-1">Amber warning before start</span>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={720}
                                                    step={5}
                                                    value={resolvedTileStatusSettings.authorizationWarningMinutes}
                                                    onChange={(e) => handleTileStatusMinutesChange('authorizationWarningMinutes', Number(e.target.value))}
                                                    disabled={!canEditSettings}
                                                    className={`w-full px-3 py-2 rounded-md border focus:ring-sky-500 focus:border-sky-500 ${
                                                        canEditSettings
                                                            ? 'bg-gray-700 border-gray-600 text-white'
                                                            : 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed'
                                                    }`}
                                                />
                                                <span className="text-xs text-gray-400">min</span>
                                            </div>
                                        </label>
                                        <label className="block">
                                            <span className="block text-xs font-medium text-gray-400 mb-1">Red urgent before start</span>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={720}
                                                    step={5}
                                                    value={resolvedTileStatusSettings.authorizationUrgentMinutes}
                                                    onChange={(e) => handleTileStatusMinutesChange('authorizationUrgentMinutes', Number(e.target.value))}
                                                    disabled={!canEditSettings}
                                                    className={`w-full px-3 py-2 rounded-md border focus:ring-sky-500 focus:border-sky-500 ${
                                                        canEditSettings
                                                            ? 'bg-gray-700 border-gray-600 text-white'
                                                            : 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed'
                                                    }`}
                                                />
                                                <span className="text-xs text-gray-400">min</span>
                                            </div>
                                        </label>
                                    </div>
                                    <p className="mt-2 text-xs text-gray-500">
                                        Deployment tiles, Runway DI/TWR DI and Duty Sup events are exempt from these authorisation warning colours.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                   )}
                    {/* Data Loaders Window */}
                   {shouldShowSection('data-loaders') && (
                    <div className="w-full max-w-5xl rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
                        <div className="p-4 flex justify-between items-center border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-200">Data Loaders</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <fieldset className="overflow-hidden rounded-lg border border-gray-600 bg-gray-900/30 p-3">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Templates</legend>
                                <div className="mt-2 space-y-2">
                                    <p className="text-xs text-gray-400">Download templates to ensure correct formatting for bulk uploads.</p>
                                    <input
                                        ref={templateOverrideInputRef}
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        className="hidden"
                                        onChange={(event) => void handleTemplateOverrideSelected(event.target.files?.[0])}
                                    />
                                    {dataLoaderTemplateRows.map((template) => {
                                        const overrideName = getTemplateOverrideDisplayName(template.key);
                                        return (
                                            <div key={template.key} className="rounded border border-gray-700 bg-gray-950/40 p-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <button onClick={() => void template.onDownload()} className="w-[45%] min-w-0 shrink-0 truncate whitespace-nowrap rounded-md bg-sky-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-sky-700">
                                                        {template.downloadLabel}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleChangeTemplateClick(template)}
                                                        className="shrink-0 whitespace-nowrap rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/20"
                                                    >
                                                        Change
                                                    </button>
                                                    {overrideName ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleResetTemplateOverride(template)}
                                                            className="shrink-0 whitespace-nowrap rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-500/20"
                                                        >
                                                            Reset
                                                        </button>
                                                    ) : null}
                                                </div>
                                                <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500" title={overrideName || 'Built-in default template'}>
                                                    {overrideName ? `Custom: ${overrideName}` : 'Built-in default'}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </fieldset>
                            <fieldset className="overflow-hidden rounded-lg border border-gray-600 bg-gray-900/30 p-3">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Upload Data</legend>
                                <div className="mt-2 space-y-3">
                                    <p className="text-xs text-gray-400">Upload directly from this computer. Files are processed immediately after confirmation and are not stored in a staging repository.</p>
                                    <DirectDataUploadCard
                                        id="instructor_loads"
                                        title="Staff Data"
                                        description="Create or update staff records from the staff bulk upload template."
                                    />
                                    <DirectDataUploadCard
                                        id="trainee_loads"
                                        title="Trainee Data"
                                        description="Create or update trainee records, then choose the course to apply the upload to."
                                    />
                                    <DirectDataUploadCard
                                        id="lmp_loads"
                                        title="LMP Data"
                                        description="Create or update master LMP event data from the LMP template."
                                    />
                                </div>
                            </fieldset>
                        </div>
                    </div>

                   )}
                    {/* Events Limits Window */}
                   {shouldShowSection('event-limits') && (
                    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-full max-w-2xl h-fit">
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
                        <div className="p-4 space-y-4">
                            {isFixedCrewModel ? (
                                <fieldset className="p-3 border border-gray-600 rounded-lg">
                                    <legend className="px-2 text-sm font-semibold text-gray-300">Staff</legend>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center gap-3">
                                            <span className="text-sm text-gray-400">Max flights per day:</span>
                                            {isEditingLimits ? (
                                                <input type="number" min="1" value={tempLimits.instructor.maxFlights || 1} onChange={e => setTempLimits({...tempLimits, instructor: {...tempLimits.instructor, maxFlights: parseInt(e.target.value) || 1}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                            ) : <span className="text-white font-mono">{eventLimits.instructor.maxFlights || 1}</span>}
                                        </div>
                                        <div className="flex justify-between items-center gap-3">
                                            <span className="text-sm text-gray-400">Max simulator per day:</span>
                                            {isEditingLimits ? (
                                                <input type="number" min="1" value={tempLimits.instructor.maxSimulators || 2} onChange={e => setTempLimits({...tempLimits, instructor: {...tempLimits.instructor, maxSimulators: parseInt(e.target.value) || 1}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                            ) : <span className="text-white font-mono">{eventLimits.instructor.maxSimulators || 2}</span>}
                                        </div>
                                        <div className="flex justify-between items-center gap-3">
                                            <span className="text-sm text-gray-400">Max flight + sim per day:</span>
                                            {isEditingLimits ? (
                                                <input type="number" min="1" value={tempLimits.instructor.maxFlightSim || tempLimits.instructor.maxFlightFtd || 2} onChange={e => setTempLimits({...tempLimits, instructor: {...tempLimits.instructor, maxFlightSim: parseInt(e.target.value) || 1, maxFlightFtd: parseInt(e.target.value) || 1}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                            ) : <span className="text-white font-mono">{eventLimits.instructor.maxFlightSim || eventLimits.instructor.maxFlightFtd || 2}</span>}
                                        </div>
                                        <div className="flex justify-between items-center gap-3">
                                            <span className="text-xs text-gray-400">Staff (Flying Supervisor role assigned) - Max Duty Sup session (hrs):</span>
                                            {isEditingLimits ? (
                                                <input type="number" min="0.25" step="0.25" value={tempLimits.instructor.maxDutySup} onChange={e => setTempLimits({...tempLimits, instructor: {...tempLimits.instructor, maxDutySup: parseFloat(e.target.value) || 0}})} className="w-16 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                            ) : <span className="text-white font-mono">{eventLimits.instructor.maxDutySup}</span>}
                                        </div>
                                    </div>
                                </fieldset>
                            ) : (
                                <>
                                    {/* Execs */}
                                    <fieldset className="p-3 border border-gray-600 rounded-lg">
                                        <legend className="px-2 text-sm font-semibold text-gray-300">Execs</legend>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-400">Max Flight/{resourceDisplayNames.ftd}:</span>
                                                {isEditingLimits ? (
                                                    <input type="number" value={tempLimits.exec.maxFlightFtd} onChange={e => setTempLimits({...tempLimits, exec: {...tempLimits.exec, maxFlightFtd: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                                ) : <span className="text-white font-mono">{eventLimits.exec.maxFlightFtd}</span>}
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-400">Max Duty Sup session (hrs):</span>
                                                {isEditingLimits ? (
                                                    <input type="number" min="0.25" step="0.25" value={tempLimits.exec.maxDutySup} onChange={e => setTempLimits({...tempLimits, exec: {...tempLimits.exec, maxDutySup: parseFloat(e.target.value) || 0}})} className="w-16 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                                ) : <span className="text-white font-mono">{eventLimits.exec.maxDutySup}</span>}
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-400">Max total all events:</span>
                                                {isEditingLimits ? (
                                                    <input type="number" value={tempLimits.exec.maxTotal || 2} onChange={e => setTempLimits({...tempLimits, exec: {...tempLimits.exec, maxTotal: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                                ) : <span className="text-white font-mono">{eventLimits.exec.maxTotal}</span>}
                                            </div>
                                        </div>
                                    </fieldset>
                                    {/* Staff */}
                                    <fieldset className="p-3 border border-gray-600 rounded-lg">
                                        <legend className="px-2 text-sm font-semibold text-gray-300">Staff</legend>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-400">Max Flight/{resourceDisplayNames.ftd}:</span>
                                                {isEditingLimits ? (
                                                    <input type="number" value={tempLimits.instructor.maxFlightFtd || 2} onChange={e => setTempLimits({...tempLimits, instructor: {...tempLimits.instructor, maxFlightFtd: parseInt(e.target.value) || 0, maxFlightSim: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                                ) : <span className="text-white font-mono">{eventLimits.instructor.maxFlightFtd}</span>}
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-400">Staff (Flying Supervisor role assigned) - Max Duty Sup session (hrs):</span>
                                                {isEditingLimits ? (
                                                    <input type="number" min="0.25" step="0.25" value={tempLimits.instructor.maxDutySup} onChange={e => setTempLimits({...tempLimits, instructor: {...tempLimits.instructor, maxDutySup: parseFloat(e.target.value) || 0}})} className="w-16 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                                ) : <span className="text-white font-mono">{eventLimits.instructor.maxDutySup}</span>}
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-400">Max total all events:</span>
                                                {isEditingLimits ? (
                                                    <input type="number" value={tempLimits.instructor.maxTotal || 3} onChange={e => setTempLimits({...tempLimits, instructor: {...tempLimits.instructor, maxTotal: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                                ) : <span className="text-white font-mono">{eventLimits.instructor.maxTotal}</span>}
                                            </div>
                                        </div>
                                    </fieldset>
                                    {/* Trainees */}
                                    <fieldset
                                        className={`p-3 border rounded-lg transition ${activeUnitHasTrainees ? 'border-gray-600' : 'border-gray-700 bg-gray-900/50 opacity-45'}`}
                                        disabled={!activeUnitHasTrainees}
                                    >
                                        <legend className="px-2 text-sm font-semibold text-gray-300">
                                            Trainees{activeUnitHasTrainees ? '' : ' (Off for current unit)'}
                                        </legend>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-400">Max Flight/{resourceDisplayNames.ftd}:</span>
                                                {canEditTraineeLimits ? (
                                                    <input type="number" value={tempLimits.trainee.maxFlightFtd || 1} onChange={e => setTempLimits({...tempLimits, trainee: {...tempLimits.trainee, maxFlightFtd: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                                ) : <span className="text-white font-mono">{eventLimits.trainee.maxFlightFtd}</span>}
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-400">Max total all events:</span>
                                                {canEditTraineeLimits ? (
                                                    <input type="number" value={tempLimits.trainee.maxTotal || 2} onChange={e => setTempLimits({...tempLimits, trainee: {...tempLimits.trainee, maxTotal: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                                ) : <span className="text-white font-mono">{eventLimits.trainee.maxTotal}</span>}
                                            </div>
                                        </div>
                                    </fieldset>
                                    {/* SIM IPs */}
                                    <fieldset className="p-3 border border-gray-600 rounded-lg">
                                        <legend className="px-2 text-sm font-semibold text-gray-300">SIM IPs</legend>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-400">Max {resourceDisplayNames.ftd}:</span>
                                                {isEditingLimits ? (
                                                    <input type="number" value={tempLimits.simIp.maxFtd || 2} onChange={e => setTempLimits({...tempLimits, simIp: {...tempLimits.simIp, maxFtd: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                                ) : <span className="text-white font-mono">{eventLimits.simIp.maxFtd}</span>}
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-400">Max total all events:</span>
                                                {isEditingLimits ? (
                                                    <input type="number" value={tempLimits.simIp.maxTotal || 2} onChange={e => setTempLimits({...tempLimits, simIp: {...tempLimits.simIp, maxTotal: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                                ) : <span className="text-white font-mono">{eventLimits.simIp.maxTotal}</span>}
                                            </div>
                                        </div>
                                    </fieldset>
                                </>
                            )}
                        </div>
                    </div>

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
            {showUpdateConfirmation && fileToProcess && <UpdateConfirmationFlyout fileName={fileToProcess.name} onConfirm={handleUpdateConfirm} onClose={() => setShowUpdateConfirmation(false)} />}
            {showCourseSelection && <CourseSelectionFlyout courses={coursesFromFile.length > 0 ? coursesFromFile : activeCourses} onConfirm={handleCourseSelection} onClose={() => setShowCourseSelection(false)} updateType={selectedUpdateType} />}
            {showNewRecordConfirm && unmatchedRowData && <NewRecordConfirmationFlyout rowData={unmatchedRowData} onConfirm={handleConfirmNewRecord} onCancel={handleRejectNewRecord} />}
            {showUpdateError && <UpdateErrorFlyout message={updateErrorMessage} onClose={() => setShowUpdateError(false)} />}
            {showUpdateSummary && <UpdateSummaryFlyout summary={updateSummary} onClose={() => setShowUpdateSummary(false)} />}
        </div>
    );
};export default SettingsView;
