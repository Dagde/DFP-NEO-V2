import React, { useMemo, useState } from 'react';
import { MasterCurrency, CurrencyRequirement, type ContinuationEventSetting } from '../types';
import { logAudit } from '../utils/auditLogger';
import { handleEditableTextBeforeInput, handleEditableTextKeyDownCapture, stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import { BASE_AIRCRAFT_CONFIG, type AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import { normaliseContinuationEventSettings } from '../utils/continuationEvents';
import { showDarkAlert } from './DarkMessageModal';

interface ContinuationCurrencyEventsSettingsProps {
    sctShortLabel: string;
    sctLongLabel: string;
    sctEvents: ContinuationEventSetting[];
    onUpdateSctEvents: (events: ContinuationEventSetting[]) => void;
    masterCurrencies: MasterCurrency[];
    currencyRequirements: CurrencyRequirement[];
    canEditSettings: boolean;
    onOpenCurrencyRequirements?: () => void;
    aircraftConfigurationDefinitions?: AircraftConfigurationDefinition[];
    activeUnitCode?: string;
    activeUnitCodes?: string[];
    activeCompositeUnitCode?: string;
    activeAircraftTypeCode?: string | null;
}

const standardSettingsButtonClass = 'w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md disabled:cursor-not-allowed disabled:opacity-50';

const InfoBadge = ({ title, ariaLabel }: { title: string; ariaLabel: string }) => (
    <span
        role="img"
        aria-label={ariaLabel}
        title={title}
        className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-cyan-400/35 bg-gray-950/20 text-cyan-100/70"
    >
        <span className="font-serif text-[11px] font-bold italic leading-none normal-case">i</span>
    </span>
);

const ContinuationCurrencyEventsSettings: React.FC<ContinuationCurrencyEventsSettingsProps> = ({
    sctShortLabel,
    sctLongLabel,
    sctEvents,
    onUpdateSctEvents,
    masterCurrencies,
    currencyRequirements,
    canEditSettings,
    onOpenCurrencyRequirements,
    aircraftConfigurationDefinitions = [],
    activeUnitCode = '',
    activeUnitCodes = [],
    activeCompositeUnitCode = '',
    activeAircraftTypeCode = '',
}) => {
    const [isEditingSctEvents, setIsEditingSctEvents] = useState(false);
    const [tempSctEvents, setTempSctEvents] = useState<ContinuationEventSetting[]>([]);
    const [newSctEvent, setNewSctEvent] = useState('');
    const [selectedSctEventId, setSelectedSctEventId] = useState<string | null>(null);

    const configuredSctEvents = useMemo(() => normaliseContinuationEventSettings(sctEvents), [sctEvents]);
    const activeCurrencyNames = useMemo(() => Array.from(new Set(
        [...masterCurrencies, ...currencyRequirements]
            .filter(currency => currency.isVisible)
            .map(currency => String(currency.name || '').trim())
            .filter(Boolean),
    )), [masterCurrencies, currencyRequirements]);
    const aircraftConfigOptions = useMemo(() => {
        const definitions = Array.isArray(aircraftConfigurationDefinitions) && aircraftConfigurationDefinitions.length > 0
            ? aircraftConfigurationDefinitions
            : [BASE_AIRCRAFT_CONFIG];
        return Array.from(new Map([
            ['ANY', { id: 'ANY', label: 'ANY' }],
            ...definitions.map(definition => [definition.id, { id: definition.id, label: definition.label || definition.id }] as const),
        ]).values());
    }, [aircraftConfigurationDefinitions]);
    const activeUnitCodeList = useMemo(() => Array.from(new Set([
        activeUnitCode,
        ...(Array.isArray(activeUnitCodes) ? activeUnitCodes : []),
    ].map(unit => String(unit || '').trim().toUpperCase()).filter(Boolean))), [activeUnitCode, activeUnitCodes]);
    const activeContinuationAircraftTypeCode = useMemo(() => String(activeAircraftTypeCode || '').trim().toUpperCase(), [activeAircraftTypeCode]);
    const displayedSctEvents = isEditingSctEvents ? tempSctEvents : configuredSctEvents;
    const selectedTempSctEvent = tempSctEvents.find(event => (event.id || event.name) === selectedSctEventId) || null;
    const selectedConfiguredSctEvent = configuredSctEvents.find(event => (event.id || event.name) === selectedSctEventId) || null;

    const applyContinuationEventDefaults = (event: ContinuationEventSetting): ContinuationEventSetting => ({
        ...event,
        aircraftTypeCode: String(event.aircraftTypeCode || '').trim().toUpperCase() || activeContinuationAircraftTypeCode,
    });

    const updateTempSctEvent = (eventId: string, updates: Partial<ContinuationEventSetting>) => {
        setTempSctEvents(current => current.map(event => (
            (event.id || event.name) === eventId ? { ...event, ...updates } : event
        )));
    };

    const toggleTempSctConfig = (eventId: string, configId: string) => {
        setTempSctEvents(current => current.map(event => {
            if ((event.id || event.name) !== eventId) return event;
            const currentConfigs = Array.isArray(event.acceptableAircraftConfigs) && event.acceptableAircraftConfigs.length > 0
                ? event.acceptableAircraftConfigs
                : [event.config || 'ANY'];
            const selected = new Set(currentConfigs);
            if (selected.has(configId)) selected.delete(configId);
            else selected.add(configId);
            const nextConfigs = Array.from(selected);
            const safeConfigs = nextConfigs.length > 0 ? nextConfigs : ['ANY'];
            return { ...event, acceptableAircraftConfigs: safeConfigs, config: safeConfigs[0] || 'ANY' };
        }));
    };

    const handleEditSctEvents = async () => {
        if (!selectedSctEventId || !selectedConfiguredSctEvent) {
            await showDarkAlert('Select an event tile before editing.', 'Select Event First', 'warning');
            return;
        }
        const editableEvents = normaliseContinuationEventSettings(sctEvents).map(applyContinuationEventDefaults);
        setTempSctEvents(editableEvents);
        setIsEditingSctEvents(true);
    };

    const handleSaveSctEvents = () => {
        const cleanedEvents = normaliseContinuationEventSettings(tempSctEvents);
        const oldEvents = configuredSctEvents.map(event => event.name).join(', ');
        const newEvents = cleanedEvents.map(event => event.name).join(', ');
        onUpdateSctEvents(cleanedEvents);
        setIsEditingSctEvents(false);
        logAudit({
            page: `Settings - ${sctShortLabel} Events`,
            action: 'update',
            description: `Updated ${sctLongLabel} event types`,
            changes: `From: [${oldEvents}] To: [${newEvents}]`,
        });
    };

    const handleCancelSctEvents = () => {
        setNewSctEvent('');
        setIsEditingSctEvents(false);
    };

    const handleAddSctEvent = () => {
        const name = newSctEvent.trim();
        if (name && !tempSctEvents.some(event => event.name.toUpperCase() === name.toUpperCase())) {
            const newEvent = {
                id: `continuation-event-${Date.now()}`,
                name,
                code: name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CONT',
                unitCode: activeUnitCodeList[0] || '',
                compositeUnitCode: activeCompositeUnitCode || '',
                aircraftTypeCode: activeContinuationAircraftTypeCode,
                crew: '',
                config: 'ANY',
                acceptableAircraftConfigs: ['ANY'],
                currency: activeCurrencyNames[0] || name,
                dayNight: 'Day',
                flightType: 'Dual',
                aircraftCount: 1,
                status: 'ACTIVE',
            };
            setTempSctEvents([...tempSctEvents, newEvent]);
            setSelectedSctEventId(newEvent.id);
            setNewSctEvent('');
        }
    };

    const handleRemoveSctEvent = (eventToRemove: string) => {
        setTempSctEvents(tempSctEvents.filter(evt => (evt.id || evt.name) !== eventToRemove));
        if (selectedSctEventId === eventToRemove) setSelectedSctEventId(null);
    };

    const renderEventTile = (evt: ContinuationEventSetting) => {
        const eventKey = evt.id || evt.name;
        const isSelected = selectedSctEventId === eventKey;
        const selectedConfigs = Array.isArray(evt.acceptableAircraftConfigs) && evt.acceptableAircraftConfigs.length > 0
            ? evt.acceptableAircraftConfigs
            : [evt.config || 'ANY'];
        const unitLabel = evt.unitCode || activeUnitCodeList[0] || 'All units';
        const aircraftLabel = evt.aircraftTypeCode || activeContinuationAircraftTypeCode || 'Aircraft type not set';

        return (
            <li key={eventKey}>
                <button
                    type="button"
                    onClick={() => setSelectedSctEventId(eventKey)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                        isSelected
                            ? 'border-sky-400/70 bg-sky-950/30 shadow-[inset_3px_0_0_rgba(56,189,248,0.75)]'
                            : 'border-gray-700/80 bg-gray-900/45 hover:border-gray-500 hover:bg-gray-900/70'
                    }`}
                    aria-pressed={isSelected}
                >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-semibold text-white">{evt.name}</span>
                                <span className="rounded border border-gray-600/70 bg-gray-950/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-300">{evt.code || 'CONT'}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="rounded bg-gray-800/90 px-2 py-0.5 text-[11px] font-medium text-gray-300">{evt.dayNight || 'Day'}</span>
                                <span className="rounded bg-gray-800/90 px-2 py-0.5 text-[11px] font-medium text-gray-300">{evt.flightType || 'Dual'}</span>
                                {evt.currency && <span className="rounded bg-sky-950/50 px-2 py-0.5 text-[11px] font-medium text-sky-100">{evt.currency}</span>}
                            </div>
                        </div>
                        <div className="shrink-0 text-right text-[11px] text-gray-400">
                            <div className="font-semibold text-gray-300">A/C {Math.max(1, Number(evt.aircraftCount) || 1)}</div>
                            <div>{selectedConfigs.join(', ')}</div>
                        </div>
                    </div>
                    <div className="mt-3 grid gap-2 border-t border-gray-700/70 pt-2 text-[11px] text-gray-400 sm:grid-cols-3">
                        <span className="truncate"><span className="text-gray-500">Unit</span> {unitLabel}</span>
                        <span className="truncate"><span className="text-gray-500">Aircraft</span> {aircraftLabel}</span>
                        <span className="truncate"><span className="text-gray-500">Crew</span> {evt.crew || 'Default'}</span>
                    </div>
                </button>
            </li>
        );
    };

    const renderSelectedEventDetails = (evt: ContinuationEventSetting) => {
        const selectedConfigs = Array.isArray(evt.acceptableAircraftConfigs) && evt.acceptableAircraftConfigs.length > 0
            ? evt.acceptableAircraftConfigs
            : [evt.config || 'ANY'];
        const unitLabel = evt.unitCode || activeUnitCodeList[0] || 'All units';
        const aircraftLabel = evt.aircraftTypeCode || activeContinuationAircraftTypeCode || 'Aircraft type not set';

        return (
            <div className="rounded-md border border-gray-700 bg-gray-900/55 p-4">
                <div className="mb-4 flex items-start justify-between gap-3 border-b border-gray-700 pb-3">
                    <div className="min-w-0">
                        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Selected Event</div>
                        <div className="mt-1 truncate text-xl font-semibold text-white">{evt.name}</div>
                    </div>
                    <div className="rounded border border-gray-600/70 bg-gray-950/60 px-2 py-1 text-xs font-bold uppercase tracking-wide text-gray-300">
                        {evt.code || 'CONT'}
                    </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded border border-gray-700/80 bg-gray-950/35 p-3">
                        <div className="text-[10px] font-black uppercase tracking-wide text-gray-500">Currency</div>
                        <div className="mt-1 text-sm font-semibold text-gray-200">{evt.currency || 'None'}</div>
                    </div>
                    <div className="rounded border border-gray-700/80 bg-gray-950/35 p-3">
                        <div className="text-[10px] font-black uppercase tracking-wide text-gray-500">Unit</div>
                        <div className="mt-1 text-sm font-semibold text-gray-200">{unitLabel}</div>
                    </div>
                    <div className="rounded border border-gray-700/80 bg-gray-950/35 p-3">
                        <div className="text-[10px] font-black uppercase tracking-wide text-gray-500">A/C Type</div>
                        <div className="mt-1 text-sm font-semibold text-gray-200">{aircraftLabel}</div>
                    </div>
                    <div className="rounded border border-gray-700/80 bg-gray-950/35 p-3">
                        <div className="text-[10px] font-black uppercase tracking-wide text-gray-500">Day/Night</div>
                        <div className="mt-1 text-sm font-semibold text-gray-200">{evt.dayNight || 'Day'}</div>
                    </div>
                    <div className="rounded border border-gray-700/80 bg-gray-950/35 p-3">
                        <div className="text-[10px] font-black uppercase tracking-wide text-gray-500">Dual/Solo</div>
                        <div className="mt-1 text-sm font-semibold text-gray-200">{evt.flightType || 'Dual'}</div>
                    </div>
                    <div className="rounded border border-gray-700/80 bg-gray-950/35 p-3">
                        <div className="text-[10px] font-black uppercase tracking-wide text-gray-500">A/C</div>
                        <div className="mt-1 text-sm font-semibold text-gray-200">{Math.max(1, Number(evt.aircraftCount) || 1)}</div>
                    </div>
                </div>
                <div className="mt-3 rounded border border-gray-700/80 bg-gray-950/35 p-3">
                    <div className="text-[10px] font-black uppercase tracking-wide text-gray-500">Acceptable CONFIG</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {selectedConfigs.map(config => (
                            <span key={config} className="rounded bg-gray-800 px-2 py-0.5 text-xs font-semibold text-gray-200">{config}</span>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderSelectedEventEditor = (evt: ContinuationEventSetting) => {
        const eventKey = evt.id || evt.name;
        const selectedConfigs = Array.isArray(evt.acceptableAircraftConfigs) && evt.acceptableAircraftConfigs.length > 0
            ? evt.acceptableAircraftConfigs
            : [evt.config || 'ANY'];

        return (
            <div className="rounded-md border border-gray-700 bg-gray-900/70 p-4">
                <div className="mb-4 flex items-center justify-between border-b border-gray-700 pb-3">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Editing Event</div>
                        <div className="text-lg font-semibold text-white">{evt.name}</div>
                    </div>
                    <button type="button" onClick={() => handleRemoveSctEvent(eventKey)} className="flex h-[34px] items-center justify-center rounded border border-red-500/30 bg-red-950/40 px-3 text-xs font-bold text-red-200 hover:bg-red-900/50">
                        Delete
                    </button>
                </div>
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_150px_110px_110px_90px]">
                    <label className="min-w-0 text-[10px] font-black uppercase tracking-wide text-gray-400">
                        Event
                        <input
                            type="text"
                            value={evt.name}
                            onBeforeInput={event => handleEditableTextBeforeInput(event, value => updateTempSctEvent(eventKey, { name: value }))}
                            onChange={event => updateTempSctEvent(eventKey, { name: event.target.value })}
                            onKeyDownCapture={event => handleEditableTextKeyDownCapture(event, value => updateTempSctEvent(eventKey, { name: value }))}
                            className="mt-1 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm font-semibold normal-case tracking-normal text-white focus:outline-none focus:ring-sky-500"
                        />
                    </label>
                    <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                        Code
                        <input
                            type="text"
                            value={evt.code || ''}
                            maxLength={8}
                            onChange={event => updateTempSctEvent(eventKey, { code: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) })}
                            onKeyDownCapture={stopEditableKeyPropagation}
                            className="mt-1 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm font-semibold normal-case tracking-normal text-white focus:outline-none focus:ring-sky-500"
                        />
                    </label>
                    <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                        Day/Night
                        <select
                            value={evt.dayNight || 'Day'}
                            onChange={event => updateTempSctEvent(eventKey, { dayNight: event.target.value as ContinuationEventSetting['dayNight'] })}
                            className="mt-1 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm font-semibold normal-case tracking-normal text-white focus:outline-none focus:ring-sky-500"
                        >
                            <option>Day</option>
                            <option>Night</option>
                            <option>Day/Night</option>
                        </select>
                    </label>
                    <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                        Dual/Solo
                        <select
                            value={evt.flightType || 'Dual'}
                            onChange={event => updateTempSctEvent(eventKey, { flightType: event.target.value as ContinuationEventSetting['flightType'] })}
                            className="mt-1 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm font-semibold normal-case tracking-normal text-white focus:outline-none focus:ring-sky-500"
                        >
                            <option>Dual</option>
                            <option>Solo</option>
                        </select>
                    </label>
                    <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                        A/C
                        <input
                            type="number"
                            min={1}
                            max={24}
                            value={Math.max(1, Number(evt.aircraftCount) || 1)}
                            onChange={event => updateTempSctEvent(eventKey, { aircraftCount: Math.max(1, Math.min(24, Math.round(Number(event.target.value) || 1))) })}
                            onKeyDownCapture={stopEditableKeyPropagation}
                            className="mt-1 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm font-semibold normal-case tracking-normal text-white focus:outline-none focus:ring-sky-500"
                        />
                    </label>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,2.4fr)_90px_minmax(0,0.9fr)_minmax(0,0.9fr)]">
                    <label className="min-w-0 text-[10px] font-black uppercase tracking-wide text-gray-400">
                        <span className="flex items-center gap-1.5">
                            <span>Currency</span>
                            <InfoBadge
                                ariaLabel="Currency field information"
                                title="Currencies are configured in Training & Standards > Currency Requirements. Select the requirement this completed event should satisfy or refresh."
                            />
                        </span>
                        <select
                            value={evt.currency || ''}
                            onChange={event => updateTempSctEvent(eventKey, { currency: event.target.value })}
                            className="mt-1 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm font-semibold normal-case tracking-normal text-white focus:outline-none focus:ring-sky-500"
                        >
                            <option value="">None</option>
                            {activeCurrencyNames.map(currency => <option key={currency} value={currency}>{currency}</option>)}
                        </select>
                    </label>
                    <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                        Unit
                        <select
                            value={evt.unitCode || ''}
                            onChange={event => updateTempSctEvent(eventKey, { unitCode: event.target.value })}
                            className="mt-1 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm font-semibold normal-case tracking-normal text-white focus:outline-none focus:ring-sky-500"
                        >
                            <option value="">All applicable units</option>
                            {activeUnitCodeList.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                    </label>
                    <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                        A/C Type
                        <input
                            type="text"
                            value={evt.aircraftTypeCode || ''}
                            onChange={event => updateTempSctEvent(eventKey, { aircraftTypeCode: event.target.value.toUpperCase() })}
                            onKeyDownCapture={stopEditableKeyPropagation}
                            className="mt-1 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm font-semibold normal-case tracking-normal text-white focus:outline-none focus:ring-sky-500"
                        />
                    </label>
                    <label className="min-w-0 text-[10px] font-black uppercase tracking-wide text-gray-400">
                        Crew
                        <input
                            type="text"
                            value={evt.crew || ''}
                            onChange={event => updateTempSctEvent(eventKey, { crew: event.target.value })}
                            onKeyDownCapture={stopEditableKeyPropagation}
                            className="mt-1 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm font-semibold normal-case tracking-normal text-white focus:outline-none focus:ring-sky-500"
                        />
                    </label>
                </div>
                <div className="mt-3 flex min-w-0 items-center gap-3 rounded border border-gray-700 bg-gray-950/60 p-2">
                    <div className="shrink-0 text-[10px] font-black uppercase tracking-wide text-gray-400">Acceptable CONFIG</div>
                    <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-4 overflow-x-auto">
                        {aircraftConfigOptions.map(config => (
                            <label key={`${eventKey}-${config.id}`} className="flex shrink-0 items-center gap-2 text-xs font-semibold text-gray-200">
                                <input
                                    type="checkbox"
                                    checked={selectedConfigs.includes(config.id)}
                                    onChange={() => toggleTempSctConfig(eventKey, config.id)}
                                    className="h-3.5 w-3.5 rounded border-gray-500 bg-gray-800 text-sky-500 focus:ring-sky-500"
                                />
                                <span>{config.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderSelectedEventPanel = () => {
        if (isEditingSctEvents) {
            return selectedTempSctEvent
                ? renderSelectedEventEditor(selectedTempSctEvent)
                : (
                    <div className="flex h-full min-h-[320px] items-center justify-center rounded-md border border-dashed border-gray-700 bg-gray-900/40 p-6 text-center text-sm text-gray-400">
                        Select an event tile to edit.
                    </div>
                );
        }
        return selectedConfiguredSctEvent
            ? renderSelectedEventDetails(selectedConfiguredSctEvent)
            : (
                <div className="flex h-full min-h-[320px] items-center justify-center rounded-md border border-dashed border-gray-700 bg-gray-900/40 p-6 text-center text-sm text-gray-400">
                    Select an event tile to view details.
                </div>
            );
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-full max-w-6xl min-h-[600px] flex flex-col">
            <div className="p-4 flex justify-between items-center border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-200">{sctShortLabel} / Currency Events</h2>
                    <InfoBadge
                        ariaLabel="Currency events information"
                        title="The Currency field links a completed event to the currency requirement it should satisfy or refresh. Set up currencies in Training & Standards > Currency Requirements."
                    />
                </div>
                {isEditingSctEvents ? (
                    <div className="flex gap-[1px]">
                        {onOpenCurrencyRequirements && (
                            <button type="button" onClick={onOpenCurrencyRequirements} className={standardSettingsButtonClass}>
                                Currency<br />Setup
                            </button>
                        )}
                        <button type="button" onClick={handleSaveSctEvents} className={standardSettingsButtonClass}>Save</button>
                        <button type="button" onClick={handleCancelSctEvents} className={standardSettingsButtonClass}>Cancel</button>
                    </div>
                ) : (
                    <div className="flex gap-[1px]">
                        {onOpenCurrencyRequirements && (
                            <button type="button" onClick={onOpenCurrencyRequirements} className={standardSettingsButtonClass}>
                                Currency<br />Setup
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleEditSctEvents}
                            disabled={!canEditSettings}
                            className={standardSettingsButtonClass}
                        >
                            Edit
                        </button>
                    </div>
                )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col space-y-4 p-4">
                <p className="text-sm text-gray-400">
                    {isEditingSctEvents
                        ? 'Edit the selected event and save when complete.'
                        : `Select a ${sctShortLabel} / currency event tile, then press Edit.`}
                </p>
                <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
                    <ul className="min-h-0 space-y-2 overflow-y-auto pr-1">
                        {displayedSctEvents.map(renderEventTile)}
                    </ul>
                    <div className="min-h-0 overflow-y-auto">
                        {renderSelectedEventPanel()}
                    </div>
                </div>
                {isEditingSctEvents && (
                    <div className="flex space-x-2 border-t border-gray-700 pt-3">
                        <input
                            type="text"
                            value={newSctEvent}
                            onChange={event => setNewSctEvent(event.target.value)}
                            onKeyDownCapture={stopEditableKeyPropagation}
                            onKeyDown={event => {
                                stopEditableKeyPropagation(event);
                                if (event.key === 'Enter') handleAddSctEvent();
                            }}
                            placeholder={`New ${sctShortLabel} event name`}
                            className="flex-grow rounded-md border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white focus:outline-none focus:ring-sky-500"
                        />
                        <button type="button" onClick={handleAddSctEvent} className="rounded-md bg-green-700 px-3 py-1 text-sm font-semibold text-white hover:bg-green-600">+</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContinuationCurrencyEventsSettings;
