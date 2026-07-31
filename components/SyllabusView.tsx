import { useSystemFreeze } from '../hooks/useSystemFreeze';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Instructor, PhraseBank, SyllabusItemDetail } from '../types';
import AuditButton from './AuditButton';
import CrewRequirementEditor from './CrewRequirementEditor';
import { logAudit } from '../utils/auditLogger';
import { createSyllabusItem, updateSyllabusItem, deleteSyllabusItem, clearSyllabusCache } from '../lib/syllabusService';
import { debouncedAuditLog, flushPendingAudits } from '../utils/auditDebounce';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import type { AircraftCrewComposition } from '../utils/aircraftCrewComposition';
import type { CrewPositionTerminology } from '../utils/crewPositionTerminology';
import { formatCrewRequirementSummary } from '../utils/crewRequirements';
import {
    ANY_AIRCRAFT_CONFIG,
    formatAircraftConfigurationSummary,
    normaliseSelectedAircraftConfigurations,
    type AircraftConfigurationDefinition,
} from '../utils/aircraftConfigurationSettings';
import { isFixedCrewLikeOperationalModel, normaliseOperationalModel } from '../utils/platformConfigService';
import type { StaffQualificationCatalogue } from '../utils/staffQualifications';
import {
    formatFixedCrewManifestStatus,
    getFixedCrewManifestReadiness,
    stripFixedCrewManifestNote,
} from '../utils/fixedCrewManifest';
import {
    getAirCombatAssignmentFromItem,
    getAuthoritativeSyllabusDuration,
    staffHasAirCombatAssignment,
    setAirCombatTrainingAssignment,
} from '../utils/airCombatTraining';
import {
    getFixedCrewCoursePackageBriefingTimes,
    withFixedCrewCoursePackageBriefingTimes,
} from '../utils/fixedCrewTraining';
import { SYLLABUS_COURSE_SHELL_NOTE, isSyllabusCourseShell } from '../utils/syllabusCourseShell';
import { stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import type { PlatformMasterLmpCatalogueEntry } from '../utils/platformConfigService';

interface SyllabusViewProps {
  syllabusDetails: SyllabusItemDetail[];
  onBack: () => void;
  initialSelectedId?: string;
  onUpdateItem: (item: SyllabusItemDetail) => void;
  onAddItem?: (item: SyllabusItemDetail) => void;
  resourceDisplayNames?: ResourceDisplayNames;
  aircraftConfigurations?: AircraftConfigurationDefinition[];
  aircraftCrewComposition?: AircraftCrewComposition;
  crewPositionTerminology?: CrewPositionTerminology;
  activeLocationCode?: string;
  activeUnitCode?: string;
  trainingPackageTemplates?: SyllabusItemDetail[];
  instructorsData?: Instructor[];
  onUpdateInstructor?: (data: Instructor) => void | Promise<void>;
  operationalModel?: string;
  sharedUnitTabs?: string[];
  masterLmpCatalogue?: PlatformMasterLmpCatalogueEntry[];
  staffQualificationCatalogue?: StaffQualificationCatalogue;
  currentUserName?: string;
  scoringMatrixPhraseBank?: PhraseBank;
  onAddScoringMatrixElement?: () => void;
  onNavigateToSettingsSection?: (request: { sectionId: string; unitCode?: string; locationCode?: string; resourcePoolCode?: string; aircraftTypeCode?: string; focusSubsectionId?: string }) => void;
}

// Reusable components for view mode
const DetailCard: React.FC<{ label: React.ReactNode; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div className={`bg-gray-700/50 p-1 rounded-lg ${className}`}>
        <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">{label}</label>
        <div className="mt-0.5 text-[10px] font-semibold text-white">{value}</div>
    </div>
);

const DetailList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
    <div>
        <h3 className="text-md font-semibold text-sky-400 mb-2">{title}</h3>
        <div className="bg-gray-700/50 p-3 rounded-lg text-sm text-gray-300">
            {items && items.length > 0 ? (
                <ul className="space-y-1 list-disc list-inside">
                    {items.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
            ) : (
                <p className="italic text-gray-500">None</p>
            )}
        </div>
    </div>
);

const AIR_COMBAT_LINKED_EVENT_NOTE_REGEX = /^\[Linked Event:\s*([^\]]+)\]$/i;
const DEFAULT_ASSESSED_ELEMENTS = ['Airmanship', 'Preparation', 'Technique'];
const SCORING_MATRIX_ASSESSABLE_ELEMENTS = [
    'Pre-Post Flight',
    'Walk Around',
    'Strap-in',
    'Ground Checks',
    'Airborne Checks',
    'Stationary',
    'Visual',
    'Effects of Control',
    'Trimming',
    'Straight and Level',
    'Level medium Turn',
    'Level Steep turn',
    'Visual - Initial & Pitch',
    'Landing',
    'Crosswind',
    'Radio Comms',
    'Situational Awareness',
    'Lookout',
    'Knowledge',
];
const SCORING_MATRIX_ELEMENT_LIST_KEY = '__scoringMatrixElements';
const SCORING_MATRIX_NON_ASSESSABLE_KEYS = new Set(['generic flying elements']);

const getScoringMatrixElementOptions = (phraseBank?: PhraseBank): string[] => {
    const seen = new Map<string, string>();
    const add = (value: string) => {
        const clean = String(value || '').trim();
        const key = clean.toLowerCase();
        if (!clean || SCORING_MATRIX_NON_ASSESSABLE_KEYS.has(key) || seen.has(key)) return;
        seen.set(key, clean);
    };
    DEFAULT_ASSESSED_ELEMENTS.forEach(add);
    const configuredElements = (phraseBank as any)?.[SCORING_MATRIX_ELEMENT_LIST_KEY];
    if (Array.isArray(configuredElements)) {
        configuredElements.forEach(add);
    } else {
        SCORING_MATRIX_ASSESSABLE_ELEMENTS.forEach(add);
        Object.keys(phraseBank || {}).forEach(key => {
            if (key !== SCORING_MATRIX_ELEMENT_LIST_KEY) add(key);
        });
    }
    return Array.from(seen.values());
};

const normaliseAssessedElements = (elements?: string[], availableElements: string[] = []): string[] => {
    const available = new Set(availableElements.map(item => item.toLowerCase()));
    const source = Array.isArray(elements) && elements.length > 0 ? elements : DEFAULT_ASSESSED_ELEMENTS;
    const selected = source
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .filter((item, index, arr) => arr.findIndex(candidate => candidate.toLowerCase() === item.toLowerCase()) === index)
        .filter(item => available.size === 0 || available.has(item.toLowerCase()));
    return selected.length > 0 ? selected : DEFAULT_ASSESSED_ELEMENTS;
};

const AssessedElementsWindow: React.FC<{
    selectedElements?: string[];
    availableElements: string[];
    isEditing: boolean;
    onChange: (elements: string[]) => void;
    onAddElement?: () => void;
    showAssessmentRequired?: boolean;
    assessmentRequired?: boolean;
    onAssessmentRequiredChange?: (required: boolean) => void;
}> = ({ selectedElements, availableElements, isEditing, onChange, onAddElement, showAssessmentRequired = false, assessmentRequired = false, onAssessmentRequiredChange }) => {
    const selected = normaliseAssessedElements(selectedElements, availableElements);
    const selectedSet = new Set(selected.map(item => item.toLowerCase()));
    const toggle = (element: string) => {
        const isSelected = selectedSet.has(element.toLowerCase());
        const next = isSelected
            ? selected.filter(item => item.toLowerCase() !== element.toLowerCase())
            : [...selected, element];
        onChange(next.length > 0 ? next : DEFAULT_ASSESSED_ELEMENTS);
    };

    return (
        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Assessed Elements</legend>
            <div className="mt-2 rounded-lg bg-gray-900/45 p-3">
                {showAssessmentRequired && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wide text-amber-100">Assessment required</div>
                            <div className="mt-0.5 text-[11px] text-gray-400">Creates a draft training report after DCO post-flight completion.</div>
                        </div>
                        {isEditing ? (
                            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-amber-100">
                                <input
                                    type="checkbox"
                                    checked={!!assessmentRequired}
                                    onChange={(event) => onAssessmentRequiredChange?.(event.target.checked)}
                                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
                                />
                                <span>{assessmentRequired ? 'On' : 'Off'}</span>
                            </label>
                        ) : (
                            <span className={`rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                                assessmentRequired
                                    ? 'border border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                                    : 'border border-gray-600 bg-gray-950/60 text-gray-400'
                            }`}>
                                {assessmentRequired ? 'On' : 'Off'}
                            </span>
                        )}
                    </div>
                )}
                {isEditing ? (
                    <>
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="space-y-2">
                                <p className="text-xs text-gray-400">Select the Scoring Matrix elements that appear on this event's Training Report.</p>
                            </div>
                            {onAddElement && (
                                <button type="button" onClick={onAddElement} className="shrink-0 rounded border border-sky-600 bg-sky-900/60 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-800">
                                    Add Element
                                </button>
                            )}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {availableElements.map(element => (
                                <label key={element} className="flex cursor-pointer items-center gap-2 rounded border border-gray-700 bg-gray-950/70 px-3 py-2 text-xs text-gray-100 hover:border-sky-600/70">
                                    <input
                                        type="checkbox"
                                        checked={selectedSet.has(element.toLowerCase())}
                                        onChange={() => toggle(element)}
                                        className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-sky-500"
                                    />
                                    <span className="font-semibold">{element}</span>
                                </label>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {selected.map(element => (
                            <span key={element} className="rounded border border-sky-700/50 bg-sky-950/50 px-2.5 py-1 text-xs font-semibold text-sky-100">
                                {element}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </fieldset>
    );
};

const getAirCombatLinkedEventCode = (item?: Partial<SyllabusItemDetail> | null): string => {
    const linkedLine = String(item?.notes || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(line => AIR_COMBAT_LINKED_EVENT_NOTE_REGEX.test(line));
    const match = linkedLine?.match(AIR_COMBAT_LINKED_EVENT_NOTE_REGEX);
    return match?.[1]?.trim() || '';
};

const withAirCombatLinkedEventNote = (item: SyllabusItemDetail, linkedEventCode: string): SyllabusItemDetail => {
    const visibleNotes = String(item.notes || '')
        .split(/\r?\n/)
        .filter(line => !AIR_COMBAT_LINKED_EVENT_NOTE_REGEX.test(line.trim()))
        .join('\n')
        .trim();
    const normalizedLinkedEvent = linkedEventCode && linkedEventCode !== 'none' ? linkedEventCode : '';
    const notes = [visibleNotes, normalizedLinkedEvent ? `[Linked Event: ${normalizedLinkedEvent}]` : '']
        .filter(Boolean)
        .join('\n')
        .trim();
    return { ...item, notes: notes || undefined };
};

// Reusable components for edit mode
const EditableField: React.FC<{ label: string; value: string | number; onChange: (value: string | number) => void; type?: string; step?: number; }> = ({ label, value, onChange, type = 'text', step }) => (
    <div className="bg-gray-700/50 p-3 rounded-lg">
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
        <input
            type={type}
            step={step}
            value={value}
            onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
            className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-md shadow-sm py-1 px-2 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
        />
    </div>
);

const EditableList: React.FC<{ title: string; items: string[]; onChange: (items: string[]) => void; }> = ({ title, items, onChange }) => (
    <div>
        <h3 className="text-md font-semibold text-sky-400 mb-2">{title}</h3>
        <textarea
            value={(items || []).join('\n')}
            onChange={(e) => onChange(e.target.value.split('\n'))}
            rows={4}
            className="block w-full bg-gray-800 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
            placeholder="One item per line"
        />
    </div>
);

const AircraftConfigInfoIcon: React.FC<{ definitions: AircraftConfigurationDefinition[] }> = ({ definitions }) => (
    <span className="group relative inline-flex">
        <button
            type="button"
            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-500 text-[10px] font-bold text-gray-300 hover:border-sky-400 hover:text-sky-200"
            aria-label="Aircraft configuration definitions"
        >
            i
        </button>
        <span className="pointer-events-none absolute left-0 top-5 z-30 hidden w-72 rounded-md border border-sky-500/45 bg-gray-950 p-3 text-left text-[11px] normal-case tracking-normal text-gray-200 shadow-xl group-hover:block group-focus-within:block">
            <span className="mb-2 block font-semibold text-sky-200">Aircraft Config Definitions</span>
            {definitions.length > 0 ? (
                definitions.map(definition => (
                    <span key={definition.id} className="mb-1 block">
                        <span className="font-semibold text-white">{definition.label}: </span>
                        <span>{definition.definition || 'No definition entered'}</span>
                    </span>
                ))
            ) : (
                <span>No aircraft configurations are defined for the active resource pool.</span>
            )}
            <span className="mt-2 block border-t border-gray-700 pt-2 text-gray-400">ANY means aircraft configuration does not matter for this LMP event.</span>
        </span>
    </span>
);

const AircraftConfigSelector: React.FC<{
    value?: string[];
    definitions: AircraftConfigurationDefinition[];
    onChange: (value: string[]) => void;
}> = ({ value, definitions, onChange }) => {
    const selected = normaliseSelectedAircraftConfigurations(value, definitions);
    const toggle = (id: string, checked: boolean) => {
        if (id === ANY_AIRCRAFT_CONFIG) {
            onChange([ANY_AIRCRAFT_CONFIG]);
            return;
        }
        const withoutAny = selected.filter(item => item !== ANY_AIRCRAFT_CONFIG);
        const next = checked
            ? Array.from(new Set([...withoutAny, id]))
            : withoutAny.filter(item => item !== id);
        onChange(next.length > 0 ? next : [ANY_AIRCRAFT_CONFIG]);
    };

    return (
        <div className="bg-gray-700/50 p-1 rounded-lg">
            <label className="flex items-center text-[9px] font-medium text-gray-400 uppercase tracking-wider">
                CONFIG
                <AircraftConfigInfoIcon definitions={definitions} />
            </label>
            <div className="mt-1 grid grid-cols-1 gap-1">
                <label className="flex items-center gap-1 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-gray-100">
                    <input
                        type="checkbox"
                        checked={selected.includes(ANY_AIRCRAFT_CONFIG)}
                        onChange={() => toggle(ANY_AIRCRAFT_CONFIG, true)}
                    />
                    ANY
                </label>
                {definitions.map(definition => (
                    <label key={definition.id} className="flex items-center gap-1 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-gray-100">
                        <input
                            type="checkbox"
                            checked={!selected.includes(ANY_AIRCRAFT_CONFIG) && selected.includes(definition.id)}
                            onChange={(event) => toggle(definition.id, event.target.checked)}
                        />
                        {definition.label}
                    </label>
                ))}
            </div>
        </div>
    );
};

const AssignTrainingModal: React.FC<{
    title: string;
    staff: Instructor[];
    selectedStaffIds: Set<number>;
    saving: boolean;
    onToggle: (idNumber: number) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onCancel: () => void;
    onSave: () => void;
}> = ({ title, staff, selectedStaffIds, saving, onToggle, onSelectAll, onDeselectAll, onCancel, onSave }) => (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-2xl rounded-lg border border-sky-700/50 bg-gray-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-700 px-4 py-3">
                <div>
                    <h2 className="text-lg font-bold text-white">Assign Training</h2>
                    <p className="mt-1 text-xs text-gray-400">{title}</p>
                </div>
                <button type="button" onClick={onCancel} className="rounded px-2 py-1 text-sm text-gray-300 hover:bg-gray-800 hover:text-white">Close</button>
            </div>
            <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={onSelectAll} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:bg-gray-700">Select All</button>
                    <button type="button" onClick={onDeselectAll} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:bg-gray-700">Deselect All</button>
                    <span className="ml-auto text-xs text-gray-400">{selectedStaffIds.size} selected</span>
                </div>
                <div className="max-h-[420px] overflow-y-auto rounded border border-gray-700">
                    {staff.length === 0 ? (
                        <div className="p-4 text-sm italic text-gray-500">No active squadron staff available for this unit.</div>
                    ) : staff.map(person => (
                        <label key={person.idNumber} className="flex cursor-pointer items-center gap-3 border-b border-gray-800 px-3 py-2 text-sm last:border-b-0 hover:bg-gray-800/70">
                            <input
                                type="checkbox"
                                checked={selectedStaffIds.has(person.idNumber)}
                                onChange={() => onToggle(person.idNumber)}
                                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-sky-500"
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold text-white">{person.rank} {person.name}</span>
                                <span className="block text-xs text-gray-400">{person.role || 'No role'} · {person.flight || 'No flight'}</span>
                            </span>
                        </label>
                    ))}
                </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-700 px-4 py-3">
                <button type="button" onClick={onCancel} className="rounded border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-gray-700">Cancel</button>
                <button type="button" onClick={onSave} disabled={saving} className="rounded border border-sky-500 bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60">
                    {saving ? 'Saving...' : 'Save Assignments'}
                </button>
            </div>
        </div>
    </div>
);

const getMasterLmpDisplayType = (syllabusItem: SyllabusItemDetail): 'Flight' | 'FTD' | 'CPT' | 'Ground' | 'Academics' => {
    if (syllabusItem.type === 'Flight') return 'Flight';
    if (syllabusItem.type === 'FTD') return 'FTD';
    if (syllabusItem.type === 'Academics') return 'Academics';
    if (syllabusItem.type === 'Ground School') {
        if (syllabusItem.code.includes('CPT')) return 'CPT';
        return 'Ground';
    }
    return 'Flight';
};

const formatMasterLmpDisplayType = (displayType: ReturnType<typeof getMasterLmpDisplayType>, resourceDisplayNames: ResourceDisplayNames): string => {
    if (displayType === 'FTD') return resourceDisplayNames.ftd;
    if (displayType === 'CPT') return resourceDisplayNames.cpt;
    return displayType;
};

const formatMasterLmpSortieLabel = (item: SyllabusItemDetail, resourceDisplayNames: ResourceDisplayNames): string => {
    if (item.type === 'Flight') return item.sortieType || 'Dual';
    return formatMasterLmpDisplayType(getMasterLmpDisplayType(item), resourceDisplayNames);
};

const formatMasterLmpHours = (value: unknown): string => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? `${numericValue.toFixed(1)}h` : '0.0h';
};


const DetailView: React.FC<{ 
    item: SyllabusItemDetail; 
    isEditing: boolean;
    editedItem: SyllabusItemDetail | null;
    onItemChange: (newItem: SyllabusItemDetail) => void;
    onDeleteEvent?: (item: SyllabusItemDetail) => void;
    resourceDisplayNames?: ResourceDisplayNames;
    aircraftConfigurations?: AircraftConfigurationDefinition[];
    aircraftCrewComposition?: AircraftCrewComposition;
    crewPositionTerminology?: CrewPositionTerminology;
    instructorsData?: Instructor[];
    activeUnitCode?: string;
    isAirCombatModel?: boolean;
    operationalModel?: string;
    staffQualificationCatalogue?: StaffQualificationCatalogue;
    scoringMatrixElements?: string[];
    onAddScoringMatrixElement?: () => void;
    linkedEventOptions?: SyllabusItemDetail[];
    linkedEventOverrides?: Record<string, string>;
    onLinkedEventChange?: (item: SyllabusItemDetail, linkedEventCode: string) => void | Promise<void>;
}> = ({ item, isEditing, editedItem, onItemChange, onDeleteEvent, resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES, aircraftConfigurations = [], aircraftCrewComposition, crewPositionTerminology, instructorsData = [], activeUnitCode = '', isAirCombatModel = false, operationalModel = 'flight_school', staffQualificationCatalogue, scoringMatrixElements = DEFAULT_ASSESSED_ELEMENTS, onAddScoringMatrixElement, linkedEventOptions = [], linkedEventOverrides = {}, onLinkedEventChange }) => {
    
    const getDisplayType = (syllabusItem: SyllabusItemDetail): 'Flight' | 'FTD' | 'CPT' | 'Ground' | 'Academics' => {
        if (syllabusItem.type === 'Flight') return 'Flight';
        if (syllabusItem.type === 'FTD') return 'FTD';
        if (syllabusItem.type === 'Academics') return 'Academics';
        if (syllabusItem.type === 'Ground School') {
            if (syllabusItem.code.includes('CPT')) return 'CPT';
            return 'Ground';
        }
        return 'Flight'; // Fallback
    };

    const formatDisplayType = (displayType: ReturnType<typeof getDisplayType>) => {
        if (displayType === 'FTD') return resourceDisplayNames.ftd;
        if (displayType === 'CPT') return resourceDisplayNames.cpt;
        return displayType;
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (!editedItem) return;
        const newDisplayType = e.target.value;
        let newType: SyllabusItemDetail['type'] = 'Flight';
        
        if (newDisplayType === 'FTD') newType = 'FTD';
        if (newDisplayType === 'CPT' || newDisplayType === 'Ground') newType = 'Ground School';
        if (newDisplayType === 'Academics') newType = 'Academics';
        
        onItemChange({ ...editedItem, type: newType });
    };

    const handleFieldChange = (field: keyof SyllabusItemDetail, value: any) => {
        if (!editedItem) return;
        const updatedItem = { ...editedItem, [field]: value };
        if (field === 'flightOrSimHours' || field === 'totalEventHours') {
            updatedItem.duration = getAuthoritativeSyllabusDuration(updatedItem);
        }
        onItemChange(updatedItem);
    };

    const currentItem = isEditing ? editedItem : item;
    if (!currentItem) return null;
    const currentItemKey = currentItem.id || currentItem.code;
    const isFixedCrewModel = isFixedCrewLikeOperationalModel(operationalModel);
    const fixedCrewBriefingTimes = getFixedCrewCoursePackageBriefingTimes();
    const currentBriefingTimes = isFixedCrewModel
        ? fixedCrewBriefingTimes
        : { preFlightTime: currentItem.preFlightTime, postFlightTime: currentItem.postFlightTime };
    const itemBriefingTimes = isFixedCrewModel
        ? fixedCrewBriefingTimes
        : { preFlightTime: item.preFlightTime, postFlightTime: item.postFlightTime };
    const fixedCrewManifestReadiness = getFixedCrewManifestReadiness(currentItem, {
        operationalModel,
        aircraftCrewComposition,
        staffQualificationCatalogue,
    });
    const currentLinkedEventCode = Object.prototype.hasOwnProperty.call(linkedEventOverrides, currentItemKey)
        ? linkedEventOverrides[currentItemKey]
        : getAirCombatLinkedEventCode(currentItem);
    const currentLinkedEventOptions = linkedEventOptions.filter(option => (
        (option.id || option.code) !== (currentItem.id || currentItem.code) &&
        option.code !== currentItem.code
    ));
    const hasSavedLinkedEventOption = currentLinkedEventOptions.some(option => (option.code || option.id) === currentLinkedEventCode);
    const handleLinkedEventChange = (linkedEventCode: string) => {
        const updatedItem = withAirCombatLinkedEventNote(currentItem, linkedEventCode);
        if (isEditing) {
            onItemChange(updatedItem);
            return;
        }
        onLinkedEventChange?.(item, linkedEventCode);
    };

    return (
    <div className="space-y-6">
        <div>
            {isEditing ? (
                <EditableField label="Code" value={currentItem.code} onChange={(val) => handleFieldChange('code', val)} />
            ) : (
                <h2 className="text-3xl font-bold text-white">{item.code}</h2>
            )}
             {isEditing ? (
                <div className="mt-2">
                    <EditableField label="Event Description" value={currentItem.eventDescription} onChange={(val) => handleFieldChange('eventDescription', val)} />
                </div>
            ) : (
                <p className="text-lg text-gray-400 mt-1">{item.eventDescription}</p>
            )}
        </div>
        
        <fieldset className="p-3 border border-gray-700 rounded-lg">
            <legend className="px-2 text-xs font-semibold text-gray-300">Core Details</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
                {isEditing ? (
                    <>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                             <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Dual/Solo</label>
                             <select
                                value={currentItem.sortieType || 'Dual'}
                                onChange={(e) => handleFieldChange('sortieType', e.target.value as 'Dual' | 'Solo')}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            >
                                <option>Dual</option>
                                <option>Solo</option>
                            </select>
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                             <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Day/Night</label>
                             <select
                                value={currentItem.dayNight}
                                onChange={(e) => handleFieldChange('dayNight', e.target.value as 'Day' | 'Night' | 'Day/Night')}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            >
                                <option>Day</option>
                                <option>Night</option>
                                <option>Day/Night</option>
                            </select>
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                             <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Type</label>
                             <select
                                value={getDisplayType(currentItem)}
                                onChange={handleTypeChange}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            >
                                <option value="Flight">Flight</option>
                                <option value="FTD">{resourceDisplayNames.ftd}</option>
                                <option value="CPT">{resourceDisplayNames.cpt}</option>
                                <option value="Ground">Ground</option>
                                <option value="Academics">Academics</option>
                            </select>
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                               <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Cct Only</label>
                               <select
                                  value={currentItem.cctOnly || 'NO'}
                                  onChange={(e) => handleFieldChange('cctOnly', e.target.value as 'YES' | 'NO')}
                                  className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                              >
                                  <option>NO</option>
                                  <option>YES</option>
                              </select>
                           </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                               <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">TWR DI Reqd</label>
                               <select
                                  value={currentItem.twrDiReqd || 'NO'}
                                  onChange={(e) => handleFieldChange('twrDiReqd', e.target.value as 'YES' | 'NO')}
                                  className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                              >
                                  <option>NO</option>
                                  <option>YES</option>
                              </select>
                           </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Total Event Hrs</label>
                            <input
                                type="number"
                                step="0.1"
                                value={currentItem.totalEventHours}
                                onChange={(e) => handleFieldChange('totalEventHours', parseFloat(e.target.value) || 0)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Flight/Sim Hrs</label>
                            <input
                                type="number"
                                step="0.1"
                                value={currentItem.flightOrSimHours}
                                onChange={(e) => handleFieldChange('flightOrSimHours', parseFloat(e.target.value) || 0)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Resource Number</label>
                            <input
                                type="number"
                                step="1"
                                min="0"
                                value={currentItem.resourceNumber ?? (currentItem.resourcesPhysical?.length ? 1 : 0)}
                                onChange={(e) => handleFieldChange('resourceNumber', Math.max(0, Math.round(Number(e.target.value) || 0)))}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            />
                        </div>
                        <AircraftConfigSelector
                            value={currentItem.acceptableAircraftConfigs}
                            definitions={aircraftConfigurations}
                            onChange={(value) => handleFieldChange('acceptableAircraftConfigs', value)}
                        />
                        <div className="md:col-span-2 lg:col-span-3">
                            <CrewRequirementEditor
                                value={currentItem.crewRequirement}
                                aircraftCrewComposition={aircraftCrewComposition}
                                crewPositionTerminology={crewPositionTerminology}
                                operationalModel={operationalModel}
                                onChange={(value) => handleFieldChange('crewRequirement', value)}
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Pre-Flight (min)</label>
                            <input
                                type="number"
                                step="1"
                                value={Math.round(currentBriefingTimes.preFlightTime * 60)}
                                disabled={isFixedCrewModel}
                                title={isFixedCrewModel ? 'Fixed Crew course and package events use 90 minutes pre-flight.' : undefined}
                                onChange={(e) => handleFieldChange('preFlightTime', Number(e.target.value) / 60)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px] disabled:cursor-not-allowed disabled:opacity-70"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Post-Flight (min)</label>
                            <input
                                type="number"
                                step="1"
                                value={Math.round(currentBriefingTimes.postFlightTime * 60)}
                                disabled={isFixedCrewModel}
                                title={isFixedCrewModel ? 'Fixed Crew course and package events use 60 minutes post-flight.' : undefined}
                                onChange={(e) => handleFieldChange('postFlightTime', Number(e.target.value) / 60)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px] disabled:cursor-not-allowed disabled:opacity-70"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Code</label>
                            <input
                                type="text"
                                value={currentItem.code}
                                onChange={(e) => handleFieldChange('code', e.target.value)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Course</label>
                            <input
                                type="text"
                                value={(currentItem.courses || []).join(', ')}
                                onChange={(e) => handleFieldChange('courses', e.target.value.split(', ').filter(c => c.trim()))}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                                placeholder="Enter courses separated by commas"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Phase</label>
                            <input
                                type="text"
                                value={currentItem.phase}
                                onChange={(e) => handleFieldChange('phase', e.target.value)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            />
                        </div>
                        <div className="bg-gray-700/50 p-1 rounded-lg">
                            <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Module</label>
                            <input
                                type="text"
                                value={currentItem.module}
                                onChange={(e) => handleFieldChange('module', e.target.value)}
                                className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                            />
                        </div>
                        {isAirCombatModel && (
                            <div className="bg-gray-700/50 p-1 rounded-lg">
                                <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Linked Events</label>
                                <select
                                    value={currentLinkedEventCode || 'none'}
                                    onChange={(e) => handleLinkedEventChange(e.target.value)}
                                    className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px]"
                                >
                                    <option value="none">none</option>
                                    {currentLinkedEventCode && !hasSavedLinkedEventOption && (
                                        <option value={currentLinkedEventCode}>{currentLinkedEventCode}</option>
                                    )}
                                    {currentLinkedEventOptions.map(option => (
                                        <option key={option.id || option.code} value={option.code || option.id}>
                                            {option.code || option.id} - {option.eventDescription || option.module || 'Event'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <DetailCard label="Dual/Solo" value={item.sortieType || 'Dual'} />
                        <DetailCard label="Day/Night" value={item.dayNight} />
                        <DetailCard label="Type" value={formatDisplayType(getDisplayType(item))} />
                        <DetailCard label="Cct Only" value={item.cctOnly || 'NO'} />
                        <DetailCard label="TWR DI Reqd" value={item.twrDiReqd || 'NO'} />
                        <DetailCard label="Total Event Hrs" value={<>{item.totalEventHours.toFixed(1)} <span className="text-[10px] font-normal">hrs</span></>} />
                        <DetailCard label="Flight/Sim Hrs" value={<>{item.flightOrSimHours.toFixed(1)} <span className="text-[10px] font-normal">hrs</span></>} />
                        <DetailCard label="Resource Number" value={item.resourceNumber ?? (item.resourcesPhysical?.length ? 1 : 0)} />
                        <DetailCard
                            label={<span className="flex items-center">CONFIG<AircraftConfigInfoIcon definitions={aircraftConfigurations} /></span>}
                            value={formatAircraftConfigurationSummary(item.acceptableAircraftConfigs, aircraftConfigurations)}
                        />
                        <DetailCard
                            className="md:col-span-2 lg:col-span-3"
                            label="Crew Required"
                            value={formatCrewRequirementSummary(item.crewRequirement, aircraftCrewComposition, crewPositionTerminology)}
                        />
                        <DetailCard label="Pre-Flight" value={<>{Math.round(itemBriefingTimes.preFlightTime * 60)} <span className="text-[10px] font-normal">min</span></>} />
                        <DetailCard label="Post-Flight" value={<>{Math.round(itemBriefingTimes.postFlightTime * 60)} <span className="text-[10px] font-normal">min</span></>} />
                        <DetailCard label="Code" value={item.code} />
                        <DetailCard label="Course" value={(item.courses || []).join(", ") || "None"} />
                        <DetailCard label="Phase" value={item.phase} />
                        <DetailCard label="Module" value={item.module} />
                        {isAirCombatModel && (
                            <div className="bg-gray-700/50 p-1 rounded-lg">
                                <label className="block text-[9px] font-medium text-gray-400 uppercase tracking-wider">Linked Events</label>
                                <select
                                    value={currentLinkedEventCode || 'none'}
                                    onChange={(e) => handleLinkedEventChange(e.target.value)}
                                    disabled={!onLinkedEventChange}
                                    className="mt-0.5 block w-full bg-gray-800 border border-gray-600 rounded shadow-sm py-0.5 px-1 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-[10px] disabled:opacity-60"
                                >
                                    <option value="none">none</option>
                                    {currentLinkedEventCode && !hasSavedLinkedEventOption && (
                                        <option value={currentLinkedEventCode}>{currentLinkedEventCode}</option>
                                    )}
                                    {currentLinkedEventOptions.map(option => (
                                        <option key={option.id || option.code} value={option.code || option.id}>
                                            {option.code || option.id} - {option.eventDescription || option.module || 'Event'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </>
                )}
            </div>
        </fieldset>
        {isFixedCrewModel && (
            <fieldset className="p-3 border border-emerald-700/70 rounded-lg bg-emerald-950/10">
                <legend className="px-2 text-xs font-semibold text-emerald-300">Fixed Crew Requirements</legend>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
                    <DetailCard
                        label="Status"
                        value={formatFixedCrewManifestStatus(fixedCrewManifestReadiness.status)}
                    />
                    <DetailCard
                        label="Crew Event"
                        value={fixedCrewManifestReadiness.isCrewedEvent ? 'Flight/sim' : 'No'}
                    />
                    <DetailCard
                        label="PIC Required"
                        value={fixedCrewManifestReadiness.picRequired ? 'PIC' : 'No'}
                    />
                    <DetailCard
                        label="PIC Configured"
                        value={fixedCrewManifestReadiness.picQualificationConfigured ? 'Yes' : 'No'}
                    />
                    <DetailCard
                        label="Required Crew"
                        value={fixedCrewManifestReadiness.requiredCrewCount}
                    />
                    <DetailCard
                        className="md:col-span-2 lg:col-span-3"
                        label="Required Roles"
                        value={formatCrewRequirementSummary(currentItem.crewRequirement, aircraftCrewComposition, crewPositionTerminology)}
                    />
                </div>
            </fieldset>
        )}
           <fieldset className="p-4 border border-gray-700 rounded-lg">
               <legend className="px-2 text-sm font-semibold text-gray-300">Event Description</legend>
               <div className="mt-2">
                   {isEditing ? (
                       <EditableField label="Event Description" value={currentItem.eventDescription} onChange={(val) => handleFieldChange('eventDescription', val)} />
                   ) : (
                       <p className="text-gray-300 p-3 bg-gray-700/30 rounded-lg">{item.eventDescription || 'No description provided'}</p>
                   )}
               </div>
           </fieldset>
           
        
        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Prerequisites</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                {isEditing ? (
                    <>
                        <EditableList title="Ground School" items={currentItem.prerequisitesGround} onChange={(val) => handleFieldChange('prerequisitesGround', val)} />
                        <EditableList title="Sim/Flying" items={currentItem.prerequisitesFlying} onChange={(val) => handleFieldChange('prerequisitesFlying', val)} />
                    </>
                ) : (
                    <>
                        <DetailList title="Ground School" items={item.prerequisitesGround} />
                        <DetailList title="Sim/Flying" items={item.prerequisitesFlying} />
                    </>
                )}
            </div>
        </fieldset>

        <AssessedElementsWindow
            selectedElements={currentItem.assessedElements}
            availableElements={scoringMatrixElements}
            isEditing={isEditing}
            onChange={(elements) => handleFieldChange('assessedElements', elements)}
            onAddElement={onAddScoringMatrixElement}
            showAssessmentRequired={isAirCombatModel || isFixedCrewModel}
            assessmentRequired={currentItem.assessmentRequired === true}
            onAssessmentRequiredChange={(required) => handleFieldChange('assessmentRequired', required)}
        />

           <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Event Breakdown</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                 {isEditing ? (
                    <>
                        <EditableList title="Methods of Delivery" items={currentItem.methodOfDelivery} onChange={(val) => handleFieldChange('methodOfDelivery', val)} />
                        <EditableList title="Methods of Assessment" items={currentItem.methodOfAssessment} onChange={(val) => handleFieldChange('methodOfAssessment', val)} />
                        <EditableList title="Event Details (Common)" items={currentItem.eventDetailsCommon} onChange={(val) => handleFieldChange('eventDetailsCommon', val)} />
                        <EditableList title="Event Details (Sortie)" items={currentItem.eventDetailsSortie} onChange={(val) => handleFieldChange('eventDetailsSortie', val)} />
                    </>
                ) : (
                    <>
                        <DetailList title="Methods of Delivery" items={item.methodOfDelivery} />
                        <DetailList title="Methods of Assessment" items={item.methodOfAssessment} />
                        <DetailList title="Event Details (Common)" items={item.eventDetailsCommon} />
                        <DetailList title="Event Details (Sortie)" items={item.eventDetailsSortie} />
                    </>
                 )}
            </div>
        </fieldset>

         <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Resources</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                 {isEditing ? (
                    <>
                        <EditableList title="Physical Resources" items={currentItem.resourcesPhysical} onChange={(val) => handleFieldChange('resourcesPhysical', val)} />
                        <EditableList title="People Required" items={currentItem.resourcesHuman} onChange={(val) => handleFieldChange('resourcesHuman', val)} />
                    </>
                 ) : (
                    <>
                        <DetailList title="Physical Resources" items={item.resourcesPhysical} />
                        <DetailList title="People Required" items={item.resourcesHuman} />
                    </>
                 )}
            </div>
        </fieldset>

        {isEditing && onDeleteEvent && (
            <div className="pt-4 border-t border-gray-700 mt-2 flex justify-end">
                <button
                    onClick={() => onDeleteEvent(item)}
                    style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none' }}
                    className="px-4 py-2 text-[11px] font-semibold rounded-md hover:opacity-90 transition-opacity"
                >
                    🗑 Delete This Event
                </button>
            </div>
        )}
    </div>
    );
};

type LmpDetailsTab = 'master' | 'packages';

const STATIC_TRAINING_PACKAGES: string[] = [];

const getItemLmpDetailsTab = (item: SyllabusItemDetail): LmpDetailsTab =>
    item.lmpType === 'Staff CAT' ? 'packages' : 'master';

const getActiveLmpType = (tab: LmpDetailsTab): NonNullable<SyllabusItemDetail['lmpType']> =>
    tab === 'packages' ? 'Staff CAT' : 'Master LMP';

const getDefaultLmpSelection = (tab: LmpDetailsTab): string =>
    tab === 'packages' ? (STATIC_TRAINING_PACKAGES[0] || '') : '';

const getPackageCodeFromTitle = (title: string): string => {
    const words = title.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    return words.length === 1
        ? words[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
        : words.map(word => word[0].toUpperCase()).join('').replace(/[^A-Z0-9]/g, '').slice(0, 8);
};

const getUnitScopedCollectionCode = (baseCode: string, unitCode: string, shouldScope: boolean): string => {
    const cleanBase = String(baseCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const cleanUnit = String(unitCode || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!cleanBase) return '';
    if (!shouldScope || !cleanUnit || cleanBase === cleanUnit || cleanBase.startsWith(`${cleanUnit}-`)) return cleanBase;
    return `${cleanUnit}-${cleanBase}`.slice(0, 24);
};

const SyllabusView: React.FC<SyllabusViewProps> = ({
    syllabusDetails,
    onBack,
    initialSelectedId,
    onUpdateItem,
    onAddItem,
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
    aircraftConfigurations = [],
    aircraftCrewComposition,
    crewPositionTerminology,
    activeLocationCode = '',
    activeUnitCode = '',
    trainingPackageTemplates = [],
    instructorsData = [],
    onUpdateInstructor,
    operationalModel = 'flight_school',
    sharedUnitTabs = [],
    masterLmpCatalogue = [],
    staffQualificationCatalogue,
    currentUserName,
    scoringMatrixPhraseBank,
    onAddScoringMatrixElement,
    onNavigateToSettingsSection,
}) => {
    const { isFrozen } = useSystemFreeze();
  const [selectedItem, setSelectedItem] = useState<SyllabusItemDetail | null>(null);
  const [hoveredItem, setHoveredItem] = useState<SyllabusItemDetail | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState<SyllabusItemDetail | null>(null);
  const [linkedEventOverrides, setLinkedEventOverrides] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<LmpDetailsTab>(() => {
      const savedTab = localStorage.getItem('neo_lmp_details_active_tab');
      return savedTab === 'packages' || savedTab === 'master' ? savedTab : 'master';
  });
  const [selectedCourseType, setSelectedCourseType] = useState<string>(() =>
      localStorage.getItem('neo_lmp_details_selected_package') || ''
  );
  const [editingCourseTitle, setEditingCourseTitle] = useState<string>('');
  const isTrainingPackagesTab = activeTab === 'packages';
  const activeLmpType = getActiveLmpType(activeTab);
  const activeCollectionNoun = isTrainingPackagesTab ? 'package' : 'course';
  const activeCollectionTitle = isTrainingPackagesTab ? 'Training Packages' : 'Master LMP';
  const activeCollectionSelectLabel = isTrainingPackagesTab ? 'Package:' : 'Course:';
  const activeOperationalModel = normaliseOperationalModel(operationalModel);
  const isAirCombatModel = activeOperationalModel === 'air_combat';
  const isFixedCrewModel = isFixedCrewLikeOperationalModel(activeOperationalModel);
  const usesPackageTab = activeOperationalModel === 'air_combat' || isFixedCrewModel;
  const normaliseUnitTabCode = (value?: string | null): string => String(value || '').trim().toUpperCase();
  const fixedCrewUnitTabs = useMemo(() => (
      Array.from(new Set(sharedUnitTabs.map(normaliseUnitTabCode).filter(Boolean)))
  ), [sharedUnitTabs]);
  const [activeUnitTab, setActiveUnitTab] = useState<string>(() => fixedCrewUnitTabs[0] || normaliseUnitTabCode(activeUnitCode));
  useEffect(() => {
      if (!isFixedCrewModel || fixedCrewUnitTabs.length === 0) return;
      if (!fixedCrewUnitTabs.includes(activeUnitTab)) {
          setActiveUnitTab(fixedCrewUnitTabs[0]);
      }
  }, [activeUnitTab, fixedCrewUnitTabs, isFixedCrewModel]);
  const shouldShowUnitTabs = isFixedCrewModel && fixedCrewUnitTabs.length > 1;
  const effectiveActiveUnitCode = shouldShowUnitTabs ? activeUnitTab : activeUnitCode;
  const shouldScopeCreatedItemsToActiveUnit = isTrainingPackagesTab || activeOperationalModel !== 'flight_school';
  const packageFoundationLabel = isFixedCrewModel ? 'Fixed Crew' : isAirCombatModel ? 'Air Combat' : 'Staff';
  const packageFoundationDescription = isFixedCrewModel
      ? 'Fixed Crew staff progression packages are scoped to the selected unit. They start as package shells until events are uploaded or added.'
      : 'Air Combat staff training packages are scoped to the selected unit. They start as package shells until events are uploaded or added.';
  const availableTabs = useMemo(() => {
      const tabs: Array<{ id: LmpDetailsTab; label: string }> = [
          { id: 'master', label: 'Master LMP' },
      ];
      if (usesPackageTab) {
          tabs.push({ id: 'packages', label: 'Training Packages' });
      }
      return tabs;
  }, [usesPackageTab]);
      const scoringMatrixElements = useMemo(
          () => getScoringMatrixElementOptions(scoringMatrixPhraseBank),
          [scoringMatrixPhraseBank]
      );
  const unitScopedSyllabusDetails = useMemo(() => {
      if (!isFixedCrewModel || !effectiveActiveUnitCode) return syllabusDetails;
      const activeUnit = normaliseUnitTabCode(effectiveActiveUnitCode);
      return syllabusDetails.filter(item => {
          const itemUnit = normaliseUnitTabCode((item as any).unit);
          return !itemUnit || itemUnit === activeUnit;
      });
  }, [effectiveActiveUnitCode, isFixedCrewModel, syllabusDetails]);
	  const [showAssignTrainingModal, setShowAssignTrainingModal] = useState(false);
  const [assignTrainingSelection, setAssignTrainingSelection] = useState<Set<number>>(new Set());
  const [isSavingTrainingAssignments, setIsSavingTrainingAssignments] = useState(false);

  // Dynamic course list: only courses found in the currently visible syllabusDetails.
  // App-level unit access filtering happens before this view is rendered.
  const activeMasterLmpCatalogue = useMemo(() => (
    masterLmpCatalogue
      .filter(entry => String(entry.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
      .filter(entry => String(entry.code || '').trim())
  ), [masterLmpCatalogue]);

  const masterLmpTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    activeMasterLmpCatalogue.forEach(entry => {
      const code = String(entry.code || '').trim();
      if (!code) return;
      map[code] = String(entry.name || code).trim() || code;
    });
    return map;
  }, [activeMasterLmpCatalogue]);

  const courseLMPs = useMemo(() => {
    const fromSyllabus = new Set<string>();
    unitScopedSyllabusDetails.filter(item => item.isActive !== false).forEach(item => {
      if (getItemLmpDetailsTab(item) !== activeTab) return;
      (item.courses || []).forEach(c => { if (c) fromSyllabus.add(c); });
    });
    if (activeTab !== 'master') {
      return Array.from(fromSyllabus).sort();
    }
    const ordered = new Map<string, string>();
    activeMasterLmpCatalogue.forEach(entry => {
      const code = String(entry.code || '').trim();
      if (code) ordered.set(code.toUpperCase(), code);
    });
    Array.from(fromSyllabus).sort().forEach(code => {
      const cleanCode = String(code || '').trim();
      if (cleanCode && !ordered.has(cleanCode.toUpperCase())) {
        ordered.set(cleanCode.toUpperCase(), cleanCode);
      }
    });
    return Array.from(ordered.values());
  }, [activeMasterLmpCatalogue, activeTab, unitScopedSyllabusDetails]);

  // Map from course code → full display title (uses module field of first item in that course)
  const courseTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    unitScopedSyllabusDetails.filter(item => item.isActive !== false).forEach(item => {
      if (getItemLmpDetailsTab(item) !== activeTab) return;
      (item.courses || []).forEach(c => {
        if (c && !map[c] && item.module && item.module !== c) {
          map[c] = item.module;
        }
      });
    });
    return map;
  }, [activeTab, unitScopedSyllabusDetails]);

  // Helper: get display title for a course code
  const getCourseTitle = (code: string) => (
    activeTab === 'master'
      ? masterLmpTitleMap[code] || courseTitleMap[code] || code
      : courseTitleMap[code] || code
  );
  const normaliseContextCode = (value?: string | null): string => String(value || '').trim().toUpperCase();
  const activeUnitNormalised = normaliseContextCode(effectiveActiveUnitCode);
  const activeLocationNormalised = normaliseContextCode(activeLocationCode);
  const pushSetupTestLmpViewDiag = (stage: string, details: Record<string, any> = {}) => {
      if (typeof window === 'undefined') return;
      const isSetupTest = new URLSearchParams(window.location.search).has('setupTest');
      if (!isSetupTest) return;
      const entry = {
          ts: new Date().toISOString(),
          stage,
          activeLocationCode,
          activeUnitCode,
          effectiveActiveUnitCode,
          activeTab,
          selectedCourseType,
          details,
      };
      try {
          console.log(`[SETUP-TEST-LMP:VIEW] ${stage}`, entry);
          const existing = JSON.parse(window.localStorage.getItem('dfp_setup_test_lmp_diag') || '[]');
          const next = [...(Array.isArray(existing) ? existing : []), entry].slice(-500);
          window.localStorage.setItem('dfp_setup_test_lmp_diag', JSON.stringify(next));
          (window as any).neoSetupTestLmpDiag = next;
      } catch (error) {
          console.log(`[SETUP-TEST-LMP:VIEW] ${stage}`, entry, error);
      }
  };
  const getPackageSourceKey = (item: SyllabusItemDetail): string => {
      const packageCode = (item.courses || [])[0] || item.code;
      const location = normaliseContextCode(item.location) || 'GLOBAL';
      const unit = normaliseContextCode(item.unit) || 'GLOBAL';
      return `${location}|${unit}|${packageCode}`;
  };
  const packageCopyOptions = useMemo(() => {
      const grouped = new Map<string, {
          key: string;
          code: string;
          title: string;
          location: string;
          unit: string;
          items: SyllabusItemDetail[];
      }>();
      trainingPackageTemplates
          .filter(item => item.isActive !== false && item.lmpType === 'Staff CAT')
          .forEach(item => {
              const packageCode = (item.courses || [])[0] || item.code;
              if (!packageCode) return;
              const key = getPackageSourceKey(item);
              if (!grouped.has(key)) {
                  grouped.set(key, {
                      key,
                      code: packageCode,
                      title: item.module && item.module !== packageCode ? item.module : packageCode,
                      location: normaliseContextCode(item.location) || 'Global',
                      unit: normaliseContextCode(item.unit) || 'Global',
                      items: [],
                  });
              }
              grouped.get(key)!.items.push(item);
          });
      return Array.from(grouped.values())
          .filter(option => option.unit !== activeUnitNormalised || !activeUnitNormalised)
          .sort((a, b) => `${a.title} ${a.unit}`.localeCompare(`${b.title} ${b.unit}`));
  }, [activeUnitNormalised, trainingPackageTemplates]);

  // Add Course modal state
  const [showAddLMPModal, setShowAddLMPModal] = useState(false);
  const [newLMPName, setNewLMPName] = useState('');       // full course title e.g. "Basic Flying Course"
  const [newLMPCourseType, setNewLMPCourseType] = useState<'Flight Training' | 'Academic Training'>('Flight Training');
  const [addPackageMode, setAddPackageMode] = useState<'blank' | 'copy'>('blank');
  const [copyPackageSourceKey, setCopyPackageSourceKey] = useState('');
  const [isCopyingPackage, setIsCopyingPackage] = useState(false);

  // Delete Course modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Bulk Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadDragActive, setIsUploadDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'update' | 'replace' | 'create'>('update');
  const [newUploadPackageName, setNewUploadPackageName] = useState('');
  const [uploadResult, setUploadResult] = useState<{ created: number; updated?: number; imported?: number; skipped: number; errors: any[]; message: string } | null>(null);
  const [isCrossLoadingDuplicateCourse, setIsCrossLoadingDuplicateCourse] = useState(false);

  const duplicateUploadSource = useMemo(() => {
      const sources = (uploadResult?.errors || [])
          .map((error: any) => error?.duplicateSource)
          .filter((source: any) => source?.sourceCourse && source?.sourceLmpType);
      if (sources.length === 0) return null;
      const byKey = new Map<string, any>();
      sources.forEach((source: any) => {
          const key = [
              normaliseContextCode(source.sourceLocation),
              normaliseContextCode(source.sourceUnit),
              source.sourceCourse,
              source.sourceLmpType,
          ].join('|');
          if (!byKey.has(key)) byKey.set(key, source);
      });
      if (byKey.size !== 1) return null;
      const source = Array.from(byKey.values())[0];
      if (source.sourceLmpType !== activeLmpType) return null;
      return source;
  }, [activeLmpType, uploadResult?.errors]);

  const canCrossLoadDuplicateCourse = Boolean(
      duplicateUploadSource
      && selectedCourseType
      && activeUnitNormalised
      && normaliseContextCode(duplicateUploadSource.sourceUnit) !== activeUnitNormalised
  );

  // Delete Event modal state
  const [showDeleteEventModal, setShowDeleteEventModal] = useState(false);
  const [deleteEventItem, setDeleteEventItem] = useState<SyllabusItemDetail | null>(null);
  const [deleteEventPassword, setDeleteEventPassword] = useState('');
  const [deleteEventError, setDeleteEventError] = useState('');
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [eventDropIndicator, setEventDropIndicator] = useState<{ targetId: string; position: 'before' | 'after' } | null>(null);
  const [isReorderingEvents, setIsReorderingEvents] = useState(false);

  // Filter items based on selected course type (exclude inactive/deleted items)
  const filteredSyllabusDetails = useMemo(() => {
      return unitScopedSyllabusDetails.filter(item => {
          if (item.isActive === false) return false;
          if (isSyllabusCourseShell(item)) return false;
          if (getItemLmpDetailsTab(item) !== activeTab) return false;
          if (!item.courses || item.courses.length === 0) {
              return false;
          }
          return item.courses.includes(selectedCourseType);
      }).sort((left, right) => {
          const leftOrder = Number.isFinite(Number(left.sortOrder)) ? Number(left.sortOrder) : Number.MAX_SAFE_INTEGER;
          const rightOrder = Number.isFinite(Number(right.sortOrder)) ? Number(right.sortOrder) : Number.MAX_SAFE_INTEGER;
          return leftOrder - rightOrder
              || String(left.code || '').localeCompare(String(right.code || ''), undefined, { numeric: true, sensitivity: 'base' })
              || String(left.id || '').localeCompare(String(right.id || ''));
      });
  }, [activeTab, unitScopedSyllabusDetails, selectedCourseType]);

  const selectedCourseEventCount = filteredSyllabusDetails.length;
  useEffect(() => {
      const rawCourseCodes = Array.from(new Set(syllabusDetails.flatMap((item: any) => (
          Array.isArray(item?.courses) ? item.courses : []
      )).map((code: any) => String(code || '').trim()).filter(Boolean)));
      const unitScopedCourseCodes = Array.from(new Set(unitScopedSyllabusDetails.flatMap((item: any) => (
          Array.isArray(item?.courses) ? item.courses : []
      )).map((code: any) => String(code || '').trim()).filter(Boolean)));
      const summariseItemForLmpView = (item: any) => {
          const courses = Array.isArray(item?.courses) ? item.courses.map((course: any) => String(course || '').trim()).filter(Boolean) : [];
          const tab = getItemLmpDetailsTab(item);
          const matchesSelectedCourse = courses.some((course: string) => normaliseContextCode(course) === normaliseContextCode(selectedCourseType));
          const matchesEffectiveUnit = !isFixedCrewModel || !normaliseContextCode(item?.unit) || normaliseContextCode(item?.unit) === normaliseContextCode(effectiveActiveUnitCode);
          return {
              id: item?.id,
              code: item?.code,
              title: item?.eventDescription,
              courses,
              unit: item?.unit,
              unitKey: normaliseContextCode(item?.unit),
              location: item?.location,
              locationKey: normaliseContextCode(item?.location),
              lmpType: item?.lmpType,
              type: item?.type,
              isActive: item?.isActive,
              isShell: isSyllabusCourseShell(item),
              tab,
              matchesActiveTab: tab === activeTab,
              matchesSelectedCourse,
              matchesEffectiveUnit,
              includedInFiltered: filteredSyllabusDetails.some((filtered: any) => String(filtered?.id || filtered?.code || '') === String(item?.id || item?.code || '')),
          };
      };
      const tabBreakdown = syllabusDetails.slice(0, 180).map(summariseItemForLmpView);
      const selectedCourseRawMatches = syllabusDetails
          .filter((item: any) => Array.isArray(item?.courses) && item.courses.some((course: any) => normaliseContextCode(course) === normaliseContextCode(selectedCourseType)))
          .map(summariseItemForLmpView);
      const selectedCourseUnitScopedMatches = unitScopedSyllabusDetails
          .filter((item: any) => Array.isArray(item?.courses) && item.courses.some((course: any) => normaliseContextCode(course) === normaliseContextCode(selectedCourseType)))
          .map(summariseItemForLmpView);
      pushSetupTestLmpViewDiag('view:lmp-details-snapshot', {
          rawSyllabusItems: syllabusDetails.length,
          unitScopedItems: unitScopedSyllabusDetails.length,
          filteredSyllabusDetails: filteredSyllabusDetails.length,
          activeLmpType,
          activeOperationalModel,
          isFixedCrewModel,
          rawCourseCodes,
          unitScopedCourseCodes,
          courseLMPs,
          selectedCourseRawMatchCount: selectedCourseRawMatches.length,
          selectedCourseUnitScopedMatchCount: selectedCourseUnitScopedMatches.length,
          selectedCourseFilteredMatchCount: filteredSyllabusDetails.length,
          selectedCourseRawMatches: selectedCourseRawMatches.slice(0, 40),
          selectedCourseUnitScopedMatches: selectedCourseUnitScopedMatches.slice(0, 40),
          incomingCatalogueProp: masterLmpCatalogue.map((entry: any) => ({
              code: entry.code,
              name: entry.name,
              status: entry.status,
          })),
          catalogue: activeMasterLmpCatalogue.map((entry: any) => ({
              code: entry.code,
              name: entry.name,
              status: entry.status,
          })),
          courseTitleMap,
          selectedCourseStorage: (() => {
              try { return window.localStorage.getItem('neo_lmp_details_selected_package'); } catch { return null; }
          })(),
          selectedCourseType,
          selectedCourseKey: normaliseContextCode(selectedCourseType),
          selectedCourseInCourseLMPs: courseLMPs.includes(selectedCourseType),
          selectedCourseInCourseLMPsByKey: courseLMPs.some((course) => normaliseContextCode(course) === normaliseContextCode(selectedCourseType)),
          tabBreakdown,
          filteredSample: filteredSyllabusDetails.slice(0, 20).map((item: any) => ({
              id: item?.id,
              code: item?.code,
              title: item?.eventDescription,
              courses: item?.courses,
              unit: item?.unit,
              location: item?.location,
              lmpType: item?.lmpType,
              isActive: item?.isActive,
          })),
          rawSample: syllabusDetails.slice(0, 20).map((item: any) => ({
              id: item?.id,
              code: item?.code,
              title: item?.eventDescription,
              courses: item?.courses,
              unit: item?.unit,
              location: item?.location,
              lmpType: item?.lmpType,
              isActive: item?.isActive,
          })),
      });
  }, [
      activeMasterLmpCatalogue,
      activeLmpType,
      activeOperationalModel,
      activeTab,
      activeUnitCode,
      courseLMPs,
      courseTitleMap,
      effectiveActiveUnitCode,
      filteredSyllabusDetails,
      isFixedCrewModel,
      masterLmpCatalogue,
      selectedCourseType,
      syllabusDetails,
      unitScopedSyllabusDetails,
  ]);
  const selectedMasterLmpCatalogueEntry = activeTab === 'master'
    ? activeMasterLmpCatalogue.find(entry => String(entry.code || '').trim().toUpperCase() === String(selectedCourseType || '').trim().toUpperCase()) || null
    : null;

  const activeTrainingAssignmentItem = useMemo(() => (
      filteredSyllabusDetails[0] || selectedItem || null
  ), [filteredSyllabusDetails, selectedItem]);

  const activeTrainingAssignment = useMemo(() => {
      if (!isAirCombatModel || !activeTrainingAssignmentItem || !selectedCourseType) return null;
      return getAirCombatAssignmentFromItem(
          { ...activeTrainingAssignmentItem, courses: [selectedCourseType] },
          activeLocationCode,
          effectiveActiveUnitCode,
          currentUserName,
      );
  }, [activeTrainingAssignmentItem, activeLocationCode, effectiveActiveUnitCode, currentUserName, isAirCombatModel, selectedCourseType]);

  const assignableAirCombatStaff = useMemo(() => {
      if (!isAirCombatModel) return [];
      const targetUnit = String(effectiveActiveUnitCode || '').trim().toUpperCase();
      return instructorsData
          .filter(staff => staff && staff.name && !staff.isAdminStaff)
          .filter(staff => !targetUnit || String(staff.unit || '').trim().toUpperCase() === targetUnit)
          .sort((a, b) => a.name.localeCompare(b.name));
  }, [effectiveActiveUnitCode, instructorsData, isAirCombatModel]);

  const openAssignTraining = () => {
      if (!activeTrainingAssignment) return;
      setAssignTrainingSelection(new Set(
          assignableAirCombatStaff
              .filter(staff => staffHasAirCombatAssignment(staff, activeTrainingAssignment))
              .map(staff => staff.idNumber)
      ));
      setShowAssignTrainingModal(true);
  };

  const saveAssignTraining = async () => {
      if (!activeTrainingAssignment || !onUpdateInstructor) return;
      setIsSavingTrainingAssignments(true);
      try {
          for (const staff of assignableAirCombatStaff) {
              const shouldAssign = assignTrainingSelection.has(staff.idNumber);
              const currentlyAssigned = staffHasAirCombatAssignment(staff, activeTrainingAssignment);
              if (shouldAssign === currentlyAssigned) continue;
              await onUpdateInstructor(setAirCombatTrainingAssignment(staff, activeTrainingAssignment, shouldAssign));
          }
          logAudit({
              action: 'Update',
              description: `Updated Air Combat training assignment for ${activeTrainingAssignment.code}`,
              changes: `${assignTrainingSelection.size} staff selected`,
              page: 'LMP/Event Details',
          });
          setShowAssignTrainingModal(false);
      } finally {
          setIsSavingTrainingAssignments(false);
      }
  };

  const handleLinkedEventChange = async (item: SyllabusItemDetail, linkedEventCode: string) => {
      const itemKey = item.id || item.code;
      const updatedItem = withAirCombatLinkedEventNote(item, linkedEventCode);
      const previousSelectedItem = selectedItem;
      const previousHoveredItem = hoveredItem;
      const previousEditedItem = editedItem;
      const previousOverride = Object.prototype.hasOwnProperty.call(linkedEventOverrides, itemKey)
          ? linkedEventOverrides[itemKey]
          : undefined;
      setLinkedEventOverrides(prev => ({ ...prev, [itemKey]: linkedEventCode === 'none' ? '' : linkedEventCode }));
      setSelectedItem(prev => prev && prev.id === item.id ? updatedItem : prev);
      setHoveredItem(prev => prev && prev.id === item.id ? updatedItem : prev);
      if (editedItem && editedItem.id === item.id) {
          setEditedItem(updatedItem);
      }
      try {
          const savedItem = await updateSyllabusItem(item.id, updatedItem, `Updated linked event for ${item.code}`);
          onUpdateItem(savedItem);
          setSelectedItem(prev => prev && prev.id === item.id ? savedItem : prev);
          setHoveredItem(prev => prev && prev.id === item.id ? savedItem : prev);
          setLinkedEventOverrides(prev => ({ ...prev, [itemKey]: getAirCombatLinkedEventCode(savedItem) }));
          if (editedItem && editedItem.id === item.id) {
              setEditedItem(savedItem);
          }
          logAudit({
              action: 'Edit',
              description: `Updated linked event for ${savedItem.code}`,
              changes: `Linked Event: ${linkedEventCode === 'none' ? 'none' : linkedEventCode}`,
              page: 'LMP/Event Details',
          });
      } catch (error) {
          console.error('[LMP/Event Details] Failed to update linked event:', error);
          setSelectedItem(previousSelectedItem);
          setHoveredItem(previousHoveredItem);
          setEditedItem(previousEditedItem);
          setLinkedEventOverrides(prev => {
              const next = { ...prev };
              if (previousOverride === undefined) {
                  delete next[itemKey];
              } else {
                  next[itemKey] = previousOverride;
              }
              return next;
          });
          alert(`Linked event was not saved: ${error instanceof Error ? error.message : String(error)}`);
      }
  };

    // Log view on component mount
    useEffect(() => {
        logAudit({
            action: 'View',
            description: 'Viewed LMP/Event Details page',
            changes: `Viewing ${activeCollectionTitle}: ${selectedCourseType}`,
            page: 'LMP/Event Details'
        });
    }, []);

  useEffect(() => {
    if (!usesPackageTab && activeTab === 'packages') {
        setActiveTab('master');
        setSelectedCourseType('');
        setSelectedItem(null);
        setHoveredItem(null);
        setIsEditing(false);
        setEditedItem(null);
        return;
    }
    if (courseLMPs.length === 0) {
        if (selectedCourseType) {
            setSelectedCourseType('');
            setSelectedItem(null);
            setHoveredItem(null);
            setIsEditing(false);
            setEditedItem(null);
        }
        return;
    }
    if (!courseLMPs.includes(selectedCourseType)) {
        setSelectedCourseType(courseLMPs[0]);
        setSelectedItem(null);
        setHoveredItem(null);
        setIsEditing(false);
        setEditedItem(null);
    }
  }, [activeTab, courseLMPs, selectedCourseType, usesPackageTab]);

  useEffect(() => {
      localStorage.setItem('neo_lmp_details_active_tab', activeTab);
      localStorage.setItem('neo_lmp_details_selected_package', selectedCourseType);
  }, [activeTab, selectedCourseType]);

  // Select first item by default when syllabusDetails or selectedCourseType changes
  useEffect(() => {
    if (initialSelectedId) {
      const itemToSelect = unitScopedSyllabusDetails.find(item => item.code === initialSelectedId);
      if (itemToSelect) {
          const itemTab = getItemLmpDetailsTab(itemToSelect);
          if (itemTab !== activeTab) {
              setActiveTab(itemTab);
          }
          setSelectedItem(itemToSelect);
          // If navigating directly, ensure we are on a course type that contains this item
          if (itemToSelect.courses && itemToSelect.courses.length > 0) {
              if (!itemToSelect.courses.includes(selectedCourseType)) {
                  setSelectedCourseType(itemToSelect.courses[0]);
              }
          }
      }
    } else {
        // Default: select the first item in the filtered list
        if (filteredSyllabusDetails.length > 0 && !selectedItem) {
            setSelectedItem(filteredSyllabusDetails[0]);
        } else if (selectedItem) {
             const updated = syllabusDetails.find(item => item.code === selectedItem.code);
             if (updated && unitScopedSyllabusDetails.some(item => item.id === updated.id) && getItemLmpDetailsTab(updated) === activeTab) setSelectedItem(updated);
        }
    }
  }, [activeTab, initialSelectedId, selectedItem, selectedCourseType, filteredSyllabusDetails, unitScopedSyllabusDetails, syllabusDetails]);

  // Reset selection when course type changes (select first item of new course)
  useEffect(() => {
    if (filteredSyllabusDetails.length > 0) {
        setSelectedItem(filteredSyllabusDetails[0]);
        setIsEditing(false);
    } else {
        setSelectedItem(null);
    }
    setHoveredItem(null);
  }, [activeTab, selectedCourseType]);

  const handleEdit = () => {
      setEditingCourseTitle(getCourseTitle(selectedCourseType));
      if (selectedItem) {
          setEditedItem(JSON.parse(JSON.stringify(selectedItem)));
      }
      setIsEditing(true);
  };

  const handleSave = async () => {
      setIsSaving(true);
      try {
          // Save the selected event item if one is being edited
          if (editedItem) {
              const itemToSaveBase = {
                  ...editedItem,
                  acceptableAircraftConfigs: normaliseSelectedAircraftConfigurations(editedItem.acceptableAircraftConfigs, aircraftConfigurations),
                  notes: stripFixedCrewManifestNote(editedItem.notes),
              };
              const itemToSave = isFixedCrewModel
                  ? withFixedCrewCoursePackageBriefingTimes(itemToSaveBase)
                  : itemToSaveBase;
              const isNew = itemToSave.id.startsWith('new-');
              let savedItem: SyllabusItemDetail;
              if (isNew) {
                  const { id: _tmpId, ...itemWithoutTmpId } = itemToSave;
                  savedItem = await createSyllabusItem(itemWithoutTmpId, `New LMP event created via ${activeCollectionTitle} editor`);
              } else {
                  savedItem = await updateSyllabusItem(itemToSave.id, itemToSave, `Updated via ${activeCollectionTitle} editor`);
              }
              // Detect changes for audit
              const changes: string[] = [];
              if (selectedItem && selectedItem.preFlightTime !== itemToSave.preFlightTime) {
                  changes.push(`Pre-flight time: ${Math.round(selectedItem.preFlightTime * 60)} min to ${Math.round(itemToSave.preFlightTime * 60)} min`);
              }
              if (selectedItem && selectedItem.postFlightTime !== itemToSave.postFlightTime) {
                  changes.push(`Post-flight time: ${Math.round(selectedItem.postFlightTime * 60)} min to ${Math.round(itemToSave.postFlightTime * 60)} min`);
              }
              if (changes.length > 0) {
                  logAudit({ action: 'Edit', description: `Updated LMP item ${savedItem.code}`, changes: changes.join(', '), page: 'LMP/Event Details' });
              }
              onUpdateItem(savedItem);
              setSelectedItem(savedItem);
          }

          // If the course title was changed, update the module field on ALL items in this course
          const currentTitle = getCourseTitle(selectedCourseType);
          const newTitle = editingCourseTitle.trim();
          if (newTitle && newTitle !== currentTitle) {
              const courseItems = unitScopedSyllabusDetails.filter(item =>
                  item.isActive !== false &&
                  getItemLmpDetailsTab(item) === activeTab &&
                  (item.courses || []).includes(selectedCourseType)
              );
              await Promise.all(courseItems.map(item =>
                  updateSyllabusItem(item.id, { ...item, module: newTitle }, 'Course title renamed')
              ));
              // Update local state for all items
              courseItems.forEach(item => onUpdateItem({ ...item, module: newTitle }));
              logAudit({ action: 'Edit', description: `Renamed ${activeCollectionNoun}: ${selectedCourseType}`, changes: `Title: "${currentTitle}" renamed to "${newTitle}"`, page: 'LMP/Event Details' });
          }

          setIsEditing(false);
          setEditedItem(null);
          setEditingCourseTitle('');
      } catch (err: any) {
          alert(`Save failed: ${err.message}`);
      } finally {
          setIsSaving(false);
      }
  };

  const handleCancel = () => {
      setIsEditing(false);
      setEditedItem(null);
      setEditingCourseTitle('');
  };

  const handleManageMasterLmps = () => {
      onNavigateToSettingsSection?.({
          sectionId: 'platform-master-lmp-access',
          focusSubsectionId: 'platform-master-lmp-catalogue',
      });
  };

  const handleDeleteCourse = async () => {
      if (!deletePassword) { setDeleteError('Please enter your password.'); return; }
      setIsDeleting(true);
      setDeleteError('');
      try {
          // Verify password first - get session token from localStorage
          const sessionToken = localStorage.getItem('dfp_session_token') || '';
          const verifyResp = await fetch('/api/auth/verify-password', {
              method: 'POST',
              credentials: 'include',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionToken}`,
              },
              body: JSON.stringify({ password: deletePassword }),
          });
          const verifyData = await verifyResp.json();
          if (!verifyData.valid) {
              setDeleteError('Incorrect password. Please try again.');
              setIsDeleting(false);
              return;
          }
          // Permanently delete all items for this course/package.
          // Include any item that belongs to this course (even if it also belongs to others)
          const itemsToDelete = unitScopedSyllabusDetails.filter(item =>
              getItemLmpDetailsTab(item) === activeTab &&
              (item.courses || []).includes(selectedCourseType)
          );
          console.log(`🗑️ Deleting ${itemsToDelete.length} items for ${activeCollectionNoun}: ${selectedCourseType}`, itemsToDelete.map(i => i.id));
          
          if (itemsToDelete.length === 0) {
              console.warn(`⚠️ No items found for ${activeCollectionNoun} ${selectedCourseType} in syllabusDetails (${syllabusDetails.length} total items)`);
          } else {
              await Promise.all(itemsToDelete.map(item =>
                  deleteSyllabusItem(item.id, `${activeCollectionTitle} deleted: ${selectedCourseType}`)
              ));
          }
          logAudit({ action: 'Delete', description: `Deleted ${activeCollectionNoun}: ${selectedCourseType}`, changes: `${itemsToDelete.length} database item(s) permanently deleted`, page: 'LMP/Event Details' });
          // Remove from local state by marking isActive: false
          itemsToDelete.forEach(item => onUpdateItem({ ...item, isActive: false } as any));
          setShowDeleteModal(false);
          setDeletePassword('');
          setSelectedItem(null);
          // Switch to first available course (excluding the deleted one)
          const remaining = courseLMPs.filter(c => c !== selectedCourseType);
          setSelectedCourseType(remaining[0] || getDefaultLmpSelection(activeTab));
      } catch (err: any) {
          setDeleteError(`Failed to delete: ${err.message}`);
      } finally {
          setIsDeleting(false);
      }
  };

  const handleBulkUpload = async () => {
      if (!uploadFile) { alert('Please select a file first.'); return; }
      const packageName = newUploadPackageName.trim();
      const destinationCode = isTrainingPackagesTab && uploadMode === 'create'
          ? getUnitScopedCollectionCode(getPackageCodeFromTitle(packageName), activeUnitNormalised, shouldScopeCreatedItemsToActiveUnit)
          : selectedCourseType;
      const destinationName = isTrainingPackagesTab && uploadMode === 'create'
          ? packageName
          : getCourseTitle(selectedCourseType);
      if (isTrainingPackagesTab && uploadMode === 'create' && !packageName) {
          alert('Please enter a new package name.');
          return;
      }
      if (!destinationCode) { alert(`Please select or add a ${activeCollectionNoun} first.`); return; }
      if (isTrainingPackagesTab && uploadMode === 'create' && courseLMPs.includes(destinationCode)) {
          alert(`A package with code ${destinationCode} already exists. Select it and use Replace Package or Update Package instead.`);
          return;
      }
      setIsUploading(true);
      setUploadResult(null);
      try {
          const formData = new FormData();
          formData.append('file', uploadFile);
          formData.append('courseCode', destinationCode);
          formData.append('packageName', destinationName);
          formData.append('uploadMode', isTrainingPackagesTab ? uploadMode : 'update');
          formData.append('lmpType', activeLmpType);
          formData.append('operationalModel', activeOperationalModel);
          if (shouldScopeCreatedItemsToActiveUnit) {
              formData.append('locationCode', activeLocationNormalised);
              formData.append('unitCode', activeUnitNormalised);
          }
          const resp = await fetch('/api/syllabus/bulk-upload', {
              method: 'POST',
              body: formData,
          });
          const responseText = await resp.text();
          let data: any = {};
          try {
              data = responseText ? JSON.parse(responseText) : {};
          } catch (_parseError) {
              const preview = responseText.replace(/\s+/g, ' ').trim().slice(0, 180);
              throw new Error(`Upload endpoint returned a non-JSON response (${resp.status} ${resp.statusText})${preview ? `: ${preview}` : ''}`);
          }
          if (!resp.ok && Array.isArray(data.errors)) {
              setUploadResult(data);
              return;
          }
          if (!resp.ok) throw new Error(data.error || data.message || `Upload failed (${resp.status} ${resp.statusText})`);
          setUploadResult(data);
          // Reload syllabus data by triggering a page reload after short delay
          if ((data.created || 0) > 0 || (data.updated || 0) > 0) {
              clearSyllabusCache();
              localStorage.setItem('neo_lmp_details_active_tab', activeTab);
              localStorage.setItem('neo_lmp_details_selected_package', destinationCode);
              setTimeout(() => window.location.reload(), 2000);
          }
      } catch (err: any) {
          alert(`Upload failed: ${err.message}`);
      } finally {
          setIsUploading(false);
      }
  };

  const handleCrossLoadDuplicateCourse = async () => {
      if (!duplicateUploadSource || !selectedCourseType || !activeUnitNormalised) return;
      setIsCrossLoadingDuplicateCourse(true);
      try {
          const sourceCourse = String(duplicateUploadSource.sourceCourse || '').trim();
          const sourceUnit = normaliseContextCode(duplicateUploadSource.sourceUnit);
          const sourceLocation = normaliseContextCode(duplicateUploadSource.sourceLocation);
          const sourceResp = await fetch(`/api/syllabus?course=${encodeURIComponent(sourceCourse)}&includeInactive=false`, {
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
          });
          if (!sourceResp.ok) throw new Error(`Could not load source course ${sourceCourse}`);
          const sourceData = await sourceResp.json();
          const sourceItems = ((sourceData.syllabus || sourceData.syllabusItems || []) as SyllabusItemDetail[])
              .filter(item => item.isActive !== false)
              .filter(item => (item.courses || []).includes(sourceCourse))
              .filter(item => (item.lmpType || 'Master LMP') === activeLmpType)
              .filter(item => !sourceUnit || normaliseContextCode(item.unit) === sourceUnit)
              .filter(item => !sourceLocation || !normaliseContextCode(item.location) || normaliseContextCode(item.location) === sourceLocation)
              .filter(item => !isSyllabusCourseShell(item))
              .sort((left, right) =>
                  Number((left as any).sortOrder ?? Number.MAX_SAFE_INTEGER) - Number((right as any).sortOrder ?? Number.MAX_SAFE_INTEGER) ||
                  String(left.code || '').localeCompare(String(right.code || ''), undefined, { numeric: true })
              );
          if (sourceItems.length === 0) throw new Error(`No source events were found for ${sourceUnit || 'the source unit'} / ${sourceCourse}`);

          const allResp = await fetch('/api/syllabus?includeInactive=false', {
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
          });
          const allData = allResp.ok ? await allResp.json() : {};
          const existingCodes = new Set(
              ((allData.syllabus || allData.syllabusItems || syllabusDetails) as SyllabusItemDetail[])
                  .map(item => String(item.code || item.id || '').trim().toUpperCase())
                  .filter(Boolean)
          );
          const copiedCodes = new Set<string>();
          const prefixImportedValue = (value?: string | null): string => {
              const clean = String(value || '').replace(/\s+/g, ' ').trim();
              if (!clean) return activeUnitNormalised;
              return clean.toUpperCase().startsWith(`${activeUnitNormalised} `)
                  ? clean
                  : `${activeUnitNormalised} ${clean}`;
          };
          const getUniqueCopiedCode = (value?: string | null): string => {
              const baseCode = prefixImportedValue(value || 'Event');
              let candidate = baseCode;
              let suffix = 2;
              while (existingCodes.has(candidate.toUpperCase()) || copiedCodes.has(candidate.toUpperCase())) {
                  candidate = `${baseCode} ${suffix}`;
                  suffix += 1;
              }
              copiedCodes.add(candidate.toUpperCase());
              return candidate;
          };
          const codeMap = new Map<string, string>();
          sourceItems.forEach(item => {
              const sourceCode = String(item.code || '').trim();
              if (sourceCode) codeMap.set(sourceCode, getUniqueCopiedCode(sourceCode));
          });
          const remapList = (values?: string[]) => (values || []).map(value => codeMap.get(String(value || '').trim()) || value);
          const targetTitle = getCourseTitle(selectedCourseType);
          const savedItems: SyllabusItemDetail[] = [];
          for (const sourceItem of sourceItems) {
              const { id: _id, completedAt: _completedAt, masterEventId: _masterEventId, lmpSource: _lmpSource, ...copyBase } = sourceItem as any;
              const copiedCode = codeMap.get(String(sourceItem.code || '').trim()) || getUniqueCopiedCode(sourceItem.code || sourceItem.eventDescription);
              const copiedItem: Partial<SyllabusItemDetail> = {
                  ...copyBase,
                  code: copiedCode,
                  eventDescription: prefixImportedValue(sourceItem.eventDescription || sourceItem.code),
                  courses: [selectedCourseType],
                  phase: selectedCourseType,
                  module: targetTitle,
                  location: activeLocationNormalised,
                  unit: activeUnitNormalised,
                  lmpType: activeLmpType,
                  prerequisites: remapList(sourceItem.prerequisites),
                  prerequisitesGround: remapList(sourceItem.prerequisitesGround),
                  prerequisitesFlying: remapList(sourceItem.prerequisitesFlying),
                  isActive: true,
              };
              const saved = await createSyllabusItem(copiedItem, `Cross-loaded ${activeCollectionNoun} from ${sourceUnit || 'another unit'} into ${activeUnitNormalised}`);
              savedItems.push(saved);
              if (onAddItem) onAddItem(saved);
          }
          clearSyllabusCache();
          setSelectedItem(savedItems[0] || null);
          setEditedItem(savedItems[0] ? JSON.parse(JSON.stringify(savedItems[0])) : null);
          setUploadResult({
              created: savedItems.length,
              updated: 0,
              imported: savedItems.length,
              skipped: 0,
              errors: [],
              message: `${savedItems.length} row${savedItems.length === 1 ? '' : 's'} cross-loaded from ${sourceUnit || 'another unit'} into ${activeUnitNormalised} ${getCourseTitle(selectedCourseType)}`,
          });
          logAudit({
              action: 'Create',
              description: `Cross-loaded ${activeCollectionNoun} ${sourceCourse} into ${activeUnitNormalised}`,
              changes: `${savedItems.length} events copied from ${sourceUnit || 'source unit'} to ${selectedCourseType}`,
              page: 'LMP/Event Details',
          });
          setTimeout(() => window.location.reload(), 1600);
      } catch (err: any) {
          alert(`Cross-load failed: ${err.message}`);
      } finally {
          setIsCrossLoadingDuplicateCourse(false);
      }
  };

  const handleDeleteEventRequest = (item: SyllabusItemDetail) => {
      setDeleteEventItem(item);
      setDeleteEventPassword('');
      setDeleteEventError('');
      setShowDeleteEventModal(true);
  };

  const handleDeleteEventConfirm = async () => {
      if (!deleteEventItem) return;
      if (!deleteEventPassword) { setDeleteEventError('Please enter your password.'); return; }
      setIsDeletingEvent(true);
      setDeleteEventError('');
      try {
          // Verify password
          const sessionToken = localStorage.getItem('dfp_session_token') || '';
          const verifyResp = await fetch('/api/auth/verify-password', {
              method: 'POST',
              credentials: 'include',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionToken}`,
              },
              body: JSON.stringify({ password: deleteEventPassword }),
          });
          const verifyData = await verifyResp.json();
          if (!verifyData.valid) {
              setDeleteEventError('Incorrect password. Please try again.');
              setIsDeletingEvent(false);
              return;
          }
          // Hard delete the event
          const deleteResp = await fetch(`/api/syllabus/${deleteEventItem.id}`, {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ changeReason: `Event deleted by user` }),
          });
          if (!deleteResp.ok) {
              const err = await deleteResp.json();
              throw new Error(err.error || 'Failed to delete event');
          }
          logAudit({ action: 'Delete', description: `Deleted event: ${deleteEventItem.code} - ${deleteEventItem.eventDescription}`, changes: `Event removed from ${activeCollectionNoun}: ${selectedCourseType}`, page: 'LMP/Event Details' });
          // Remove from local state
          onUpdateItem({ ...deleteEventItem, isActive: false } as any);
          setShowDeleteEventModal(false);
          setDeleteEventItem(null);
          setDeleteEventPassword('');
          setSelectedItem(null);
          setEditedItem(null);
          setIsEditing(false);
      } catch (err: any) {
          setDeleteEventError(`Failed to delete: ${err.message}`);
      } finally {
          setIsDeletingEvent(false);
      }
  };

  const handleAddLMP = () => {
      setNewLMPName('');
      setNewLMPCourseType('Flight Training');
      setAddPackageMode('blank');
      setCopyPackageSourceKey(packageCopyOptions[0]?.key || '');
      setShowAddLMPModal(true);
  };

  const handleCopyPackageSave = async () => {
      const source = packageCopyOptions.find(option => option.key === copyPackageSourceKey);
      if (!source) {
          alert('Please select a package to copy.');
          return;
      }
      if (!activeUnitNormalised) {
          alert('Please select a unit before copying a training package.');
          return;
      }
      const targetPackageCodeBase = `${activeUnitNormalised}-${source.code}`.replace(/[^A-Z0-9-]/g, '').slice(0, 24);
      let targetPackageCode = targetPackageCodeBase;
      let suffix = 2;
      while (courseLMPs.includes(targetPackageCode)) {
          targetPackageCode = `${targetPackageCodeBase}-${suffix}`;
          suffix += 1;
      }
      const sortedSourceItems = [...source.items].sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }));
      const prefixImportedEventName = (value?: string | null): string => {
          const cleanName = String(value || '').replace(/\s+/g, ' ').trim();
          if (!cleanName) return activeUnitNormalised;
          return cleanName.toUpperCase().startsWith(`${activeUnitNormalised} `)
              ? cleanName
              : `${activeUnitNormalised} ${cleanName}`;
      };
      const existingCodes = new Set(
          syllabusDetails
              .map(item => String(item.code || item.id || '').trim().toUpperCase())
              .filter(Boolean)
      );
      const copiedCodes = new Set<string>();
      const getUniqueCopiedEventCode = (value?: string | null): string => {
          const baseCode = prefixImportedEventName(value || 'Event');
          let candidate = baseCode;
          let duplicateSuffix = 2;
          while (existingCodes.has(candidate.toUpperCase()) || copiedCodes.has(candidate.toUpperCase())) {
              candidate = `${baseCode} ${duplicateSuffix}`;
              duplicateSuffix += 1;
          }
          copiedCodes.add(candidate.toUpperCase());
          return candidate;
      };
      const codeMap = new Map<string, string>();
      sortedSourceItems.forEach(item => {
          const sourceCode = String(item.code || '').trim();
          if (sourceCode) {
              codeMap.set(sourceCode, getUniqueCopiedEventCode(sourceCode));
          }
      });
      const remapList = (values?: string[]) => (values || []).map(value => codeMap.get(String(value || '').trim()) || value);

      setIsCopyingPackage(true);
      try {
          const savedItems: SyllabusItemDetail[] = [];
          for (const sourceItem of sortedSourceItems) {
              const { id: _id, completedAt: _completedAt, masterEventId: _masterEventId, lmpSource: _lmpSource, ...copyBase } = sourceItem as any;
              const copiedEventCode = codeMap.get(String(sourceItem.code || '').trim()) || getUniqueCopiedEventCode(sourceItem.code || sourceItem.eventDescription);
              const copiedItem: Partial<SyllabusItemDetail> = {
                  ...copyBase,
                  code: copiedEventCode,
                  courses: [targetPackageCode],
                  module: source.title,
                  eventDescription: copiedEventCode,
                  location: activeLocationNormalised,
                  unit: activeUnitNormalised,
                  lmpType: 'Staff CAT',
                  prerequisites: remapList(sourceItem.prerequisites),
                  prerequisitesGround: remapList(sourceItem.prerequisitesGround),
                  prerequisitesFlying: remapList(sourceItem.prerequisitesFlying),
                  isActive: true,
              };
              const saved = await createSyllabusItem(copiedItem, `Copied Training Package ${source.title} into ${activeUnitNormalised}`);
              savedItems.push(saved);
              if (onAddItem) onAddItem(saved);
          }
          setSelectedCourseType(targetPackageCode);
          setSelectedItem(savedItems[0] || null);
          setEditedItem(savedItems[0] ? JSON.parse(JSON.stringify(savedItems[0])) : null);
          setIsEditing(false);
          setShowAddLMPModal(false);
          logAudit({
              action: 'Create',
              description: `Copied training package ${source.title} into ${activeUnitNormalised}`,
              changes: `${savedItems.length} events copied from ${source.unit} / ${source.code} to ${targetPackageCode}`,
              page: 'LMP/Event Details',
          });
      } catch (err: any) {
          alert(`❌ Failed to copy package: ${err.message}`);
      } finally {
          setIsCopyingPackage(false);
      }
  };

  const handleAddLMPSave = async () => {
      if (isTrainingPackagesTab && addPackageMode === 'copy') {
          await handleCopyPackageSave();
          return;
      }
      if (!newLMPName.trim()) { alert(`Please enter a ${activeCollectionNoun} title.`); return; }
      // For Academic Training courses, use the full name as the course code/identifier.
      // This is critical: the academicLmpType field on trainees/courses stores the FULL NAME
      // and syllabus items are filtered by courses.includes(academicLmpType).
      // Using autoCode (initials) would cause a mismatch for multi-word academic course names.
      // For Flight Training courses, use the traditional short auto-generated code.
      const words = newLMPName.trim().split(/\s+/);
      const shortCode = words.length === 1
          ? newLMPName.trim().toUpperCase().slice(0, 8)
          : words.map(w => w[0].toUpperCase()).join('').slice(0, 8);
      // Academic Training: use full name as course identifier so it matches academicLmpType dropdown
      const isAcademic = newLMPCourseType === 'Academic Training';
      const baseCourseCode = isAcademic && !isTrainingPackagesTab && !shouldScopeCreatedItemsToActiveUnit ? newLMPName.trim() : shortCode;
      const courseCode = getUnitScopedCollectionCode(baseCourseCode, activeUnitNormalised, shouldScopeCreatedItemsToActiveUnit);
      // Build a non-schedulable course/package shell so the collection exists
      // without creating a default event.
      const newItem: SyllabusItemDetail = {
          id: `new-lmp-${Date.now()}`,
          code: courseCode,
          phase: courseCode,
          module: newLMPName.trim(),
          dayNight: 'Day',
          eventDescription: newLMPName.trim(),
          prerequisites: [],
          prerequisitesGround: [],
          prerequisitesFlying: [],
          eventDetailsCommon: [],
          eventDetailsSortie: [],
          totalEventHours: 0,
          flightOrSimHours: 0,
          duration: 0,
          preFlightTime: 0,
          postFlightTime: 0,
          type: isAcademic ? 'Academics' : 'Ground School',
          methodOfDelivery: [],
          methodOfAssessment: [],
          resourcesPhysical: [],
          resourceNumber: 0,
          acceptableAircraftConfigs: [ANY_AIRCRAFT_CONFIG],
          resourcesHuman: [],
          location: shouldScopeCreatedItemsToActiveUnit ? activeLocationNormalised : '',
          unit: shouldScopeCreatedItemsToActiveUnit ? activeUnitNormalised : undefined,
          courses: [courseCode],
          lmpType: activeLmpType,
          notes: SYLLABUS_COURSE_SHELL_NOTE,
      };
      setShowAddLMPModal(false);
      try {
          // Persist the collection shell to the database
          const { id: _tmpId, ...itemWithoutTmpId } = newItem;
          const savedItem = await createSyllabusItem(itemWithoutTmpId, `New ${activeCollectionNoun} created: ${newLMPName.trim()}`);
          if (onAddItem) onAddItem(savedItem);
          const actualCode = savedItem.courses?.[0] || savedItem.code || courseCode;
          setSelectedCourseType(actualCode);
          setSelectedItem(null);
          setHoveredItem(null);
          setEditedItem(null);
          setIsEditing(false);
          logAudit({ action: 'Create', description: `Created new ${activeCollectionNoun}: ${savedItem.code}`, changes: `Course type: ${newLMPCourseType}`, page: 'LMP/Event Details' });
      } catch (err: any) {
          alert(`❌ Failed to create ${activeCollectionNoun}: ${err.message}`);
      }
  };

  const handleAddEvent = () => {
      if (!selectedCourseType) {
          alert(`Please select a ${activeCollectionNoun} before adding an event.`);
          return;
      }
      const existingOrders = filteredSyllabusDetails
          .map(item => Number(item.sortOrder))
          .filter(order => Number.isFinite(order));
      const nextSortOrder = (existingOrders.length > 0 ? Math.max(...existingOrders) : 0) + 10;
      // Create a blank new item pre-filled for the currently selected course
      // Determine if this is an Academics course (so new events default to Academics type)
      const isAcademicCourse = filteredSyllabusDetails.some(s => s.type === 'Academics');
      const newItem: SyllabusItemDetail = {
          id: `new-${Date.now()}`,
          code: '',
          phase: '',
          module: '',
          dayNight: 'Day',
          eventDescription: '',
          prerequisites: [],
          prerequisitesGround: [],
          prerequisitesFlying: [],
          eventDetailsCommon: [],
          eventDetailsSortie: [],
          totalEventHours: 0,
          flightOrSimHours: 0,
          duration: 1,
          preFlightTime: 0,
          postFlightTime: 0,
          type: isAcademicCourse ? 'Academics' : 'Ground School',
          methodOfDelivery: [],
          methodOfAssessment: [],
          resourcesPhysical: [],
          resourceNumber: 0,
          acceptableAircraftConfigs: [ANY_AIRCRAFT_CONFIG],
          resourcesHuman: [],
          location: shouldScopeCreatedItemsToActiveUnit ? activeLocationNormalised : '',
          unit: shouldScopeCreatedItemsToActiveUnit ? activeUnitNormalised : undefined,
          courses: [selectedCourseType],
          lmpType: activeLmpType,
          sortOrder: nextSortOrder,
      };
      // Add optimistically to UI, then persist to DB
      if (onAddItem) onAddItem(newItem);
      setSelectedItem(newItem);
      setEditedItem(JSON.parse(JSON.stringify(newItem)));
      setIsEditing(true);
      // Persist to DB in background (save will finalize with real DB id)
      createSyllabusItem({ ...newItem, id: undefined }, `New event added via ${activeCollectionTitle} editor`)
          .then(saved => { if (onAddItem) onAddItem(saved); setSelectedItem(saved); setEditedItem(JSON.parse(JSON.stringify(saved))); })
          .catch(err => console.warn('Could not pre-create event in DB:', err));
  };

  const handleEventTileDrop = async (targetId: string, position: 'before' | 'after' = 'before') => {
      if (!draggedEventId || draggedEventId === targetId || isEditing || isFrozen || isReorderingEvents) return;
      const currentIndex = filteredSyllabusDetails.findIndex(item => item.id === draggedEventId);
      const targetIndex = filteredSyllabusDetails.findIndex(item => item.id === targetId);
      if (currentIndex < 0 || targetIndex < 0) return;

      const reordered = [...filteredSyllabusDetails];
      const [moved] = reordered.splice(currentIndex, 1);
      const targetIndexAfterRemoval = reordered.findIndex(item => item.id === targetId);
      const insertIndex = position === 'after' ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval;
      reordered.splice(insertIndex, 0, moved);
      setIsReorderingEvents(true);
      try {
          const updates = reordered.map((item, index) => ({
              item,
              sortOrder: (index + 1) * 10,
          })).filter(({ item, sortOrder }) => Number(item.sortOrder) !== sortOrder);

          const savedItems = await Promise.all(updates.map(async ({ item, sortOrder }) => {
              const saved = await updateSyllabusItem(item.id, { sortOrder }, `Reordered ${activeCollectionTitle} events`);
              return { ...item, ...saved, id: item.id, sortOrder };
          }));
          savedItems.forEach(onUpdateItem);
          const selectedSaved = savedItems.find(item => item.id === selectedItem?.id);
          if (selectedSaved) setSelectedItem(selectedSaved);
          logAudit({
              action: 'Edit',
              description: `Reordered ${activeCollectionTitle} events`,
              changes: `${moved.code || 'Event'} moved to position ${insertIndex + 1}`,
              page: 'LMP/Event Details',
          });
      } catch (error) {
          console.error('[LMP/Event Details] Failed to reorder events:', error);
          alert(`Event order was not saved: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
          setDraggedEventId(null);
          setEventDropIndicator(null);
          setIsReorderingEvents(false);
      }
  };

  return (
    <>
    <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden" onKeyDownCapture={stopEditableKeyPropagation}>
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-start border-b border-gray-700 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">LMP/Event Details: {isEditing ? (
              <input
                  type="text"
                  value={editingCourseTitle}
                  onChange={e => setEditingCourseTitle(e.target.value)}
                  className="text-sky-400 bg-transparent border-b border-sky-400 outline-none text-2xl font-bold w-72 focus:border-sky-300"
                  placeholder="Course title..."
                  title="Edit course title"
              />
          ) : (
              <span className="text-sky-400">{getCourseTitle(selectedCourseType)}</span>
          )}</h1>
          <p className="text-sm text-gray-400">{isEditing ? `Editing ${activeCollectionNoun} title - changes apply to all events in this ${activeCollectionNoun}` : activeCollectionTitle}</p>
          {shouldShowUnitTabs && (
              <div className="mt-3 flex flex-wrap gap-2">
                  {fixedCrewUnitTabs.map(unitCode => (
                      <button
                          key={unitCode}
                          type="button"
                          onClick={() => {
                              if (unitCode === activeUnitTab) return;
                              setActiveUnitTab(unitCode);
                              setSelectedItem(null);
                              setHoveredItem(null);
                              setIsEditing(false);
                              setEditedItem(null);
                          }}
                          className={`h-8 rounded-md border px-4 text-xs font-semibold transition ${
                              activeUnitTab === unitCode
                                  ? 'border-emerald-400/80 bg-emerald-900/50 text-white'
                                  : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                          }`}
                      >
                          {unitCode}
                      </button>
                  ))}
              </div>
          )}
          <div className="mt-3 inline-flex rounded-md border border-gray-700 bg-gray-950/70 p-1">
            {availableTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                    if (tab.id === activeTab) return;
                    setActiveTab(tab.id);
                    setSelectedCourseType(getDefaultLmpSelection(tab.id));
                    setSelectedItem(null);
                    setHoveredItem(null);
                    setIsEditing(false);
                    setEditedItem(null);
                }}
                className={`h-9 min-w-[136px] rounded px-4 text-sm font-semibold transition ${
                    activeTab === tab.id
                        ? 'border border-sky-500/70 bg-sky-900/65 text-white'
                        : 'border border-transparent text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center space-x-4 pt-1">
            <div className="flex items-center space-x-2 bg-gray-700 p-1 rounded-md">
                <label htmlFor="course-select" className="text-xs text-gray-300 font-medium pl-2">{activeCollectionSelectLabel}</label>
                <select 
                    id="course-select"
                    value={selectedCourseType}
                    onChange={(e) => {
                        setSelectedCourseType(e.target.value);
                        setSelectedItem(null); // Clear selection when switching list
                    }}
                    className="bg-gray-800 text-white text-sm border-none rounded focus:ring-sky-500 cursor-pointer py-1 pl-2 pr-8"
                >
                    {courseLMPs.length === 0 && <option value="">No {activeCollectionTitle} available</option>}
                    {courseLMPs.map(c => <option key={`${activeTab}-${c}`} value={c}>{getCourseTitle(c)}</option>)}
                </select>
            </div>
            {selectedCourseType && (
                <div className="flex min-h-[38px] flex-wrap items-center gap-2 rounded-md border border-gray-700 bg-gray-900/70 px-3 py-1 text-xs text-gray-300">
                    <span className="font-semibold text-white">{selectedCourseEventCount} event{selectedCourseEventCount === 1 ? '' : 's'}</span>
                    {activeTab === 'master' && (
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            selectedMasterLmpCatalogueEntry
                                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100'
                                : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                        }`}>
                            {selectedMasterLmpCatalogueEntry ? 'Catalogue linked' : 'Legacy stream'}
                        </span>
                    )}
                </div>
            )}

            <div className="w-px h-8 bg-gray-600 mx-2"></div>

            {isEditing ? (
                <div className="flex items-center gap-[1px]">
                    <button onClick={handleAddEvent} disabled={isFrozen} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed disabled:opacity-50 disabled:cursor-not-allowed">Add Event</button>
                    <button onClick={handleSave} disabled={isSaving} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-black disabled:opacity-60">{isSaving ? 'Saving…' : 'Save'}</button>
                    <button onClick={handleCancel} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed">Cancel</button>
                </div>
            ) : (
                <div className="flex items-center gap-[1px]">
                    <AuditButton pageName="LMP/Event Details" />
                    {isTrainingPackagesTab ? (
                        <button onClick={handleAddLMP} disabled={isFrozen} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed disabled:opacity-50 disabled:cursor-not-allowed">
                            <span>Add<br />Package</span>
                        </button>
                    ) : (
                        <button onClick={handleManageMasterLmps} className="w-[64px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed">
                            <span>Manage<br />LMPs</span>
                        </button>
                    )}
                    <button onClick={handleAddEvent} disabled={isFrozen || !selectedCourseType} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed disabled:opacity-50 disabled:cursor-not-allowed">
                        <span>Add<br />Event</span>
                    </button>
                    {isTrainingPackagesTab && (
                        <button onClick={() => { setDeletePassword(''); setDeleteError(''); setShowDeleteModal(true); }} disabled={isFrozen} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed text-red-500 disabled:opacity-50 disabled:cursor-not-allowed">
                            <span>Del<br />Package</span>
                        </button>
                    )}
                    {isAirCombatModel && (
                        <button onClick={openAssignTraining} disabled={isFrozen || !activeTrainingAssignment || !onUpdateInstructor} className="w-[68px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed disabled:opacity-50 disabled:cursor-not-allowed">
                            <span>Assign<br />Training</span>
                        </button>
                    )}
                    <button onClick={() => { setUploadFile(null); setUploadResult(null); setUploadMode(selectedCourseType ? 'update' : 'create'); setNewUploadPackageName(''); setShowUploadModal(true); }} disabled={isFrozen} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-black disabled:opacity-50 disabled:cursor-not-allowed">Upload</button>
                    <button onClick={handleEdit} disabled={isFrozen} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed disabled:opacity-50 disabled:cursor-not-allowed">Edit</button>
                </div>
            )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Left Column: Event Icons */}
        <div className="w-[292px] border-r border-gray-700 overflow-hidden flex flex-col bg-gray-950/25">
          <div className="flex-1 overflow-y-auto p-3">
            {filteredSyllabusDetails.map((item, index) => {
              const totalItems = filteredSyllabusDetails.length;
              const midPoint = Math.ceil(totalItems / 2);
              const phaseNum = index < midPoint ? 1 : 2;
              const moduleNum = Math.floor((index * 12) / totalItems) + 1;
              const actualModule = Math.min(moduleNum, 12);
              const isSelected = selectedItem?.id === item.id && !isEditing;
              const sortieLabel = formatMasterLmpSortieLabel(item, resourceDisplayNames);
              const dayLabel = item.dayNight || 'Day';
              const durationLabel = formatMasterLmpHours(item.totalEventHours || item.duration);

              return (
              <div key={item.id} className="relative mb-2">
                {eventDropIndicator?.targetId === item.id && eventDropIndicator.position === 'before' && (
                    <span className="pointer-events-none absolute inset-x-2 -top-[5px] z-10 h-px bg-cyan-200 shadow-[0_0_8px_rgba(125,211,252,0.9)]" />
                )}
                {eventDropIndicator?.targetId === item.id && eventDropIndicator.position === 'after' && (
                    <span className="pointer-events-none absolute inset-x-2 -bottom-[5px] z-10 h-px bg-cyan-200 shadow-[0_0_8px_rgba(125,211,252,0.9)]" />
                )}
              <button
                type="button"
                draggable={!isEditing && !isFrozen && !isReorderingEvents}
                onDragStart={(event) => {
                    if (isEditing || isFrozen || isReorderingEvents) {
                        event.preventDefault();
                        return;
                    }
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', item.id);
                    setDraggedEventId(item.id);
                    setEventDropIndicator(null);
                }}
                onDragOver={(event) => {
                    if (!draggedEventId || draggedEventId === item.id || isEditing || isFrozen || isReorderingEvents) {
                        setEventDropIndicator(null);
                        return;
                    }
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
                    setEventDropIndicator({ targetId: item.id, position });
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
                    void handleEventTileDrop(item.id, position);
                }}
                onDragEnd={() => {
                    setDraggedEventId(null);
                    setEventDropIndicator(null);
                }}
                onClick={() => {
                    if (!isEditing && !isReorderingEvents) {
                        setHoveredItem(null);
                        setSelectedItem(item);
                    }
                }}
                disabled={isEditing || isReorderingEvents}
                aria-pressed={isSelected}
                title={`${item.code}${item.eventDescription ? ` - ${item.eventDescription}` : ''}`}
                className={`relative h-[62px] w-full overflow-hidden rounded-md border px-3 py-2 text-left shadow-sm transition ${
                    isSelected
                        ? 'border-emerald-300 bg-sky-800/85 text-white shadow-sky-950/40'
                        : draggedEventId === item.id
                            ? 'border-cyan-300 bg-gray-800/70 text-gray-100 opacity-70 shadow-cyan-950/30'
                        : 'border-emerald-500/60 bg-gray-900 text-gray-200 shadow-black/15'
                } ${isEditing || isReorderingEvents ? 'cursor-not-allowed opacity-55' : 'cursor-grab hover:border-emerald-300/80 hover:bg-gray-800 active:cursor-grabbing'}`}
              >
                <span className={`absolute left-3 top-2 max-w-[38%] truncate text-[10px] font-bold uppercase ${isSelected ? 'text-sky-100' : 'text-gray-400'}`}>
                  P {phaseNum}
                </span>
                <span className={`absolute right-3 top-2 max-w-[38%] truncate text-[10px] font-bold uppercase ${isSelected ? 'text-sky-100' : 'text-gray-300'}`}>
                  {sortieLabel}
                </span>
                <span className="absolute inset-x-3 top-1/2 -translate-y-1/2 truncate text-center text-[15px] font-extrabold leading-tight">
                  {item.code}
                </span>
                <span className={`absolute bottom-2 left-3 max-w-[38%] truncate text-[10px] font-semibold uppercase ${isSelected ? 'text-sky-100' : 'text-gray-400'}`}>
                  M {actualModule}
                </span>
                <span className={`absolute bottom-2 right-3 inline-flex max-w-[54%] items-center gap-3 overflow-hidden text-[10px] font-semibold uppercase ${isSelected ? 'text-sky-100' : 'text-gray-300'}`}>
                  <span className="truncate">{dayLabel}</span>
                  <span className="shrink-0">{durationLabel}</span>
                </span>
              </button>
              </div>
            );})}
            {filteredSyllabusDetails.length === 0 && (
                <div className="p-4 text-center text-gray-500 italic text-sm">No events found for this syllabus.</div>
            )}
          </div>
        </div>

        {/* Right Column: Detail View */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-5xl mx-auto">
            {(hoveredItem || selectedItem) ? (
                <DetailView 
                    item={hoveredItem || selectedItem}
                    isEditing={isEditing}
                    editedItem={editedItem}
                    onItemChange={setEditedItem}
                    onDeleteEvent={handleDeleteEventRequest}
                    resourceDisplayNames={resourceDisplayNames}
	                    aircraftConfigurations={aircraftConfigurations}
                        aircraftCrewComposition={aircraftCrewComposition}
                        crewPositionTerminology={crewPositionTerminology}
                        instructorsData={instructorsData}
                        activeUnitCode={effectiveActiveUnitCode}
	                    isAirCombatModel={isAirCombatModel}
                        operationalModel={operationalModel}
                        staffQualificationCatalogue={staffQualificationCatalogue}
                        scoringMatrixElements={scoringMatrixElements}
                        onAddScoringMatrixElement={onAddScoringMatrixElement}
	                    linkedEventOptions={filteredSyllabusDetails}
                    linkedEventOverrides={linkedEventOverrides}
                    onLinkedEventChange={handleLinkedEventChange}
                />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 italic">Select an item from the list to view its details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ── Add LMP Basics Modal ── */}
    {showAddLMPModal && (
        <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 10000,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowAddLMPModal(false)}
        >
            <div
                style={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 12,
                    padding: 28, width: 420, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                    Add {isTrainingPackagesTab ? 'Package' : 'Course'}
                </h2>
                <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 20 }}>
                    {isTrainingPackagesTab
                        ? `${packageFoundationDescription} Destination: ${activeLocationNormalised || 'the selected location'} / ${activeUnitNormalised || 'the selected unit'}.`
                        : `A ${activeCollectionNoun} code will be auto-generated from the title. No event is created until you upload or add one.`}
                </p>

                {isTrainingPackagesTab && (
                    <div style={{ marginBottom: 16, padding: 10, border: '1px solid #374151', borderRadius: 8, backgroundColor: '#111827' }}>
                        {[
                            { id: 'blank' as const, label: 'Create blank package' },
                            { id: 'copy' as const, label: `Copy ${packageFoundationLabel} package from another unit` },
                        ].map(option => (
                            <label key={option.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: option.id === 'blank' ? 8 : 0, cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="addPackageMode"
                                    checked={addPackageMode === option.id}
                                    onChange={() => setAddPackageMode(option.id)}
                                />
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#f9fafb' }}>{option.label}</span>
                            </label>
                        ))}
                    </div>
                )}

                {isTrainingPackagesTab && addPackageMode === 'copy' && (
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            Source Package
                        </label>
                        <select
                            value={copyPackageSourceKey}
                            onChange={e => setCopyPackageSourceKey(e.target.value)}
                            style={{ width: '100%', backgroundColor: '#111827', border: '1px solid #4b5563',
                                borderRadius: 6, padding: '8px 10px', color: '#fff', fontSize: 13,
                                outline: 'none', boxSizing: 'border-box' as const }}
                        >
                            {packageCopyOptions.length === 0 && <option value="">No source packages available</option>}
                            {packageCopyOptions.map(option => (
                                <option key={option.key} value={option.key}>
                                    {option.title} ({option.code}) - {option.location} / {option.unit}
                                </option>
                            ))}
                        </select>
                        <p style={{ fontSize: 10, color: '#6b7280', marginTop: 6 }}>
                            The copied package will become a separate {packageFoundationLabel} package for {activeUnitNormalised || 'the selected unit'}.
                        </p>
                    </div>
                )}

                {/* Course Title */}
                {(!isTrainingPackagesTab || addPackageMode === 'blank') && <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        {isTrainingPackagesTab ? 'Package' : 'Course'} Title *
                    </label>
                    <input
                        type="text"
                        value={newLMPName}
                        onChange={e => setNewLMPName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddLMPSave()}
                        placeholder={isTrainingPackagesTab
                            ? isFixedCrewModel ? 'e.g. Conversion Crew Package' : 'e.g. Staff Category'
                            : 'e.g. Basic Flying Course'}
                        autoFocus
                        style={{ width: '100%', backgroundColor: '#111827', border: '1px solid #4b5563',
                            borderRadius: 6, padding: '8px 10px', color: '#fff', fontSize: 13,
                            outline: 'none', boxSizing: 'border-box' as const }}
                    />
                    {newLMPName.trim() && (
                        <p style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
                            Auto-generated code: <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                                {getUnitScopedCollectionCode(
                                    newLMPName.trim().split(/\s+/).length === 1
                                        ? newLMPName.trim().toUpperCase().slice(0, 8)
                                        : newLMPName.trim().split(/\s+/).map((w: string) => w[0].toUpperCase()).join('').slice(0, 8),
                                    activeUnitNormalised,
                                    shouldScopeCreatedItemsToActiveUnit,
                                )}
                            </span>
                        </p>
                    )}
                </div>}

                {/* Course Type */}
                {(!isTrainingPackagesTab || addPackageMode === 'blank') && <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        {isTrainingPackagesTab ? 'Package Type' : 'Course Type'}
                    </label>
                    <select
                        value={newLMPCourseType}
                        onChange={e => setNewLMPCourseType(e.target.value as 'Flight Training' | 'Academic Training')}
                        style={{ width: '100%', backgroundColor: '#111827', border: '1px solid #4b5563',
                            borderRadius: 6, padding: '8px 10px', color: '#fff', fontSize: 13,
                            outline: 'none', boxSizing: 'border-box' as const }}
                    >
                        <option value="Flight Training">Flight Training</option>
                        <option value="Academic Training">Academic Training</option>
                    </select>
                    <p style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
                        {newLMPCourseType === 'Academic Training'
                            ? 'Academic Training: theory/classroom instruction delivered prior to the flying phase.'
                            : 'Flight Training: airborne, simulator and associated ground events during the flying phase.'}
                    </p>
                </div>}

                {/* Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                        onClick={() => setShowAddLMPModal(false)}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAddLMPSave}
                        disabled={isCopyingPackage}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-black disabled:opacity-60"
                    >
                        {isCopyingPackage ? 'Copying…' : addPackageMode === 'copy' ? 'Copy' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    )}

    {/* ── Delete Course Confirmation Modal ── */}
    {showDeleteModal && (
        <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.80)', zIndex: 10001,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowDeleteModal(false)}
        >
            <div
                style={{ backgroundColor: '#1f2937', border: '1px solid #ef4444', borderRadius: 12,
                    padding: 28, width: 420, boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
                    Delete {isTrainingPackagesTab ? 'Package' : 'Course'}: {getCourseTitle(selectedCourseType)}
                </h2>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20, lineHeight: 1.6 }}>
                    This will permanently remove <strong style={{ color: '#f9fafb' }}>all events</strong> in the <strong style={{ color: '#f9fafb' }}>{getCourseTitle(selectedCourseType)}</strong> {activeCollectionNoun} from the database.
                    This action cannot be undone. Enter your password to confirm.
                </p>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Your Password *
                    </label>
                    <input
                        type="password"
                        value={deletePassword}
                        onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleDeleteCourse()}
                        placeholder="Enter your password to confirm"
                        autoFocus
                        style={{ width: '100%', backgroundColor: '#111827', border: `1px solid ${deleteError ? '#ef4444' : '#4b5563'}`,
                            borderRadius: 6, padding: '8px 10px', color: '#fff', fontSize: 13,
                            outline: 'none', boxSizing: 'border-box' as const }}
                    />
                    {deleteError && (
                        <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{deleteError}</p>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                        onClick={() => setShowDeleteModal(false)}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDeleteCourse}
                        disabled={isDeleting}
                        className="w-[72px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-red-500 disabled:opacity-60"
                    >
                        {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    )}
    {/* Delete Event Modal */}
    {showDeleteEventModal && deleteEventItem && (
        <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.80)', zIndex: 10002,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => !isDeletingEvent && setShowDeleteEventModal(false)}
        >
            <div
                style={{ backgroundColor: '#1f2937', border: '1px solid #ef4444', borderRadius: 12,
                    padding: 28, width: 440, boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
                    🗑 Delete Event
                </h2>
                <p style={{ fontSize: 13, color: '#d1d5db', marginBottom: 4 }}>
                    <strong>{deleteEventItem.code}</strong> — {deleteEventItem.eventDescription}
                </p>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20, lineHeight: 1.6 }}>
                    This will permanently remove this event from the database. This action cannot be undone. Enter your password to confirm.
                </p>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Your Password *
                    </label>
                    <input
                        type="password"
                        value={deleteEventPassword}
                        onChange={e => { setDeleteEventPassword(e.target.value); setDeleteEventError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleDeleteEventConfirm()}
                        autoFocus
                        placeholder="Enter your login password"
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, backgroundColor: '#111827',
                            border: `1px solid ${deleteEventError ? '#ef4444' : '#374151'}`, borderRadius: 6,
                            color: '#f9fafb', outline: 'none', boxSizing: 'border-box' }}
                    />
                    {deleteEventError && (
                        <p style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>{deleteEventError}</p>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                        onClick={() => setShowDeleteEventModal(false)}
                        disabled={isDeletingEvent}
                        style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                            backgroundColor: '#374151', color: '#d1d5db', border: 'none', cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDeleteEventConfirm}
                        disabled={isDeletingEvent}
                        style={{ padding: '8px 20px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                            backgroundColor: '#dc2626', color: '#ffffff', border: 'none',
                            cursor: isDeletingEvent ? 'not-allowed' : 'pointer', opacity: isDeletingEvent ? 0.6 : 1 }}
                    >
                        {isDeletingEvent ? 'Deleting…' : 'Delete Event'}
                    </button>
                </div>
            </div>
        </div>
    )}

    {/* Bulk Upload Modal */}
    {showUploadModal && (
        <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.80)', zIndex: 10001,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => !isUploading && setShowUploadModal(false)}
        >
            <div
                style={{ backgroundColor: '#1f2937', border: '1px solid #38bdf8', borderRadius: 12,
                    padding: 28, width: 480, boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8', marginBottom: 8 }}>
                    Bulk Upload {isTrainingPackagesTab ? 'Training Package' : 'Master LMP'} Events
                </h2>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4, lineHeight: 1.6 }}>
                    Upload an Excel (.xlsx) file to populate <strong style={{ color: '#f9fafb' }}>{getCourseTitle(selectedCourseType)}</strong> with {isTrainingPackagesTab ? `${packageFoundationLabel} training package` : 'Master LMP'} events.
                    {isTrainingPackagesTab ? ' These rows will be saved to Training Packages, not Master LMP.' : ''}
                </p>
                <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
                    Preferred sheet name: <strong style={{ color: '#d1d5db' }}>Syllabus_LMP</strong>. If that sheet is not present, the first worksheet is used. Mandatory data: Event description, Type, and a positive duration in either Flight or Sim Hours or Total Event Hours. Optional columns: Code, Course, Phase, Module, Day/Night, Dual/Solo, prerequisites, Event Details - Common, Event Details - Sortie, Method/s of Delivery, Method/s of Assessment, Resources Required (physical), Resources Required (Human), Resource Number, CONFIG. Blank Code cells are generated from the selected {activeCollectionNoun}.
                </p>

                {isTrainingPackagesTab && !uploadResult && (
                    <div style={{ marginBottom: 16, padding: 12, border: '1px solid #374151', borderRadius: 8, backgroundColor: '#111827' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af',
                            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                            Package Destination
                        </label>
                        {[
                            { id: 'update' as const, label: 'Update selected package', detail: `Add new rows and update matching event codes in ${getCourseTitle(selectedCourseType) || 'the selected package'}.` },
                            { id: 'replace' as const, label: 'Replace selected package', detail: `Remove current rows in ${getCourseTitle(selectedCourseType) || 'the selected package'} before importing this workbook.` },
                            { id: 'create' as const, label: 'Create new package', detail: 'Enter a package name; the app will create the package code and import these rows into it.' },
                        ].map(option => (
                            <label key={option.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8, cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="uploadMode"
                                    checked={uploadMode === option.id}
                                    onChange={() => setUploadMode(option.id)}
                                    disabled={!selectedCourseType && option.id !== 'create'}
                                    style={{ marginTop: 3 }}
                                />
                                <span>
                                    <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#f9fafb' }}>{option.label}</span>
                                    <span style={{ display: 'block', fontSize: 11, color: '#6b7280', lineHeight: 1.35 }}>{option.detail}</span>
                                </span>
                            </label>
                        ))}
                        {uploadMode === 'create' && (
                            <div style={{ marginTop: 10 }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>
                                    New package name
                                </label>
                                <input
                                    type="text"
                                    value={newUploadPackageName}
                                    onChange={e => setNewUploadPackageName(e.target.value)}
                                    placeholder={isFixedCrewModel ? 'e.g. Conversion Crew Package' : 'e.g. Air Combat'}
                                    style={{ width: '100%', fontSize: 13, color: '#f9fafb', backgroundColor: '#0f172a',
                                        border: '1px solid #374151', borderRadius: 6, padding: '8px 10px' }}
                                />
                                {newUploadPackageName.trim() && (
                                    <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                                        Package code: <strong style={{ color: '#d1d5db' }}>
                                            {getUnitScopedCollectionCode(getPackageCodeFromTitle(newUploadPackageName), activeUnitNormalised, shouldScopeCreatedItemsToActiveUnit)}
                                        </strong>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div
                    onDragEnter={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIsUploadDragActive(true);
                    }}
                    onDragOver={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = 'copy';
                        setIsUploadDragActive(true);
                    }}
                    onDragLeave={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIsUploadDragActive(false);
                    }}
                    onDrop={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIsUploadDragActive(false);
                        setUploadFile(event.dataTransfer.files?.[0] || null);
                        setUploadResult(null);
                    }}
                    style={{
                        marginBottom: 16,
                        border: `1px dashed ${isUploadDragActive ? '#67e8f9' : '#374151'}`,
                        borderRadius: 8,
                        padding: 12,
                        backgroundColor: isUploadDragActive ? 'rgba(14, 116, 144, 0.22)' : '#0f172a',
                    }}
                >
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        Select or drop Excel File (.xlsx)
                    </label>
                    <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={e => { setUploadFile(e.target.files?.[0] || null); setUploadResult(null); }}
                        style={{ display: 'block', width: '100%', fontSize: 13, color: '#f9fafb',
                            backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6, padding: '8px 12px' }}
                    />
                    <p style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>Drag and drop .xlsx, .xls or .csv here.</p>
                </div>

                {uploadFile && !uploadResult && (
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                        Selected: <strong style={{ color: '#d1d5db' }}>{uploadFile.name}</strong> ({(uploadFile.size / 1024).toFixed(1)} KB)
                    </p>
                )}

                {uploadResult && (
                    <div style={{ marginBottom: 16, padding: 12, backgroundColor: uploadResult.errors.length > 0 ? '#1c1917' : '#052e16',
                        border: `1px solid ${uploadResult.errors.length > 0 ? '#78350f' : '#166534'}`, borderRadius: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: uploadResult.errors.length > 0 ? '#fbbf24' : '#4ade80', marginBottom: 4 }}>
                            {uploadResult.message}
                        </p>
                        <p style={{ fontSize: 11, color: '#9ca3af' }}>
                            Imported rows: {uploadResult.imported ?? ((uploadResult.created || 0) + (uploadResult.updated || 0))} &nbsp;|&nbsp; Created: {uploadResult.created} &nbsp;|&nbsp; Updated: {uploadResult.updated || 0} &nbsp;|&nbsp; Skipped: {uploadResult.skipped}
                            {uploadResult.errors.length > 0 && <span style={{ color: '#f87171' }}> &nbsp;|&nbsp; Errors: {uploadResult.errors.length}</span>}
                        </p>
                        {duplicateUploadSource && (
                            <div style={{ marginTop: 10, padding: 10, border: '1px solid #0e7490', borderRadius: 8, backgroundColor: '#082f49' }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: '#bae6fd', marginBottom: 4 }}>
                                    This looks like a course already loaded for another unit.
                                </p>
                                <p style={{ fontSize: 11, color: '#d1d5db', lineHeight: 1.45, marginBottom: 8 }}>
                                    The upload file contains event codes that already exist in {duplicateUploadSource.sourceUnit || 'another unit'}
                                    {duplicateUploadSource.sourceCourse ? ` under ${duplicateUploadSource.sourceCourse}` : ''}. Event codes must stay unique, so the app cannot import the same spreadsheet directly into {activeUnitNormalised || 'this unit'}.
                                    You can cross-load it instead; the app will copy the source events into {getCourseTitle(selectedCourseType)} and prefix the copied event codes with {activeUnitNormalised || 'the importing unit'}.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleCrossLoadDuplicateCourse}
                                    disabled={!canCrossLoadDuplicateCourse || isCrossLoadingDuplicateCourse}
                                    style={{
                                        padding: '7px 12px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        borderRadius: 6,
                                        backgroundColor: canCrossLoadDuplicateCourse && !isCrossLoadingDuplicateCourse ? '#0284c7' : '#334155',
                                        color: '#fff',
                                        border: 'none',
                                        cursor: canCrossLoadDuplicateCourse && !isCrossLoadingDuplicateCourse ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    {isCrossLoadingDuplicateCourse
                                        ? 'Cross-loading…'
                                        : `Cross-load from ${duplicateUploadSource.sourceUnit || 'source unit'}`}
                                </button>
                            </div>
                        )}
                        {uploadResult.errors.length > 0 && (
                            <div style={{ marginTop: 8, maxHeight: 100, overflowY: 'auto' }}>
                                {uploadResult.errors.map((e: any, i: number) => (
                                    <p key={i} style={{ fontSize: 10, color: '#f87171' }}>Row {e.row}: {e.error}</p>
                                ))}
                            </div>
                        )}
                        {(uploadResult.created > 0 || (uploadResult.updated || 0) > 0) && (
                            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>Page will reload automatically…</p>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <button
                        onClick={() => setShowUploadModal(false)}
                        disabled={isUploading}
                        style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                            backgroundColor: '#374151', color: '#d1d5db', border: 'none', cursor: 'pointer' }}
                    >
                        {uploadResult && (uploadResult.created > 0 || (uploadResult.updated || 0) > 0) ? 'Close' : 'Cancel'}
                    </button>
                    {!uploadResult && (
                        <button
                            onClick={handleBulkUpload}
                            disabled={!uploadFile || isUploading || (isTrainingPackagesTab && uploadMode === 'create' && !newUploadPackageName.trim())}
                            style={{ padding: '8px 20px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                                backgroundColor: uploadFile && !isUploading && !(isTrainingPackagesTab && uploadMode === 'create' && !newUploadPackageName.trim()) ? '#0284c7' : '#1e3a5f',
                                color: '#fff', border: 'none', cursor: uploadFile && !isUploading && !(isTrainingPackagesTab && uploadMode === 'create' && !newUploadPackageName.trim()) ? 'pointer' : 'not-allowed' }}
                        >
                            {isUploading ? 'Uploading…' : 'Upload & Import'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )}
    {showAssignTrainingModal && activeTrainingAssignment && (
        <AssignTrainingModal
            title={`${activeTrainingAssignment.kind === 'course' ? 'Course' : 'Training Package'}: ${activeTrainingAssignment.title || activeTrainingAssignment.code}`}
            staff={assignableAirCombatStaff}
            selectedStaffIds={assignTrainingSelection}
            saving={isSavingTrainingAssignments}
            onToggle={(idNumber) => {
                setAssignTrainingSelection(prev => {
                    const next = new Set(prev);
                    if (next.has(idNumber)) next.delete(idNumber);
                    else next.add(idNumber);
                    return next;
                });
            }}
            onSelectAll={() => setAssignTrainingSelection(new Set(assignableAirCombatStaff.map(staff => staff.idNumber)))}
            onDeselectAll={() => setAssignTrainingSelection(new Set())}
            onCancel={() => setShowAssignTrainingModal(false)}
            onSave={saveAssignTraining}
        />
    )}
    </>
  );
};

export default SyllabusView;
