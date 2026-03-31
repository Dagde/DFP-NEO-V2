# Rewrite CurrencyBuilderView.tsx PrimitiveEditor and CompositeEditor sections

with open('/workspace/DFP-NEO-V2-fresh/components/CurrencyBuilderView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

prim_start = content.find('\nconst PrimitiveEditor')
comp_start = content.find('\nconst CompositeEditor')
logic_start = content.find('\nconst LogicNodeEditor')

print(f"prim_start={prim_start}, comp_start={comp_start}, logic_start={logic_start}")
if prim_start == -1 or comp_start == -1 or logic_start == -1:
    raise SystemExit("Could not find all markers")

before = content[:prim_start]
after = content[logic_start:]

CHECKBOX = '\u2611'
CAL = '\U0001f4c5'
NUM = '\U0001f522'
DASH = '\u2014'

new_editors = f"""
const PrimitiveEditor: React.FC<{{ currency: CurrencyRequirement; onUpdate: (c: CurrencyRequirement) => void; }}> = ({{ currency, onUpdate }}) => {{
    const handleChange = (field: keyof CurrencyRequirement, value: any) => {{
        onUpdate({{ ...currency, [field]: value }});
    }};

    const suggestedTypes: string[] = currency.expiryRule === 'ROLLING_WINDOW' ? ['count'] : ['date'];
    const activeTypes: string[] = currency.postFlightInputTypes ?? suggestedTypes;

    const toggleInputType = (type: 'date' | 'count' | 'checkbox') => {{
        const current: string[] = currency.postFlightInputTypes ?? suggestedTypes;
        const next = current.includes(type)
            ? current.filter((t: string) => t !== type)
            : [...current, type];
        handleChange('postFlightInputTypes', next.length > 0 ? next : suggestedTypes);
    }};

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-green-400">Edit Primitive Currency</h2>
            <InputField label="Name" value={{currency.name}} onChange={{v => handleChange('name', v)}} />
            <InputField label="Description" value={{currency.description}} onChange={{v => handleChange('description', v)}} />
            <CheckboxField label="Visible in Main List" checked={{currency.isVisible}} onChange={{v => handleChange('isVisible', v)}} />
            <InputField label="Validity (Days)" type="number" value={{currency.validityDays}} onChange={{v => handleChange('validityDays', Number(v))}} />
            <InputField label="Required Count" type="number" value={{currency.requiredCount}} onChange={{v => handleChange('requiredCount', Number(v))}} />
            <DropdownField label="Expiry Rule" value={{currency.expiryRule}} onChange={{v => handleChange('expiryRule', v)}}>
                <option value="LAST_EVENT_PLUS_PERIOD">Last Event + Period</option>
                <option value="ROLLING_WINDOW">Rolling Window</option>
            </DropdownField>
            <InputField label="Event Codes (comma-separated)" value={{currency.eventCodes.join(', ')}} onChange={{v => handleChange('eventCodes', v.split(',').map((s: string) => s.trim()).filter(Boolean))}} />

            {{/* Post-Flight Integration */}}
            <div className="p-4 border border-amber-600/40 rounded-lg bg-amber-900/10 space-y-3">
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide">Post-Flight Page</h3>
                <CheckboxField
                    label="Show in Post-Flight entry page"
                    checked={{currency.showInPostFlight ?? false}}
                    onChange={{v => handleChange('showInPostFlight', v)}}
                />
                {{currency.showInPostFlight && (
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Input Type(s) on Post-Flight Page
                            <span className="text-xs text-gray-500 ml-2 font-normal">(select one or more)</span>
                        </label>
                        <div className="flex flex-col space-y-2">
                            {{([
                                {{ type: 'checkbox' as const, icon: '{CHECKBOX}', label: 'Checkbox', desc: 'Pilot ticks to confirm completed {DASH} flight date is saved as the currency date' }},
                                {{ type: 'date'     as const, icon: '{CAL}',      label: 'Date picker', desc: 'Pilot enters the date it was last completed' }},
                                {{ type: 'count'    as const, icon: '{NUM}',      label: 'Number input', desc: 'Pilot enters count completed this flight (e.g. approaches)' }},
                            ]).map(({{ type, icon, label, desc }}) => (
                                <label key={{type}} className="flex items-start space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={{activeTypes.includes(type)}}
                                        onChange={{() => toggleInputType(type)}}
                                        className="h-4 w-4 mt-0.5 accent-amber-500 flex-shrink-0"
                                    />
                                    <span className="text-sm leading-tight">
                                        <span className="font-medium text-amber-300">{{icon}} {{label}}</span>
                                        <span className="text-gray-400"> {DASH} {{desc}}</span>
                                    </span>
                                </label>
                            ))}}
                        </div>
                        <p className="text-xs text-amber-500/70 mt-2">
                            Suggested: <span className="font-semibold">{{suggestedTypes.join(', ')}}</span> based on expiry rule
                            ({{currency.expiryRule === 'ROLLING_WINDOW' ? 'rolling count' : 'last event date'}})
                        </p>
                    </div>
                )}}
            </div>
        </div>
    );
}};

const CompositeEditor: React.FC<{{ currency: MasterCurrency; onUpdate: (c: MasterCurrency) => void; allCurrencies: CurrencyDefinition[]; }}> = ({{ currency, onUpdate, allCurrencies }}) => {{
    const handleChange = (field: keyof MasterCurrency, value: any) => {{
        onUpdate({{ ...currency, [field]: value }});
    }};
    const handleLogicTreeChange = (newLogicTree: LogicNode) => {{
        handleChange('logicTree', newLogicTree);
    }};

    const activeTypes: string[] = currency.postFlightInputTypes ?? ['checkbox'];

    const toggleInputType = (type: 'date' | 'count' | 'checkbox') => {{
        const current: string[] = currency.postFlightInputTypes ?? ['checkbox'];
        const next = current.includes(type)
            ? current.filter((t: string) => t !== type)
            : [...current, type];
        handleChange('postFlightInputTypes', next.length > 0 ? next : ['checkbox']);
    }};

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-purple-400">Edit Composite Currency</h2>
            <InputField label="Name" value={{currency.name}} onChange={{v => handleChange('name', v)}} />
            <InputField label="Description" value={{currency.description}} onChange={{v => handleChange('description', v)}} />
            <CheckboxField label="Visible in Main List" checked={{currency.isVisible}} onChange={{v => handleChange('isVisible', v)}} />
            <DropdownField label="Expiry Calculation" value={{currency.expiryCalculation}} onChange={{v => handleChange('expiryCalculation', v)}}>
                <option value="EARLIEST_CHILD">Use Earliest Expiry</option>
                <option value="LATEST_CHILD">Use Latest Expiry</option>
            </DropdownField>
            <LogicNodeEditor node={{currency.logicTree}} path={{[]}} onUpdate={{handleLogicTreeChange}} allCurrencies={{allCurrencies}} />

            {{/* Post-Flight Integration */}}
            <div className="p-4 border border-purple-600/40 rounded-lg bg-purple-900/10 space-y-3">
                <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wide">Post-Flight Page</h3>
                <CheckboxField
                    label="Show in Post-Flight entry page"
                    checked={{currency.showInPostFlight ?? false}}
                    onChange={{v => handleChange('showInPostFlight', v)}}
                />
                {{currency.showInPostFlight && (
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Input Type(s) on Post-Flight Page
                            <span className="text-xs text-gray-500 ml-2 font-normal">(select one or more)</span>
                        </label>
                        <div className="flex flex-col space-y-2">
                            {{([
                                {{ type: 'checkbox' as const, icon: '{CHECKBOX}', label: 'Checkbox', desc: 'Pilot ticks to confirm completed {DASH} flight date is saved as the currency date' }},
                                {{ type: 'date'     as const, icon: '{CAL}',      label: 'Date picker', desc: 'Pilot enters the date it was last satisfied' }},
                                {{ type: 'count'    as const, icon: '{NUM}',      label: 'Number input', desc: 'Pilot enters count completed this flight' }},
                            ]).map(({{ type, icon, label, desc }}) => (
                                <label key={{type}} className="flex items-start space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={{activeTypes.includes(type)}}
                                        onChange={{() => toggleInputType(type)}}
                                        className="h-4 w-4 mt-0.5 accent-purple-500 flex-shrink-0"
                                    />
                                    <span className="text-sm leading-tight">
                                        <span className="font-medium text-purple-300">{{icon}} {{label}}</span>
                                        <span className="text-gray-400"> {DASH} {{desc}}</span>
                                    </span>
                                </label>
                            ))}}
                        </div>
                    </div>
                )}}
            </div>
        </div>
    );
}};

"""

result = before + new_editors + after

with open('/workspace/DFP-NEO-V2-fresh/components/CurrencyBuilderView.tsx', 'w', encoding='utf-8') as f:
    f.write(result)

print(f"Done. Total chars: {len(result)}")
print(f"PrimitiveEditor: {'const PrimitiveEditor' in result}")
print(f"CompositeEditor: {'const CompositeEditor' in result}")
print(f"LogicNodeEditor: {'const LogicNodeEditor' in result}")