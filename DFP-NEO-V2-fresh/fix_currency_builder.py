#!/usr/bin/env python3
"""Fix CurrencyBuilderView.tsx: replace radio buttons with multi-select checkboxes for postFlightInputTypes."""

import sys

with open('components/CurrencyBuilderView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── Locate markers ────────────────────────────────────────────────────────────
PRIM_START  = '\nconst PrimitiveEditor'
COMP_START  = '\nconst CompositeEditor'
LOGIC_START = '\nconst LogicNodeEditor'

prim_idx  = content.find(PRIM_START)
comp_idx  = content.find(COMP_START)
logic_idx = content.find(LOGIC_START)

if prim_idx == -1 or comp_idx == -1 or logic_idx == -1:
    print('ERROR: Could not find one or more markers.')
    print(f'  PrimitiveEditor at: {prim_idx}')
    print(f'  CompositeEditor at: {comp_idx}')
    print(f'  LogicNodeEditor at: {logic_idx}')
    sys.exit(1)

print(f'Markers found: Prim={prim_idx}, Comp={comp_idx}, Logic={logic_idx}')

# ─── New PrimitiveEditor block ─────────────────────────────────────────────────
PRIM_NEW = r"""
const PrimitiveEditor: React.FC<{ currency: CurrencyRequirement; onUpdate: (c: CurrencyRequirement) => void; }> = ({ currency, onUpdate }) => {
    const handleChange = (field: keyof CurrencyRequirement, value: any) => {
        onUpdate({ ...currency, [field]: value });
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
            <InputField label="Description" value={currency.description} onChange={v => handleChange('description', v)} />
            <CheckboxField label="Visible in Main List" checked={currency.isVisible} onChange={v => handleChange('isVisible', v)} />
            <InputField label="Validity (Days)" type="number" value={currency.validityDays} onChange={v => handleChange('validityDays', Number(v))} />
            <InputField label="Required Count" type="number" value={currency.requiredCount} onChange={v => handleChange('requiredCount', Number(v))} />
            <DropdownField label="Expiry Rule" value={currency.expiryRule} onChange={v => handleChange('expiryRule', v)}>
                <option value="LAST_EVENT_PLUS_PERIOD">Last Event + Period</option>
                <option value="ROLLING_WINDOW">Rolling Window</option>
            </DropdownField>
            <InputField label="Event Codes (comma-separated)" value={currency.eventCodes.join(', ')} onChange={v => handleChange('eventCodes', v.split(',').map((s: string) => s.trim()).filter(Boolean))} />

            {/* Post-Flight Integration */}
            <div className="p-4 border border-amber-600/40 rounded-lg bg-amber-900/10 space-y-3">
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide">Post-Flight Page</h3>
                <CheckboxField
                    label="Show in Post-Flight entry page"
                    checked={currency.showInPostFlight ?? false}
                    onChange={v => handleChange('showInPostFlight', v)}
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
"""

# ─── New CompositeEditor block ─────────────────────────────────────────────────
COMP_NEW = r"""
const CompositeEditor: React.FC<{ currency: MasterCurrency; onUpdate: (c: MasterCurrency) => void; allCurrencies: CurrencyDefinition[]; }> = ({ currency, onUpdate, allCurrencies }) => {
    const handleChange = (field: keyof MasterCurrency, value: any) => {
        onUpdate({ ...currency, [field]: value });
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
            <InputField label="Description" value={currency.description} onChange={v => handleChange('description', v)} />
            <CheckboxField label="Visible in Main List" checked={currency.isVisible} onChange={v => handleChange('isVisible', v)} />
            <DropdownField label="Expiry Calculation" value={currency.expiryCalculation} onChange={v => handleChange('expiryCalculation', v)}>
                <option value="EARLIEST_CHILD">Use Earliest Expiry</option>
                <option value="LATEST_CHILD">Use Latest Expiry</option>
            </DropdownField>
            <LogicNodeEditor node={currency.logicTree} path={[]} onUpdate={handleLogicTreeChange} allCurrencies={allCurrencies} />

            {/* Post-Flight Integration */}
            <div className="p-4 border border-purple-600/40 rounded-lg bg-purple-900/10 space-y-3">
                <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wide">Post-Flight Page</h3>
                <CheckboxField
                    label="Show in Post-Flight entry page"
                    checked={currency.showInPostFlight ?? false}
                    onChange={v => handleChange('showInPostFlight', v)}
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
"""

# ─── Also need to add PostFlightInputType import if not already there ──────────
# Check if PostFlightInputType is imported
if 'PostFlightInputType' not in content:
    content = content.replace(
        "import { CurrencyRequirement, MasterCurrency",
        "import { CurrencyRequirement, MasterCurrency, PostFlightInputType"
    )
    print("Added PostFlightInputType to imports")

# ─── Splice ────────────────────────────────────────────────────────────────────
before_prim = content[:prim_idx]
after_logic  = content[logic_idx:]

new_content = before_prim + PRIM_NEW + COMP_NEW + after_logic

with open('components/CurrencyBuilderView.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Done! CurrencyBuilderView.tsx updated successfully.')
print(f'  Original length: {len(content)}')
print(f'  New length:      {len(new_content)}')