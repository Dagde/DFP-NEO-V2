
import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CurrencyDefinition, MasterCurrency, CurrencyRequirement, LogicNode } from '../types';
import AuditButton from './AuditButton';

interface CurrencyBuilderViewProps {
  onBack: () => void;
  masterCurrencies: MasterCurrency[];
  currencyRequirements: CurrencyRequirement[];
  onSave: (allCurrencies: CurrencyDefinition[]) => void;
  onDelete: (id: string) => void;
}

const getNewPrimitive = (): CurrencyRequirement => ({
  id: uuidv4(),
  name: 'New Primitive Currency',
  description: '',
  type: 'primitive',
  isVisible: true,
  validityDays: 365,
  eventCodes: [],
  requiredCount: 1,
  expiryRule: 'LAST_EVENT_PLUS_PERIOD',
});

const getNewComposite = (): MasterCurrency => ({
  id: uuidv4(),
  name: 'New Composite Currency',
  description: '',
  type: 'composite',
  isVisible: true,
  expiryCalculation: 'EARLIEST_CHILD',
  logicTree: { operator: 'AND', children: [] },
});

const CurrencyBuilderView: React.FC<CurrencyBuilderViewProps> = ({ onBack, masterCurrencies, currencyRequirements, onSave, onDelete }) => {
    const [allCurrencies, setAllCurrencies] = useState<CurrencyDefinition[]>([]);
    const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        const combined = [...masterCurrencies, ...currencyRequirements];
        setAllCurrencies(combined);
        // If the previously selected currency is no longer in the list (e.g., deleted), deselect it.
        if (selectedCurrencyId && !combined.some(c => c.id === selectedCurrencyId)) {
            setSelectedCurrencyId(null);
        }
    }, [masterCurrencies, currencyRequirements, selectedCurrencyId]);

    const filteredCurrencies = useMemo(() => {
        return allCurrencies
            .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [allCurrencies, searchTerm]);

    const selectedCurrency = useMemo(() => {
        return allCurrencies.find(c => c.id === selectedCurrencyId) || null;
    }, [selectedCurrencyId, allCurrencies]);

    const handleUpdateCurrency = (updatedCurrency: CurrencyDefinition) => {
        setAllCurrencies(prev => prev.map(c => c.id === updatedCurrency.id ? updatedCurrency : c));
        setIsDirty(true);
    };

    const handleAddCurrency = (type: 'primitive' | 'composite') => {
        const newCurrency = type === 'primitive' ? getNewPrimitive() : getNewComposite();
        setAllCurrencies(prev => [...prev, newCurrency]);
        setSelectedCurrencyId(newCurrency.id);
        setIsDirty(true);
    };

    const handleDeleteCurrency = () => {
        if (!selectedCurrencyId) return;

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
            alert("This currency cannot be deleted because it is used as a dependency in another composite currency.");
            return;
        }

        if (window.confirm(`Are you sure you want to delete "${selectedCurrency?.name}"? This action cannot be undone.`)) {
            onDelete(selectedCurrencyId);
            setSelectedCurrencyId(null);
        }
    };
    
    const handleSave = () => {
        onSave(allCurrencies);
        setIsDirty(false);
    };

    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden h-full">
            <header className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-white">Currency Builder</h1>
                    <p className="text-sm text-gray-400">Define primitive and composite currency rules.</p>
                </div>
                <div className="flex items-center space-x-4">
                    {isDirty && (
                         <button onClick={handleSave} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold shadow-md flex items-center space-x-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6a1 1 0 10-2 0v5.586L7.707 10.293z" /><path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" /></svg>
                            <span>Save Changes</span>
                        </button>
                    )}
                    <button onClick={onBack} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md">
                        &larr; Back to Settings
                    </button>
                       <AuditButton pageName="Currency Builder" />
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
                            <button onClick={() => handleAddCurrency('primitive')} className="flex-1 text-center py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-semibold">+ Primitive</button>
                            <button onClick={() => handleAddCurrency('composite')} className="flex-1 text-center py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-xs font-semibold">+ Composite</button>
                         </div>
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
                                <p className={`font-semibold ${c.type === 'composite' ? 'text-purple-300' : 'text-green-300'}`}>{c.name}</p>
                                <p className="text-xs text-gray-400">{c.description || 'No description'}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Pane: Editor */}
                <div className="w-2/3 overflow-y-auto p-6">
                    {selectedCurrency ? (
                        <div className="space-y-6">
                            {selectedCurrency.type === 'primitive' 
                                ? <PrimitiveEditor currency={selectedCurrency as CurrencyRequirement} onUpdate={handleUpdateCurrency} />
                                : <CompositeEditor currency={selectedCurrency as MasterCurrency} onUpdate={handleUpdateCurrency} allCurrencies={allCurrencies} />
                            }

                             {/* Used In Section */}
                            <UsedInSection currencyId={selectedCurrency.id} allCurrencies={allCurrencies} />

                            <div className="pt-6 border-t border-gray-700">
                                <button onClick={handleDeleteCurrency} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-semibold">
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

const PrimitiveEditor: React.FC<{ currency: CurrencyRequirement; onUpdate: (c: CurrencyRequirement) => void; }> = ({ currency, onUpdate }) => {
    const handleChange = (field: keyof CurrencyRequirement, value: any) => {
        onUpdate({ ...currency, [field]: value });
    };
    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-green-400">Edit Primitive Currency</h2>
            <InputField label="Name" value={currency.name} onChange={v => handleChange('name', v)} />
            <InputField label="Description" value={currency.description} onChange={v => handleChange('description', v)} />
            <CheckboxField label="Visible in Main List" checked={currency.isVisible} onChange={v => handleChange('isVisible', v)} />
            <InputField label="Validity (Days)" type="number" value={currency.validityDays} onChange={v => handleChange('validityDays', Number(v))} />
            <InputField label="Required Count" type="number" value={currency.requiredCount} onChange={v => handleChange('requiredCount', Number(v))} />
            <DropdownField label="Expiry Rule" value={currency.expiryRule} onChange={v => handleChange('expiryRule', v)}>
                <option value="LAST_EVENT_PLUS_PERIOD">Last Event + Period</option>
                <option value="ROLLING_WINDOW">Rolling Window</option>
            </DropdownField>
            <InputField label="Event Codes (comma-separated)" value={currency.eventCodes.join(', ')} onChange={v => handleChange('eventCodes', v.split(',').map((s: string) => s.trim()).filter(Boolean))} />
        </div>
    );
};

const CompositeEditor: React.FC<{ currency: MasterCurrency; onUpdate: (c: MasterCurrency) => void; allCurrencies: CurrencyDefinition[]; }> = ({ currency, onUpdate, allCurrencies }) => {
    const handleChange = (field: keyof MasterCurrency, value: any) => {
        onUpdate({ ...currency, [field]: value });
    };
    const handleLogicTreeChange = (newLogicTree: LogicNode) => {
        handleChange('logicTree', newLogicTree);
    };
    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-purple-400">Edit Composite Currency</h2>
            <InputField label="Name" value={currency.name} onChange={v => handleChange('name', v)} />
            <InputField label="Description" value={currency.description} onChange={v => handleChange('description', v)} />
            <CheckboxField label="Visible in Main List" checked={currency.isVisible} onChange={v => handleChange('isVisible', v)} />
            <DropdownField label="Expiry Calculation" value={currency.expiryCalculation} onChange={v => handleChange('expiryCalculation', v)}>
                <option value="EARLIEST_CHILD">Use Earliest Expiry</option>
                <option value="LATEST_CHILD">Use Latest Expiry</option>
            </DropdownField>
            <LogicNodeEditor node={currency.logicTree} path={[]} onUpdate={handleLogicTreeChange} allCurrencies={allCurrencies} />
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