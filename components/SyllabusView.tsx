import { useSystemFreeze } from '../hooks/useSystemFreeze';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PencilIcon } from '@heroicons/react/24/outline';
import { Instructor, PhraseBank, SyllabusItemDetail, Trainee } from '../types';
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
import {
    getQualificationsForOperationalModel,
    type StaffQualificationCatalogue,
} from '../utils/staffQualifications';
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
    getFlightSchoolStaffLmpAssignmentFromItem,
    staffHasFlightSchoolStaffLmpAssignment,
    setFlightSchoolStaffLmpAssignment,
} from '../utils/flightSchoolStaffLmpAssignments';
import {
    getDefaultLmpAudience,
    getLmpAudienceForCourse,
    withLmpAudienceInNotes,
    type LmpAudience,
} from '../utils/lmpAudience';
import {
    getFixedCrewCoursePackageBriefingTimes,
    withFixedCrewCoursePackageBriefingTimes,
} from '../utils/fixedCrewTraining';
import { SYLLABUS_COURSE_SHELL_NOTE, isSyllabusCourseShell } from '../utils/syllabusCourseShell';
import {
    handleEditableTextBeforeInput,
    handleEditableTextKeyDownCapture,
    stopEditableKeyPropagation,
} from '../utils/editableKeyEvents';
import {
    INITIAL_SCORING_MATRIX_ELEMENTS,
    SCORING_MATRIX_ELEMENT_GROUPS_KEY,
    SCORING_MATRIX_ELEMENT_LIST_KEY,
    SCORING_MATRIX_ELEMENT_SELECTION_VERSION_KEY,
    getConfiguredScoringMatrixElements,
} from '../utils/scoringMatrixElements';
import type { PlatformMasterLmpCatalogueEntry } from '../utils/platformConfigService';
import { showDarkAlert, showDarkPrompt } from './DarkMessageModal';

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
  traineesData?: Trainee[];
  onUpdateTrainee?: (data: Trainee) => void | Promise<void>;
  onAssignTraineeLmp?: (trainee: Trainee, lmpCode: string) => void | Promise<void>;
  onTraceAssignLmp?: (stage: string, details?: Record<string, any>) => void;
  onDownloadAssignmentTrace?: () => void;
  operationalModel?: string;
  sharedUnitTabs?: string[];
  masterLmpCatalogue?: PlatformMasterLmpCatalogueEntry[];
  staffQualificationCatalogue?: StaffQualificationCatalogue;
  currentUserName?: string;
  scoringMatrixPhraseBank?: PhraseBank;
  onAddScoringMatrixElement?: () => void;
  onNavigateToSettingsSection?: (request: { sectionId: string; unitCode?: string; locationCode?: string; resourcePoolCode?: string; aircraftTypeCode?: string; focusSubsectionId?: string }) => void;
  onDeleteMasterLmpCatalogue?: (lmpCode: string) => Promise<void> | void;
  onUpsertMasterLmpCatalogue?: (entry: { code: string; name: string; version?: string; audience?: LmpAudience }) => Promise<void> | void;
}

const LMP_VERSION_NOTE_REGEX = /\[DFP_LMP_VERSION:([0-9]+(?:\.[0-9]+)?)\]/i;
const DEFAULT_LMP_VERSION = '1.0';

const getLmpVersionFromNotes = (notes?: string | null): string | null => {
  const match = String(notes || '').match(LMP_VERSION_NOTE_REGEX);
  return match?.[1] || null;
};

const withLmpVersionInNotes = (notes: string | undefined | null, version: string): string => {
  const withoutVersion = String(notes || '').replace(LMP_VERSION_NOTE_REGEX, '').replace(/\n{3,}/g, '\n\n').trim();
  return [withoutVersion, `[DFP_LMP_VERSION:${version}]`].filter(Boolean).join('\n');
};

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
        <div className="min-h-[52px] bg-gray-700/50 p-3 rounded-lg text-sm text-gray-300">
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

const formatWholeNumberField = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return '';
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? String(Math.round(numericValue)) : '';
};

const formatOptionalYesNo = (value: unknown): string => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    const normalised = String(value ?? '').trim().toUpperCase();
    if (normalised === 'YES') return 'Yes';
    if (normalised === 'NO') return 'No';
    return '';
};

const GroupDataWindow: React.FC<{ label: React.ReactNode; value: React.ReactNode; className?: string; subHeading?: boolean }> = ({ label, value, className = '', subHeading = false }) => (
    <div className={className}>
        <h3 className={subHeading ? 'mb-2 text-xs font-semibold text-white' : 'text-md font-semibold text-sky-400 mb-2'}>{label}</h3>
        <div className="min-h-[52px] rounded-lg bg-gray-700/50 p-3 text-sm text-gray-300">{value}</div>
    </div>
);

const GroupEventSummary: React.FC<{ item: SyllabusItemDetail }> = ({ item }) => (
    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
        <GroupDataWindow label="Group Event" value={formatOptionalYesNo(item.groupEvent)} />
        <GroupDataWindow label="Minimum to Schedule" value={formatWholeNumberField(item.minimumToSchedule)} />
        <div className="md:col-span-2">
            <h3 className="text-md font-semibold text-sky-400 mb-2">Group Size</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <GroupDataWindow subHeading label="Minimum" value={formatWholeNumberField(item.groupSizeMin)} />
                <GroupDataWindow subHeading label="Maximum" value={formatWholeNumberField(item.groupSizeMax)} />
                <GroupDataWindow
                    subHeading
                    label="Entire course"
                    value={(
                        <span className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={item.groupEntireCourse === true}
                                readOnly
                                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-sky-500"
                            />
                            <span>{formatOptionalYesNo(item.groupEntireCourse)}</span>
                        </span>
                    )}
                />
            </div>
        </div>
    </div>
);

const GroupEventEditor: React.FC<{
    item: SyllabusItemDetail;
    onChange: (field: keyof SyllabusItemDetail, value: any) => void;
}> = ({ item, onChange }) => {
    const groupEntireCourse = item.groupEntireCourse === true;
    return (
        <div className="md:col-span-2 rounded-lg border border-gray-700 bg-gray-800/40 p-3">
            <h3 className="text-md font-semibold text-sky-400 mb-3">Group Scheduling</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="bg-gray-700/50 p-3 rounded-lg">
                    <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider">Group Event</span>
                    <select
                        value={item.groupEvent ? 'YES' : 'NO'}
                        onChange={(event) => onChange('groupEvent', event.target.value === 'YES')}
                        className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-md shadow-sm py-1 px-2 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    >
                        <option value="NO">No</option>
                        <option value="YES">Yes</option>
                    </select>
                </label>
                <EditableField
                    label="Minimum to Schedule"
                    type="number"
                    value={item.minimumToSchedule ?? 0}
                    onChange={(value) => onChange('minimumToSchedule', value)}
                />
            </div>
            <div className="mt-6">
                <h4 className="text-md font-semibold text-sky-400 mb-2">Group Size</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <EditableField
                        label="Minimum"
                        type="number"
                        value={item.groupSizeMin ?? 0}
                        onChange={(value) => onChange('groupSizeMin', value)}
                    />
                    <EditableField
                        label="Maximum"
                        type="number"
                        value={item.groupSizeMax ?? 0}
                        onChange={(value) => onChange('groupSizeMax', value)}
                    />
                    <label className="min-h-[52px] flex items-center gap-2 rounded-lg bg-gray-700/50 px-3 py-2 text-sm text-gray-300">
                        <input
                            type="checkbox"
                            checked={groupEntireCourse}
                            onChange={(event) => onChange('groupEntireCourse', event.target.checked)}
                            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-sky-500"
                        />
                        Entire course
                    </label>
                </div>
            </div>
        </div>
    );
};

const AIR_COMBAT_LINKED_EVENT_NOTE_REGEX = /^\[Linked Event:\s*([^\]]+)\]$/i;
const DEFAULT_ASSESSED_ELEMENTS = INITIAL_SCORING_MATRIX_ELEMENTS.filter(element => element !== 'Generic Flying Elements');
const SCORING_MATRIX_NON_ASSESSABLE_KEYS = new Set(['generic flying elements']);

const roundMasterLmpHourToTenths = (value: number): number => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Number((Math.round(numericValue * 10) / 10).toFixed(1));
};

const clampMasterLmpHourToTenths = (value: number, minimum = 0): number =>
    Math.max(minimum, roundMasterLmpHourToTenths(value));

const getScoringMatrixElementOptions = (phraseBank?: PhraseBank): string[] => {
    const seen = new Map<string, string>();
    const add = (value: string) => {
        const clean = String(value || '').trim();
        const key = clean.toLowerCase();
        if (!clean || SCORING_MATRIX_NON_ASSESSABLE_KEYS.has(key) || seen.has(key)) return;
        seen.set(key, clean);
    };
    const configuredElements = (phraseBank as any)?.[SCORING_MATRIX_ELEMENT_LIST_KEY];
    if (Array.isArray(configuredElements)) {
        configuredElements.forEach(add);
    } else {
        getConfiguredScoringMatrixElements(phraseBank).forEach(add);
        Object.keys(phraseBank || {}).forEach(key => {
            if (
                key !== SCORING_MATRIX_ELEMENT_LIST_KEY
                && key !== SCORING_MATRIX_ELEMENT_GROUPS_KEY
                && key !== SCORING_MATRIX_ELEMENT_SELECTION_VERSION_KEY
            ) add(key);
        });
    }
    return Array.from(seen.values());
};

const normaliseAssessedElements = (elements?: string[], availableElements: string[] = []): string[] => {
    const available = new Set(availableElements.map(item => item.toLowerCase()));
    const source = Array.isArray(elements) ? elements : availableElements;
    const selected = source
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .filter((item, index, arr) => arr.findIndex(candidate => candidate.toLowerCase() === item.toLowerCase()) === index)
        .filter(item => available.size === 0 || available.has(item.toLowerCase()));
    return selected;
};

const AssessedElementsWindow: React.FC<{
    selectedElements?: string[];
    availableElements: string[];
    isEditing: boolean;
    onChange: (elements: string[]) => void;
    onAddElement?: () => void;
}> = ({ selectedElements, availableElements, isEditing, onChange, onAddElement }) => {
    const selected = normaliseAssessedElements(selectedElements, availableElements);
    const selectedSet = new Set(selected.map(item => item.toLowerCase()));
    const toggle = (element: string) => {
        const isSelected = selectedSet.has(element.toLowerCase());
        const next = isSelected
            ? selected.filter(item => item.toLowerCase() !== element.toLowerCase())
            : [...selected, element];
        onChange(next);
    };

    return (
        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Assessed Elements</legend>
            <div className="mt-2 rounded-lg bg-gray-900/45 p-3">
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
const EditableField: React.FC<{ label: string; value: string | number; onChange: (value: string | number) => void; type?: string; step?: number; }> = ({ label, value, onChange, type = 'text', step }) => {
    const [draft, setDraft] = useState(String(value ?? ''));
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        if (!focused) setDraft(String(value ?? ''));
    }, [focused, value]);

    const commitDraft = () => {
        setFocused(false);
        if (type === 'number') {
            const nextValue = parseFloat(draft) || 0;
            if (nextValue !== Number(value || 0)) onChange(nextValue);
            return;
        }
        if (draft !== String(value ?? '')) onChange(draft);
    };

    return (
        <div className="bg-gray-700/50 p-3 rounded-lg">
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
            <input
                type={type}
                step={step}
                value={focused ? draft : String(value ?? '')}
                onBeforeInput={type === 'number' ? undefined : (event) => handleEditableTextBeforeInput(event, setDraft)}
                onKeyDownCapture={type === 'number' ? stopEditableKeyPropagation : (event) => handleEditableTextKeyDownCapture(event, setDraft)}
                onKeyDown={stopEditableKeyPropagation}
                onFocus={() => {
                    setFocused(true);
                    setDraft(String(value ?? ''));
                }}
                onBlur={commitDraft}
                onChange={(event) => setDraft(event.target.value)}
                className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-md shadow-sm py-1 px-2 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
            />
        </div>
    );
};

const EditableList: React.FC<{ title: string; items: string[]; onChange: (items: string[]) => void; }> = ({ title, items, onChange }) => {
    const formatItems = (value: string[]) => (value || []).join('\n');
    const [draft, setDraft] = useState(formatItems(items || []));
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        if (!focused) setDraft(formatItems(items || []));
    }, [focused, items]);

    const commitDraft = () => {
        setFocused(false);
        const currentValue = formatItems(items || []);
        if (draft !== currentValue) onChange(draft.split('\n'));
    };

    return (
        <div>
            <h3 className="text-md font-semibold text-sky-400 mb-2">{title}</h3>
            <textarea
                value={focused ? draft : formatItems(items || [])}
                onBeforeInput={(event) => handleEditableTextBeforeInput(event, setDraft)}
                onKeyDownCapture={(event) => handleEditableTextKeyDownCapture(event, setDraft)}
                onKeyDown={stopEditableKeyPropagation}
                onFocus={() => {
                    setFocused(true);
                    setDraft(formatItems(items || []));
                }}
                onBlur={commitDraft}
                onChange={(event) => setDraft(event.target.value)}
                rows={4}
                className="block w-full bg-gray-800 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                placeholder="One item per line"
            />
        </div>
    );
};

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
                <span>No aircraft configurations are defined for the active DFP resource rows.</span>
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
    heading?: string;
    title: string;
    emptyMessage?: string;
    showStaffAssignments?: boolean;
    staff: Instructor[];
    trainees?: Trainee[];
    lmpOptions?: Array<{ code: string; title: string }>;
    selectedLmpCode?: string;
    courseOptions?: string[];
    selectedCourseKeys?: Set<string>;
    selectedStaffIds: Set<number>;
    selectedTraineeIds?: Set<number>;
    saving: boolean;
    onToggle: (idNumber: number) => void;
    onToggleTrainee?: (idNumber: number) => void;
    onLmpChange?: (code: string) => void;
    onToggleCourse?: (course: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onSelectAllCourses?: () => void;
    onDeselectAllCourses?: () => void;
    onSelectAllTrainees?: () => void;
    onDeselectAllTrainees?: () => void;
    onDownloadTrace?: () => void;
    onCancel: () => void;
    onSave: () => void;
}> = ({
    heading = 'Assign Training',
    title,
    emptyMessage = 'No active squadron staff available for this unit.',
    showStaffAssignments = true,
    staff,
    trainees = [],
    lmpOptions = [],
    selectedLmpCode = '',
    courseOptions = [],
    selectedCourseKeys = new Set(),
    selectedStaffIds,
    selectedTraineeIds = new Set(),
    saving,
    onToggle,
    onToggleTrainee,
    onLmpChange,
    onToggleCourse,
    onSelectAll,
    onDeselectAll,
    onSelectAllCourses,
    onDeselectAllCourses,
    onSelectAllTrainees,
    onDeselectAllTrainees,
    onDownloadTrace,
    onCancel,
    onSave,
}) => {
    const showTraineeAssignments = Boolean(onToggleTrainee);
    const lmpSelectionVisible = showTraineeAssignments && Boolean(onLmpChange);
    const lmpSelectionEnabled = lmpOptions.length > 1;
    const courseSelectionEnabled = showTraineeAssignments && courseOptions.length > 1 && Boolean(onToggleCourse);
    const panelCount = (showStaffAssignments ? 1 : 0) + (showTraineeAssignments ? 1 : 0);
    const traineeGroups = trainees.reduce<Array<{ course: string; people: Trainee[] }>>((groups, person) => {
        const course = String(person.course || 'No course').trim() || 'No course';
        const existingGroup = groups.find(group => group.course === course);
        if (existingGroup) {
            existingGroup.people.push(person);
        } else {
            groups.push({ course, people: [person] });
        }
        return groups;
    }, []);
    const formatCourseHeading = (course: string): string => course === 'No course' ? 'No course' : `Course ${course}`;
    const selectedVisibleTraineeCount = trainees.filter(person => selectedTraineeIds.has(person.idNumber)).length;
    const savingMessage = showTraineeAssignments
        ? 'Assigning LMP to course participants'
        : 'Saving training assignments';
    const savingDetail = showTraineeAssignments
        ? 'Creating Individual LMPs. This may take a moment.'
        : 'Updating selected staff assignments. This may take a moment.';

    const staffPanel = (
        <section className="min-w-0 overflow-hidden rounded-lg border border-gray-700 bg-gray-950/40">
            <div className="border-b border-sky-800/70 bg-sky-950/50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-sky-100">Staff</h3>
                    <span className="rounded-full border border-sky-700/70 bg-sky-900/50 px-2.5 py-1 text-xs font-bold text-sky-100">{selectedStaffIds.size} selected</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={onSelectAll} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:bg-gray-700">Select All</button>
                    <button type="button" onClick={onDeselectAll} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:bg-gray-700">Deselect All</button>
                </div>
            </div>
            <div className={showTraineeAssignments ? 'max-h-[54vh] overflow-y-auto' : 'max-h-[420px] overflow-y-auto'}>
                {staff.length === 0 ? (
                    <div className="p-4 text-sm italic text-gray-500">{emptyMessage}</div>
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
        </section>
    );

    const traineePanel = onToggleTrainee ? (
        <section className="min-w-0 overflow-hidden rounded-lg border border-gray-700 bg-gray-950/40">
            <div className="border-b border-teal-800/70 bg-teal-950/40 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-teal-100">Trainees</h3>
                    <span className="rounded-full border border-teal-700/70 bg-teal-900/50 px-2.5 py-1 text-xs font-bold text-teal-100">{selectedVisibleTraineeCount} selected</span>
                </div>
                {lmpSelectionVisible && (
                    <div className="mt-3 rounded border border-sky-800/60 bg-gray-950/35 p-3">
                        <label className="block text-[11px] font-extrabold uppercase tracking-[0.18em] text-sky-200">
                            Master LMP to Assign
                        </label>
                        <select
                            value={selectedLmpCode}
                            onChange={(event) => onLmpChange?.(event.target.value)}
                            disabled={!lmpSelectionEnabled}
                            className="mt-2 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm font-semibold text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-80"
                        >
                            {lmpOptions.length === 0 && (
                                <option value={selectedLmpCode}>
                                    {selectedLmpCode || 'No Master LMP available'}
                                </option>
                            )}
                            {lmpOptions.map(option => (
                                <option key={option.code} value={option.code}>
                                    {option.title && option.title !== option.code ? `${option.code} - ${option.title}` : option.code}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {courseSelectionEnabled && (
                    <div className="mt-3 rounded border border-teal-800/60 bg-gray-950/35 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <h4 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-teal-200">Courses</h4>
                            <span className="text-xs font-semibold text-gray-300">{selectedCourseKeys.size} selected</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button" onClick={onSelectAllCourses} className="rounded border border-gray-600 bg-gray-800 px-2.5 py-1 text-[11px] font-semibold text-gray-100 hover:bg-gray-700">Select All Courses</button>
                            <button type="button" onClick={onDeselectAllCourses} className="rounded border border-gray-600 bg-gray-800 px-2.5 py-1 text-[11px] font-semibold text-gray-100 hover:bg-gray-700">Deselect All Courses</button>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {courseOptions.map(course => (
                                <label key={course} className="flex cursor-pointer items-center gap-2 rounded border border-gray-700 bg-gray-900/70 px-2.5 py-1.5 text-xs text-gray-100 hover:border-teal-600/70">
                                    <input
                                        type="checkbox"
                                        checked={selectedCourseKeys.has(course)}
                                        onChange={() => onToggleCourse?.(course)}
                                        className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-sky-500"
                                    />
                                    <span className="font-semibold">{formatCourseHeading(course)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={onSelectAllTrainees} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:bg-gray-700">Select All</button>
                    <button type="button" onClick={onDeselectAllTrainees} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:bg-gray-700">Deselect All</button>
                </div>
            </div>
            <div className="max-h-[54vh] overflow-y-auto">
                {trainees.length === 0 ? (
                    <div className="p-4 text-sm italic text-gray-500">No active trainees available for this unit.</div>
                ) : traineeGroups.map(group => (
                    <div key={group.course} className="border-b border-gray-800 last:border-b-0">
                        <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-teal-200">
                            {formatCourseHeading(group.course)}
                        </div>
                        {group.people.map(person => (
                            <label key={person.idNumber} className="flex cursor-pointer items-center gap-3 border-b border-gray-800 px-3 py-2 text-sm last:border-b-0 hover:bg-gray-800/70">
                                <input
                                    type="checkbox"
                                    checked={selectedTraineeIds.has(person.idNumber)}
                                    onChange={() => onToggleTrainee(person.idNumber)}
                                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-sky-500"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-semibold text-white">{person.rank} {person.name}</span>
                                    <span className="block text-xs text-gray-400">{person.flight || 'No flight'}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                ))}
            </div>
        </section>
    ) : null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4">
            <div className={`relative flex max-h-[90vh] w-full flex-col rounded-lg border border-sky-700/50 bg-gray-900 shadow-2xl ${panelCount > 1 ? 'max-w-5xl' : 'max-w-2xl'}`}>
                {saving && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-black/75 px-4">
                        <div className="w-full max-w-md rounded-lg border border-sky-600/70 bg-gray-900 px-6 py-5 text-center shadow-2xl">
                            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-sky-900 border-t-sky-300" />
                            <h3 className="mt-4 text-lg font-extrabold text-white">{savingMessage}</h3>
                            <p className="mt-2 text-sm font-medium text-gray-300">{savingDetail}</p>
                            {showTraineeAssignments && (
                                <p className="mt-3 rounded border border-teal-700/60 bg-teal-950/40 px-3 py-2 text-xs font-semibold text-teal-100">
                                    {selectedVisibleTraineeCount} selected trainee{selectedVisibleTraineeCount === 1 ? '' : 's'} · {selectedLmpCode || 'Selected LMP'}
                                </p>
                            )}
                        </div>
                    </div>
                )}
                <div className="flex items-start justify-between gap-4 border-b border-gray-700 px-4 py-3">
                    <div>
                        <h2 className="text-lg font-bold text-white">{heading}</h2>
                        <p className="mt-1 text-xs text-gray-400">{title}</p>
                    </div>
                    <button type="button" onClick={onCancel} disabled={saving} className="rounded px-2 py-1 text-sm text-gray-300 hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Close</button>
                </div>
                <div className="overflow-y-auto p-4">
                    {panelCount > 1 ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {showStaffAssignments && staffPanel}
                            {traineePanel}
                        </div>
                    ) : showStaffAssignments ? staffPanel : traineePanel}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-700 px-4 py-3">
                    <div>
                        {onDownloadTrace && (
                            <button type="button" onClick={onDownloadTrace} className="rounded border border-amber-600/60 bg-amber-900/30 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-800/40">
                                Download Assign LMP Trace
                            </button>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onCancel} disabled={saving} className="rounded border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
                        <button type="button" onClick={onSave} disabled={saving} className="rounded border border-sky-500 bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60">
                            {saving ? 'Saving...' : 'Save Assignments'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

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
    isAddingEvent?: boolean;
    editedItem: SyllabusItemDetail | null;
    onItemChange: (newItem: SyllabusItemDetail) => void;
    onDeleteEvent?: (item: SyllabusItemDetail) => void;
    onEdit?: () => void;
    editDisabled?: boolean;
    onSave?: () => void | Promise<void>;
    onCancel?: () => void;
    saveDisabled?: boolean;
    isSaving?: boolean;
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
    collectionTitle?: string;
    codeExample?: string;
    descriptionExample?: string;
}> = ({ item, isEditing, isAddingEvent = false, editedItem, onItemChange, onDeleteEvent, onEdit, editDisabled = false, onSave, onCancel, saveDisabled = false, isSaving = false, resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES, aircraftConfigurations = [], aircraftCrewComposition, crewPositionTerminology, instructorsData = [], activeUnitCode = '', isAirCombatModel = false, operationalModel = 'flight_school', staffQualificationCatalogue, scoringMatrixElements = DEFAULT_ASSESSED_ELEMENTS, onAddScoringMatrixElement, linkedEventOptions = [], linkedEventOverrides = {}, onLinkedEventChange, collectionTitle = 'this Master LMP', codeExample = '', descriptionExample = '' }) => {
    
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
        let normalisedValue = value;
        if (field === 'totalEventHours') normalisedValue = clampMasterLmpHourToTenths(value, 0.3);
        if (field === 'flightOrSimHours') normalisedValue = clampMasterLmpHourToTenths(value, 0);
        const updatedItem = { ...editedItem, [field]: normalisedValue };
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
    const showAssessmentRequiredControl = operationalModel === 'flight_school' || isAirCombatModel || isFixedCrewModel;
    const testEventType = currentItem.testEventType || 'NONE';
    const isTestEvent = testEventType !== 'NONE';
    const testingOfficerQualifications = getQualificationsForOperationalModel(
        staffQualificationCatalogue,
        normaliseOperationalModel(operationalModel),
    );
    const selectedTestingOfficerQualification = testingOfficerQualifications.find(qualification => (
        qualification.id === currentItem.testingOfficerQualificationId
    ));
    const cleanCodeExample = String(codeExample || '').trim();
    const cleanDescriptionExample = String(descriptionExample || '').trim();
    const addEventCodeHelp = cleanCodeExample
        ? `Code is the short event identifier used in scheduling, prerequisites and reports. Example already saved in ${collectionTitle}: ${cleanCodeExample}.`
        : `Code is the short event identifier used in scheduling, prerequisites and reports. Use the same style as the other events in ${collectionTitle}.`;
    const addEventDescriptionHelp = cleanDescriptionExample
        ? `Event Description is the plain English name of this one event. Example already saved in ${collectionTitle}: ${cleanDescriptionExample}.`
        : `Event Description is the plain English name of this one event. It should describe what the crew or trainee will do in this event.`;
    const AddEventHelp: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <p className="mt-2 rounded-md border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs leading-relaxed text-cyan-100">
            {children}
        </p>
    );
    const sortieDetailsSummary = (currentItem.eventDetailsSortie || [])
        .map(detail => String(detail || '').trim())
        .filter(Boolean)
        .join(', ');

    return (
    <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
                {isEditing ? (
                    <>
                        <EditableField label={isAddingEvent ? 'Event Code' : 'Code'} value={currentItem.code} onChange={(val) => handleFieldChange('code', val)} />
                        {isAddingEvent && <AddEventHelp>{addEventCodeHelp}</AddEventHelp>}
                    </>
                ) : (
                    <h2 className="text-3xl font-bold text-white">{item.code}</h2>
                )}
                 {isEditing ? (
                    <div className="mt-2">
                        <EditableField label="Event Description" value={currentItem.eventDescription} onChange={(val) => handleFieldChange('eventDescription', val)} />
                        {isAddingEvent && <AddEventHelp>{addEventDescriptionHelp}</AddEventHelp>}
                    </div>
                ) : (
                    <p className="text-lg text-gray-400 mt-1">{sortieDetailsSummary || 'No sortie details recorded'}</p>
                )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {isEditing && (
                <>
                    <button
                        type="button"
                        onClick={() => { void onSave?.(); }}
                        disabled={saveDisabled || isSaving}
                        className="h-[41px] min-w-[56px] rounded-md px-3 py-1 text-[10px] font-semibold text-black btn-aluminium-brushed disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-[41px] min-w-[56px] rounded-md px-3 py-1 text-[10px] font-semibold btn-aluminium-brushed"
                    >
                        Cancel
                    </button>
                </>
            )}
            {!isEditing && onEdit && (
                <button
                    type="button"
                    onClick={onEdit}
                    disabled={editDisabled}
                    className="h-[41px] min-w-[56px] rounded-md px-3 py-1 text-[10px] font-semibold btn-aluminium-brushed disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Edit
                </button>
            )}
            {showAssessmentRequiredControl && (
                <label
                    className={`mt-1 flex shrink-0 items-center gap-2 rounded border px-3 py-2 text-xs font-semibold ${
                        isEditing
                            ? 'cursor-pointer border-gray-600 bg-gray-900/60 text-gray-200 hover:border-sky-600/70'
                            : 'border-gray-700 bg-gray-900/30 text-gray-400'
                    }`}
                    title="Creates a draft training report after completed post-flight entry."
                >
                    <input
                        type="checkbox"
                        checked={currentItem.assessmentRequired === true}
                        disabled={!isEditing}
                        onChange={(event) => handleFieldChange('assessmentRequired', event.target.checked)}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-sky-500 disabled:opacity-70"
                    />
                    <span>Assessment required</span>
                </label>
            )}
            </div>
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
                                min="0.3"
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
                                min="0"
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
        <fieldset className="p-3 border border-gray-700 rounded-lg">
            <legend className="px-2 text-xs font-semibold text-gray-300">Test Event Scheduling</legend>
            {isEditing ? (
                <div className="grid gap-3 mt-2 md:grid-cols-2">
                    <label className="block">
                        <span className="block text-xs font-semibold text-gray-300">Test event type</span>
                        <select
                            value={testEventType}
                            onChange={(event) => {
                                const nextType = event.target.value as SyllabusItemDetail['testEventType'];
                                onItemChange({
                                    ...currentItem,
                                    testEventType: nextType,
                                    testingOfficerQualificationId: nextType === 'NONE'
                                        ? null
                                        : currentItem.testingOfficerQualificationId,
                                    useTestingOfficerSecondaryCallsign: nextType === 'FLIGHT_TEST'
                                        ? currentItem.useTestingOfficerSecondaryCallsign === true
                                        : false,
                                });
                            }}
                            className="mt-1 block w-full rounded border border-gray-600 bg-gray-800 px-2 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        >
                            <option value="NONE">Not a test event</option>
                            <option value="FLIGHT_TEST">Flight Test</option>
                            <option value="SIMULATOR_TEST">Simulator Test</option>
                        </select>
                        <span className="mt-1 block text-xs text-gray-500">
                            Identifies whether this event requires a specifically qualified Testing Officer.
                        </span>
                    </label>
                    <label className={`block ${isTestEvent ? '' : 'opacity-50'}`}>
                        <span className="block text-xs font-semibold text-gray-300">Testing Officer qualification</span>
                        <select
                            value={currentItem.testingOfficerQualificationId || ''}
                            disabled={!isTestEvent}
                            onChange={(event) => handleFieldChange('testingOfficerQualificationId', event.target.value || null)}
                            className="mt-1 block w-full rounded border border-gray-600 bg-gray-800 px-2 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed"
                        >
                            <option value="">Select one qualification</option>
                            {testingOfficerQualifications.map(qualification => (
                                <option key={qualification.id} value={qualification.id}>
                                    {qualification.name}{qualification.code ? ` (${qualification.code})` : ''}
                                </option>
                            ))}
                        </select>
                        <span className="mt-1 block text-xs text-gray-500">
                            The one test qualification required for this event. Staff may also hold other general qualifications.
                        </span>
                    </label>
                    {testEventType === 'FLIGHT_TEST' && (
                        <label className="flex items-start gap-2 rounded border border-gray-700 bg-gray-900/40 p-3 md:col-span-2">
                            <input
                                type="checkbox"
                                checked={currentItem.useTestingOfficerSecondaryCallsign === true}
                                onChange={(event) => handleFieldChange('useTestingOfficerSecondaryCallsign', event.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-sky-500"
                            />
                            <span>
                                <span className="block text-xs font-semibold text-gray-200">Use secondary callsign for this event</span>
                                <span className="mt-1 block text-xs text-gray-500">
                                    Uses the selected Testing Officer's Secondary Callsign for this Flight Test.
                                </span>
                            </span>
                        </label>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2 mt-2 md:grid-cols-3">
                    <DetailCard
                        label="Test Event Type"
                        value={testEventType === 'FLIGHT_TEST' ? 'Flight Test' : testEventType === 'SIMULATOR_TEST' ? 'Simulator Test' : 'Not a test'}
                    />
                    <DetailCard
                        label="Testing Officer Qualification"
                        value={isTestEvent ? (selectedTestingOfficerQualification?.name || 'Not configured') : 'N/A'}
                    />
                    <DetailCard
                        label="Secondary Callsign"
                        value={testEventType === 'FLIGHT_TEST'
                            ? (currentItem.useTestingOfficerSecondaryCallsign ? 'Use secondary callsign for this event' : 'Do not use')
                            : 'N/A'}
                    />
                </div>
            )}
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
                       <>
                           <EditableField label="Event Description" value={currentItem.eventDescription} onChange={(val) => handleFieldChange('eventDescription', val)} />
                           {isAddingEvent && <AddEventHelp>{addEventDescriptionHelp}</AddEventHelp>}
                       </>
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
                        <GroupEventEditor item={currentItem} onChange={handleFieldChange} />
                    </>
                ) : (
                    <>
                        <DetailList title="Methods of Delivery" items={item.methodOfDelivery} />
                        <DetailList title="Methods of Assessment" items={item.methodOfAssessment} />
                        <DetailList title="Event Details (Common)" items={item.eventDetailsCommon} />
                        <DetailList title="Event Details (Sortie)" items={item.eventDetailsSortie} />
                        <GroupEventSummary item={item} />
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
    traineesData = [],
    onUpdateTrainee,
    onAssignTraineeLmp,
    onTraceAssignLmp,
    onDownloadAssignmentTrace,
    currentUserName,
    scoringMatrixPhraseBank,
    onAddScoringMatrixElement,
    onNavigateToSettingsSection,
    onDeleteMasterLmpCatalogue,
    onUpsertMasterLmpCatalogue,
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
  const [editingCourseAudience, setEditingCourseAudience] = useState<LmpAudience>('trainee');
  const [isAddingLmpEvent, setIsAddingLmpEvent] = useState(false);
  const isTrainingPackagesTab = activeTab === 'packages';
  const activeLmpType = getActiveLmpType(activeTab);
  const activeCollectionNoun = isTrainingPackagesTab ? 'package' : 'course';
  const activeCollectionTitle = isTrainingPackagesTab ? 'Training Packages' : 'Master LMP';
  const activeCollectionSelectLabel = isTrainingPackagesTab ? 'Package:' : 'Course:';
  const activeOperationalModel = normaliseOperationalModel(operationalModel);
  const isAirCombatModel = activeOperationalModel === 'air_combat';
  const isFlightSchoolModel = activeOperationalModel === 'flight_school';
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
  const [assignTraineeSelection, setAssignTraineeSelection] = useState<Set<number>>(new Set());
  const [assignLmpCode, setAssignLmpCode] = useState('');
  const [assignCourseSelection, setAssignCourseSelection] = useState<Set<string>>(new Set());
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
  const selectedMasterLmpCatalogueEntry = useMemo(() => (
    activeTab === 'master'
      ? activeMasterLmpCatalogue.find(entry => String(entry.code || '').trim().toUpperCase() === String(selectedCourseType || '').trim().toUpperCase()) || null
      : null
  ), [activeMasterLmpCatalogue, activeTab, selectedCourseType]);
  const selectedCourseAudience = useMemo(() => (
    getLmpAudienceForCourse(unitScopedSyllabusDetails, selectedCourseType, {
      activeTab,
      operationalModel: activeOperationalModel,
      lmpType: activeLmpType,
      catalogueAudience: selectedMasterLmpCatalogueEntry?.audience,
    })
  ), [activeLmpType, activeOperationalModel, activeTab, selectedCourseType, selectedMasterLmpCatalogueEntry?.audience, unitScopedSyllabusDetails]);
  const selectedCourseAllowsStaff = selectedCourseAudience === 'staff';
  const selectedCourseAllowsTrainees = selectedCourseAudience === 'trainee';
  const normaliseContextCode = (value?: string | null): string => String(value || '').trim().toUpperCase();
  const selectedCollectionDeleteItems = useMemo(() => (
      unitScopedSyllabusDetails.filter(item =>
          item.isActive !== false &&
          getItemLmpDetailsTab(item) === activeTab &&
          (item.courses || []).includes(selectedCourseType)
      )
  ), [activeTab, selectedCourseType, unitScopedSyllabusDetails]);
  const selectedCourseVersion = useMemo(() => {
      const shellVersion = selectedCollectionDeleteItems
          .filter(isSyllabusCourseShell)
          .map(item => getLmpVersionFromNotes(item.notes))
          .find(Boolean);
      if (shellVersion) return shellVersion;

      const itemVersion = selectedCollectionDeleteItems
          .map(item => getLmpVersionFromNotes(item.notes))
          .find(Boolean);
      return itemVersion || DEFAULT_LMP_VERSION;
  }, [selectedCollectionDeleteItems]);
  const selectedCollectionAssignedTrainees = useMemo(() => {
      const selectedKey = normaliseContextCode(selectedCourseType);
      if (!selectedKey) return [];
      return traineesData.filter(trainee =>
          normaliseContextCode(trainee.lmpType) === selectedKey ||
          normaliseContextCode((trainee as any).academicLmpType) === selectedKey
      );
  }, [selectedCourseType, traineesData]);
  const deleteConfirmationPhrase = selectedCourseType ? `DELETE ${selectedCourseType}` : '';
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
          const existing = JSON.parse(window.localStorage.getItem('dfp_setup_test_lmp_diag') || '[]');
          const next = [...(Array.isArray(existing) ? existing : []), entry].slice(-500);
          window.localStorage.setItem('dfp_setup_test_lmp_diag', JSON.stringify(next));
          (window as any).neoSetupTestLmpDiag = next;
      } catch {
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
  const [newLMPAudience, setNewLMPAudience] = useState<LmpAudience>(() => getDefaultLmpAudience({
      activeTab,
      operationalModel: activeOperationalModel,
      lmpType: activeLmpType,
  }));
  const [addPackageMode, setAddPackageMode] = useState<'blank' | 'copy'>('blank');
  const [copyPackageSourceKey, setCopyPackageSourceKey] = useState('');
  const [isCopyingPackage, setIsCopyingPackage] = useState(false);

  // Delete Course modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletePasswordVerified, setDeletePasswordVerified] = useState(false);

  // Bulk Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadDragActive, setIsUploadDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'update' | 'replace' | 'create'>('update');
  const [masterUploadIntent, setMasterUploadIntent] = useState<'new' | 'update' | null>(null);
  const [uploadTargetLmpCode, setUploadTargetLmpCode] = useState('');
  const [uploadLmpVersion, setUploadLmpVersion] = useState(DEFAULT_LMP_VERSION);
  const [lmpUpdateReviewMode, setLmpUpdateReviewMode] = useState<'automatic' | 'one-by-one'>('automatic');
  const [uploadReview, setUploadReview] = useState<any | null>(null);
  const [showUploadOneByOneReview, setShowUploadOneByOneReview] = useState(false);
  const [showUploadFinalWarning, setShowUploadFinalWarning] = useState(false);
  const [oneByOneSelectedTraineeKey, setOneByOneSelectedTraineeKey] = useState('');
  const [oneByOneCurrentLmp, setOneByOneCurrentLmp] = useState<any | null>(null);
  const [oneByOneLmpLoading, setOneByOneLmpLoading] = useState(false);
  const [oneByOneLmpError, setOneByOneLmpError] = useState('');
  const oneByOneCurrentListRef = useRef<HTMLDivElement | null>(null);
  const oneByOneProposedListRef = useRef<HTMLDivElement | null>(null);
  const [newUploadPackageName, setNewUploadPackageName] = useState('');
  const [uploadResult, setUploadResult] = useState<{ created: number; updated?: number; imported?: number; skipped: number; errors: any[]; message: string; preview?: any; individualLmpSync?: any; dryRun?: boolean; uploadTrace?: any } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<any | null>(null);
  const [isCrossLoadingDuplicateCourse, setIsCrossLoadingDuplicateCourse] = useState(false);

  useEffect(() => {
      const operationId = String(uploadProgress?.operationId || '').trim();
      if (!isUploading || !operationId) return;
      let cancelled = false;
      let timer: number | null = null;

      const pollProgress = async () => {
          try {
              const sessionToken = localStorage.getItem('dfp_session_token') || '';
              const response = await fetch(`/api/syllabus/bulk-upload/progress/${encodeURIComponent(operationId)}`, {
                  credentials: 'include',
                  headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
              });
              const data = await response.json().catch(() => null);
              if (!cancelled && response.ok && data) {
                  setUploadProgress(data);
              }
          } catch (_error) {
              // Keep the upload running. A missed poll should not stop the actual import.
          } finally {
              if (!cancelled) {
                  timer = window.setTimeout(pollProgress, 1000);
              }
          }
      };

      pollProgress();
      return () => {
          cancelled = true;
          if (timer !== null) window.clearTimeout(timer);
      };
  }, [isUploading, uploadProgress?.operationId]);

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
  const addEventExamples = useMemo(() => {
      const selectedItemId = selectedItem?.id || editedItem?.id || '';
      const savedEvents = filteredSyllabusDetails
          .filter(item => item.id !== selectedItemId)
          .filter(item => !String(item.id || '').startsWith('new-'))
          .filter(item => String(item.code || item.eventDescription || '').trim());
      return {
          code: String(savedEvents.find(item => String(item.code || '').trim())?.code || '').trim(),
          description: String(savedEvents.find(item => String(item.eventDescription || '').trim())?.eventDescription || '').trim(),
      };
  }, [editedItem?.id, filteredSyllabusDetails, selectedItem?.id]);
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
  const activeTrainingAssignmentItem = useMemo(() => (
      filteredSyllabusDetails[0] || selectedItem || null
  ), [filteredSyllabusDetails, selectedItem]);

  const activeAirCombatTrainingAssignment = useMemo(() => {
      if (!isAirCombatModel || !activeTrainingAssignmentItem || !selectedCourseType) return null;
      return getAirCombatAssignmentFromItem(
          { ...activeTrainingAssignmentItem, courses: [selectedCourseType] },
          activeLocationCode,
          effectiveActiveUnitCode,
          currentUserName,
      );
  }, [activeTrainingAssignmentItem, activeLocationCode, effectiveActiveUnitCode, currentUserName, isAirCombatModel, selectedCourseType]);

  const activeFlightSchoolLmpAssignment = useMemo(() => {
      if (!isFlightSchoolModel || isTrainingPackagesTab || !activeTrainingAssignmentItem || !selectedCourseType) return null;
      return getFlightSchoolStaffLmpAssignmentFromItem(
          { ...activeTrainingAssignmentItem, courses: [selectedCourseType] },
          selectedCourseType,
          activeLocationCode,
          effectiveActiveUnitCode,
          currentUserName,
      );
  }, [activeTrainingAssignmentItem, activeLocationCode, effectiveActiveUnitCode, currentUserName, isFlightSchoolModel, isTrainingPackagesTab, selectedCourseType]);

  const activeStaffTrainingAssignment = activeAirCombatTrainingAssignment || activeFlightSchoolLmpAssignment;
  const isAssigningFlightSchoolLmp = Boolean(activeFlightSchoolLmpAssignment && !activeAirCombatTrainingAssignment);
  const showStaffInAssignTraining = !isAssigningFlightSchoolLmp || selectedCourseAllowsStaff;
  const showTraineesInAssignTraining = isAssigningFlightSchoolLmp && selectedCourseAllowsTrainees;

  const assignLmpOptions = useMemo(() => {
      const options = new Map<string, { code: string; title: string }>();
      courseLMPs.forEach(code => {
          const cleanCode = String(code || '').trim();
          if (!cleanCode) return;
          options.set(cleanCode.toUpperCase(), {
              code: cleanCode,
              title: getCourseTitle(cleanCode),
          });
      });
      activeMasterLmpCatalogue.forEach(entry => {
          const cleanCode = String(entry.code || '').trim();
          if (!cleanCode || options.has(cleanCode.toUpperCase())) return;
          options.set(cleanCode.toUpperCase(), {
              code: cleanCode,
              title: String(entry.name || cleanCode).trim() || cleanCode,
          });
      });
      return Array.from(options.values())
          .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
  }, [activeMasterLmpCatalogue, courseLMPs, getCourseTitle]);

  const assignFlightSchoolLmpAssignment = useMemo(() => {
      if (!isFlightSchoolModel || isTrainingPackagesTab || !activeTrainingAssignmentItem) return activeFlightSchoolLmpAssignment;
      const code = String(assignLmpCode || activeFlightSchoolLmpAssignment?.lmpCode || selectedCourseType || '').trim();
      if (!code) return activeFlightSchoolLmpAssignment;
      const title = assignLmpOptions.find(option => option.code.toUpperCase() === code.toUpperCase())?.title || getCourseTitle(code);
      return {
          ...getFlightSchoolStaffLmpAssignmentFromItem(
              { ...activeTrainingAssignmentItem, courses: [code], module: title },
              code,
              activeLocationCode,
              effectiveActiveUnitCode,
              currentUserName,
          ),
          title,
      };
  }, [
      activeFlightSchoolLmpAssignment,
      activeLocationCode,
      activeTrainingAssignmentItem,
      assignLmpCode,
      assignLmpOptions,
      currentUserName,
      effectiveActiveUnitCode,
      getCourseTitle,
      isFlightSchoolModel,
      isTrainingPackagesTab,
      selectedCourseType,
  ]);

  const assignableTrainingStaff = useMemo(() => {
      if (!isAirCombatModel && !isFlightSchoolModel) return [];
      if (isFlightSchoolModel && !selectedCourseAllowsStaff) return [];
      const targetUnit = String(effectiveActiveUnitCode || '').trim().toUpperCase();
      const targetUnits = new Set(targetUnit.split(/[+,&/]+/).map(unit => unit.trim()).filter(Boolean));
      return instructorsData
          .filter(staff => staff && staff.name && !staff.isAdminStaff)
          .filter(staff => {
              if (!targetUnit) return true;
              const staffUnit = String(staff.unit || '').trim().toUpperCase();
              return staffUnit === targetUnit || targetUnits.has(staffUnit);
          })
          .sort((a, b) => a.name.localeCompare(b.name));
  }, [effectiveActiveUnitCode, instructorsData, isAirCombatModel, isFlightSchoolModel, selectedCourseAllowsStaff]);

  const assignableFlightSchoolTrainees = useMemo(() => {
      if (!isFlightSchoolModel || isTrainingPackagesTab || !selectedCourseAllowsTrainees) return [];
      const targetUnit = String(effectiveActiveUnitCode || '').trim().toUpperCase();
      const targetUnits = new Set(targetUnit.split(/[+,&/]+/).map(unit => unit.trim()).filter(Boolean));
      return traineesData
          .filter(trainee => trainee && trainee.name && !trainee.isPaused)
          .filter(trainee => {
              if (!targetUnit) return true;
              const traineeUnit = String(trainee.unit || '').trim().toUpperCase();
              return traineeUnit === targetUnit || targetUnits.has(traineeUnit);
          })
          .sort((a, b) => a.name.localeCompare(b.name));
  }, [effectiveActiveUnitCode, isFlightSchoolModel, isTrainingPackagesTab, selectedCourseAllowsTrainees, traineesData]);

  const assignableFlightSchoolTraineeCourses = useMemo(() => {
      const courses = new Set<string>();
      assignableFlightSchoolTrainees.forEach(trainee => {
          courses.add(String(trainee.course || 'No course').trim() || 'No course');
      });
      return Array.from(courses).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [assignableFlightSchoolTrainees]);

  const courseFilteredAssignableFlightSchoolTrainees = useMemo(() => {
      if (!showTraineesInAssignTraining) return [];
      if (assignCourseSelection.size === 0) return [];
      return assignableFlightSchoolTrainees.filter(trainee => {
          const course = String(trainee.course || 'No course').trim() || 'No course';
          return assignCourseSelection.has(course);
      });
  }, [assignCourseSelection, assignableFlightSchoolTrainees, showTraineesInAssignTraining]);

  const oneByOneUploadTrainees = useMemo(() => {
      const targetLmp = String(uploadTargetLmpCode || selectedCourseType || '').trim().toUpperCase();
      if (!targetLmp) return [];
      return assignableFlightSchoolTrainees
          .filter(trainee => String(trainee.lmpType || '').trim().toUpperCase() === targetLmp)
          .sort((a, b) => String(a.name || a.fullName || '').localeCompare(String(b.name || b.fullName || ''), undefined, { sensitivity: 'base' }));
  }, [assignableFlightSchoolTrainees, selectedCourseType, uploadTargetLmpCode]);

  const oneByOneSelectedTrainee = useMemo(() => {
      return oneByOneUploadTrainees.find(trainee => String((trainee as any).id || trainee.idNumber || trainee.fullName || trainee.name) === oneByOneSelectedTraineeKey) || oneByOneUploadTrainees[0] || null;
  }, [oneByOneSelectedTraineeKey, oneByOneUploadTrainees]);

  const oneByOneUploadEvents = useMemo(() => {
      const traceRows = uploadReview?.uploadTrace?.rowScan?.uploadedEventRows;
      if (Array.isArray(traceRows) && traceRows.length > 0) return traceRows;
      const previewRows = uploadReview?.preview?.uploadedEvents;
      if (Array.isArray(previewRows) && previewRows.length > 0) return previewRows;
      const firstRows = uploadReview?.uploadTrace?.rowScan?.firstEventRows;
      if (Array.isArray(firstRows) && firstRows.length > 0) return firstRows;
      const previewCodes = uploadReview?.preview?.uploadedEventCodes;
      if (Array.isArray(previewCodes)) return previewCodes.map((code, index) => ({ row: index + 1, eventCode: String(code || '').trim() })).filter(row => row.eventCode);
      return [];
  }, [uploadReview]);

  const oneByOneCurrentEvents = useMemo(() => {
      return Array.isArray(oneByOneCurrentLmp?.events) ? oneByOneCurrentLmp.events : [];
  }, [oneByOneCurrentLmp]);

  const oneByOneCompletedTokens = useMemo(() => {
      return new Set((Array.isArray(oneByOneCurrentLmp?.completedEventIds) ? oneByOneCurrentLmp.completedEventIds : [])
          .map(value => String(value || '').replace('*', '').trim().toUpperCase())
          .filter(Boolean));
  }, [oneByOneCurrentLmp]);

  const oneByOneLastCompletedIndex = useMemo(() => {
      let lastIndex = -1;
      oneByOneCurrentEvents.forEach((event: any, index: number) => {
          const tokens = [event?.id, event?.code, event?.masterEventId, event?.eventDescription, event?.title]
              .map(value => String(value || '').replace('*', '').trim().toUpperCase())
              .filter(Boolean);
          if (tokens.some(token => oneByOneCompletedTokens.has(token))) lastIndex = index;
      });
      return lastIndex;
  }, [oneByOneCompletedTokens, oneByOneCurrentEvents]);

  const oneByOneLastCompletedCode = oneByOneLastCompletedIndex >= 0
      ? String(oneByOneCurrentEvents[oneByOneLastCompletedIndex]?.code || oneByOneCurrentEvents[oneByOneLastCompletedIndex]?.eventDescription || '').trim()
      : '';

  const oneByOneProtectedNewIndex = useMemo(() => {
      if (!oneByOneLastCompletedCode) return -1;
      const token = oneByOneLastCompletedCode.toUpperCase();
      const matchedIndex = oneByOneUploadEvents.findIndex((event: any) => String(event?.eventCode || event?.code || '').trim().toUpperCase() === token);
      return matchedIndex >= 0 ? matchedIndex : Math.min(oneByOneLastCompletedIndex, oneByOneUploadEvents.length - 1);
  }, [oneByOneLastCompletedCode, oneByOneLastCompletedIndex, oneByOneUploadEvents]);

  const oneByOneProposalRows = useMemo(() => {
      const currentByCode = new Map<string, { event: any; index: number }>();
      oneByOneCurrentEvents.forEach((event: any, index: number) => {
          const code = String(event?.code || event?.eventCode || '').trim().toUpperCase();
          if (code) currentByCode.set(code, { event, index });
      });
      const uploadedCodeSet = new Set(
          oneByOneUploadEvents
              .map((event: any) => String(event?.eventCode || event?.code || '').trim().toUpperCase())
              .filter(Boolean)
      );
      const deletedCurrentRows = oneByOneCurrentEvents
          .map((event: any, index: number) => ({
              event,
              index,
              code: String(event?.code || event?.eventCode || '').trim(),
          }))
          .filter(row => row.index > oneByOneLastCompletedIndex)
          .filter(row => row.code && !uploadedCodeSet.has(row.code.toUpperCase()))
          .sort((left, right) => left.index - right.index);
      const rows: any[] = [];
      let deletedCursor = 0;
      let lastMatchedCurrentIndex = oneByOneLastCompletedIndex;
      const appendDeletedBefore = (currentIndexLimit: number) => {
          while (deletedCursor < deletedCurrentRows.length && deletedCurrentRows[deletedCursor].index < currentIndexLimit) {
              const deleted = deletedCurrentRows[deletedCursor];
              rows.push({
                  eventCode: deleted.code,
                  code: deleted.code,
                  eventDescription: deleted.event.eventDescription || deleted.event.description || '',
                  proposalAction: 'Delete',
                  proposalSource: 'current-missing-from-upload',
                  currentIndex: deleted.index,
              });
              lastMatchedCurrentIndex = Math.max(lastMatchedCurrentIndex, deleted.index);
              deletedCursor += 1;
          }
      };
      oneByOneUploadEvents.forEach((event: any, index: number) => {
          const code = String(event?.eventCode || event?.code || '').trim();
          const currentMatch = currentByCode.get(code.toUpperCase());
          const current = currentMatch?.event;
          let action = index <= oneByOneProtectedNewIndex ? 'Skip - completed/protected' : 'Add';
          if (index > oneByOneProtectedNewIndex && currentMatch && currentMatch.index > lastMatchedCurrentIndex) {
              appendDeletedBefore(currentMatch.index);
              lastMatchedCurrentIndex = Math.max(lastMatchedCurrentIndex, currentMatch.index);
          }
          if (index > oneByOneProtectedNewIndex && current) {
              const currentDescription = String(current.eventDescription || current.description || '').trim();
              const nextDescription = String(event.eventDescription || event.description || '').trim();
              action = currentDescription && nextDescription && currentDescription !== nextDescription ? 'Amend' : 'Replace/retain';
          }
          rows.push({
              ...event,
              eventCode: code,
              proposalAction: action,
              proposalSource: 'uploaded',
              currentIndex: currentMatch?.index,
          });
      });
      appendDeletedBefore(Number.POSITIVE_INFINITY);
      return rows;
  }, [oneByOneCurrentEvents, oneByOneLastCompletedIndex, oneByOneProtectedNewIndex, oneByOneUploadEvents]);

  useEffect(() => {
      if (!showUploadOneByOneReview) return;
      if (oneByOneSelectedTraineeKey && oneByOneUploadTrainees.some(trainee => String((trainee as any).id || trainee.idNumber || trainee.fullName || trainee.name) === oneByOneSelectedTraineeKey)) return;
      const firstTrainee = oneByOneUploadTrainees[0];
      setOneByOneSelectedTraineeKey(firstTrainee ? String((firstTrainee as any).id || firstTrainee.idNumber || firstTrainee.fullName || firstTrainee.name) : '');
  }, [oneByOneSelectedTraineeKey, oneByOneUploadTrainees, showUploadOneByOneReview]);

  useEffect(() => {
      if (!showUploadOneByOneReview || !oneByOneSelectedTrainee) {
          setOneByOneCurrentLmp(null);
          return;
      }
      let cancelled = false;
      const traineeLookup = String((oneByOneSelectedTrainee as any).id || oneByOneSelectedTrainee.fullName || oneByOneSelectedTrainee.name || oneByOneSelectedTrainee.idNumber || '').trim();
      if (!traineeLookup) return;
      setOneByOneLmpLoading(true);
      setOneByOneLmpError('');
      fetch(`/api/trainees/${encodeURIComponent(traineeLookup)}/lmp`, { credentials: 'include' })
          .then(async response => {
              const data = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(data?.message || data?.error || `Could not load Individual LMP (${response.status})`);
              if (!cancelled) setOneByOneCurrentLmp(data?.lmp || null);
          })
          .catch(error => {
              if (!cancelled) {
                  setOneByOneCurrentLmp(null);
                  setOneByOneLmpError(error?.message || 'Could not load this trainee Individual LMP.');
              }
          })
          .finally(() => {
              if (!cancelled) setOneByOneLmpLoading(false);
          });
      return () => { cancelled = true; };
  }, [oneByOneSelectedTrainee, showUploadOneByOneReview]);

  useEffect(() => {
      if (!showUploadOneByOneReview) return;
      const targetIndex = Math.max(0, oneByOneLastCompletedIndex - 3);
      const rowHeight = 42;
      const scrollTop = targetIndex * rowHeight;
      if (oneByOneCurrentListRef.current) oneByOneCurrentListRef.current.scrollTop = scrollTop;
      if (oneByOneProposedListRef.current) oneByOneProposedListRef.current.scrollTop = Math.max(0, Math.max(0, oneByOneProtectedNewIndex - 3) * rowHeight);
  }, [oneByOneCurrentEvents.length, oneByOneLastCompletedIndex, oneByOneProtectedNewIndex, oneByOneProposalRows.length, showUploadOneByOneReview]);

  const openAssignTraining = () => {
      if (!activeStaffTrainingAssignment) return;
      const lmpCode = String(activeFlightSchoolLmpAssignment?.lmpCode || selectedCourseType || '').trim();
      setAssignLmpCode(lmpCode);
      const assignedTraineeCourses = new Set(
          showTraineesInAssignTraining
              ? assignableFlightSchoolTrainees
                  .filter(trainee => String(trainee.lmpType || '').trim().toUpperCase() === lmpCode.toUpperCase())
                  .map(trainee => String(trainee.course || 'No course').trim() || 'No course')
              : []
      );
      setAssignCourseSelection(new Set(
          assignedTraineeCourses.size > 0
              ? Array.from(assignedTraineeCourses)
              : assignableFlightSchoolTraineeCourses
      ));
      setAssignTrainingSelection(new Set(
          showStaffInAssignTraining
              ? assignableTrainingStaff
                  .filter(staff => (
                      activeAirCombatTrainingAssignment
                          ? staffHasAirCombatAssignment(staff, activeAirCombatTrainingAssignment)
                          : activeFlightSchoolLmpAssignment
                              ? staffHasFlightSchoolStaffLmpAssignment(staff, activeFlightSchoolLmpAssignment)
                              : false
                  ))
                  .map(staff => staff.idNumber)
              : []
      ));
      setAssignTraineeSelection(new Set(
          showTraineesInAssignTraining
              ? assignableFlightSchoolTrainees
                  .filter(trainee => String(trainee.lmpType || '').trim().toUpperCase() === lmpCode.toUpperCase())
                  .map(trainee => trainee.idNumber)
              : []
      ));
      setShowAssignTrainingModal(true);
  };

  const saveAssignTraining = async () => {
      if (!activeStaffTrainingAssignment) return;
      if (showStaffInAssignTraining && !onUpdateInstructor) return;
      if (showTraineesInAssignTraining && !onUpdateTrainee) return;
      const traceAssignLmp = (stage: string, details: Record<string, any> = {}) => {
          onTraceAssignLmp?.(stage, {
              selectedLmpCode: assignLmpCode || activeFlightSchoolLmpAssignment?.lmpCode || selectedCourseType,
              selectedCourseKeys: Array.from(assignCourseSelection),
              selectedTraineeIds: Array.from(assignTraineeSelection),
              visibleTraineeCount: courseFilteredAssignableFlightSchoolTrainees.length,
              ...details,
          });
      };
      setIsSavingTrainingAssignments(true);
      try {
          if (showStaffInAssignTraining && onUpdateInstructor) {
              for (const staff of assignableTrainingStaff) {
                  const shouldAssign = assignTrainingSelection.has(staff.idNumber);
                  const currentlyAssigned = activeAirCombatTrainingAssignment
                      ? staffHasAirCombatAssignment(staff, activeAirCombatTrainingAssignment)
                      : assignFlightSchoolLmpAssignment
                          ? staffHasFlightSchoolStaffLmpAssignment(staff, assignFlightSchoolLmpAssignment)
                          : false;
                  if (shouldAssign === currentlyAssigned) continue;
                  const updatedStaff = activeAirCombatTrainingAssignment
                      ? setAirCombatTrainingAssignment(staff, activeAirCombatTrainingAssignment, shouldAssign)
                      : setFlightSchoolStaffLmpAssignment(staff, assignFlightSchoolLmpAssignment!, shouldAssign);
                  await onUpdateInstructor(updatedStaff);
              }
          }
          if (showTraineesInAssignTraining && onUpdateTrainee) {
              const lmpCode = String(assignLmpCode || activeFlightSchoolLmpAssignment?.lmpCode || selectedCourseType || '').trim();
              traceAssignLmp('save:start', {
                  lmpCode,
                  hasUpdateTrainee: Boolean(onUpdateTrainee),
                  hasAssignIndividualLmp: Boolean(onAssignTraineeLmp),
              });
              for (const trainee of courseFilteredAssignableFlightSchoolTrainees) {
                  const shouldAssign = assignTraineeSelection.has(trainee.idNumber);
                  const currentlyAssigned = String(trainee.lmpType || '').trim().toUpperCase() === lmpCode.toUpperCase();
                  traceAssignLmp('trainee:evaluate', {
                      traineeName: trainee.fullName || trainee.name,
                      traineeIdNumber: trainee.idNumber,
                      traineeDbId: (trainee as any).id || null,
                      traineeCourse: trainee.course || null,
                      currentLmpType: trainee.lmpType || '',
                      lmpCode,
                      shouldAssign,
                      currentlyAssigned,
                  });
                  if (!shouldAssign && !currentlyAssigned) {
                      traceAssignLmp('trainee:skip-unassigned', {
                          traineeName: trainee.fullName || trainee.name,
                          traineeIdNumber: trainee.idNumber,
                      });
                      continue;
                  }
                  const updatedTrainee = {
                      ...trainee,
                      lmpType: shouldAssign ? lmpCode : '',
                  };
                  if (shouldAssign && currentlyAssigned) {
                      traceAssignLmp('trainee:profile-already-assigned', {
                          traineeName: trainee.fullName || trainee.name,
                          traineeIdNumber: trainee.idNumber,
                      });
                  } else {
                      traceAssignLmp('trainee:profile-update:start', {
                          traineeName: trainee.fullName || trainee.name,
                          traineeIdNumber: trainee.idNumber,
                          nextLmpType: updatedTrainee.lmpType,
                      });
                      await onUpdateTrainee(updatedTrainee);
                      traceAssignLmp('trainee:profile-update:success', {
                          traineeName: trainee.fullName || trainee.name,
                          traineeIdNumber: trainee.idNumber,
                          nextLmpType: updatedTrainee.lmpType,
                      });
                  }
                  if (shouldAssign && lmpCode) {
                      if (onAssignTraineeLmp) {
                          traceAssignLmp('trainee:individual-lmp:start', {
                              traineeName: updatedTrainee.fullName || updatedTrainee.name,
                              traineeIdNumber: updatedTrainee.idNumber,
                              traineeDbId: (updatedTrainee as any).id || null,
                              lmpCode,
                          });
                          await onAssignTraineeLmp(updatedTrainee, lmpCode);
                          traceAssignLmp('trainee:individual-lmp:success', {
                              traineeName: updatedTrainee.fullName || updatedTrainee.name,
                              traineeIdNumber: updatedTrainee.idNumber,
                              lmpCode,
                          });
                      } else {
                          traceAssignLmp('trainee:individual-lmp:no-callback', {
                              traineeName: updatedTrainee.fullName || updatedTrainee.name,
                              traineeIdNumber: updatedTrainee.idNumber,
                              lmpCode,
                          });
                      }
                  }
              }
              traceAssignLmp('save:complete', { lmpCode });
          }
          logAudit({
              action: 'Update',
              description: isAssigningFlightSchoolLmp
                  ? `Updated Flight School ${selectedCourseAudience === 'staff' ? 'staff' : 'trainee'} LMP assignment for ${assignLmpCode || activeFlightSchoolLmpAssignment?.lmpCode || selectedCourseType}`
                  : `Updated Air Combat training assignment for ${activeAirCombatTrainingAssignment?.code || selectedCourseType}`,
              changes: `${assignTrainingSelection.size} staff selected, ${assignTraineeSelection.size} trainees selected, ${assignCourseSelection.size} courses selected`,
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
          void showDarkAlert(`Linked event was not saved: ${error instanceof Error ? error.message : String(error)}`, 'Save Failed', 'error');
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
        setIsAddingLmpEvent(false);
        return;
    }
    if (courseLMPs.length === 0) {
        if (selectedCourseType) {
            setSelectedCourseType('');
            setSelectedItem(null);
            setHoveredItem(null);
            setIsEditing(false);
            setEditedItem(null);
            setIsAddingLmpEvent(false);
        }
        return;
    }
    if (!courseLMPs.includes(selectedCourseType)) {
        setSelectedCourseType(courseLMPs[0]);
        setSelectedItem(null);
        setHoveredItem(null);
        setIsEditing(false);
        setEditedItem(null);
        setIsAddingLmpEvent(false);
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
    setIsAddingLmpEvent(false);
    setHoveredItem(null);
  }, [activeTab, selectedCourseType]);

  const handleEdit = () => {
      setIsAddingLmpEvent(false);
      setEditingCourseTitle(getCourseTitle(selectedCourseType));
      setEditingCourseAudience(selectedCourseAudience);
      if (selectedItem) {
          setEditedItem(JSON.parse(JSON.stringify(selectedItem)));
      }
      setIsEditing(true);
  };

  const handleSave = async () => {
      const editedTestEventType = editedItem?.testEventType || 'NONE';
      if (editedItem && editedTestEventType !== 'NONE' && !editedItem.testingOfficerQualificationId?.trim()) {
          await showDarkAlert(
              'Select one Testing Officer qualification. A Flight Test or Simulator Test cannot be saved until the qualification required to schedule its Testing Officer is selected.',
              'Testing Officer Qualification Required',
              'error',
          );
          return;
      }
      setIsSaving(true);
      try {
          // Save the selected event item if one is being edited
          if (editedItem) {
              const itemToSaveBase = {
                  ...editedItem,
                  testEventType: editedTestEventType,
                  testingOfficerQualificationId: editedTestEventType === 'NONE'
                      ? null
                      : editedItem.testingOfficerQualificationId,
                  useTestingOfficerSecondaryCallsign: editedTestEventType === 'FLIGHT_TEST'
                      && editedItem.useTestingOfficerSecondaryCallsign === true,
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
          if (!isAddingLmpEvent && newTitle && newTitle !== currentTitle) {
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

          if (!isAddingLmpEvent && editingCourseAudience !== selectedCourseAudience) {
              const courseItems = unitScopedSyllabusDetails.filter(item =>
                  item.isActive !== false &&
                  getItemLmpDetailsTab(item) === activeTab &&
                  (item.courses || []).includes(selectedCourseType)
              );
              const shellItem = courseItems.find(isSyllabusCourseShell) || courseItems[0];
              if (shellItem) {
                  const updatedShell = {
                      ...shellItem,
                      notes: withLmpAudienceInNotes(shellItem.notes, editingCourseAudience),
                  };
                  const savedShell = await updateSyllabusItem(shellItem.id, updatedShell, `${activeCollectionTitle} audience changed`);
                  onUpdateItem({ ...updatedShell, ...savedShell, id: shellItem.id });
                  logAudit({
                      action: 'Edit',
                      description: `Updated ${activeCollectionNoun} audience: ${selectedCourseType}`,
                      changes: `Audience: ${selectedCourseAudience} to ${editingCourseAudience}`,
                      page: 'LMP/Event Details',
                  });
              }
          }

          setIsEditing(false);
          setIsAddingLmpEvent(false);
          setEditedItem(null);
          setEditingCourseTitle('');
          setEditingCourseAudience(selectedCourseAudience);
      } catch (err: any) {
          await showDarkAlert(`Save failed: ${err.message}`, 'Save Failed', 'error');
      } finally {
          setIsSaving(false);
      }
  };

  const handleCancel = () => {
      setIsEditing(false);
      setIsAddingLmpEvent(false);
      setEditedItem(null);
      setEditingCourseTitle('');
      setEditingCourseAudience(selectedCourseAudience);
  };

  const handleManageMasterLmps = () => {
      onNavigateToSettingsSection?.({
          sectionId: 'platform-master-lmp-access',
          focusSubsectionId: 'platform-master-lmp-catalogue',
      });
  };

  const openUploadModal = () => {
      setUploadFile(null);
      setUploadResult(null);
      setUploadProgress(null);
      setUploadReview(null);
      setShowUploadOneByOneReview(false);
      setShowUploadFinalWarning(false);
      setNewUploadPackageName('');
      if (isTrainingPackagesTab) {
          setUploadMode(selectedCourseType ? 'update' : 'create');
          setMasterUploadIntent(null);
          setUploadTargetLmpCode('');
      } else {
          setUploadMode(selectedCourseType ? 'replace' : 'create');
          setMasterUploadIntent(null);
          setUploadTargetLmpCode(selectedCourseType || activeMasterLmpCatalogue[0]?.code || '');
          setUploadLmpVersion(selectedCourseVersion || DEFAULT_LMP_VERSION);
          setLmpUpdateReviewMode('automatic');
      }
      setShowUploadModal(true);
  };

  const downloadUploadTrace = (label = 'lmp-upload-trace') => {
      const payload = {
          generatedAt: new Date().toISOString(),
          activeTab,
          activeCollectionTitle,
          selectedCourseType,
          masterUploadIntent,
          uploadMode,
          uploadTargetLmpCode,
          newUploadPackageName,
          uploadLmpVersion,
          lmpUpdateReviewMode,
          uploadFile: uploadFile ? { name: uploadFile.name, size: uploadFile.size, type: uploadFile.type } : null,
          review: uploadReview,
          result: uploadResult,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeCode = (uploadTargetLmpCode || selectedCourseType || newUploadPackageName || 'lmp').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'lmp';
      link.href = url;
      link.download = `${label}-${safeCode}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
  };

  const handleEditSelectedCourseVersion = async () => {
      if (isFrozen || !selectedCourseType) return;
      const currentVersion = selectedCourseVersion || DEFAULT_LMP_VERSION;
      const value = await showDarkPrompt({
          title: 'Edit LMP Version',
          message: `Enter the version number for ${getCourseTitle(selectedCourseType)}.`,
          inputLabel: 'Version',
          inputPlaceholder: '1.0',
          inputDefaultValue: currentVersion,
          confirmText: 'Save',
          variant: 'info',
      });
      if (value === null) return;

      const version = String(value || '').trim();
      if (!/^\d+(?:\.\d+)?$/.test(version)) {
          await showDarkAlert('Enter a version number using digits only, with an optional decimal point. Example: 1 or 1.2', 'Invalid Version', 'warning');
          return;
      }

      const targetItem = selectedCollectionDeleteItems.find(isSyllabusCourseShell) || selectedCollectionDeleteItems[0];
      if (!targetItem) {
          await showDarkAlert('No saved LMP record was found to store the version against.', 'Version Not Saved', 'warning');
          return;
      }

      const updatedItem = {
          ...targetItem,
          notes: withLmpVersionInNotes(targetItem.notes, version),
      };
      const savedItem = await updateSyllabusItem(targetItem.id, updatedItem, `Updated ${activeCollectionTitle} version`);
      onUpdateItem({ ...updatedItem, ...savedItem, id: targetItem.id });
      logAudit({
          action: 'Edit',
          description: `Updated ${activeCollectionNoun} version: ${selectedCourseType}`,
          changes: `Version: ${currentVersion} to ${version}`,
          page: 'LMP/Event Details',
      });
  };

  const handleDeleteCourse = async () => {
      if (!selectedCourseType) { setDeleteError('Select an LMP before deleting.'); return; }
      if (selectedCollectionDeleteItems.length === 0 && (isTrainingPackagesTab || !selectedMasterLmpCatalogueEntry)) {
          setDeleteError(`No database event rows were found for ${selectedCourseType}. Hard refresh and try again, or check the selected unit/location.`);
          return;
      }
      if (deleteConfirmText.trim() !== deleteConfirmationPhrase) {
          setDeleteError(`Type ${deleteConfirmationPhrase} to confirm permanent deletion.`);
          return;
      }
      if (!deletePassword) { setDeleteError('Please enter your password.'); return; }
      setIsDeleting(true);
      setDeleteError('');
      try {
          if (!deletePasswordVerified) {
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
              setDeletePasswordVerified(true);
              setIsDeleting(false);
              return;
          }
          // Permanently delete all database rows for this Master LMP/package.
          // Master LMP deletion is a server-side whole-record operation so the
          // catalogue title cannot survive after event rows have been removed.
          const itemsToDelete = selectedCollectionDeleteItems;

          let deletedCount = itemsToDelete.length;
          if (!isTrainingPackagesTab) {
              const sessionToken = localStorage.getItem('dfp_session_token') || '';
              const deleteResp = await fetch(`/api/master-lmp/${encodeURIComponent(selectedCourseType)}`, {
                  method: 'DELETE',
                  credentials: 'include',
                  headers: {
                      'Content-Type': 'application/json',
                      ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}),
                  },
                  body: JSON.stringify({
                      lmpCode: selectedCourseType,
                      unit: activeUnitNormalised,
                      location: activeLocationNormalised,
                  }),
              });
              const deleteData = await deleteResp.json().catch(() => ({}));
              if (!deleteResp.ok || deleteData?.success === false) {
                  throw new Error(deleteData?.message || deleteData?.error || deleteData?.details || 'Master LMP delete failed.');
              }
              deletedCount = Number(deleteData?.deletedEventRows ?? itemsToDelete.length) || 0;
              if (onDeleteMasterLmpCatalogue) {
                  await onDeleteMasterLmpCatalogue(selectedCourseType);
              }
          } else {
              if (itemsToDelete.length === 0) {
                  console.warn(`⚠️ No items found for ${activeCollectionNoun} ${selectedCourseType} in syllabusDetails (${syllabusDetails.length} total items)`);
              } else {
                  await Promise.all(itemsToDelete.map(item =>
                      deleteSyllabusItem(item.id, `${activeCollectionTitle} deleted: ${selectedCourseType}`)
                  ));
              }
          }
          logAudit({ action: 'Delete', description: `Deleted ${activeCollectionNoun}: ${selectedCourseType}`, changes: `${deletedCount} database item(s) permanently deleted`, page: 'LMP/Event Details' });
          // Remove from local state immediately after the server hard-delete succeeds.
          itemsToDelete.forEach(item => onUpdateItem({ ...item, isActive: false } as any));
          clearSyllabusCache();
          setShowDeleteModal(false);
          setDeletePassword('');
          setDeleteConfirmText('');
          setDeletePasswordVerified(false);
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
      if (!uploadFile) { await showDarkAlert('Please select a file first.', 'No File Selected', 'warning'); return; }
      const isMasterUpload = !isTrainingPackagesTab;
      if (isMasterUpload && !masterUploadIntent) {
          await showDarkAlert('Choose whether this is a new LMP or an update to an existing LMP first.', 'Upload Type Required', 'warning');
          return;
      }
      const packageName = newUploadPackageName.trim();
      const masterNewCode = getPackageCodeFromTitle(packageName);
      const destinationCode = isMasterUpload
          ? (masterUploadIntent === 'new' ? masterNewCode : uploadTargetLmpCode.trim())
          : isTrainingPackagesTab && uploadMode === 'create'
          ? getUnitScopedCollectionCode(getPackageCodeFromTitle(packageName), activeUnitNormalised, shouldScopeCreatedItemsToActiveUnit)
          : selectedCourseType;
      const destinationName = isMasterUpload
          ? (masterUploadIntent === 'new' ? packageName : getCourseTitle(destinationCode))
          : isTrainingPackagesTab && uploadMode === 'create'
          ? packageName
          : getCourseTitle(selectedCourseType);
      if ((isTrainingPackagesTab && uploadMode === 'create') || (isMasterUpload && masterUploadIntent === 'new')) {
          if (!packageName) {
              await showDarkAlert(`Please enter a new ${isMasterUpload ? 'LMP' : 'package'} name.`, `${isMasterUpload ? 'LMP' : 'Package'} Name Required`, 'warning');
              return;
          }
      }
      if (isMasterUpload && !/^\d+(?:\.\d+)?$/.test(uploadLmpVersion.trim())) {
          await showDarkAlert('Enter a version number using digits only, with an optional decimal point. Example: 1 or 1.2', 'Invalid Version', 'warning');
          return;
      }
      if (!destinationCode) { await showDarkAlert(`Please select or add a ${activeCollectionNoun} first.`, 'Selection Required', 'warning'); return; }
      if (isTrainingPackagesTab && uploadMode === 'create' && courseLMPs.includes(destinationCode)) {
          await showDarkAlert(`A package with code ${destinationCode} already exists. Select it and use Replace Package or Update Package instead.`, 'Package Already Exists', 'warning');
          return;
      }
      if (isMasterUpload && masterUploadIntent === 'new' && (
          courseLMPs.some(code => normaliseContextCode(code) === normaliseContextCode(destinationCode)) ||
          activeMasterLmpCatalogue.some(entry => normaliseContextCode(entry.code) === normaliseContextCode(destinationCode))
      )) {
          await showDarkAlert(`Master LMP "${destinationCode}" already exists. Use Update existing LMP or choose a different name.`, 'Master LMP Already Exists', 'warning');
          return;
      }
      const isReviewStep = !uploadReview;
      if (!isReviewStep && isMasterUpload && masterUploadIntent === 'update' && lmpUpdateReviewMode === 'one-by-one' && !showUploadOneByOneReview) {
          setShowUploadOneByOneReview(true);
          return;
      }
      if (!isReviewStep && !showUploadFinalWarning) {
          setShowUploadFinalWarning(true);
          return;
      }
      setIsUploading(true);
      const uploadOperationId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setUploadProgress({
          operationId: uploadOperationId,
          status: 'running',
          phase: 'client:starting',
          message: isReviewStep ? 'Starting upload review...' : 'Starting Master LMP update...',
          percent: 0,
          current: 0,
          total: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          deleted: 0,
      });
      if (isReviewStep) setUploadResult(null);
      try {
          const formData = new FormData();
          formData.append('file', uploadFile);
          formData.append('uploadOperationId', uploadOperationId);
          formData.append('courseCode', destinationCode);
          formData.append('packageName', destinationName);
          formData.append('uploadMode', isMasterUpload ? (masterUploadIntent === 'new' ? 'create' : 'replace') : uploadMode);
          if (isMasterUpload) {
              formData.append('uploadIntent', masterUploadIntent || '');
              formData.append('lmpVersion', uploadLmpVersion.trim() || DEFAULT_LMP_VERSION);
              formData.append('updateReviewMode', lmpUpdateReviewMode);
          }
          if (isReviewStep) formData.append('dryRun', 'true');
          formData.append('lmpType', activeLmpType);
          formData.append('operationalModel', activeOperationalModel);
          const sessionToken = localStorage.getItem('dfp_session_token') || '';
          if (shouldScopeCreatedItemsToActiveUnit) {
              formData.append('locationCode', activeLocationNormalised);
              formData.append('unitCode', activeUnitNormalised);
          }
          const abortController = new AbortController();
          const timeoutMs = isReviewStep ? 60000 : 180000;
          const timeoutId = window.setTimeout(() => abortController.abort(), timeoutMs);
          let resp: Response;
          try {
              resp = await fetch('/api/syllabus/bulk-upload', {
                  method: 'POST',
                  headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
                  body: formData,
                  signal: abortController.signal,
              });
          } finally {
              window.clearTimeout(timeoutId);
          }
          const responseText = await resp.text();
          let data: any = {};
          try {
              data = responseText ? JSON.parse(responseText) : {};
          } catch (_parseError) {
              const preview = responseText.replace(/\s+/g, ' ').trim().slice(0, 180);
              throw new Error(`Upload endpoint returned a non-JSON response (${resp.status} ${resp.statusText})${preview ? `: ${preview}` : ''}`);
          }
          if (!resp.ok && (Array.isArray(data.errors) || data.uploadTrace)) {
              setUploadResult({
                  created: data.created || 0,
                  updated: data.updated || 0,
                  imported: data.imported || 0,
                  skipped: data.skipped || 0,
                  errors: Array.isArray(data.errors) && data.errors.length > 0
                      ? data.errors
                      : [{ row: 0, error: data.message || data.error || data.details || `Upload failed (${resp.status} ${resp.statusText})` }],
                  message: data.message || data.error || `Upload failed (${resp.status} ${resp.statusText})`,
                  uploadTrace: data.uploadTrace,
              });
              return;
          }
          if (!resp.ok) throw new Error(data.error || data.message || `Upload failed (${resp.status} ${resp.statusText})`);
          if (data.dryRun) {
              setUploadReview(data);
              setUploadResult(null);
              setShowUploadOneByOneReview(false);
              setShowUploadFinalWarning(false);
              return;
          }
          if (isMasterUpload && masterUploadIntent === 'new') {
              await onUpsertMasterLmpCatalogue?.({
                  code: destinationCode,
                  name: destinationName || destinationCode,
                  version: uploadLmpVersion.trim() || DEFAULT_LMP_VERSION,
                  audience: 'trainee',
              });
          }
          setUploadResult(data);
          setUploadReview(null);
          setShowUploadFinalWarning(false);
          logAudit({
              action: isMasterUpload && masterUploadIntent === 'update' ? 'Update' : 'Create',
              description: `${isMasterUpload ? 'Master LMP' : activeCollectionTitle} upload: ${destinationCode}`,
              changes: JSON.stringify({
                  uploadIntent: isMasterUpload ? masterUploadIntent : uploadMode,
                  version: isMasterUpload ? uploadLmpVersion : undefined,
                  imported: data.imported,
                  created: data.created,
                  updated: data.updated,
                  individualLmpSync: data.individualLmpSync ? {
                      assignedTrainees: data.individualLmpSync.assignedTrainees,
                      protectedCompletedEvents: data.individualLmpSync.protectedCompletedEvents,
                  } : undefined,
              }),
              page: 'LMP/Event Details',
          });
          // Reload syllabus data by triggering a page reload after short delay
          if ((data.created || 0) > 0 || (data.updated || 0) > 0) {
              clearSyllabusCache();
              localStorage.setItem('neo_lmp_details_active_tab', activeTab);
              localStorage.setItem('neo_lmp_details_selected_package', destinationCode);
              setTimeout(() => window.location.reload(), 2000);
          }
      } catch (err: any) {
          const isTimeout = err?.name === 'AbortError';
          const errorMessage = isTimeout
              ? `The ${isReviewStep ? 'review' : 'apply'} request did not return within ${Math.round((isReviewStep ? 60000 : 180000) / 1000)} seconds. Download the trace below; the server may still have continued processing.`
              : `Upload failed: ${err.message}`;
          setUploadResult({
              created: 0,
              updated: 0,
              imported: 0,
              skipped: 0,
              errors: [{ row: 0, error: errorMessage }],
              message: errorMessage,
              uploadTrace: {
                  generatedAt: new Date().toISOString(),
                  source: 'components/SyllabusView.tsx:handleBulkUpload',
                  liveProgress: uploadProgress,
                  finalWarningWasVisible: showUploadFinalWarning,
                  clientError: {
                      name: err?.name || 'Error',
                      message: err?.message || String(err),
                      timedOut: isTimeout,
                  },
                  request: {
                      destinationCode,
                      destinationName,
                      uploadMode: isMasterUpload ? (masterUploadIntent === 'new' ? 'create' : 'replace') : uploadMode,
                      masterUploadIntent,
                      dryRun: isReviewStep,
                      lmpUpdateReviewMode,
                      uploadLmpVersion,
                      activeLmpType,
                      activeOperationalModel,
                      activeLocationNormalised,
                      activeUnitNormalised,
                      file: uploadFile ? { name: uploadFile.name, size: uploadFile.size, type: uploadFile.type } : null,
                  },
                  review: uploadReview,
              },
          });
          await showDarkAlert(errorMessage, isTimeout ? 'Upload Still Running or Timed Out' : 'Upload Failed', 'error');
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
          await showDarkAlert(`Cross-load failed: ${err.message}`, 'Cross-load Failed', 'error');
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
              headers: {
                  'Content-Type': 'application/json',
                  ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
              },
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
      setNewLMPAudience(getDefaultLmpAudience({
          activeTab,
          operationalModel: activeOperationalModel,
          lmpType: activeLmpType,
      }));
      setAddPackageMode('blank');
      setCopyPackageSourceKey(packageCopyOptions[0]?.key || '');
      setShowAddLMPModal(true);
  };

  const handleCopyPackageSave = async () => {
      const source = packageCopyOptions.find(option => option.key === copyPackageSourceKey);
      if (!source) {
          await showDarkAlert('Please select a package to copy.', 'Package Required', 'warning');
          return;
      }
      if (!activeUnitNormalised) {
          await showDarkAlert('Please select a unit before copying a training package.', 'Unit Required', 'warning');
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
          await showDarkAlert(`Failed to copy package: ${err.message}`, 'Copy Failed', 'error');
      } finally {
          setIsCopyingPackage(false);
      }
  };

  const handleAddLMPSave = async () => {
      if (isTrainingPackagesTab && addPackageMode === 'copy') {
          await handleCopyPackageSave();
          return;
      }
      if (!newLMPName.trim()) { await showDarkAlert(`Please enter a ${activeCollectionNoun} title.`, 'Title Required', 'warning'); return; }
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
          notes: withLmpAudienceInNotes(SYLLABUS_COURSE_SHELL_NOTE, newLMPAudience),
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
          setIsAddingLmpEvent(false);
          logAudit({ action: 'Create', description: `Created new ${activeCollectionNoun}: ${savedItem.code}`, changes: `Course type: ${newLMPCourseType}`, page: 'LMP/Event Details' });
      } catch (err: any) {
          await showDarkAlert(`Failed to create ${activeCollectionNoun}: ${err.message}`, 'Create Failed', 'error');
      }
  };

  const handleAddEvent = () => {
      if (!selectedCourseType) {
          void showDarkAlert(`Please select a ${activeCollectionNoun} before adding an event.`, 'Selection Required', 'warning');
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
      setEditingCourseTitle(getCourseTitle(selectedCourseType));
      setIsAddingLmpEvent(true);
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
          await showDarkAlert(`Event order was not saved: ${error instanceof Error ? error.message : String(error)}`, 'Reorder Failed', 'error');
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
          <h1 className="text-2xl font-bold text-white">
              {isAddingLmpEvent ? 'Add Event to: ' : 'LMP/Event Details: '}
              {isEditing && !isAddingLmpEvent ? (
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
              )}
          </h1>
          <p className="text-sm text-gray-400">
              {isAddingLmpEvent
                  ? `This creates one event inside ${getCourseTitle(selectedCourseType)}. The ${activeCollectionTitle} title is fixed here; fill in the event code and event description below.`
                  : isEditing
                      ? `Editing ${activeCollectionNoun} title and enrolment audience - changes apply to this ${activeCollectionNoun}`
                      : activeCollectionTitle}
          </p>
          {selectedCourseType && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded border border-sky-500/35 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-100">
                      Version: {selectedCourseVersion}
                      <button
                          type="button"
                          onClick={handleEditSelectedCourseVersion}
                          disabled={isFrozen}
                          className="ml-1 rounded p-0.5 text-sky-100 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Edit LMP version"
                          aria-label="Edit LMP version"
                      >
                          <PencilIcon className="h-3 w-3" />
                      </button>
                  </span>
              </div>
          )}
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
                              setIsAddingLmpEvent(false);
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
                    setIsAddingLmpEvent(false);
                }}
                className={`flex min-h-[48px] min-w-[150px] items-center justify-center rounded px-4 py-1 text-center text-sm font-semibold leading-tight transition ${
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
                        setIsAddingLmpEvent(false);
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
                        <button onClick={handleManageMasterLmps} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed">
                            <span>Manage<br />LMPs</span>
                        </button>
                    )}
                    <button onClick={handleAddEvent} disabled={isFrozen || !selectedCourseType} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed disabled:opacity-50 disabled:cursor-not-allowed">
                        <span>Add<br />Event</span>
                    </button>
                    {(isTrainingPackagesTab || (!isTrainingPackagesTab && selectedCourseType)) && (
                        <button
                            onClick={() => { setDeletePassword(''); setDeleteConfirmText(''); setDeleteError(''); setDeletePasswordVerified(false); setShowDeleteModal(true); }}
                            disabled={isFrozen || !selectedCourseType}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed text-black disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span>Delete<br />{isTrainingPackagesTab ? 'Package' : 'LMP'}</span>
                        </button>
                    )}
                    {(isAirCombatModel || (isFlightSchoolModel && !isTrainingPackagesTab)) && (
                        <button
                            onClick={openAssignTraining}
                            disabled={
                                isFrozen
                                || !activeStaffTrainingAssignment
                                || (showStaffInAssignTraining && !onUpdateInstructor)
                                || (showTraineesInAssignTraining && !onUpdateTrainee)
                            }
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span>Assign<br />{isAssigningFlightSchoolLmp ? 'LMP' : 'Training'}</span>
                        </button>
                    )}
                    <button onClick={openUploadModal} disabled={isFrozen} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-black disabled:opacity-50 disabled:cursor-not-allowed">Upload</button>
                </div>
            )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-gray-950/20">
        <div
          className="relative min-w-[980px] p-3"
          style={{
              minHeight: selectedItem
                  ? Math.max(filteredSyllabusDetails.length * 74, Math.max(0, filteredSyllabusDetails.findIndex(item => item.id === selectedItem.id)) * 74 + (isEditing ? 1320 : 760))
                  : undefined,
          }}
        >
          <div className="w-[292px]">
            {filteredSyllabusDetails.map((item, index) => {
              const totalItems = filteredSyllabusDetails.length;
              const midPoint = Math.ceil(totalItems / 2);
              const phaseNum = index < midPoint ? 1 : 2;
              const moduleNum = Math.floor((index * 12) / totalItems) + 1;
              const actualModule = Math.min(moduleNum, 12);
              const isSelected = selectedItem?.id === item.id;
              const sortieLabel = formatMasterLmpSortieLabel(item, resourceDisplayNames);
              const dayLabel = item.dayNight || 'Day';
              const durationLabel = formatMasterLmpHours(item.totalEventHours || item.duration);

              return (
                <div key={item.id} className="mb-3">
                  <div className="relative w-[292px] shrink-0">
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
                              setIsAddingLmpEvent(false);
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
                </div>
              );
            })}
            {filteredSyllabusDetails.length === 0 && (
                <div className="p-4 text-center text-gray-500 italic text-sm">No events found for this LMP.</div>
            )}
          </div>
          {selectedItem && (() => {
              const selectedIndex = Math.max(0, filteredSyllabusDetails.findIndex(item => item.id === selectedItem.id));
              return (
                <div
                  className="absolute left-[320px] right-3 max-w-5xl rounded-lg border border-sky-700/50 bg-gray-900/90 p-5 shadow-xl shadow-black/30"
                  style={{ top: 12 + selectedIndex * 74 }}
                >
                  <DetailView
                      item={hoveredItem || selectedItem}
                      isEditing={isEditing}
                      isAddingEvent={isAddingLmpEvent}
                      editedItem={editedItem}
                      onItemChange={setEditedItem}
                      onDeleteEvent={handleDeleteEventRequest}
                      onEdit={handleEdit}
                      editDisabled={isFrozen}
                      onSave={handleSave}
                      onCancel={handleCancel}
                      saveDisabled={isSaving}
                      isSaving={isSaving}
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
                      collectionTitle={getCourseTitle(selectedCourseType)}
                      codeExample={addEventExamples.code}
                      descriptionExample={addEventExamples.description}
                  />
                </div>
              );
          })()}
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
                {(!isTrainingPackagesTab || addPackageMode === 'blank') && <div style={{ marginBottom: 16 }}>
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

                {(!isTrainingPackagesTab || addPackageMode === 'blank') && <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Assignment Audience
                    </label>
                    <select
                        value={newLMPAudience}
                        onChange={e => setNewLMPAudience(e.target.value as LmpAudience)}
                        style={{ width: '100%', backgroundColor: '#111827', border: '1px solid #4b5563',
                            borderRadius: 6, padding: '8px 10px', color: '#fff', fontSize: 13,
                            outline: 'none', boxSizing: 'border-box' as const }}
                    >
                        <option value="trainee">Trainees only</option>
                        <option value="staff">Staff only</option>
                    </select>
                    <p style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
                        This controls who can be enrolled from Assign LMP. Staff-only courses are for upgrades or category progression; trainee-only courses feed normal trainee LMP assignment.
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
            onClick={() => {
                if (isDeleting) return;
                setShowDeleteModal(false);
                setDeletePasswordVerified(false);
            }}
        >
            <div
                style={{ backgroundColor: '#1f2937', border: '1px solid #ef4444', borderRadius: 12,
                    padding: 28, width: 520, boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
                    Delete {isTrainingPackagesTab ? 'Package' : 'Master LMP'}: {getCourseTitle(selectedCourseType)}
                </h2>
                <p style={{ fontSize: 12, color: '#d1d5db', marginBottom: 12, lineHeight: 1.6 }}>
                    {deletePasswordVerified
                        ? `Final warning: this will permanently delete ${getCourseTitle(selectedCourseType)}. This removes the title, access records and database event rows. This cannot be undone.`
                        : `This will permanently remove the selected ${isTrainingPackagesTab ? 'training package' : 'Master LMP'} from the database. It does not archive or hide rows.`}
                </p>
                <div style={{ border: '1px solid #7f1d1d', backgroundColor: 'rgba(127, 29, 29, 0.20)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: '#fecaca', lineHeight: 1.7 }}>
                        <div><strong style={{ color: '#fff' }}>Scope:</strong> {activeUnitNormalised || 'Current unit'} / {activeLocationNormalised || 'Current location'} / {selectedCourseType || 'No LMP selected'}</div>
                        <div><strong style={{ color: '#fff' }}>Database event rows to delete:</strong> {selectedCollectionDeleteItems.length}</div>
                        <div><strong style={{ color: '#fff' }}>Trainees currently assigned to this LMP:</strong> {selectedCollectionAssignedTrainees.length}</div>
                        <div><strong style={{ color: '#fff' }}>Confirmation phrase:</strong> {deleteConfirmationPhrase}</div>
                        {deletePasswordVerified && <div><strong style={{ color: '#fff' }}>Password:</strong> accepted. Click Delete once more to permanently delete.</div>}
                    </div>
                </div>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16, lineHeight: 1.6 }}>
                    Precautions: confirm the selected LMP, type the confirmation phrase exactly, then enter your password. This action cannot be undone.
                </p>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Type Confirmation Phrase *
                    </label>
                    <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={e => { setDeleteConfirmText(e.target.value); setDeleteError(''); setDeletePasswordVerified(false); }}
                        placeholder={deleteConfirmationPhrase}
                        disabled={isDeleting}
                        style={{ width: '100%', backgroundColor: '#111827', border: `1px solid ${deleteError && deleteConfirmText.trim() !== deleteConfirmationPhrase ? '#ef4444' : '#4b5563'}`,
                            borderRadius: 6, padding: '8px 10px', color: '#fff', fontSize: 13,
                            outline: 'none', boxSizing: 'border-box' as const }}
                    />
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Your Password *
                    </label>
                    <input
                        type="password"
                        value={deletePassword}
                        onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); setDeletePasswordVerified(false); }}
                        onKeyDown={e => e.key === 'Enter' && handleDeleteCourse()}
                        placeholder="Enter your password to confirm"
                        disabled={isDeleting}
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
                        onClick={() => { setShowDeleteModal(false); setDeletePasswordVerified(false); }}
                        disabled={isDeleting}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDeleteCourse}
                        disabled={isDeleting}
                        className="w-[72px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-red-500 disabled:opacity-60"
                    >
                        {isDeleting ? (deletePasswordVerified ? 'Deleting…' : 'Checking…') : deletePasswordVerified ? 'Delete' : 'Confirm'}
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
                    padding: 28, width: 480, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 40px)',
                    overflowY: 'auto', overscrollBehavior: 'contain', boxSizing: 'border-box',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8', marginBottom: 8 }}>
                    Bulk Upload {isTrainingPackagesTab ? 'Training Package' : 'Master LMP'} Events
                </h2>
                {!isTrainingPackagesTab && !masterUploadIntent ? (
                    <div>
                        <p style={{ fontSize: 12, color: '#d1d5db', marginBottom: 18, lineHeight: 1.55 }}>
                            Is this upload creating a new Master LMP, or updating an existing Master LMP?
                        </p>
                        <div style={{ display: 'grid', gap: 12 }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setMasterUploadIntent('new');
                                    setUploadMode('create');
                                    setUploadReview(null);
                                    setShowUploadOneByOneReview(false);
                                    setUploadResult(null);
                                    setNewUploadPackageName('');
                                    setUploadLmpVersion(DEFAULT_LMP_VERSION);
                                }}
                                style={{ textAlign: 'left', padding: 14, borderRadius: 10, border: '1px solid #0e7490', backgroundColor: '#082f49', color: '#f9fafb', cursor: 'pointer' }}
                            >
                                <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#7dd3fc' }}>New LMP</span>
                                <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
                                    Create a new Master LMP record, give it a unique name, then import the workbook events into it.
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMasterUploadIntent('update');
                                    setUploadMode('replace');
                                    setUploadReview(null);
                                    setShowUploadOneByOneReview(false);
                                    setUploadResult(null);
                                    setUploadTargetLmpCode(selectedCourseType || activeMasterLmpCatalogue[0]?.code || '');
                                    setUploadLmpVersion(selectedCourseVersion || DEFAULT_LMP_VERSION);
                                }}
                                disabled={activeMasterLmpCatalogue.length === 0 && courseLMPs.length === 0}
                                style={{ textAlign: 'left', padding: 14, borderRadius: 10, border: '1px solid #92400e', backgroundColor: '#1c1917', color: '#f9fafb', cursor: activeMasterLmpCatalogue.length === 0 && courseLMPs.length === 0 ? 'not-allowed' : 'pointer', opacity: activeMasterLmpCatalogue.length === 0 && courseLMPs.length === 0 ? 0.55 : 1 }}
                            >
                                <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#fdba74' }}>Update Existing LMP</span>
                                <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
                                    Replace the Master LMP template, then refresh assigned Individual LMPs while preserving completed events.
                                </span>
                            </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
                            <button
                                onClick={() => setShowUploadModal(false)}
                                style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                                    backgroundColor: '#374151', color: '#d1d5db', border: 'none', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                <>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4, lineHeight: 1.6 }}>
                    Upload an Excel (.xlsx) file to populate <strong style={{ color: '#f9fafb' }}>{isTrainingPackagesTab ? getCourseTitle(selectedCourseType) : masterUploadIntent === 'new' ? (newUploadPackageName.trim() || 'the new Master LMP') : getCourseTitle(uploadTargetLmpCode || selectedCourseType)}</strong> with {isTrainingPackagesTab ? `${packageFoundationLabel} training package` : 'Master LMP'} events.
                    {isTrainingPackagesTab ? ' These rows will be saved to Training Packages, not Master LMP.' : ''}
                </p>
                <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
                    Preferred sheet name: <strong style={{ color: '#d1d5db' }}>Syllabus_LMP</strong>. If that sheet is not present, the first worksheet is used. Mandatory data: Event description, Type, and a positive duration in either Flight or Sim Hours or Total Event Hours. Optional columns: Code, Course, Phase, Module, Day/Night, Dual/Solo, prerequisites, Event Details - Common, Event Details - Sortie, Method/s of Delivery, Method/s of Assessment, Resources Required (physical), Resources Required (Human), Resource Number, CONFIG. Blank Code cells are generated from the selected {activeCollectionNoun}.
                </p>

                {!isTrainingPackagesTab && !uploadResult && (
                    <div style={{ marginBottom: 16, padding: 12, border: '1px solid #374151', borderRadius: 8, backgroundColor: '#111827' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af',
                                textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {masterUploadIntent === 'new' ? 'New Master LMP' : 'Master LMP to update'}
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    setMasterUploadIntent(null);
                                    setUploadReview(null);
                                    setShowUploadOneByOneReview(false);
                                    setUploadResult(null);
                                    setUploadFile(null);
                                }}
                                style={{ fontSize: 11, color: '#7dd3fc', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                            >
                                Change upload type
                            </button>
                        </div>
                        {masterUploadIntent === 'new' ? (
                            <div style={{ display: 'grid', gap: 10 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>
                                        LMP name
                                    </label>
                                    <input
                                        type="text"
                                        value={newUploadPackageName}
                                onChange={e => { setNewUploadPackageName(e.target.value); setUploadReview(null); setShowUploadOneByOneReview(false); }}
                                        placeholder="e.g. UPT"
                                        style={{ width: '100%', fontSize: 13, color: '#f9fafb', backgroundColor: '#0f172a',
                                            border: '1px solid #374151', borderRadius: 6, padding: '8px 10px' }}
                                    />
                                    {newUploadPackageName.trim() && (
                                        <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                                            LMP code: <strong style={{ color: '#d1d5db' }}>{getPackageCodeFromTitle(newUploadPackageName)}</strong>
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <select
                                value={uploadTargetLmpCode}
                                onChange={event => { setUploadTargetLmpCode(event.target.value); setUploadReview(null); setUploadResult(null); setShowUploadOneByOneReview(false); }}
                                style={{ width: '100%', fontSize: 13, color: '#f9fafb', backgroundColor: '#0f172a',
                                    border: '1px solid #374151', borderRadius: 6, padding: '8px 10px' }}
                            >
                                {Array.from(new Set([...activeMasterLmpCatalogue.map(entry => entry.code), ...courseLMPs])).filter(Boolean).map(code => (
                                    <option key={code} value={code}>{getCourseTitle(code)}</option>
                                ))}
                            </select>
                        )}
                        <div style={{ marginTop: 10 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>
                                Version
                            </label>
                            <input
                                type="text"
                                value={uploadLmpVersion}
                                onChange={e => { setUploadLmpVersion(e.target.value); setUploadReview(null); setShowUploadOneByOneReview(false); }}
                                placeholder="1.0"
                                style={{ width: 120, fontSize: 13, color: '#f9fafb', backgroundColor: '#0f172a',
                                    border: '1px solid #374151', borderRadius: 6, padding: '8px 10px' }}
                            />
                        </div>
                        {masterUploadIntent === 'update' && (
                            <div style={{ marginTop: 12, padding: 10, border: '1px solid #334155', borderRadius: 8, backgroundColor: '#0f172a' }}>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af',
                                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                    Individual LMP update method
                                </label>
                                {[
                                    {
                                        id: 'automatic' as const,
                                        label: 'Automatic update',
                                        detail: 'Protect each trainee up to their last completed event, then update only future events using the new Master LMP order.',
                                    },
                                    {
                                        id: 'one-by-one' as const,
                                        label: 'One-by-one review',
                                        detail: 'Review the affected trainees before applying. The automatic protected cut point is still used as the starting suggestion.',
                                    },
                                ].map(option => (
                                    <label key={option.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8, cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="lmpUpdateReviewMode"
                                            checked={lmpUpdateReviewMode === option.id}
                                            onChange={() => { setLmpUpdateReviewMode(option.id); setUploadReview(null); setShowUploadOneByOneReview(false); setShowUploadFinalWarning(false); }}
                                            style={{ marginTop: 3 }}
                                        />
                                        <span>
                                            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#f9fafb' }}>{option.label}</span>
                                            <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', lineHeight: 1.35 }}>{option.detail}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}

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
                        setUploadProgress(null);
                        setUploadReview(null);
                        setShowUploadOneByOneReview(false);
                        setShowUploadFinalWarning(false);
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
                        onChange={e => { setUploadFile(e.target.files?.[0] || null); setUploadResult(null); setUploadProgress(null); setUploadReview(null); setShowUploadOneByOneReview(false); setShowUploadFinalWarning(false); }}
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

                {uploadReview?.preview && !uploadResult && (
                    <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#082f49', border: '1px solid #0e7490', borderRadius: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#bae6fd', marginBottom: 8 }}>
                            Review before import
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: '#d1d5db' }}>
                            <div><strong style={{ color: '#fff' }}>Target:</strong> {uploadReview.preview.destinationName || uploadReview.preview.destinationCode}</div>
                            <div><strong style={{ color: '#fff' }}>Version:</strong> {uploadReview.preview.lmpVersion || uploadLmpVersion || 'N/A'}</div>
                            <div><strong style={{ color: '#fff' }}>Uploaded events:</strong> {uploadReview.preview.uploadedEventRows}</div>
                            <div><strong style={{ color: '#fff' }}>Existing Master rows:</strong> {uploadReview.preview.existingMasterRows}</div>
                            <div><strong style={{ color: '#fff' }}>Assigned trainees:</strong> {uploadReview.preview.assignedTrainees}</div>
                            <div><strong style={{ color: '#fff' }}>Completed events protected:</strong> {uploadReview.preview.protectedCompletedEvents}</div>
                        </div>
                        {!isTrainingPackagesTab && masterUploadIntent === 'update' && (
                            <p style={{ marginTop: 10, fontSize: 11, color: '#fde68a', lineHeight: 1.45 }}>
                                Applying this update will replace the Master LMP event list. Assigned Individual LMPs will be refreshed from each trainee's last completed event onward; earlier uploaded events will be ignored for that trainee.
                            </p>
                        )}
                    </div>
                )}

                {uploadReview?.preview && showUploadFinalWarning && !uploadResult && (
                    <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#1c1917', border: '1px solid #f97316', borderRadius: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#fdba74', marginBottom: 6 }}>
                            Final warning before applying update
                        </p>
                        <p style={{ fontSize: 11, color: '#fed7aa', lineHeight: 1.45 }}>
                            This will permanently update Master LMP {uploadTargetLmpCode || selectedCourseType}. The app will then refresh assigned Individual LMPs while protecting completed events and only changing future events.
                        </p>
                        <p style={{ marginTop: 8, fontSize: 11, color: '#fef3c7', fontWeight: 700 }}>
                            Click Confirm and Apply Update to start the real database update.
                        </p>
                    </div>
                )}

                {uploadReview?.preview && showUploadOneByOneReview && !uploadResult && !isTrainingPackagesTab && masterUploadIntent === 'update' && (
                    <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#111827', border: '1px solid #38bdf8', borderRadius: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#bae6fd', marginBottom: 6 }}>
                            One-by-one Individual LMP review
                        </p>
                        <p style={{ fontSize: 11, color: '#d1d5db', lineHeight: 1.45, marginBottom: 10 }}>
                            Select a trainee, then compare their current Individual LMP with the proposed updated LMP. Completed events are protected.
                        </p>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                            Trainee to review
                        </label>
                        <select
                            value={oneByOneSelectedTraineeKey}
                            onChange={event => setOneByOneSelectedTraineeKey(event.target.value)}
                            style={{ width: '100%', marginBottom: 10, fontSize: 13, color: '#f9fafb', backgroundColor: '#0f172a',
                                border: '1px solid #374151', borderRadius: 6, padding: '8px 10px' }}
                        >
                            {oneByOneUploadTrainees.map(trainee => {
                                const key = String((trainee as any).id || trainee.idNumber || trainee.fullName || trainee.name);
                                return (
                                    <option key={key} value={key}>
                                        {trainee.rank ? `${trainee.rank} ` : ''}{trainee.name || trainee.fullName} - {trainee.course || 'No course'}
                                    </option>
                                );
                            })}
                        </select>
                        {oneByOneLmpError && (
                            <p style={{ marginBottom: 8, fontSize: 11, color: '#fca5a5' }}>{oneByOneLmpError}</p>
                        )}
                        {oneByOneLmpLoading && (
                            <p style={{ marginBottom: 8, fontSize: 11, color: '#93c5fd' }}>Loading Individual LMP for selected trainee...</p>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                                    Current Individual LMP ({oneByOneCurrentEvents.length})
                                </p>
                                <div ref={oneByOneCurrentListRef} style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #334155', borderRadius: 6, backgroundColor: '#0f172a' }}>
                                    {oneByOneCurrentEvents.length > 0 ? oneByOneCurrentEvents.map((event: any, index: number) => {
                                        const tokens = [event?.id, event?.code, event?.masterEventId, event?.eventDescription, event?.title]
                                            .map(value => String(value || '').replace('*', '').trim().toUpperCase())
                                            .filter(Boolean);
                                        const isCompleted = tokens.some(token => oneByOneCompletedTokens.has(token));
                                        const isLastCompleted = index === oneByOneLastCompletedIndex;
                                        return (
                                            <div key={`${event?.id || event?.code || index}-${index}`} style={{
                                                display: 'grid',
                                                gridTemplateColumns: '22px 1fr',
                                                gap: 7,
                                                padding: '7px 9px',
                                                borderBottom: '1px solid #1f2937',
                                                backgroundColor: isLastCompleted ? 'rgba(14, 116, 144, 0.25)' : 'transparent',
                                            }}>
                                                <span style={{ color: isCompleted ? '#4ade80' : '#64748b', fontWeight: 900 }}>{isCompleted ? '✓' : ''}</span>
                                                <span>
                                                    <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#f9fafb' }}>{event?.code || event?.eventDescription || `Event ${index + 1}`}</span>
                                                    <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', lineHeight: 1.3 }}>{event?.eventDescription || event?.description || ''}</span>
                                                    {isLastCompleted && <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: '#67e8f9', fontWeight: 700 }}>Last completed event</span>}
                                                </span>
                                            </div>
                                        );
                                    }) : (
                                        <p style={{ padding: 9, fontSize: 11, color: '#fca5a5' }}>No current Individual LMP loaded for this trainee.</p>
                                    )}
                                </div>
                            </div>
                            <div>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                                    Proposed Updated LMP ({oneByOneProposalRows.length})
                                </p>
                                <div ref={oneByOneProposedListRef} style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #334155', borderRadius: 6, backgroundColor: '#0f172a' }}>
                                    {oneByOneProposalRows.length > 0 ? oneByOneProposalRows.map((event: any, index: number) => {
                                        const action = event.proposalAction || '';
                                        const isProtected = action.startsWith('Skip');
                                        const isDelete = action === 'Delete';
                                        const actionColor = isProtected ? '#fbbf24' : isDelete ? '#f87171' : action === 'Add' ? '#4ade80' : action === 'Amend' ? '#38bdf8' : '#cbd5e1';
                                        return (
                                            <div key={`${event.eventCode || event.code || index}-${index}`} style={{
                                                display: 'grid',
                                                gridTemplateColumns: '28px 1fr',
                                                gap: 7,
                                                padding: '7px 9px',
                                                borderBottom: '1px solid #1f2937',
                                                opacity: isProtected ? 0.72 : 1,
                                                backgroundColor: isDelete ? 'rgba(127, 29, 29, 0.28)' : index === oneByOneProtectedNewIndex ? 'rgba(14, 116, 144, 0.25)' : 'transparent',
                                            }}>
                                                <span style={{ color: isDelete ? '#f87171' : '#64748b', fontSize: 10 }}>{isDelete ? 'DEL' : index + 1}</span>
                                                <span>
                                                    <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: isDelete ? '#fecaca' : '#f9fafb', textDecoration: isDelete ? 'line-through' : 'none' }}>{event.eventCode || event.code || `Event ${index + 1}`}</span>
                                                    <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', lineHeight: 1.3 }}>{event.eventDescription || event.description || ''}</span>
                                                    <span style={{ display: 'inline-block', marginTop: 3, fontSize: 9, color: actionColor, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                        {action}
                                                    </span>
                                                </span>
                                            </div>
                                        );
                                    }) : (
                                        <p style={{ padding: 9, fontSize: 11, color: '#fca5a5' }}>No proposed LMP events were returned by the upload review.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8, fontSize: 10, color: '#94a3b8' }}>
                            <div>
                                {oneByOneLastCompletedCode
                                    ? <>Scrolled near last completed: <strong style={{ color: '#d1d5db' }}>{oneByOneLastCompletedCode}</strong></>
                                    : 'No completed event found for this trainee.'}
                            </div>
                            <div>
                                Proposed events before and including the protected cut point are skipped for this trainee.
                            </div>
                        </div>
                        <p style={{ marginTop: 10, fontSize: 11, color: '#fde68a', lineHeight: 1.45 }}>
                            Next step: click Apply Reviewed Update to permanently update the Master LMP and refresh assigned Individual LMPs.
                        </p>
                    </div>
                )}

                {isUploading && uploadProgress && (
                    <div style={{ marginBottom: 16, padding: 12, border: '1px solid #0e7490', borderRadius: 8, backgroundColor: '#082f49' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#bae6fd' }}>
                                {uploadProgress.message || 'Updating LMP...'}
                            </p>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#e0f2fe' }}>
                                {Math.max(0, Math.min(100, Number(uploadProgress.percent || 0)))}%
                            </span>
                        </div>
                        <div style={{ marginTop: 8, height: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: '#0f172a', border: '1px solid #075985' }}>
                            <div
                                style={{
                                    height: '100%',
                                    width: `${Math.max(0, Math.min(100, Number(uploadProgress.percent || 0)))}%`,
                                    backgroundColor: uploadProgress.status === 'error' ? '#ef4444' : '#38bdf8',
                                    transition: 'width 180ms ease',
                                }}
                            />
                        </div>
                        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>
                                <strong style={{ display: 'block', color: '#e0f2fe', fontSize: 12 }}>{uploadProgress.current || 0}/{uploadProgress.total || 0}</strong>
                                processed
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>
                                <strong style={{ display: 'block', color: '#e0f2fe', fontSize: 12 }}>{uploadProgress.created || 0}</strong>
                                created
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>
                                <strong style={{ display: 'block', color: '#e0f2fe', fontSize: 12 }}>{uploadProgress.updated || 0}</strong>
                                updated
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>
                                <strong style={{ display: 'block', color: '#e0f2fe', fontSize: 12 }}>{uploadProgress.deleted || 0}</strong>
                                deleted
                            </div>
                        </div>
                        <p style={{ marginTop: 8, fontSize: 10, color: '#7dd3fc' }}>
                            Phase: {uploadProgress.phase || 'starting'}
                        </p>
                    </div>
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
                        {uploadResult.individualLmpSync && (
                            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                                Individual LMPs refreshed: {uploadResult.individualLmpSync.assignedTrainees} trainee{uploadResult.individualLmpSync.assignedTrainees === 1 ? '' : 's'} &nbsp;|&nbsp; Completed events protected: {uploadResult.individualLmpSync.protectedCompletedEvents}
                            </p>
                        )}
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
                    {(uploadReview || uploadResult) && (
                        <button
                            type="button"
                            onClick={() => downloadUploadTrace(uploadResult ? 'lmp-upload-result' : 'lmp-upload-review')}
                            style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                                backgroundColor: '#111827', color: '#fdba74', border: '1px solid #92400e', cursor: 'pointer', marginRight: 'auto' }}
                        >
                            Download Trace
                        </button>
                    )}
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
                            disabled={
                                !uploadFile
                                || isUploading
                                || (isTrainingPackagesTab && uploadMode === 'create' && !newUploadPackageName.trim())
                                || (!isTrainingPackagesTab && masterUploadIntent === 'new' && !newUploadPackageName.trim())
                                || (!isTrainingPackagesTab && masterUploadIntent === 'update' && !uploadTargetLmpCode)
                            }
                            style={{ padding: '8px 20px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                                backgroundColor: uploadFile && !isUploading ? '#0284c7' : '#1e3a5f',
                                color: '#fff', border: 'none', cursor: uploadFile && !isUploading ? 'pointer' : 'not-allowed' }}
                        >
                            {isUploading
                                ? (uploadReview ? 'Applying…' : 'Reviewing…')
                                : uploadReview
                                    ? (!isTrainingPackagesTab && masterUploadIntent === 'update'
                                        ? (lmpUpdateReviewMode === 'one-by-one'
                                            ? (showUploadOneByOneReview
                                                ? (showUploadFinalWarning ? 'Confirm and Apply Reviewed Update' : 'Review Final Warning')
                                                : 'Start One-by-one Review')
                                            : (showUploadFinalWarning ? 'Confirm and Apply Update' : 'Review Final Warning'))
                                        : 'Create LMP')
                                    : 'Review Upload'}
                        </button>
                    )}
                </div>
                </>
                )}
            </div>
        </div>
    )}
    {showAssignTrainingModal && activeStaffTrainingAssignment && (
        <AssignTrainingModal
            heading={isAssigningFlightSchoolLmp ? 'Assign LMP' : 'Assign Training'}
            title={isAssigningFlightSchoolLmp
                ? `Master LMP: ${activeFlightSchoolLmpAssignment?.title || activeFlightSchoolLmpAssignment?.lmpCode || selectedCourseType} · ${selectedCourseAudience === 'staff' ? 'Staff only' : 'Trainees only'}`
                : `${activeAirCombatTrainingAssignment?.kind === 'course' ? 'Course' : 'Training Package'}: ${activeAirCombatTrainingAssignment?.title || activeAirCombatTrainingAssignment?.code || selectedCourseType}`}
            emptyMessage={isAssigningFlightSchoolLmp ? 'No active staff available for this unit.' : 'No active squadron staff available for this unit.'}
            showStaffAssignments={showStaffInAssignTraining}
            staff={assignableTrainingStaff}
            trainees={showTraineesInAssignTraining ? courseFilteredAssignableFlightSchoolTrainees : []}
            lmpOptions={showTraineesInAssignTraining ? assignLmpOptions : []}
            selectedLmpCode={assignLmpCode || activeFlightSchoolLmpAssignment?.lmpCode || selectedCourseType}
            courseOptions={showTraineesInAssignTraining ? assignableFlightSchoolTraineeCourses : []}
            selectedCourseKeys={assignCourseSelection}
            selectedStaffIds={assignTrainingSelection}
            selectedTraineeIds={assignTraineeSelection}
            saving={isSavingTrainingAssignments}
            onToggle={(idNumber) => {
                setAssignTrainingSelection(prev => {
                    const next = new Set(prev);
                    if (next.has(idNumber)) next.delete(idNumber);
                    else next.add(idNumber);
                    return next;
                });
            }}
            onToggleTrainee={showTraineesInAssignTraining ? (idNumber) => {
                setAssignTraineeSelection(prev => {
                    const next = new Set(prev);
                    if (next.has(idNumber)) next.delete(idNumber);
                    else next.add(idNumber);
                    return next;
                });
            } : undefined}
            onLmpChange={showTraineesInAssignTraining ? (code) => {
                const cleanCode = String(code || '').trim();
                setAssignLmpCode(cleanCode);
                setAssignTraineeSelection(new Set(
                    assignableFlightSchoolTrainees
                        .filter(trainee => String(trainee.lmpType || '').trim().toUpperCase() === cleanCode.toUpperCase())
                        .map(trainee => trainee.idNumber)
                ));
            } : undefined}
            onToggleCourse={showTraineesInAssignTraining ? (course) => {
                setAssignCourseSelection(prev => {
                    const next = new Set(prev);
                    if (next.has(course)) next.delete(course);
                    else next.add(course);
                    return next;
                });
            } : undefined}
            onSelectAll={() => setAssignTrainingSelection(new Set(assignableTrainingStaff.map(staff => staff.idNumber)))}
            onDeselectAll={() => setAssignTrainingSelection(new Set())}
            onSelectAllCourses={() => setAssignCourseSelection(new Set(assignableFlightSchoolTraineeCourses))}
            onDeselectAllCourses={() => setAssignCourseSelection(new Set())}
            onSelectAllTrainees={() => setAssignTraineeSelection(prev => {
                const next = new Set(prev);
                courseFilteredAssignableFlightSchoolTrainees.forEach(trainee => next.add(trainee.idNumber));
                return next;
            })}
            onDeselectAllTrainees={() => setAssignTraineeSelection(prev => {
                const next = new Set(prev);
                courseFilteredAssignableFlightSchoolTrainees.forEach(trainee => next.delete(trainee.idNumber));
                return next;
            })}
            onDownloadTrace={showTraineesInAssignTraining ? onDownloadAssignmentTrace : undefined}
            onCancel={() => setShowAssignTrainingModal(false)}
            onSave={saveAssignTraining}
        />
    )}
    </>
  );
};

export default SyllabusView;
