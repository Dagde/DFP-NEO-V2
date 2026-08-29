import React, { useMemo, useState } from 'react';
import { MasterCurrency, CurrencyRequirement, type ContinuationEventSetting } from '../types';
import { logAudit } from '../utils/auditLogger';
import { handleEditableTextBeforeInput, handleEditableTextKeyDownCapture, stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import { BASE_AIRCRAFT_CONFIG, type AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import { normaliseContinuationEventSettings } from '../utils/continuationEvents';

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

    const handleEditSctEvents = () => {
        setTempSctEvents(normaliseContinuationEventSettings(sctEvents).map(applyContinuationEventDefaults));
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
            setTempSctEvents([
                ...tempSctEvents,
                {
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
                },
            ]);
            setNewSctEvent('');
        }
    };

    const handleRemoveSctEvent = (eventToRemove: string) => {
        setTempSctEvents(tempSctEvents.filter(evt => (evt.id || evt.name) !== eventToRemove));
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
            <div className="p-4 space-y-4 flex min-h-0 flex-1 flex-col">
                {isEditingSctEvents ? (
                    <>
                        <p className="text-sm text-gray-400">Manage the configured event choices and their request/build settings.</p>
                        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                            {tempSctEvents.map(evt => {
                                const eventKey = evt.id || evt.name;
                                const selectedConfigs = Array.isArray(evt.acceptableAircraftConfigs) && evt.acceptableAircraftConfigs.length > 0
                                    ? evt.acceptableAircraftConfigs
                                    : [evt.config || 'ANY'];
                                return (
                                    <div key={eventKey} className="rounded-lg border border-gray-700 bg-gray-900/70 p-3">
                                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_150px_110px_110px_minmax(0,1fr)_minmax(0,0.9fr)_auto]">
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
                                            <button type="button" onClick={() => handleRemoveSctEvent(eventKey)} className="mt-[18px] flex h-[34px] items-center justify-center rounded border border-red-500/30 bg-red-950/40 px-3 text-xs font-bold text-red-200 hover:bg-red-900/50">
                                                Delete
                                            </button>
                                        </div>
                                        <div className="mt-3 grid gap-3 lg:grid-cols-[180px_minmax(0,0.9fr)_minmax(0,1.7fr)_90px]">
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
                                                Aircraft Type
                                                <input
                                                    type="text"
                                                    value={evt.aircraftTypeCode || ''}
                                                    onChange={event => updateTempSctEvent(eventKey, { aircraftTypeCode: event.target.value.toUpperCase() })}
                                                    onKeyDownCapture={stopEditableKeyPropagation}
                                                    className="mt-1 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm font-semibold normal-case tracking-normal text-white focus:outline-none focus:ring-sky-500"
                                                />
                                            </label>
                                            <div className="min-w-0">
                                                <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-gray-400">Acceptable CONFIG</div>
                                                <div className="flex flex-wrap gap-2 rounded border border-gray-700 bg-gray-950/60 p-2">
                                                    {aircraftConfigOptions.map(config => (
                                                        <label key={`${eventKey}-${config.id}`} className="flex min-w-[70px] items-center gap-2 text-xs font-semibold text-gray-200">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedConfigs.includes(config.id)}
                                                                onChange={() => toggleTempSctConfig(eventKey, config.id)}
                                                                className="h-3.5 w-3.5 rounded border-gray-500 bg-gray-800 text-sky-500 focus:ring-sky-500"
                                                            />
                                                            <span className="truncate">{config.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
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
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex space-x-2">
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
                                className="flex-grow bg-gray-700 border-gray-600 rounded-md py-1 px-2 text-white text-sm focus:outline-none focus:ring-sky-500"
                            />
                            <button type="button" onClick={handleAddSctEvent} className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold">+</button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-gray-400">Configured {sctShortLabel} and currency event settings.</p>
                        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                            {configuredSctEvents.map(evt => (
                                <li key={evt.id || evt.name} className="w-[40%] min-w-[260px] rounded bg-gray-700/50 p-3 text-white">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold">{evt.name}</span>
                                        <span className="rounded bg-gray-900/70 px-2 py-0.5 text-[11px] text-gray-300">{evt.dayNight || 'Day'}</span>
                                        <span className="rounded bg-gray-900/70 px-2 py-0.5 text-[11px] text-gray-300">{evt.flightType || 'Dual'}</span>
                                        {evt.currency && <span className="rounded bg-sky-950/60 px-2 py-0.5 text-[11px] text-sky-100">{evt.currency}</span>}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-400">
                                        CONFIG {(evt.acceptableAircraftConfigs?.length ? evt.acceptableAircraftConfigs : [evt.config || 'ANY']).join(', ')} · A/C {Math.max(1, Number(evt.aircraftCount) || 1)}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
};

export default ContinuationCurrencyEventsSettings;
