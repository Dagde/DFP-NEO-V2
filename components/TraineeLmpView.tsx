import React, { useState, useEffect, useMemo } from 'react';
import { Trainee, SyllabusItemDetail, Score } from '../types';
import AuditButton from './AuditButton';
import { useSystemFreeze } from '../hooks/useSystemFreeze';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import {
    INSERT_EVENT_LABEL_MAX_LENGTH,
    type InsertEventDayNight,
    type InsertEventTypeConfig,
} from '../utils/insertEventTypes';
import {
    ANY_AIRCRAFT_CONFIG,
    formatAircraftConfigurationSummary,
    normaliseSelectedAircraftConfigurations,
    type AircraftConfigurationDefinition,
} from '../utils/aircraftConfigurationSettings';
import {
    DEFAULT_AIRCRAFT_CREW_COMPOSITION,
    filterAircraftCrewCompositionForResource,
    getAircraftSeatEligibleRolesForResource,
    type AircraftCrewComposition,
    type AircraftCrewResourceKind,
    type AircraftSeatRole,
} from '../utils/aircraftCrewComposition';

interface TraineeLmpViewProps {
  trainee: Trainee;
  traineeLmp: SyllabusItemDetail[];
  scores: Score[];
  onBack: () => void;
  // Optional: full syllabus + all trainees for Academic LMP tab
  syllabusDetails?: SyllabusItemDetail[];
  allTraineesData?: Trainee[];
  // Optional: open a training report for a specific lesson
  onOpenPt051ForLesson?: (trainee: Trainee, lessonCode: string) => void;
  canOpenPt051?: boolean;
  onAccessDenied?: (actionLabel: string) => void;
  resourceDisplayNames?: ResourceDisplayNames;
  aircraftConfigurations?: AircraftConfigurationDefinition[];
  aircraftCrewComposition?: AircraftCrewComposition;
  onDeleteRemedialItem?: (trainee: Trainee, item: SyllabusItemDetail) => Promise<boolean> | boolean;
  onGeneratePt051ForItem?: (trainee: Trainee, item: SyllabusItemDetail) => void;
  insertEventTypes?: InsertEventTypeConfig[];
  onInsertCustomEvent?: (trainee: Trainee, event: InsertLmpEventRequest) => Promise<boolean> | boolean;
  onUpdateLmpItem?: (trainee: Trainee, originalItem: SyllabusItemDetail, updatedItem: SyllabusItemDetail) => Promise<boolean> | boolean;
  trainingReportDisplayName?: string;
}

export interface InsertLmpEventRequest {
    eventType: InsertEventTypeConfig;
    label: string;
    dayNight: InsertEventDayNight;
    duration: number;
    flightOrSimHours: number;
    totalEventHours: number;
    preFlightTime: number;
    postFlightTime: number;
    resourceCount: number;
    peopleRequired: string[];
    followsEventId: string;
}

const splitListInput = (value: string): string[] =>
    value
        .split('\n')
        .map(item => item.trim())
        .filter(Boolean);

const joinListInput = (items?: string[]): string => (items || []).join('\n');

const getInsertEventCrewResourceKind = (eventType?: InsertEventTypeConfig): AircraftCrewResourceKind | null => {
    const syllabusType = String(eventType?.syllabusType || '').trim().toLowerCase();
    if (!syllabusType || syllabusType === 'academics') return null;
    if (syllabusType === 'ftd' || syllabusType === 'sim' || syllabusType === 'simulator') return 'sim';
    if (syllabusType === 'cpt' || syllabusType === 'procedural trainer') return 'cpt';
    return 'flight';
};

const getInsertEventCrewSeats = (
    eventType?: InsertEventTypeConfig,
    aircraftCrewComposition?: AircraftCrewComposition,
): AircraftSeatRole[] => {
    const resourceKind = getInsertEventCrewResourceKind(eventType);
    if (!resourceKind) return [];
    return filterAircraftCrewCompositionForResource(
        aircraftCrewComposition || DEFAULT_AIRCRAFT_CREW_COMPOSITION,
        resourceKind,
    ).seats;
};

const getDefaultPeopleRequiredForInsertType = (
    eventType?: InsertEventTypeConfig,
    aircraftCrewComposition?: AircraftCrewComposition,
): string[] => getInsertEventCrewSeats(eventType, aircraftCrewComposition)
    .map((seat) => {
        const resourceKind = getInsertEventCrewResourceKind(eventType);
        const eligibleRoles = resourceKind ? getAircraftSeatEligibleRolesForResource(seat, resourceKind) : [];
        return eligibleRoles.find(role => role.toUpperCase() === String(seat.role || '').trim().toUpperCase()) || eligibleRoles[0] || seat.role;
    })
    .filter(Boolean);

const alignPhysicalResourcesToResourceNumber = (
    resources: string[],
    resourceNumber: number,
    resourceLabel = 'Aircraft'
): string[] => {
    const count = Math.max(0, Math.round(Number(resourceNumber) || 0));
    const existing = resources.filter(resource => String(resource || '').trim().length > 0);
    if (count === 0) return existing;

    const aligned = existing.slice(0, count);
    for (let index = aligned.length; index < count; index++) {
        aligned.push(count === 1 ? resourceLabel : `${resourceLabel} ${index + 1}`);
    }
    return aligned;
};

const AircraftConfigInfoIcon: React.FC<{ definitions: AircraftConfigurationDefinition[] }> = ({ definitions }) => (
    <span className="group relative inline-flex">
        <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-500 text-[10px] font-bold text-gray-300 hover:border-sky-400 hover:text-sky-200"
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

const AircraftConfigCheckboxes: React.FC<{
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
        <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-xs text-gray-100">
                <input type="checkbox" checked={selected.includes(ANY_AIRCRAFT_CONFIG)} onChange={() => toggle(ANY_AIRCRAFT_CONFIG, true)} />
                ANY
            </label>
            {definitions.map(definition => (
                <label key={definition.id} className="flex items-center gap-2 rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-xs text-gray-100">
                    <input
                        type="checkbox"
                        checked={!selected.includes(ANY_AIRCRAFT_CONFIG) && selected.includes(definition.id)}
                        onChange={(event) => toggle(definition.id, event.target.checked)}
                    />
                    {definition.label}
                </label>
            ))}
        </div>
    );
};

export const LmpEventEditModal: React.FC<{
    item: SyllabusItemDetail;
    aircraftConfigurations: AircraftConfigurationDefinition[];
    description?: string;
    onCancel: () => void;
    onSave: (updatedItem: SyllabusItemDetail) => void;
}> = ({ item, aircraftConfigurations, description = 'Update the event details used by Individual LMP and NEO Build.', onCancel, onSave }) => {
    const [code, setCode] = useState(item.code || item.id || '');
    const [eventDescription, setEventDescription] = useState(item.eventDescription || '');
    const [type, setType] = useState<SyllabusItemDetail['type']>(item.type || 'Flight');
    const [dayNight, setDayNight] = useState<SyllabusItemDetail['dayNight']>(item.dayNight || 'Day');
    const [sortieType, setSortieType] = useState<'Dual' | 'Solo'>(item.sortieType || 'Dual');
    const [duration, setDuration] = useState(item.duration || 1);
    const [flightOrSimHours, setFlightOrSimHours] = useState(item.flightOrSimHours || 0);
    const [totalEventHours, setTotalEventHours] = useState(item.totalEventHours || item.duration || 1);
    const [preFlightTime, setPreFlightTime] = useState(item.preFlightTime || 0);
    const [postFlightTime, setPostFlightTime] = useState(item.postFlightTime || 0);
    const [resourceNumber, setResourceNumber] = useState(item.resourceNumber ?? (item.resourcesPhysical?.length ? item.resourcesPhysical.length : 0));
    const [acceptableAircraftConfigs, setAcceptableAircraftConfigs] = useState<string[]>(() => (
        normaliseSelectedAircraftConfigurations(item.acceptableAircraftConfigs, aircraftConfigurations)
    ));
    const [resourcesPhysical, setResourcesPhysical] = useState(joinListInput(item.resourcesPhysical));
    const [resourcesHuman, setResourcesHuman] = useState(joinListInput(item.resourcesHuman));
    const [validationMessage, setValidationMessage] = useState('');

    const handleSave = () => {
        const trimmedCode = code.trim().slice(0, 8);
        if (!trimmedCode) {
            setValidationMessage('Enter an event label.');
            return;
        }
        if (!Number.isFinite(duration) || duration <= 0) {
            setValidationMessage('Duration must be greater than zero.');
            return;
        }

        const roundedResourceNumber = Math.max(0, Math.round(Number(resourceNumber) || 0));
        const normalizedPhysicalResources = alignPhysicalResourcesToResourceNumber(
            splitListInput(resourcesPhysical),
            roundedResourceNumber
        );
        onSave({
            ...item,
            code: trimmedCode,
            eventDescription: eventDescription.trim() || trimmedCode,
            type,
            dayNight,
            sortieType: type === 'Flight' ? sortieType : undefined,
            duration: Math.max(0.25, Number(duration) || 0.25),
            flightOrSimHours: Math.max(0, Number(flightOrSimHours) || 0),
            totalEventHours: Math.max(0.25, Number(totalEventHours) || 0.25),
            preFlightTime: Math.max(0, Number(preFlightTime) || 0),
            postFlightTime: Math.max(0, Number(postFlightTime) || 0),
            resourceNumber: roundedResourceNumber,
            resourceCount: roundedResourceNumber,
            acceptableAircraftConfigs: normaliseSelectedAircraftConfigurations(acceptableAircraftConfigs, aircraftConfigurations),
            resourcesPhysical: normalizedPhysicalResources,
            resourcesHuman: splitListInput(resourcesHuman),
        } as SyllabusItemDetail & { resourceCount: number });
    };

    return (
        <div className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto bg-black/70 px-4 pb-4 pt-[96px]">
            <div className="max-h-[calc(100vh-112px)] w-full max-w-3xl overflow-y-auto rounded-xl border border-sky-500/35 bg-gray-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-white">Edit LMP Event</h2>
                        <p className="mt-1 text-xs text-gray-400">{description}</p>
                    </div>
                    <button type="button" onClick={onCancel} className="text-2xl leading-none text-gray-400 hover:text-white">×</button>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-2">
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tile Label</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" value={code} maxLength={8} onChange={(event) => setCode(event.target.value.slice(0, 8))} />
                        <span className="block text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">{code.length}/8</span>
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Description</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Type</span>
                        <select className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" value={type} onChange={(event) => setType(event.target.value as SyllabusItemDetail['type'])}>
                            <option value="Flight">Flight</option>
                            <option value="FTD">FTD</option>
                            <option value="Ground School">Ground School</option>
                            <option value="Academics">Academics</option>
                        </select>
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Day/Night</span>
                        <select className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" value={dayNight} onChange={(event) => setDayNight(event.target.value as SyllabusItemDetail['dayNight'])}>
                            <option value="Day">Day</option>
                            <option value="Night">Night</option>
                            <option value="Day/Night">Both</option>
                        </select>
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dual/Solo</span>
                        <select className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" value={sortieType} disabled={type !== 'Flight'} onChange={(event) => setSortieType(event.target.value as 'Dual' | 'Solo')}>
                            <option value="Dual">Dual</option>
                            <option value="Solo">Solo</option>
                        </select>
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Resource Number</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" type="number" step="1" min="0" value={resourceNumber} onChange={(event) => setResourceNumber(Number(event.target.value))} />
                    </label>
                    <div className="space-y-2 rounded border border-gray-700 bg-gray-950/60 p-3 md:col-span-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">CONFIG</span>
                            <AircraftConfigInfoIcon definitions={aircraftConfigurations} />
                            <span className="text-[11px] text-gray-500">{formatAircraftConfigurationSummary(acceptableAircraftConfigs, aircraftConfigurations)}</span>
                        </div>
                        <AircraftConfigCheckboxes
                            value={acceptableAircraftConfigs}
                            definitions={aircraftConfigurations}
                            onChange={setAcceptableAircraftConfigs}
                        />
                    </div>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Duration</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" type="number" step="0.25" min="0.25" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Flight/Sim Hours</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" type="number" step="0.25" min="0" value={flightOrSimHours} onChange={(event) => setFlightOrSimHours(Number(event.target.value))} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pre Event Time</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" type="number" step="0.25" min="0" value={preFlightTime} onChange={(event) => setPreFlightTime(Number(event.target.value))} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Post Event Time</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" type="number" step="0.25" min="0" value={postFlightTime} onChange={(event) => setPostFlightTime(Number(event.target.value))} />
                    </label>
                    <label className="space-y-1 md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Physical Resources</span>
                        <textarea className="min-h-[74px] w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" value={resourcesPhysical} onChange={(event) => setResourcesPhysical(event.target.value)} />
                    </label>
                    <label className="space-y-1 md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">People Required</span>
                        <textarea className="min-h-[74px] w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" value={resourcesHuman} onChange={(event) => setResourcesHuman(event.target.value)} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total Event Hours</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" type="number" step="0.25" min="0.25" value={totalEventHours} onChange={(event) => setTotalEventHours(Number(event.target.value))} />
                    </label>
                </div>
                {validationMessage && <div className="px-5 pb-2 text-sm font-semibold text-red-300">{validationMessage}</div>}
                <div className="flex justify-end gap-px border-t border-gray-700 px-5 py-4">
                    <button type="button" onClick={onCancel} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed">Cancel</button>
                    <button type="button" onClick={handleSave} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed">Save</button>
                </div>
            </div>
        </div>
    );
};

// ─── Shared sub-components ───────────────────────────────────────────────────

const DetailCard: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div className={`bg-gray-700/50 p-3 rounded-lg ${className}`}>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
        <p className="mt-1 text-md font-semibold text-white">{value}</p>
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

export const InsertEventModal: React.FC<{
    traineeLmp: SyllabusItemDetail[];
    insertEventTypes: InsertEventTypeConfig[];
    selectedAnchorItem?: SyllabusItemDetail | null;
    aircraftCrewComposition?: AircraftCrewComposition;
    description?: string;
    onCancel: () => void;
    onSave: (request: InsertLmpEventRequest) => void;
}> = ({ traineeLmp, insertEventTypes, selectedAnchorItem, aircraftCrewComposition = DEFAULT_AIRCRAFT_CREW_COMPOSITION, description = 'Create an Individual LMP event with the scheduling fields NEO Build needs.', onCancel, onSave }) => {
    const options = insertEventTypes;
    const initialAnchorItem = selectedAnchorItem && traineeLmp.some(item => (item.id || item.code) === (selectedAnchorItem.id || selectedAnchorItem.code))
        ? selectedAnchorItem
        : traineeLmp[0];
    const initialEventType = (() => {
        if (!initialAnchorItem) return options[0];
        const exactMatch = options.find(option => option.syllabusType === initialAnchorItem.type && option.dayNight === initialAnchorItem.dayNight);
        if (exactMatch) return exactMatch;
        return options.find(option => option.syllabusType === initialAnchorItem.type) || options[0];
    })();
    const [selectedLabel, setSelectedLabel] = useState(initialEventType?.label || options[0]?.label || 'GF');
    const selectedType = options.find(option => option.label === selectedLabel) || options[0];
    const [label, setLabel] = useState((selectedType?.label || '').slice(0, INSERT_EVENT_LABEL_MAX_LENGTH));
    const [dayNight, setDayNight] = useState<InsertEventDayNight>(selectedType?.dayNight || 'Day');
    const [duration, setDuration] = useState(selectedType?.duration || 1);
    const [flightOrSimHours, setFlightOrSimHours] = useState(selectedType?.flightOrSimHours || 0);
    const [totalEventHours, setTotalEventHours] = useState(selectedType?.totalEventHours || 1);
    const [preFlightTime, setPreFlightTime] = useState(selectedType?.preFlightTime || 0);
    const [postFlightTime, setPostFlightTime] = useState(selectedType?.postFlightTime || 0);
    const [resourceCount, setResourceCount] = useState(selectedType?.resourceCount || 0);
    const [peopleRequired, setPeopleRequired] = useState<string[]>(() => getDefaultPeopleRequiredForInsertType(selectedType, aircraftCrewComposition));
    const [followsEventId, setFollowsEventId] = useState(initialAnchorItem?.id || initialAnchorItem?.code || '');
    const [validationMessage, setValidationMessage] = useState('');
    const peopleRequiredSeats = useMemo(
        () => getInsertEventCrewSeats(selectedType, aircraftCrewComposition),
        [aircraftCrewComposition, selectedType],
    );

    useEffect(() => {
        setPeopleRequired(current => {
            if (peopleRequiredSeats.length === 0) return current.length === 0 ? current : [];
            const resourceKind = getInsertEventCrewResourceKind(selectedType);
            const next = peopleRequiredSeats.map((seat, index) => {
                const eligibleRoles = resourceKind ? getAircraftSeatEligibleRolesForResource(seat, resourceKind) : [];
                const currentRole = current[index];
                if (currentRole && eligibleRoles.some(role => role.toUpperCase() === currentRole.toUpperCase())) return currentRole;
                return eligibleRoles.find(role => role.toUpperCase() === String(seat.role || '').trim().toUpperCase()) || eligibleRoles[0] || seat.role || '';
            });
            if (next.length === current.length && next.every((value, index) => value === current[index])) return current;
            return next;
        });
    }, [peopleRequiredSeats, selectedType]);

    if (options.length === 0) {
        return (
            <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-4">
                <div className="w-full max-w-md rounded-xl border border-sky-500/35 bg-gray-900 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
                        <h2 className="text-lg font-bold text-white">Insert Event</h2>
                        <button type="button" onClick={onCancel} className="text-2xl leading-none text-gray-400 hover:text-white">×</button>
                    </div>
                    <div className="p-5 text-sm text-gray-300">
                        No insert event types are configured.
                    </div>
                    <div className="flex justify-end border-t border-gray-700 px-5 py-4">
                        <button type="button" onClick={onCancel} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed">Close</button>
                    </div>
                </div>
            </div>
        );
    }

    const handleTypeChange = (nextLabel: string) => {
        const nextType = options.find(option => option.label === nextLabel) || options[0];
        setSelectedLabel(nextLabel);
        setLabel((nextType?.label || '').slice(0, INSERT_EVENT_LABEL_MAX_LENGTH));
        setDayNight(nextType?.dayNight || 'Day');
        setDuration(nextType?.duration || 1);
        setFlightOrSimHours(nextType?.flightOrSimHours || 0);
        setTotalEventHours(nextType?.totalEventHours || 1);
        setPreFlightTime(nextType?.preFlightTime || 0);
        setPostFlightTime(nextType?.postFlightTime || 0);
        setResourceCount(nextType?.resourceCount || 0);
        setPeopleRequired(getDefaultPeopleRequiredForInsertType(nextType, aircraftCrewComposition));
    };

    const handleSave = () => {
        const trimmedLabel = label.trim().slice(0, INSERT_EVENT_LABEL_MAX_LENGTH);
        if (!trimmedLabel) {
            setValidationMessage('Enter an event label.');
            return;
        }
        if (!followsEventId) {
            setValidationMessage('Select the event this new event immediately follows.');
            return;
        }
        if (!Number.isFinite(duration) || duration <= 0) {
            setValidationMessage('Duration must be greater than zero.');
            return;
        }
        onSave({
            eventType: selectedType,
            label: trimmedLabel,
            dayNight,
            duration,
            flightOrSimHours: Math.max(0, flightOrSimHours),
            totalEventHours: Math.max(duration, totalEventHours),
            preFlightTime: Math.max(0, preFlightTime),
            postFlightTime: Math.max(0, postFlightTime),
            resourceCount: Math.max(0, Math.round(resourceCount)),
            peopleRequired: peopleRequired.map(item => item.trim()).filter(Boolean),
            followsEventId,
        });
    };

    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-sky-500/35 bg-gray-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-white">Insert Event</h2>
                        <p className="mt-1 text-xs text-gray-400">{description}</p>
                    </div>
                    <button type="button" onClick={onCancel} className="text-2xl leading-none text-gray-400 hover:text-white">×</button>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-2">
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Event Type</span>
                        <select className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" value={selectedLabel} onChange={(event) => handleTypeChange(event.target.value)}>
                            {options.map(option => <option key={option.label} value={option.label}>{option.label}</option>)}
                        </select>
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tile Label</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" value={label} maxLength={INSERT_EVENT_LABEL_MAX_LENGTH} onChange={(event) => setLabel(event.target.value.slice(0, INSERT_EVENT_LABEL_MAX_LENGTH))} />
                        <span className="block text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label.length}/{INSERT_EVENT_LABEL_MAX_LENGTH}</span>
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Day/Night</span>
                        <select className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" value={dayNight} onChange={(event) => setDayNight(event.target.value as InsertEventDayNight)}>
                            <option value="Day">Day</option>
                            <option value="Night">Night</option>
                            <option value="Day/Night">Both</option>
                        </select>
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Immediately Follows</span>
                        <select className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" value={followsEventId} onChange={(event) => setFollowsEventId(event.target.value)}>
                            {traineeLmp.map(item => <option key={item.id || item.code} value={item.id || item.code}>{item.code}</option>)}
                        </select>
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Duration</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" type="number" step="0.25" min="0.25" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Flight/Sim Hours</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" type="number" step="0.25" min="0" value={flightOrSimHours} onChange={(event) => setFlightOrSimHours(Number(event.target.value))} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pre Event Time</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" type="number" step="0.25" min="0" value={preFlightTime} onChange={(event) => setPreFlightTime(Number(event.target.value))} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Post Event Time</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" type="number" step="0.25" min="0" value={postFlightTime} onChange={(event) => setPostFlightTime(Number(event.target.value))} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total Event Hours</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" type="number" step="0.25" min="0.25" value={totalEventHours} onChange={(event) => setTotalEventHours(Number(event.target.value))} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Aircraft / Resources Required</span>
                        <input className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white" type="number" step="1" min="0" value={resourceCount} onChange={(event) => setResourceCount(Number(event.target.value))} />
                    </label>
                    <div className="space-y-2 md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">People Required</span>
                        {peopleRequiredSeats.length > 0 ? (
                            <div className="grid gap-2 md:grid-cols-2">
                                {peopleRequiredSeats.map((seat, index) => {
                                    const resourceKind = getInsertEventCrewResourceKind(selectedType);
                                    const eligibleRoles = resourceKind ? getAircraftSeatEligibleRolesForResource(seat, resourceKind) : [];
                                    return (
                                        <label key={seat.id || index} className="space-y-1">
                                            <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                                {seat.role || `Position ${index + 1}`}
                                            </span>
                                            <select
                                                className="w-full rounded border border-gray-600 bg-gray-950 px-3 py-2 text-sm text-white"
                                                value={peopleRequired[index] || eligibleRoles[0] || ''}
                                                onChange={(event) => {
                                                    const next = [...peopleRequired];
                                                    next[index] = event.target.value;
                                                    setPeopleRequired(next);
                                                }}
                                            >
                                                {eligibleRoles.map(role => <option key={role} value={role}>{role}</option>)}
                                            </select>
                                        </label>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-400">No people required for this event type.</div>
                        )}
                    </div>
                </div>
                {validationMessage && <div className="px-5 pb-2 text-sm font-semibold text-red-300">{validationMessage}</div>}
                <div className="flex justify-end gap-px border-t border-gray-700 px-5 py-4">
                    <button type="button" onClick={onCancel} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed">Cancel</button>
                    <button type="button" onClick={handleSave} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed">Insert</button>
                </div>
            </div>
        </div>
    );
};

const getScoreColor = (score: number, type: 'text' | 'bg') => {
    const colors = {
        '2-5': { text: 'text-green-300', bg: 'bg-green-500/20' },
        '1': { text: 'text-amber-300', bg: 'bg-amber-500/20' },
        '0': { text: 'text-red-300', bg: 'bg-red-500/20' },
    };
    const key = score >= 2 ? '2-5' : score === 1 ? '1' : '0';
    return colors[key][type];
};

const getDisplayType = (syllabusItem: SyllabusItemDetail): 'Flight' | 'FTD' | 'CPT' | 'Ground' => {
    if (syllabusItem.type === 'Flight') return 'Flight';
    if (syllabusItem.type === 'FTD') return 'FTD';
    if (syllabusItem.type === 'Ground School') {
        if (syllabusItem.code.includes('CPT')) return 'CPT';
        return 'Ground';
    }
    return 'Flight';
};

const formatDisplayType = (displayType: ReturnType<typeof getDisplayType>, resourceDisplayNames: ResourceDisplayNames) => {
    if (displayType === 'FTD') return resourceDisplayNames.ftd;
    if (displayType === 'CPT') return resourceDisplayNames.cpt;
    return displayType;
};

const REMEDIAL_EVENT_CODE_REGEX = /-(?:REM-[A-Z]+\d+|RFTD\d+|RRF\d+|RT\d+|RF\d+|FTD\d+|F\d+|T\d+)$/i;

const isRemedialLmpItem = (item: SyllabusItemDetail): boolean =>
    item.lmpSource === 'remedial' ||
    item.isRemedial === true ||
    item.module === 'Remedial' ||
    REMEDIAL_EVENT_CODE_REGEX.test(item.id || '') ||
    REMEDIAL_EVENT_CODE_REGEX.test(item.code || '');

const getLmpItemKeys = (item: Partial<SyllabusItemDetail>): string[] =>
    [item.id, item.code, item.masterEventId]
        .map(value => String(value || '').replace(/\*/g, '').trim().toUpperCase())
        .filter(Boolean);

const isAddedLmpItem = (item: SyllabusItemDetail, masterLmpKeys?: Set<string>): boolean => {
    if (
        item.lmpSource === 'custom' ||
        item.lmpSource === 'remedial' ||
        item.isRemedial === true
    ) {
        return true;
    }

    const itemKeys = getLmpItemKeys(item);
    if (masterLmpKeys && masterLmpKeys.size > 0 && itemKeys.length > 0) {
        return !itemKeys.some(key => masterLmpKeys.has(key));
    }

    return /X\d+$/i.test(String(item.code || item.id || '')) ||
        (!item.masterEventId && item.lmpSource !== 'master');
};

const formatHours = (value: unknown): string => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue.toFixed(1) : '0.0';
};

const formatLmpModuleLabel = (value: unknown): string => {
    const cleanValue = String(value || '').trim();
    if (!cleanValue) return 'Module';

    const moduleNumber = cleanValue.match(/\d+/)?.[0];
    return moduleNumber ? `M ${moduleNumber}` : cleanValue;
};

const formatLmpSortieLabel = (item: SyllabusItemDetail, resourceDisplayNames: ResourceDisplayNames): string => {
    if (item.type === 'Flight') return item.sortieType || 'Dual';
    return formatDisplayType(getDisplayType(item), resourceDisplayNames);
};

const formatLmpDurationLabel = (item: SyllabusItemDetail): string =>
    `${formatHours(item.duration)}h`;

const DEFAULT_ASSESSED_ELEMENTS = ['Airmanship', 'Preparation', 'Technique'];

const getAssessedElements = (item: SyllabusItemDetail): string[] => (
    Array.isArray(item.assessedElements) && item.assessedElements.length > 0
        ? item.assessedElements
        : DEFAULT_ASSESSED_ELEMENTS
);

const DetailView: React.FC<{
    item: SyllabusItemDetail;
    score: Score | undefined;
    resourceDisplayNames?: ResourceDisplayNames;
    aircraftConfigurations?: AircraftConfigurationDefinition[];
    isRemedial?: boolean;
    isAddedItem?: boolean;
    onDelete?: (item: SyllabusItemDetail) => void;
}> = ({ item, score, resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES, aircraftConfigurations = [], isRemedial = false, isAddedItem = false, onDelete }) => (
    <div className="space-y-6">
        {isRemedial && (
            <div className="flex items-center justify-between rounded-lg border border-red-500/40 bg-red-950/35 px-4 py-3">
                <div>
                    <p className="text-sm font-bold text-red-100">Remedial Package Event</p>
                    <p className="text-xs text-red-200/80">Use this action to remove this event from the trainee's Individual LMP.</p>
                </div>
                <button
                    type="button"
                    disabled={!onDelete}
                    onClick={() => onDelete?.(item)}
                    className={`rounded-md border px-4 py-2 text-sm font-bold ${
                        onDelete
                            ? 'border-red-400/70 bg-red-700 text-white hover:bg-red-600'
                            : 'border-gray-600 bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    Delete Remedial Event
                </button>
            </div>
        )}
        <div className="flex items-start justify-between gap-4">
            <div>
                <h2 className="text-3xl font-bold text-white">{item.code}</h2>
                <p className="text-lg text-gray-400 mt-1">{item.eventDescription}</p>
            </div>
        </div>
        
        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Core Details</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <DetailCard label="Phase" value={item.phase} />
                <DetailCard label="Module" value={item.module} />
                <DetailCard label="Type" value={formatDisplayType(getDisplayType(item), resourceDisplayNames)} />
                <DetailCard label="Day/Night" value={item.dayNight || 'Day'} />
                <DetailCard label="Dual/Solo" value={item.sortieType || 'Dual'} />
                <DetailCard label="Total Event Hours" value={<>{formatHours(item.totalEventHours)} <span className="text-sm font-normal">hrs</span></>} />
                <DetailCard label="Flight/Sim Hours" value={<>{formatHours(item.flightOrSimHours)} <span className="text-sm font-normal">hrs</span></>} />
                <DetailCard label="Resource Number" value={item.resourceNumber ?? (item.resourcesPhysical?.length ? 1 : 0)} />
                <DetailCard
                    label={<span className="flex items-center">CONFIG<AircraftConfigInfoIcon definitions={aircraftConfigurations} /></span>}
                    value={formatAircraftConfigurationSummary(item.acceptableAircraftConfigs, aircraftConfigurations)}
                />
            </div>
        </fieldset>

        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Assessed Elements</legend>
            <div className="mt-2 flex flex-wrap gap-2 rounded-lg bg-gray-900/45 p-3">
                {getAssessedElements(item).map(element => (
                    <span key={element} className="rounded border border-sky-700/50 bg-sky-950/50 px-2.5 py-1 text-xs font-semibold text-sky-100">
                        {element}
                    </span>
                ))}
            </div>
        </fieldset>

        {score && (
            <fieldset className="p-4 border border-sky-700 rounded-lg bg-sky-900/10">
                <legend className="px-2 text-sm font-semibold text-sky-300">Trainee's Score</legend>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <DetailCard 
                        label="Overall Score"
                        value={
                            item.type === 'Ground School' ? (
                                <div className="flex items-center space-x-2">
                                    <div className={`w-8 h-8 ${isAddedItem ? 'bg-amber-500' : 'bg-green-500'} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                                        -
                                    </div>
                                    <span className={isAddedItem ? 'text-amber-300' : 'text-green-300'}>Complete</span>
                                </div>
                            ) : (
                                <span className={`text-xl ${getScoreColor(score.score, 'text')}`}>{score.score}</span>
                            )
                        }
                    />
                     <DetailCard label="Date" value={score.date} />
                     <DetailCard label="Instructor" value={score.instructor} />
                </div>
                 <div className="mt-4">
                     <DetailCard label="Notes" value={<p className="whitespace-pre-wrap">{score.notes}</p>} />
                 </div>
            </fieldset>
        )}
        
        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Prerequisites</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <DetailList title="Ground School" items={item.prerequisitesGround} />
                <DetailList title="Sim/Flying" items={item.prerequisitesFlying} />
            </div>
        </fieldset>

        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Event Breakdown</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <DetailList title="Methods of Delivery" items={item.methodOfDelivery} />
                <DetailList title="Methods of Assessment" items={item.methodOfAssessment} />
            </div>
        </fieldset>

         <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Resources</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <DetailList title="Physical Resources" items={item.resourcesPhysical} />
                <DetailList title="People Required" items={item.resourcesHuman} />
            </div>
        </fieldset>
    </div>
);

const CheckIcon: React.FC<{ tone?: 'green' | 'amber' }> = ({ tone = 'green' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${tone === 'amber' ? 'text-amber-400' : 'text-green-400'} flex-shrink-0`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
);

const MissedIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
);

// ─── Academic LMP Tab ─────────────────────────────────────────────────────────

interface AcademicLmpTabProps {
    trainee: Trainee;
    scores: Score[];
    syllabusDetails: SyllabusItemDetail[];
    allTraineesData: Trainee[];
    onOpenPt051ForLesson?: (trainee: Trainee, lessonCode: string) => void;
    canOpenPt051?: boolean;
    onAccessDenied?: (actionLabel: string) => void;
    trainingReportDisplayName?: string;
}

const AcademicLmpTab: React.FC<AcademicLmpTabProps> = ({
    trainee,
    scores,
    syllabusDetails,
    allTraineesData,
    onOpenPt051ForLesson,
    canOpenPt051 = true,
    onAccessDenied,
    trainingReportDisplayName = 'Training Report',
}) => {
    const [selectedLesson, setSelectedLesson] = useState<SyllabusItemDetail | null>(null);

    // Build academic syllabus for this trainee
    // Only type === 'Academics' (Ground School = flying phase ground events, not academic lessons)
    // Filtered by trainee.academicLmpType (set per-trainee or inherited from course)
    const academicSyllabus = useMemo(() => {
        const academicLmpType = (trainee as any).academicLmpType;
        if (!academicLmpType) return []; // No academic LMP assigned — show prompt
        return syllabusDetails.filter(s =>
            s.type === 'Academics' &&
            s.courses?.includes(academicLmpType)
        ).sort((a, b) => {
            // Sort by phase then module then code
            if (a.phase !== b.phase) return (a.phase || '').localeCompare(b.phase || '');
            if (a.module !== b.module) return (a.module || '').localeCompare(b.module || '');
            return (a.code || '').localeCompare(b.code || '');
        });
    }, [syllabusDetails, (trainee as any).academicLmpType]);

    // Set of lesson codes this trainee has completed (has a Score record)
    const completedLessonCodes = useMemo(() => {
        const codes = new Set<string>();
        scores.forEach(s => {
            if (s.event) codes.add(s.event.replace('*', ''));
        });
        return codes;
    }, [scores]);

    // Course-mates: all trainees in the same course
    const courseMates = useMemo(() =>
        allTraineesData.filter(t => t.course === trainee.course && t.fullName !== trainee.fullName),
        [allTraineesData, trainee.course, trainee.fullName]
    );

    // Build a set of lesson codes that at least one coursemate has completed
    // (used to identify "missed" lessons — course progressed past this, trainee hasn't)
    // Note: we don't have all-trainees scores here, but we can detect missed via
    // counting how many courseMates would have a score vs trainee
    // For now, we determine "course has done this" by checking if >50% of courseMates have it
    // This is a UI approximation — the real calculation would require all scores.
    // Since we only receive this trainee's scores, "Missed" = lesson appears in academic syllabus
    // AND trainee has no score BUT the lesson is before the trainee's last completed lesson.
    const lastCompletedIndex = useMemo(() => {
        let last = -1;
        academicSyllabus.forEach((item, idx) => {
            if (completedLessonCodes.has(item.code)) last = idx;
        });
        return last;
    }, [academicSyllabus, completedLessonCodes]);

    const individualCount = completedLessonCodes.size;
    const totalCount = academicSyllabus.length;

    // Group by module for display
    const groupedByModule = useMemo(() => {
        const groups: Record<string, SyllabusItemDetail[]> = {};
        academicSyllabus.forEach(item => {
            const key = item.module?.trim() || item.phase?.trim() || 'General';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [academicSyllabus]);

    const handleOpenPt051 = (lesson: SyllabusItemDetail) => {
        if (onOpenPt051ForLesson) {
            onOpenPt051ForLesson(trainee, lesson.code);
        }
    };

    const academicLmpType = (trainee as any).academicLmpType;
    if (!academicLmpType) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-6 max-w-md">
                    <p className="text-amber-300 font-semibold text-lg mb-2">No Academic LMP Assigned</p>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        This trainee does not have an Academic LMP assigned.<br/>
                        Go to <span className="text-sky-400 font-medium">Course Roster → Edit Trainee</span> and set the <span className="text-sky-400 font-medium">Academic LMP</span> field,<br/>
                        or set it at the course level via <span className="text-sky-400 font-medium">Training Records → Edit Course</span>.
                    </p>
                </div>
            </div>
        );
    }

    if (academicSyllabus.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="text-4xl mb-4">📚</div>
                <p className="text-gray-400 text-lg font-medium">No Academic Syllabus Found</p>
                <p className="text-gray-500 text-sm mt-2">
                    No <span className="text-sky-400">Academics</span> type lessons found with course assignment: <span className="text-purple-400">"{academicLmpType}"</span>
                </p>
                <p className="text-gray-600 text-xs mt-2 max-w-md">
                    In the <span className="text-sky-400">Syllabus view</span>, ensure at least one event has type <strong className="text-white">Academics</strong> and has <span className="text-purple-400">"{academicLmpType}"</span> in its <strong className="text-white">Courses</strong> field.
                </p>
                <p className="text-gray-700 text-xs mt-1">
                    Total syllabus items loaded: {syllabusDetails.length} | 
                    Academics type items: {syllabusDetails.filter(s => s.type === 'Academics').length} |
                    Matching course: {syllabusDetails.filter(s => s.type === 'Academics' && s.courses?.includes(academicLmpType)).length}
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-row overflow-hidden">
            {/* Left panel: lesson list grouped by module */}
            <div className="w-1/3 border-r border-gray-700 overflow-y-auto">
                {/* Progress header */}
                <div className="p-3 bg-gray-800/60 border-b border-gray-700 sticky top-0 z-10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Individual Progress</span>
                        <span className="text-sm font-bold text-white">{individualCount}/{totalCount}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${totalCount > 0 ? (individualCount / totalCount) * 100 : 0}%` }}
                        />
                    </div>
                    {lastCompletedIndex > individualCount && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
                            <span>⚠</span>
                            <span>Behind — {lastCompletedIndex - individualCount + 1} lesson(s) missed</span>
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="px-3 py-2 border-b border-gray-700/50 flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><span className="text-green-400">✓</span> Attended</span>
                    <span className="flex items-center gap-1"><span className="text-red-400">✗</span> Missed</span>
                    <span className="flex items-center gap-1"><span className="text-gray-500">○</span> Pending</span>
                </div>

                {/* Lesson groups */}
                {Object.entries(groupedByModule).map(([moduleName, items]) => {
                    const moduleCompleted = items.filter(i => completedLessonCodes.has(i.code)).length;
                    return (
                        <div key={moduleName}>
                            <div className="px-3 py-1.5 bg-gray-800/40 border-b border-gray-700/50 flex items-center justify-between">
                                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider truncate">{moduleName}</span>
                                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{moduleCompleted}/{items.length}</span>
                            </div>
                            <ul className="p-1 space-y-0.5">
                                {items.map((item, idx) => {
                                    const isCompleted = completedLessonCodes.has(item.code);
                                    // "Missed" = not completed but there are completed lessons AFTER this in the syllabus
                                    const lessonIdx = academicSyllabus.findIndex(a => a.code === item.code);
                                    const isMissed = !isCompleted && lessonIdx < lastCompletedIndex;
                                    const isSelected = selectedLesson?.code === item.code;
                                    return (
                                        <li key={item.code}>
                                            <button
                                                onClick={() => setSelectedLesson(item)}
                                                className={`w-full text-left px-2 py-1.5 rounded transition-colors text-xs flex items-center gap-2 ${
                                                    isSelected
                                                        ? 'bg-sky-700 text-white font-semibold'
                                                        : isCompleted
                                                        ? 'text-green-300 hover:bg-gray-700/50'
                                                        : isMissed
                                                        ? 'text-red-300 hover:bg-gray-700/50'
                                                        : 'text-gray-400 hover:bg-gray-700/50'
                                                }`}
                                            >
                                                {isCompleted ? (
                                                    <CheckIcon />
                                                ) : isMissed ? (
                                                    <MissedIcon />
                                                ) : (
                                                    <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                                                        <div className="w-2 h-2 rounded-full border border-gray-600" />
                                                    </div>
                                                )}
                                                <span className="font-mono font-bold">{item.code}</span>
                                                <span className="truncate text-gray-400 text-xs">{item.eventDescription}</span>
                                                {isMissed && !isSelected && (
                                                    <span className="ml-auto flex-shrink-0 text-xs bg-red-900/50 text-red-300 px-1 rounded">MISSED</span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>

            {/* Right panel: detail view */}
            <div className="w-2/3 overflow-y-auto">
                {selectedLesson ? (
                    <div className="p-6 max-w-3xl mx-auto space-y-4">
                        {/* Lesson header */}
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white">{selectedLesson.code}</h2>
                                <p className="text-gray-400 mt-0.5">{selectedLesson.eventDescription}</p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                    <span className="bg-gray-700 px-2 py-0.5 rounded">{selectedLesson.module || selectedLesson.phase}</span>
                                    <span className="bg-gray-700 px-2 py-0.5 rounded">{selectedLesson.type}</span>
                                    {selectedLesson.duration ? (
                                        <span className="bg-gray-700 px-2 py-0.5 rounded">{selectedLesson.duration}h</span>
                                    ) : null}
                                </div>
                            </div>
                            {/* Status badge */}
                            {completedLessonCodes.has(selectedLesson.code) ? (
                                <span className="flex items-center gap-1.5 bg-green-900/40 text-green-300 px-3 py-1.5 rounded-lg text-sm font-semibold border border-green-700/50">
                                    <CheckIcon /> Attended
                                </span>
                            ) : (() => {
                                const lessonIdx = academicSyllabus.findIndex(a => a.code === selectedLesson.code);
                                return lessonIdx < lastCompletedIndex ? (
                                    <span className="flex items-center gap-1.5 bg-red-900/40 text-red-300 px-3 py-1.5 rounded-lg text-sm font-semibold border border-red-700/50">
                                        <MissedIcon /> Missed
                                    </span>
                                ) : (
                                    <span className="bg-gray-700/50 text-gray-400 px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-600/50">
                                        Not Yet Attended
                                    </span>
                                );
                            })()}
                        </div>

                        {/* Completion record (if attended) */}
                        {(() => {
                            const lessonScore = scores.find(s => s.event === selectedLesson.code || s.event === selectedLesson.code + '*');
                            if (!lessonScore) return null;
                            return (
                                <fieldset className="p-4 border border-green-700/50 rounded-lg bg-green-900/10">
                                    <legend className="px-2 text-sm font-semibold text-green-300">Attendance Record</legend>
                                    <div className="grid grid-cols-3 gap-4 mt-2">
                                        <DetailCard label="Date" value={lessonScore.date} />
                                        <DetailCard label="Instructor" value={lessonScore.instructor || '—'} />
                                        <DetailCard label="Result" value={
                                            <span className="text-green-300 font-bold">Complete ✓</span>
                                        } />
                                    </div>
                                    {lessonScore.notes && (
                                        <div className="mt-3">
                                            <DetailCard label="Notes" value={<p className="whitespace-pre-wrap text-sm">{lessonScore.notes}</p>} />
                                        </div>
                                    )}
                                </fieldset>
                            );
                        })()}

                        {/* Open training report button */}
                        {onOpenPt051ForLesson && (
                            <div className="flex items-center gap-px pt-2">
                                <button
                                    onClick={() => {
                                        if (!canOpenPt051) {
                                            onAccessDenied?.(`${trainingReportDisplayName} from Individual LMP`);
                                            return;
                                        }
                                        handleOpenPt051(selectedLesson);
                                    }}
                                    disabled={!canOpenPt051}
                                    title={canOpenPt051 ? undefined : `Your permission profile does not allow opening ${trainingReportDisplayName} records`}
                                    className={`w-[140px] h-[41px] flex items-center justify-center text-center px-2 py-1 text-[11px] font-semibold rounded-md btn-aluminium-brushed ${!canOpenPt051 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {completedLessonCodes.has(selectedLesson.code) ? `View / Edit ${trainingReportDisplayName}` : `Open ${trainingReportDisplayName}`}
                                </button>
                                <span className="text-xs text-gray-500 italic">
                                    {completedLessonCodes.has(selectedLesson.code)
                                        ? 'View or edit the attendance record for this lesson'
                                        : `Mark this lesson as attended via ${trainingReportDisplayName}`}
                                </span>
                            </div>
                        )}

                        {/* Lesson details */}
                        <fieldset className="p-4 border border-gray-700 rounded-lg">
                            <legend className="px-2 text-sm font-semibold text-gray-300">Lesson Details</legend>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                                <DetailCard label="Phase" value={selectedLesson.phase || '—'} />
                                <DetailCard label="Module" value={selectedLesson.module || '—'} />
                                <DetailCard label="Duration" value={
                                    <>{selectedLesson.duration?.toFixed(1) || '—'} <span className="text-sm font-normal">hrs</span></>
                                } />
                            </div>
                        </fieldset>

                        {/* Method of Delivery */}
                        {selectedLesson.methodOfDelivery?.length > 0 && (
                            <fieldset className="p-4 border border-gray-700 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Method of Delivery</legend>
                                <div className="mt-2">
                                    <DetailList title="" items={selectedLesson.methodOfDelivery} />
                                </div>
                            </fieldset>
                        )}

                        {/* Method of Assessment */}
                        {selectedLesson.methodOfAssessment?.length > 0 && (
                            <fieldset className="p-4 border border-gray-700 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Method of Assessment</legend>
                                <div className="mt-2">
                                    <DetailList title="" items={selectedLesson.methodOfAssessment} />
                                </div>
                            </fieldset>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <div className="text-4xl mb-4">📖</div>
                        <p className="text-gray-500 italic">Select a lesson from the list to view its details and attendance record.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const TraineeLmpView: React.FC<TraineeLmpViewProps> = ({
    trainee,
    traineeLmp,
    scores,
    onBack,
    syllabusDetails,
    allTraineesData,
    onOpenPt051ForLesson,
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
    aircraftConfigurations = [],
    aircraftCrewComposition = DEFAULT_AIRCRAFT_CREW_COMPOSITION,
    canOpenPt051 = true,
    onAccessDenied,
    onDeleteRemedialItem,
    onGeneratePt051ForItem,
    insertEventTypes = [],
    onInsertCustomEvent,
    onUpdateLmpItem,
    trainingReportDisplayName = 'Training Report',
}) => {
    const { isFrozen } = useSystemFreeze();
    const [selectedItem, setSelectedItem] = useState<SyllabusItemDetail | null>(null);
    const [activeTab, setActiveTab] = useState<'neo' | 'academic'>('neo');
    const [showInsertEventModal, setShowInsertEventModal] = useState(false);
    const [itemBeingEdited, setItemBeingEdited] = useState<SyllabusItemDetail | null>(null);

    // Always show Academic tab when syllabusDetails prop is provided
    // The tab itself will show a "configure" message if academicLmpType not set
    const hasAcademicSyllabus = !!(syllabusDetails && syllabusDetails.length > 0);

    // ── NEO Build LMP: dual-source completion check ──
    const completedEventIds = useMemo(() => {
        const ids = new Set(scores.map(s => (s.event || '').replace('*', '')));
        traineeLmp.forEach((item: any) => {
            if (item.completedAt) {
                ids.add((item.id || item.code || '').replace('*', ''));
            }
        });
        // BIF FTD dependency rules
        if (ids.has('BIF FTD2') && !ids.has('BIF FTD1')) ids.add('BIF FTD1');
        if (ids.has('BIF1') && !ids.has('BIF FTD3')) ids.add('BIF FTD3');
        return ids;
    }, [scores, traineeLmp]);

    const masterLmpKeys = useMemo(() => {
        const keys = new Set<string>();
        (syllabusDetails || [])
            .filter(item => item.lmpSource !== 'custom' && item.lmpSource !== 'remedial' && item.isRemedial !== true)
            .forEach(item => getLmpItemKeys(item).forEach(key => keys.add(key)));
        return keys;
    }, [syllabusDetails]);

    useEffect(() => {
        if (activeTab !== 'neo') return;
        if (traineeLmp.length === 0) {
            setSelectedItem(null);
            return;
        }

        setSelectedItem(current => {
            if (current && traineeLmp.some(item => item.id === current.id || item.code === current.code)) {
                return current;
            }
            return traineeLmp[0];
        });
    }, [activeTab, trainee.fullName, traineeLmp]);

    // Tab button style helper
    const tabClass = (tab: 'neo' | 'academic') =>
        `px-4 py-2 text-sm font-semibold rounded-t-md transition-colors ${
            activeTab === tab
                ? 'bg-gray-900 text-sky-400 border-t border-l border-r border-gray-700'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-transparent'
        }`;

    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-white">Individual LMP</h1>
                    <p className="text-sm text-gray-400">{trainee.rank} {trainee.name} - {trainee.course}</p>
                </div>
                <div className="flex items-center gap-px">
                    <button
                        onClick={onBack}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed"
                    >
                        ← Back
                    </button>
                    {activeTab === 'neo' && (
                        <button
                            onClick={() => setShowInsertEventModal(true)}
                            disabled={!onInsertCustomEvent || traineeLmp.length === 0 || insertEventTypes.length === 0}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Insert<br />Event
                        </button>
                    )}
                    {activeTab === 'neo' && (
                        <button
                            onClick={() => selectedItem && setItemBeingEdited(selectedItem)}
                            disabled={!selectedItem || !onUpdateLmpItem}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Edit
                        </button>
                    )}
                    {activeTab === 'neo' && selectedItem && onGeneratePt051ForItem && (
                        <button
                            onClick={() => onGeneratePt051ForItem(trainee, selectedItem)}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed"
                        >
                            Generate<br />{trainingReportDisplayName}
                        </button>
                    )}
                    <AuditButton pageName="Individual LMP" />
                </div>
            </div>

            {showInsertEventModal && (
                <InsertEventModal
                    traineeLmp={traineeLmp}
                    insertEventTypes={insertEventTypes}
                    selectedAnchorItem={selectedItem}
                    aircraftCrewComposition={aircraftCrewComposition}
                    onCancel={() => setShowInsertEventModal(false)}
                    onSave={async (request) => {
                        const inserted = await onInsertCustomEvent?.(trainee, request);
                        if (inserted !== false) setShowInsertEventModal(false);
                    }}
                />
            )}

            {itemBeingEdited && (
                <LmpEventEditModal
                    item={itemBeingEdited}
                    aircraftConfigurations={aircraftConfigurations}
                    onCancel={() => setItemBeingEdited(null)}
                    onSave={async (updatedItem) => {
                        const updated = await onUpdateLmpItem?.(trainee, itemBeingEdited, updatedItem);
                        if (updated !== false) {
                            setSelectedItem(updatedItem);
                            setItemBeingEdited(null);
                        }
                    }}
                />
            )}

            {/* Tab switcher — only show if academic syllabus exists */}
            {hasAcademicSyllabus && (
                <div className="flex-shrink-0 bg-gray-800 px-4 pt-2 flex gap-1 border-b border-gray-700">
                    <button className={tabClass('neo')} onClick={() => setActiveTab('neo')}>
                        NEO Build LMP
                    </button>
                    <button className={tabClass('academic')} onClick={() => setActiveTab('academic')}>
                        Academic LMP
                    </button>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-row overflow-hidden relative">
                {/* Transparent freeze overlay */}
                {isFrozen && (
                    <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{ pointerEvents: 'all' }} />
                )}

                {/* ── Academic LMP Tab ── */}
                {activeTab === 'academic' && syllabusDetails && allTraineesData ? (
                    <AcademicLmpTab
                        trainee={trainee}
                        scores={scores}
                        syllabusDetails={syllabusDetails}
                        allTraineesData={allTraineesData}
                        onOpenPt051ForLesson={onOpenPt051ForLesson}
                        canOpenPt051={canOpenPt051}
                        onAccessDenied={onAccessDenied}
                        trainingReportDisplayName={trainingReportDisplayName}
                    />
                ) : (
                    /* ── NEO Build LMP Tab (existing) ── */
                    <>
                        {/* Left Column: Event Tiles */}
                        <div className="w-[310px] min-h-0 border-r border-gray-700 overflow-y-auto overscroll-contain bg-gray-950/25">
                            <ul className="p-3 space-y-2">
                                {traineeLmp.map(item => {
                                    const isCompleted = completedEventIds.has(item.code);
                                    const isAddedItem = isAddedLmpItem(item, masterLmpKeys);
                                    const isSelected = selectedItem?.code === item.code;
                                    const phaseLabel = item.phase || 'Phase';
                                    const moduleLabel = formatLmpModuleLabel(item.module);
                                    const sortieLabel = formatLmpSortieLabel(item, resourceDisplayNames);
                                    const dayLabel = item.dayNight || 'Day';
                                    const durationLabel = formatLmpDurationLabel(item);
                                    return (
                                        <li key={item.id || item.code}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedItem(item)}
                                                aria-pressed={isSelected}
                                                title={`${item.code}${item.eventDescription ? ` - ${item.eventDescription}` : ''}`}
                                                className={`relative h-[88px] w-full overflow-hidden rounded-md border px-3 py-2 text-left shadow-sm transition ${
                                                    isSelected
                                                        ? isAddedItem
                                                            ? 'border-amber-300 bg-sky-800/85 text-white shadow-sky-950/40'
                                                            : isCompleted
                                                                ? 'border-emerald-300 bg-sky-800/85 text-white shadow-sky-950/40'
                                                                : 'border-sky-300 bg-sky-800/85 text-white shadow-sky-950/40'
                                                        : isAddedItem
                                                            ? 'border-amber-500/70 bg-amber-950/20 text-gray-100 hover:border-amber-300/80 hover:bg-gray-800'
                                                            : isCompleted
                                                                ? 'border-emerald-500/60 bg-gray-900 text-gray-100 hover:border-emerald-300/70 hover:bg-gray-800'
                                                            : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-sky-500/60 hover:bg-gray-800'
                                                }`}
                                            >
                                                <span className={`absolute left-3 top-2 max-w-[42%] truncate text-[10px] font-bold uppercase ${isSelected ? 'text-sky-100' : 'text-gray-400'}`}>
                                                    {phaseLabel}
                                                </span>
                                                <span className={`absolute right-3 top-2 max-w-[42%] truncate text-[10px] font-bold uppercase ${isSelected ? 'text-sky-100' : 'text-gray-300'}`}>
                                                    {sortieLabel}
                                                </span>
                                                <span className="absolute inset-x-3 top-1/2 -translate-y-1/2 truncate text-center text-lg font-extrabold leading-tight">
                                                    {item.code}
                                                </span>
                                                <span className={`absolute bottom-2 left-3 max-w-[42%] truncate text-[11px] font-semibold uppercase ${isSelected ? 'text-sky-100' : 'text-gray-400'}`}>
                                                    {moduleLabel}
                                                </span>
                                                <span className={`absolute bottom-2 right-3 inline-flex max-w-[50%] items-center gap-3 overflow-hidden text-[11px] font-semibold uppercase ${isSelected ? 'text-sky-100' : 'text-gray-300'}`}>
                                                    <span className="truncate">{dayLabel}</span>
                                                    <span className="shrink-0">{durationLabel}</span>
                                                </span>
                                                {isCompleted && (
                                                    <span className="absolute left-1/2 top-2 -translate-x-1/2" aria-label="Completed">
                                                        <CheckIcon tone={isAddedItem ? 'amber' : 'green'} />
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        {/* Right Column: Detail View */}
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                            <div className="p-6 max-w-5xl mx-auto min-h-full">
                                {selectedItem ? (
                                    <DetailView
                                        item={selectedItem}
                                        score={scores.find(s => s.event === selectedItem.code)}
                                        resourceDisplayNames={resourceDisplayNames}
                                        aircraftConfigurations={aircraftConfigurations}
                                        isRemedial={isRemedialLmpItem(selectedItem)}
                                        isAddedItem={isAddedLmpItem(selectedItem, masterLmpKeys)}
                                        onDelete={isRemedialLmpItem(selectedItem) && onDeleteRemedialItem
                                            ? async (item) => {
                                                const deleted = await onDeleteRemedialItem(trainee, item);
                                                if (deleted) setSelectedItem(null);
                                            }
                                            : undefined
                                        }
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <p className="text-gray-500 italic">Select an item from the list to view its details.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TraineeLmpView;
