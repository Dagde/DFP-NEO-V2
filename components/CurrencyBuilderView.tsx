import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CurrencyDefinition, MasterCurrency, CurrencyRequirement, LogicNode } from '../types';
import AuditButton from './AuditButton';
import CrewRequirementEditor from './CrewRequirementEditor';
import type { AircraftCrewComposition } from '../utils/aircraftCrewComposition';
import type { CrewPositionTerminology } from '../utils/crewPositionTerminology';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';
import { showDarkAlert, showDarkConfirm, showDarkPrompt } from './DarkMessageModal';

interface CurrencyBuilderViewProps {
    onBack: () => void;
    masterCurrencies: MasterCurrency[];
    currencyRequirements: CurrencyRequirement[];
    activeUnitCode?: string;
    importUnitOptions?: Array<{
        unitCode: string;
        label: string;
        currencyCount: number;
        recencyCount: number;
        usesFallback?: boolean;
    }>;
    onSave: (allCurrencies: CurrencyDefinition[]) => void;
    onDelete: (id: string) => void;
    onImportFromUnit?: (unitCode: string) => void;
    aircraftCrewComposition?: AircraftCrewComposition;
    crewPositionTerminology?: CrewPositionTerminology;
    operationalModel?: string;
}

const normaliseShortCode = (value: unknown): string => String(value || '').trim();

const getCurrencyShortCode = (currency: { shortCode?: string; eventCodes?: string[]; name?: string }): string => (
    normaliseShortCode(currency.shortCode || currency.eventCodes?.[0] || '')
);

const getNewPrimitive = (): CurrencyRequirement => ({
    id: uuidv4(),
    name: 'New Primitive Currency',
    shortCode: '',
    description: '',
    type: 'primitive',
    isVisible: true,
    validityDays: 365,
    eventCodes: [],
    requiredCount: 1,
    expiryRule: 'LAST_EVENT_PLUS_PERIOD',
    showInPostFlight: false,
    showInPostFlightRecency: false,
    postFlightInputTypes: ['date'],
    crewRequirement: { mode: 'aircraft_default' },
});

const getNewComposite = (): MasterCurrency => ({
    id: uuidv4(),
    name: 'New Composite Currency',
    shortCode: '',
    description: '',
    type: 'composite',
    isVisible: true,
    expiryCalculation: 'EARLIEST_CHILD',
    logicTree: { operator: 'AND', children: [] },
    showInPostFlight: false,
    showInPostFlightRecency: false,
    postFlightInputTypes: ['checkbox'],
    crewRequirement: { mode: 'aircraft_default' },
});

const CurrencyBuilderView: React.FC<CurrencyBuilderViewProps> = ({
    onBack,
    masterCurrencies,
    currencyRequirements,
    activeUnitCode,
    importUnitOptions = [],
    onSave,
    onDelete,
    onImportFromUnit,
    aircraftCrewComposition,
    crewPositionTerminology,
    operationalModel,
}) => {
    const [allCurrencies, setAllCurrencies] = useState<CurrencyDefinition[]>([]);
    const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDirty, setIsDirty] = useState(false);
    const [isEditUnlocked, setIsEditUnlocked] = useState(false);
    const [importSourceUnit, setImportSourceUnit] = useState('');
    const standardActionButtonClass = 'w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed disabled:cursor-not-allowed disabled:opacity-50';

    useEffect(() => {
        const combined = [...masterCurrencies, ...currencyRequirements];
        setAllCurrencies(combined);
        // If the previously selected currency is no longer in the list (e.g., deleted), deselect it.
        setSelectedCurrencyId(currentSelection => (
            currentSelection && !combined.some(c => c.id === currentSelection) ? null : currentSelection
        ));
    }, [masterCurrencies, currencyRequirements]);

    const filteredCurrencies = useMemo(() => {
        return allCurrencies
            .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [allCurrencies, searchTerm]);

    const selectedCurrency = useMemo(() => {
        return allCurrencies.find(c => c.id === selectedCurrencyId) || null;
    }, [selectedCurrencyId, allCurrencies]);

    const handleUpdateCurrency = (updatedCurrency: CurrencyDefinition) => {
        if (!isEditUnlocked) return;
        setAllCurrencies(prev => prev.map(c => c.id === updatedCurrency.id ? updatedCurrency : c));
        setIsDirty(true);
    };

    const handleAddCurrency = (type: 'primitive' | 'composite') => {
        if (!isEditUnlocked) return;
        const newCurrency = type === 'primitive' ? getNewPrimitive() : getNewComposite();
        setAllCurrencies(prev => [...prev, newCurrency]);
        setSelectedCurrencyId(newCurrency.id);
        setIsDirty(true);
    };

    const handleDeleteCurrency = async () => {
        if (!isEditUnlocked || !selectedCurrencyId) return;

        // Check for dependencies
        const isInUse = allCurrencies.some(c => {
            if (c.type === 'composite') {
                const checkNode = (node: LogicNode): boolean => {
                    return node.children.some(child => {
                        if (typeof child === 'string') {
                            return child === selectedCurrencyId;
                        }
                        return checkNode(child);
                    });
                };
                return checkNode(c.logicTree);
            }
            return false;
        });

        if (isInUse) {
            await showDarkAlert('This currency cannot be deleted because it is used as a dependency in another composite currency.', 'Currency In Use', 'warning');
            return;
        }

        if (await showDarkConfirm(`Are you sure you want to delete "${selectedCurrency?.name}"? This action cannot be undone.`, 'Delete Currency', 'warning')) {
            onDelete(selectedCurrencyId);
            setSelectedCurrencyId(null);
        }
    };
    
    const handleSave = () => {
        if (isDirty) {
            onSave(allCurrencies);
        }
        setIsDirty(false);
        setIsEditUnlocked(false);
    };

    const handleImportFromUnit = async () => {
        if (!isEditUnlocked || !importSourceUnit || !onImportFromUnit) return;
        const sourceLabel = importUnitOptions.find(option => option.unitCode === importSourceUnit)?.label || importSourceUnit;
        const targetLabel = activeUnitCode || 'this unit';
        if (!await showDarkConfirm(`Import currency and recency definitions from ${sourceLabel} into ${targetLabel}?\n\nThis replaces the current ${targetLabel} currency/recency list.`, 'Import Currency Definitions', 'warning')) return;
        onImportFromUnit(importSourceUnit);
        setSelectedCurrencyId(null);
        setIsDirty(false);
    };

    const unlockForEdit = async () => {
        const password = await showDarkPrompt({
            title: 'Edit Currency Builder',
            message: 'Enter your password to edit currency definitions.',
            inputLabel: 'Password',
            inputType: 'password',
            inputPlaceholder: 'Enter password',
            confirmText: 'Unlock',
            cancelText: 'Cancel',
            variant: 'warning',
        });
        if (!password) return;
        try {
            const isValid = await verifyCurrentUserPassword(password);
            if (!isValid) {
                await showDarkAlert('The password was not accepted.', 'Currency Builder Locked', 'warning');
                return;
            }
            setIsEditUnlocked(true);
        } catch (error) {
            await showDarkAlert('The app could not verify your password.', 'Password Check Failed', 'error');
        }
    };

    const handleEditSaveClick = () => {
        if (isEditUnlocked) {
            handleSave();
            return;
        }
        void unlockForEdit();
    };

    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden h-full">
            <header className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-white">Currency Builder</h1>
                    <p className="text-sm text-gray-400">
                        Define primitive and composite currency rules{activeUnitCode ? ` for ${activeUnitCode}` : ''}.
                    </p>
                </div>
                <div className="flex items-center" style={{ gap: '1px' }}>
                    <button
                        onClick={handleEditSaveClick}
                        className={standardActionButtonClass}
                        style={{ borderRadius: '6px 0 0 6px', borderRightWidth: '1px', borderRightColor: '#6b7280' }}
                    >
                        {isEditUnlocked ? 'Save' : 'Edit'}
                    </button>
                    <button
                        onClick={onBack}
                        className={standardActionButtonClass}
                        style={{
                            borderRadius: '0',
                            borderLeftWidth: '0',
                            borderRightWidth: '1px',
                            borderRightColor: '#6b7280',
                        }}
                    >
                        Back
                    </button>
                    <AuditButton
                        pageName="Currency Builder"
                        style={{ borderRadius: '0 6px 6px 0', borderLeftWidth: '0' }}
                    />
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Pane: Currency List */}
                <div className="w-1/3 border-r border-gray-700 flex flex-col">
                    <div className="p-4 border-b border-gray-700">
                        <input
                            type="text"
                            placeholder="Search currencies..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500"
                        />
                         <div className="flex mt-2 space-x-2">
                            <button onClick={() => handleAddCurrency('primitive')} disabled={!isEditUnlocked} className="flex-1 text-center py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-semibold disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400">+ Primitive</button>
                            <button onClick={() => handleAddCurrency('composite')} disabled={!isEditUnlocked} className="flex-1 text-center py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-xs font-semibold disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400">+ Composite</button>
                         </div>
                         {activeUnitCode && (
                            <div className="mt-3 rounded border border-sky-500/30 bg-sky-950/20 p-2">
                                <label className="block text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                                    Import from unit
                                    <select
                                        value={importSourceUnit}
                                        onChange={event => setImportSourceUnit(event.target.value)}
                                        className="mt-1 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs normal-case tracking-normal text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        disabled={importUnitOptions.length === 0}
                                    >
                                        <option value="">{importUnitOptions.length ? 'Select unit...' : 'No other units available'}</option>
                                        {importUnitOptions.map(option => (
                                            <option key={option.unitCode} value={option.unitCode}>
                                                {option.label} ({option.currencyCount} items, {option.recencyCount} recency{option.usesFallback ? ', default' : ''})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <button
                                    type="button"
                                    onClick={handleImportFromUnit}
                                    disabled={!isEditUnlocked || !importSourceUnit || !onImportFromUnit}
                                    className="mt-2 w-full rounded bg-sky-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                                >
                                    Import List
                                </button>
                            </div>
                         )}
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {filteredCurrencies.map(c => (
                            <div
                                key={c.id}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/currency-id', c.id);
                                    e.dataTransfer.effectAllowed = 'copy';
                                }}
                                onClick={() => setSelectedCurrencyId(c.id)}
                                className={`p-3 cursor-pointer border-l-4 ${
                                    selectedCurrencyId === c.id ? 'bg-sky-700 border-sky-400' : 'border-transparent hover:bg-gray-700/50'
                                }`}
                            >
                                <p className={`font-semibold ${c.type === 'composite' ? 'text-purple-300' : 'text-green-300'}`}>
                                    {c.name}
                                    {getCurrencyShortCode(c) && <span className="ml-2 text-xs font-bold text-gray-400">[{getCurrencyShortCode(c)}]</span>}
                                </p>
                                <p className="text-xs text-gray-400">{c.description || 'No description'}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Pane: Editor */}
                <div className={`w-2/3 overflow-y-auto p-6 ${isEditUnlocked ? '' : 'opacity-80'}`}>
                    {selectedCurrency ? (
                        <div className="space-y-6">
                            <div className={isEditUnlocked ? '' : 'pointer-events-none'}>
                                {selectedCurrency.type === 'primitive'
                                    ? <PrimitiveEditor currency={selectedCurrency as CurrencyRequirement} onUpdate={handleUpdateCurrency} aircraftCrewComposition={aircraftCrewComposition} crewPositionTerminology={crewPositionTerminology} operationalModel={operationalModel} />
                                    : <CompositeEditor currency={selectedCurrency as MasterCurrency} onUpdate={handleUpdateCurrency} allCurrencies={allCurrencies} aircraftCrewComposition={aircraftCrewComposition} crewPositionTerminology={crewPositionTerminology} operationalModel={operationalModel} />
                                }
                            </div>

                             {/* Used In Section */}
                            <UsedInSection currencyId={selectedCurrency.id} allCurrencies={allCurrencies} />

                            <div className="pt-6 border-t border-gray-700">
                                <button onClick={handleDeleteCurrency} disabled={!isEditUnlocked} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-semibold disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400">
                                    Delete Currency
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 italic">
                            Select a currency to edit, or add a new one.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- EDITOR SUB-COMPONENTS ---

const PrimitiveEditor: React.FC<{
    currency: CurrencyRequirement;
    onUpdate: (c: CurrencyRequirement) => void;
    aircraftCrewComposition?: AircraftCrewComposition;
    crewPositionTerminology?: CrewPositionTerminology;
    operationalModel?: string;
}> = ({ currency, onUpdate, aircraftCrewComposition, crewPositionTerminology, operationalModel }) => {
    const handleChange = (field: keyof CurrencyRequirement, value: any) => {
        onUpdate({ ...currency, [field]: value });
    };

    const handleShortCodeChange = (value: string) => {
        const shortCode = normaliseShortCode(value).toUpperCase();
        onUpdate({
            ...currency,
            shortCode,
            eventCodes: shortCode ? [shortCode] : [],
        });
    };

    // Auto-suggest input types based on expiry rule
    const suggestedTypes: PostFlightInputType[] = currency.expiryRule === 'ROLLING_WINDOW' ? ['count'] : ['date'];
    const activeTypes: PostFlightInputType[] = (currency.postFlightInputTypes && currency.postFlightInputTypes.length > 0)
        ? currency.postFlightInputTypes
        : suggestedTypes;

    const toggleInputType = (type: PostFlightInputType) => {
        const current = activeTypes;
        const next = current.includes(type)
            ? current.filter((t) => t !== type)
            : [...current, type];
        handleChange('postFlightInputTypes', next.length > 0 ? next : suggestedTypes);
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-green-400">Edit Primitive Currency</h2>
            <InputField label="Name" value={currency.name} onChange={v => handleChange('name', v)} />
            <ShortCodeField
                value={currency.shortCode || currency.eventCodes?.[0] || ''}
                onChange={handleShortCodeChange}
            />
            <InputField label="Description" value={currency.description} onChange={v => handleChange('description', v)} />
            <CheckboxField label="Visible in Main List" checked={currency.isVisible} onChange={v => handleChange('isVisible', v)} />
            <InputField label="Validity (Days)" type="number" value={currency.validityDays} onChange={v => handleChange('validityDays', Number(v))} />
            <InputField label="Required Count" type="number" value={currency.requiredCount} onChange={v => handleChange('requiredCount', Number(v))} />
            <DropdownField label="Expiry Rule" value={currency.expiryRule} onChange={v => handleChange('expiryRule', v)}>
                <option value="LAST_EVENT_PLUS_PERIOD">Last Event + Period</option>
                <option value="ROLLING_WINDOW">Rolling Window</option>
            </DropdownField>
            <CrewRequirementEditor
                value={currency.crewRequirement}
                aircraftCrewComposition={aircraftCrewComposition}
                crewPositionTerminology={crewPositionTerminology}
                operationalModel={operationalModel}
                onChange={v => handleChange('crewRequirement', v)}
            />

            {/* Post-Flight Integration */}
            <div className="p-4 border border-amber-600/40 rounded-lg bg-amber-900/10 space-y-3">
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide">Post-Flight Page</h3>
                <CheckboxField
                    label="Show in Post-Flight currency panel"
                    checked={currency.showInPostFlight ?? false}
                    onChange={v => handleChange('showInPostFlight', v)}
                />
                <CheckboxField
                    label="Show in Post-Flight Recency checklist"
                    checked={currency.showInPostFlightRecency ?? false}
                    onChange={v => handleChange('showInPostFlightRecency', v)}
                />
                {currency.showInPostFlight && (
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Input Type(s) in Post-Flight
                            <span className="ml-2 text-xs text-gray-500">(select all that apply)</span>
                        </label>
                        <div className="flex flex-col space-y-2 mt-1">
                            {([
                                { type: 'date' as PostFlightInputType, icon: '\ud83d\udcc5', label: 'Date picker', desc: 'Records when this was last completed' },
                                { type: 'count' as PostFlightInputType, icon: '\ud83d\udd22', label: 'Number input', desc: 'Records how many times completed today' },
                                { type: 'checkbox' as PostFlightInputType, icon: '\u2611', label: 'Checkbox', desc: 'Ticking records the flight date as the currency date' },
                            ] as { type: PostFlightInputType; icon: string; label: string; desc: string }[]).map(({ type, icon, label, desc }) => (
                                <label key={type} className="flex items-start space-x-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={activeTypes.includes(type)}
                                        onChange={() => toggleInputType(type)}
                                        className="h-4 w-4 mt-0.5 rounded accent-amber-500 cursor-pointer"
                                    />
                                    <span className="text-sm text-gray-300 leading-tight">
                                        <span className="mr-1">{icon}</span>
                                        <span className="font-medium">{label}</span>
                                        <span className="text-gray-500 ml-1">&mdash; {desc}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-amber-500/70 mt-2">
                            Auto-suggested: <span className="font-semibold">{suggestedTypes.join(', ')}</span> based on expiry rule ({currency.expiryRule === 'ROLLING_WINDOW' ? 'rolling count' : 'last event date'})
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

const CompositeEditor: React.FC<{
    currency: MasterCurrency;
    onUpdate: (c: MasterCurrency) => void;
    allCurrencies: CurrencyDefinition[];
    aircraftCrewComposition?: AircraftCrewComposition;
    crewPositionTerminology?: CrewPositionTerminology;
    operationalModel?: string;
}> = ({ currency, onUpdate, allCurrencies, aircraftCrewComposition, crewPositionTerminology, operationalModel }) => {
    const handleChange = (field: keyof MasterCurrency, value: any) => {
        onUpdate({ ...currency, [field]: value });
    };
    const handleShortCodeChange = (value: string) => {
        handleChange('shortCode', normaliseShortCode(value).toUpperCase());
    };
    const handleLogicTreeChange = (newLogicTree: LogicNode) => {
        handleChange('logicTree', newLogicTree);
    };

    // Default for composite currencies is checkbox (most common)
    const suggestedTypes: PostFlightInputType[] = ['checkbox'];
    const activeTypes: PostFlightInputType[] = (currency.postFlightInputTypes && currency.postFlightInputTypes.length > 0)
        ? currency.postFlightInputTypes
        : suggestedTypes;

    const toggleInputType = (type: PostFlightInputType) => {
        const current = activeTypes;
        const next = current.includes(type)
            ? current.filter((t) => t !== type)
            : [...current, type];
        handleChange('postFlightInputTypes', next.length > 0 ? next : suggestedTypes);
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-purple-400">Edit Composite Currency</h2>
            <InputField label="Name" value={currency.name} onChange={v => handleChange('name', v)} />
            <ShortCodeField
                value={getCurrencyShortCode(currency)}
                onChange={handleShortCodeChange}
            />
            <InputField label="Description" value={currency.description} onChange={v => handleChange('description', v)} />
            <CheckboxField label="Visible in Main List" checked={currency.isVisible} onChange={v => handleChange('isVisible', v)} />
            <DropdownField label="Expiry Calculation" value={currency.expiryCalculation} onChange={v => handleChange('expiryCalculation', v)}>
                <option value="EARLIEST_CHILD">Use Earliest Expiry</option>
                <option value="LATEST_CHILD">Use Latest Expiry</option>
            </DropdownField>
            <LogicNodeEditor node={currency.logicTree} path={[]} onUpdate={handleLogicTreeChange} allCurrencies={allCurrencies} />
            <CrewRequirementEditor
                value={currency.crewRequirement}
                aircraftCrewComposition={aircraftCrewComposition}
                crewPositionTerminology={crewPositionTerminology}
                operationalModel={operationalModel}
                onChange={v => handleChange('crewRequirement', v)}
            />

            {/* Post-Flight Integration */}
            <div className="p-4 border border-purple-600/40 rounded-lg bg-purple-900/10 space-y-3">
                <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wide">Post-Flight Page</h3>
                <CheckboxField
                    label="Show in Post-Flight currency panel"
                    checked={currency.showInPostFlight ?? false}
                    onChange={v => handleChange('showInPostFlight', v)}
                />
                <CheckboxField
                    label="Show in Post-Flight Recency checklist"
                    checked={currency.showInPostFlightRecency ?? false}
                    onChange={v => handleChange('showInPostFlightRecency', v)}
                />
                {currency.showInPostFlight && (
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Input Type(s) in Post-Flight
                            <span className="ml-2 text-xs text-gray-500">(select all that apply)</span>
                        </label>
                        <div className="flex flex-col space-y-2 mt-1">
                            {([
                                { type: 'checkbox' as PostFlightInputType, icon: '\u2611', label: 'Checkbox', desc: 'Ticking records the flight date as the currency date (recommended for composite)' },
                                { type: 'date' as PostFlightInputType, icon: '\ud83d\udcc5', label: 'Date picker', desc: 'Records when this was last completed' },
                                { type: 'count' as PostFlightInputType, icon: '\ud83d\udd22', label: 'Number input', desc: 'Records how many times completed today' },
                            ] as { type: PostFlightInputType; icon: string; label: string; desc: string }[]).map(({ type, icon, label, desc }) => (
                                <label key={type} className="flex items-start space-x-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={activeTypes.includes(type)}
                                        onChange={() => toggleInputType(type)}
                                        className="h-4 w-4 mt-0.5 rounded accent-purple-500 cursor-pointer"
                                    />
                                    <span className="text-sm text-gray-300 leading-tight">
                                        <span className="mr-1">{icon}</span>
                                        <span className="font-medium">{label}</span>
                                        <span className="text-gray-500 ml-1">&mdash; {desc}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-purple-500/70 mt-2">
                            Recommended for composite currencies: <span className="font-semibold">Checkbox</span> (flight date is recorded automatically)
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

const LogicNodeEditor: React.FC<{
    node: LogicNode;
    path: (string | number)[];
    onUpdate: (newNode: LogicNode, path: (string | number)[]) => void;
    allCurrencies: CurrencyDefinition[];
}> = ({ node, path, onUpdate, allCurrencies }) => {
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const currencyId = e.dataTransfer.getData('application/currency-id');
        if (currencyId && !node.children.includes(currencyId)) {
            const newChildren = [...node.children, currencyId];
            onUpdate({ ...node, children: newChildren }, path);
        }
    };

    const handleChildUpdate = (newChild: LogicNode, childIndex: number) => {
        const newChildren = [...node.children];
        newChildren[childIndex] = newChild;
        onUpdate({ ...node, children: newChildren }, path);
    };
    
    const removeChild = (index: number) => {
        const newChildren = node.children.filter((_, i) => i !== index);
        onUpdate({ ...node, children: newChildren }, path);
    };

    const addCondition = () => {
        // We add a placeholder string that can be replaced
        const newChildren = [...node.children, 'new_condition_placeholder'];
        onUpdate({ ...node, children: newChildren }, path);
    };
    
    const addGroup = () => {
        const newGroup: LogicNode = { operator: 'AND', children: [] };
        const newChildren = [...node.children, newGroup];
        onUpdate({ ...node, children: newChildren }, path);
    };

    const setOperator = (op: 'AND' | 'OR') => {
        onUpdate({ ...node, operator: op }, path);
    };

    return (
        <div className="p-4 border border-gray-600 rounded-lg bg-gray-700/30 space-y-3" onDragOver={handleDragOver} onDrop={handleDrop}>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <button onClick={() => setOperator('AND')} className={`px-3 py-1 text-xs font-bold rounded ${node.operator === 'AND' ? 'bg-sky-600 text-white' : 'bg-gray-600 text-gray-300'}`}>ALL of these (AND)</button>
                    <button onClick={() => setOperator('OR')} className={`px-3 py-1 text-xs font-bold rounded ${node.operator === 'OR' ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-300'}`}>ANY of these (OR)</button>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={addCondition} className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded">+ Condition</button>
                    <button onClick={addGroup} className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded">+ Group</button>
                </div>
            </div>
            <div className="space-y-2 pl-4 border-l-2 border-gray-500">
                {node.children.length > 0 ? node.children.map((child, index) => (
                    <div key={index} className="flex items-center group">
                        {typeof child === 'string' ? (
                            <div className="flex-1 p-2 bg-gray-800 rounded text-sm text-gray-300">
                                {allCurrencies.find(c => c.id === child)?.name || 'Unlinked Condition'}
                            </div>
                        ) : (
                            <LogicNodeEditor node={child} path={[...path, 'children', index]} onUpdate={(newNode, subPath) => handleChildUpdate(newNode, index)} allCurrencies={allCurrencies} />
                        )}
                        <button onClick={() => removeChild(index)} className="ml-2 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                )) : <div className="text-xs text-gray-500 italic p-4 text-center">Drag currencies here or add conditions/groups.</div>}
            </div>
        </div>
    );
};

const UsedInSection: React.FC<{ currencyId: string; allCurrencies: CurrencyDefinition[] }> = ({ currencyId, allCurrencies }) => {
    const dependencies = useMemo(() => {
        const dependents: string[] = [];
        const masterCurrencies = allCurrencies.filter(c => c.type === 'composite') as MasterCurrency[];

        for (const master of masterCurrencies) {
            const checkNode = (node: LogicNode): boolean => {
                return node.children.some(child => {
                    if (typeof child === 'string') {
                        return child === currencyId;
                    }
                    return checkNode(child);
                });
            };
            if (checkNode(master.logicTree)) {
                dependents.push(master.name);
            }
        }
        return dependents;
    }, [currencyId, allCurrencies]);

    if (dependencies.length === 0) return null;

    return (
        <div className="p-4 border border-gray-600 rounded-lg bg-gray-700/30">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Used In:</h3>
            <div className="flex flex-wrap gap-2">
                {dependencies.map(name => (
                    <span key={name} className="px-2 py-1 bg-purple-800 text-purple-200 text-xs font-medium rounded-full">{name}</span>
                ))}
            </div>
        </div>
    );
};


// --- FORM HELPER COMPONENTS ---

const ShortCodeField: React.FC<{ value: string; onChange: (v: string) => void; }> = ({ value, onChange }) => (
    <div>
        <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-400">
            Currency Short Code
            <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-sky-400 text-[10px] font-bold text-sky-300"
                title="Abbreviated code used to identify the currency event throughout NEO"
                aria-label="Abbreviated code used to identify the currency event throughout NEO"
            >
                i
            </span>
        </label>
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="e.g. NF90"
            className="block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white uppercase focus:outline-none focus:ring-sky-500"
        />
    </div>
);

const InputField: React.FC<{ label: string; value: any; onChange: (v: any) => void; type?: string; }> = ({ label, value, onChange, type = 'text' }) => (
    <div>
        <label className="block text-sm font-medium text-gray-400">{label}</label>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500" />
    </div>
);

const CheckboxField: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; }> = ({ label, checked, onChange }) => (
    <label className="flex items-center space-x-3">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 bg-gray-600 border-gray-500 rounded accent-sky-500" />
        <span className="text-white">{label}</span>
    </label>
);

const DropdownField: React.FC<{ label: string; value: any; onChange: (v: any) => void; children: React.ReactNode; }> = ({ label, value, onChange, children }) => (
    <div>
        <label className="block text-sm font-medium text-gray-400">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500">
            {children}
        </select>
    </div>
);


export default CurrencyBuilderView;
