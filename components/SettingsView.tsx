

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initDB, getAllFiles, addFile, getFile, deleteFile } from '../utils/db';
import ScoringMatrixFlyout from './ScoringMatrixFlyout';
import { EventLimits, PhraseBank, MasterCurrency, CurrencyRequirement, CancellationRecord, CancellationCode } from '../types';
import ACHistoryPage from './ACHistoryPage';
import { logAudit } from '../utils/auditLogger';
import { debouncedAuditLog } from '../utils/auditDebounce';
import { stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import DutyTurnaroundSection from './DutyTurnaroundSection';
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
import { verifyCurrentUserPassword } from '../utils/passwordVerification';
import { showDarkAlert, showDarkPrompt } from './DarkMessageModal';


declare var XLSX: any;

const TEMPLATE_OVERRIDE_FOLDER_ID = 'template_overrides';

interface SettingsViewProps {
    activeSection?: 'scoring-matrix' | 'duty-turnaround' | 'sct-events' | 'currencies' | 'business-rules' | 'data-loaders' | 'event-limits' | 'validation' | 'emergency';
    onShowSuccess: (message: string) => void;
    eventLimits: EventLimits;
    onUpdateEventLimits: (limits: EventLimits) => void;
    phraseBank: PhraseBank;
    onUpdatePhraseBank: (newBank: PhraseBank) => void;
    onNavigate: (view: string) => void;
    onOpenCurrencyBuilder?: () => void;
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
    onShowSuccess,
    eventLimits, onUpdateEventLimits,
    phraseBank, onUpdatePhraseBank,
    onNavigate,
    onOpenCurrencyBuilder,
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
    const resolvedTileStatusSettings = normaliseTileStatusSettings(tileStatusSettings);
    const [isEditingBusinessRules, setIsEditingBusinessRules] = useState(false);
    const [tempMaxDispatchPerHour, setTempMaxDispatchPerHour] = useState(maxDispatchPerHour);
    const [tempDispatchStaggerSettings, setTempDispatchStaggerSettings] = useState<DispatchStaggerSettings>(resolvedDispatchStaggerSettings);
    const [tempTileStatusSettings, setTempTileStatusSettings] = useState<TileStatusSettings>(resolvedTileStatusSettings);
    const displayedDispatchStaggerSettings = isEditingBusinessRules ? tempDispatchStaggerSettings : resolvedDispatchStaggerSettings;
    const displayedTileStatusSettings = isEditingBusinessRules ? tempTileStatusSettings : resolvedTileStatusSettings;
    const displayedMaxDispatchPerHour = isEditingBusinessRules ? tempMaxDispatchPerHour : maxDispatchPerHour;
    const canEditBusinessRules = canEditSettings && isEditingBusinessRules;
    const handleDispatchStaggerChange = (updates: Partial<DispatchStaggerSettings>) => {
        setTempDispatchStaggerSettings((current) => normaliseDispatchStaggerSettings({
            ...current,
            ...updates,
        }));
    };
    const handleTileStatusMinutesChange = (key: keyof TileStatusSettings, value: number) => {
        setTempTileStatusSettings((current) => normaliseTileStatusSettings({
            ...current,
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

    // Import template override state
    const [repoFiles, setRepoFiles] = useState<{ id: string; name: string; folderId: string }[]>([]);
    const [pendingTemplateOverride, setPendingTemplateOverride] = useState<{ key: string; label: string } | null>(null);
    const templateOverrideInputRef = useRef<HTMLInputElement>(null);
    const standardSettingsButtonClass = 'w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md disabled:cursor-not-allowed disabled:opacity-50';

    // --- COMPUTED / MEMOIZED ---
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
        if (activeSection && activeSection !== 'data-loaders') return;
        const initAndFetch = async () => {
            try {
                await initDB();
                refreshFiles();
            } catch (error) {
                console.error("Failed to initialize DB:", error);
            }
        };
        initAndFetch();
    }, [activeSection]);
    
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

    const verifySettingsEditPassword = async (message: string): Promise<boolean> => {
        const password = await showDarkPrompt({
            title: 'Password Required',
            message,
            inputLabel: 'Password',
            inputType: 'password',
            inputPlaceholder: 'Enter password',
            confirmText: 'Unlock',
            cancelText: 'Cancel',
        });
        if (!password) return false;
        try {
            const isValid = await verifyCurrentUserPassword(password);
            if (!isValid) {
                await showDarkAlert('The password was not accepted.', 'Password Required', 'warning');
                return false;
            }
            return true;
        } catch (error) {
            await showDarkAlert('The app could not verify your password.', 'Password Check Failed', 'error');
            return false;
        }
    };

    const handleChangeTemplateClick = async (template: { key: string; label: string }) => {
        const unlocked = await verifySettingsEditPassword(`Enter your password to change the ${template.label} download template.`);
        if (!unlocked) return;
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
            page: 'Settings - Import Templates',
            action: 'update',
            description: `Changed ${pendingTemplateOverride.label} download template`,
            changes: `Template file: ${file.name}`,
        });
        onShowSuccess(`${pendingTemplateOverride.label} template updated.`);
        setPendingTemplateOverride(null);
    };

    const handleResetTemplateOverride = async (template: { key: string; label: string }) => {
        const unlocked = await verifySettingsEditPassword(`Enter your password to reset the ${template.label} download template.`);
        if (!unlocked) return;
        const existingOverrides = repoFiles.filter(existingFile => (
            existingFile.folderId === TEMPLATE_OVERRIDE_FOLDER_ID
            && existingFile.name.startsWith(`${template.key}::`)
        ));
        await Promise.all(existingOverrides.map(existingFile => deleteFile(existingFile.id)));
        await refreshFiles();
        logAudit({
            page: 'Settings - Import Templates',
            action: 'update',
            description: `Reset ${template.label} download template`,
            changes: 'Restored built-in template download.',
        });
        onShowSuccess(`${template.label} template reset to built-in default.`);
    };

    const handleEditBusinessRules = () => {
        setTempMaxDispatchPerHour(maxDispatchPerHour);
        setTempDispatchStaggerSettings(resolvedDispatchStaggerSettings);
        setTempTileStatusSettings(resolvedTileStatusSettings);
        setIsEditingBusinessRules(true);
    };

    const handleSaveBusinessRules = () => {
        onUpdateMaxDispatchPerHour(tempMaxDispatchPerHour);
        if (onUpdateDispatchStaggerSettings) {
            onUpdateDispatchStaggerSettings(normaliseDispatchStaggerSettings(tempDispatchStaggerSettings));
        }
        if (onUpdateTileStatusSettings) {
            onUpdateTileStatusSettings(normaliseTileStatusSettings(tempTileStatusSettings));
        }
        setIsEditingBusinessRules(false);
        onShowSuccess('Business rules updated');
        logAudit({
            page: 'Settings - Business Rules',
            action: 'update',
            description: 'Updated business rule settings',
            changes: `Max dispatch/hr: ${tempMaxDispatchPerHour}; flight stagger: ${tempDispatchStaggerSettings.flightNoMinimum ? 'none' : `${tempDispatchStaggerSettings.flightMinutes} min`}; simulator stagger: ${tempDispatchStaggerSettings.simulatorNoMinimum ? 'none' : `${tempDispatchStaggerSettings.simulatorMinutes} min`}; authorisation warnings: ${tempTileStatusSettings.authorizationWarningMinutes}/${tempTileStatusSettings.authorizationUrgentMinutes} min`,
        });
    };

    const handleCancelBusinessRules = () => {
        setTempMaxDispatchPerHour(maxDispatchPerHour);
        setTempDispatchStaggerSettings(resolvedDispatchStaggerSettings);
        setTempTileStatusSettings(resolvedTileStatusSettings);
        setIsEditingBusinessRules(false);
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

    const handleCancelLimits = () => {
        setTempLimits(JSON.parse(JSON.stringify(eventLimits)));
        setIsEditingLimits(false);
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
                        onUpdatePreferredDutyPeriod={onUpdatePreferredDutyPeriod}
                        maxCrewDutyPeriod={maxCrewDutyPeriod}
                        onUpdateMaxCrewDutyPeriod={onUpdateMaxCrewDutyPeriod}
                        flightTurnaround={flightTurnaround}
                        onUpdateFlightTurnaround={onUpdateFlightTurnaround}
                        ftdTurnaround={ftdTurnaround}
                        onUpdateFtdTurnaround={onUpdateFtdTurnaround}
                        cptTurnaround={cptTurnaround}
                        onUpdateCptTurnaround={onUpdateCptTurnaround}
                        canEdit={canEditSettings}
                        onShowSuccess={onShowSuccess}
                        resourceDisplayNames={resourceDisplayNames}
                    />
                   )}

                          {/* SCT Events Window */}
                   {shouldShowSection('sct-events') && (
                       <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-80 h-[500px] flex flex-col">
                           <div className="p-4 flex justify-between items-center border-b border-gray-700">
                               <h2 className="text-lg font-semibold text-gray-200">SCT Events</h2>
                               {isEditingSctEvents ? (
                                   <div className="flex gap-[1px]">
                                       <button type="button" onClick={handleSaveSctEvents} className={standardSettingsButtonClass}>Save</button>
                                       <button type="button" onClick={handleCancelSctEvents} className={standardSettingsButtonClass}>Cancel</button>
                                   </div>
                               ) : (
                                   <button 
                                   type="button"
                                   onClick={handleEditSctEvents} 
                                   disabled={!canEditSettings}
                                   className={standardSettingsButtonClass}
                               >
                                   Edit
                               </button>
                               )}
                           </div>
                           <div className="p-4 space-y-4 flex min-h-0 flex-1 flex-col">
                               {isEditingSctEvents ? (
                                   <>
                                       <p className="text-sm text-gray-400">Manage SCT event types.</p>
                                       <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
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
                                               onKeyDownCapture={stopEditableKeyPropagation}
                                               onKeyDown={(e) => {
                                                   stopEditableKeyPropagation(e);
                                                   if (e.key === 'Enter') handleAddSctEvent();
                                               }}
                                               placeholder="New SCT event name" 
                                               className="flex-grow bg-gray-700 border-gray-600 rounded-md py-1 px-2 text-white text-sm focus:outline-none focus:ring-sky-500" 
                                           />
                                           <button type="button" onClick={handleAddSctEvent} className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold">+</button>
                                       </div>
                                   </>
                               ) : (
                                   <>
                                       <p className="text-sm text-gray-400">Configured SCT event types.</p>
                                       <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
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
                                <button onClick={() => onOpenCurrencyBuilder ? onOpenCurrencyBuilder() : onNavigate('CurrencyBuilder')} className="w-full px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold">
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
                            {isEditingBusinessRules ? (
                                <div className="flex gap-[1px]">
                                    <button onClick={handleSaveBusinessRules} className={standardSettingsButtonClass}>Save</button>
                                    <button onClick={handleCancelBusinessRules} className={standardSettingsButtonClass}>Cancel</button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleEditBusinessRules}
                                    disabled={!canEditSettings}
                                    className={standardSettingsButtonClass}
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-700">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Max dispatch / hr
                                    </label>
                                    <select 
                                        value={displayedMaxDispatchPerHour}
                                        onChange={(e) => setTempMaxDispatchPerHour(parseInt(e.target.value))}
                                        disabled={!canEditBusinessRules}
                                        className={`w-full px-3 py-2 rounded-md border focus:ring-sky-500 focus:border-sky-500 ${
                                            canEditBusinessRules
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
                                                        checked={displayedDispatchStaggerSettings.flightNoMinimum}
                                                        onChange={(event) => handleDispatchStaggerChange({ flightNoMinimum: event.target.checked })}
                                                        disabled={!canEditBusinessRules || !onUpdateDispatchStaggerSettings}
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
                                                    value={displayedDispatchStaggerSettings.flightMinutes}
                                                    onChange={(event) => handleDispatchStaggerChange({ flightMinutes: Number(event.target.value) })}
                                                    disabled={!canEditBusinessRules || !onUpdateDispatchStaggerSettings || displayedDispatchStaggerSettings.flightNoMinimum}
                                                    className={`w-full px-3 py-2 rounded-md border focus:ring-sky-500 focus:border-sky-500 ${
                                                        canEditBusinessRules && onUpdateDispatchStaggerSettings && !displayedDispatchStaggerSettings.flightNoMinimum
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
                                                        checked={displayedDispatchStaggerSettings.simulatorNoMinimum}
                                                        onChange={(event) => handleDispatchStaggerChange({ simulatorNoMinimum: event.target.checked })}
                                                        disabled={!canEditBusinessRules || !onUpdateDispatchStaggerSettings}
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
                                                    value={displayedDispatchStaggerSettings.simulatorMinutes}
                                                    onChange={(event) => handleDispatchStaggerChange({ simulatorMinutes: Number(event.target.value) })}
                                                    disabled={!canEditBusinessRules || !onUpdateDispatchStaggerSettings || displayedDispatchStaggerSettings.simulatorNoMinimum}
                                                    className={`w-full px-3 py-2 rounded-md border focus:ring-sky-500 focus:border-sky-500 ${
                                                        canEditBusinessRules && onUpdateDispatchStaggerSettings && !displayedDispatchStaggerSettings.simulatorNoMinimum
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
                                                    value={displayedTileStatusSettings.authorizationWarningMinutes}
                                                    onChange={(e) => handleTileStatusMinutesChange('authorizationWarningMinutes', Number(e.target.value))}
                                                    disabled={!canEditBusinessRules}
                                                    className={`w-full px-3 py-2 rounded-md border focus:ring-sky-500 focus:border-sky-500 ${
                                                        canEditBusinessRules
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
                                                    value={displayedTileStatusSettings.authorizationUrgentMinutes}
                                                    onChange={(e) => handleTileStatusMinutesChange('authorizationUrgentMinutes', Number(e.target.value))}
                                                    disabled={!canEditBusinessRules}
                                                    className={`w-full px-3 py-2 rounded-md border focus:ring-sky-500 focus:border-sky-500 ${
                                                        canEditBusinessRules
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
                    {/* Import Templates Window */}
                   {shouldShowSection('data-loaders') && (
                    <div className="w-full max-w-5xl rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
                        <div className="p-4 flex justify-between items-center border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-200">Import Templates</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <fieldset className="overflow-hidden rounded-lg border border-gray-600 bg-gray-900/30 p-3">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Download Templates</legend>
                                <div className="mt-2 space-y-2">
                                    <p className="text-xs text-gray-400">Download templates for bulk uploads in the relevant Staff, Trainee, Syllabus and Organisation pages.</p>
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
                                                        onClick={() => void handleChangeTemplateClick(template)}
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
                        </div>
                    </div>

                   )}
                    {/* Events Limits Window */}
                   {shouldShowSection('event-limits') && (
                    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-full max-w-2xl h-fit">
                        <div className="p-4 flex justify-between items-center border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-200">Events Limits</h2>
                            {isEditingLimits ? (
                                <div className="flex gap-[1px]">
                                    <button onClick={handleSaveLimits} className={standardSettingsButtonClass}>Save</button>
                                    <button onClick={handleCancelLimits} className={standardSettingsButtonClass}>Cancel</button>
                                </div>
                            ) : (
                                <button 
                                onClick={handleEditLimits} 
                                disabled={!canEditSettings}
                                className={standardSettingsButtonClass}
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
        </div>
    );
};export default SettingsView;
