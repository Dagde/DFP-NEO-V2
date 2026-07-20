import React, { useState } from 'react';
import { FormationCallsign } from '../types';
import { stopEditableKeyPropagation } from '../utils/editableKeyEvents';

interface FormationCallsignsSectionProps {
    callsigns: FormationCallsign[];
    onUpdateCallsigns: (callsigns: FormationCallsign[]) => void;
    units: string[];
    locations: string[];
    locationOptions?: Array<{ name: string; code: string }>;
    canEditSettings: boolean;
    isSettingsUnlocked?: boolean;
    onRequestUnlock?: () => Promise<boolean>;
    onAuditLog?: (entry: any) => void;
}

const FormationCallsignsSection: React.FC<FormationCallsignsSectionProps> = ({
    callsigns,
    onUpdateCallsigns,
    units,
    locations,
    locationOptions = [],
    canEditSettings,
    isSettingsUnlocked = canEditSettings,
    onRequestUnlock,
    onAuditLog
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempCallsigns, setTempCallsigns] = useState<FormationCallsign[]>([]);
    const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
    const [newCallsign, setNewCallsign] = useState<FormationCallsign>({
        name: '',
        code: '',
        unit: '',
        location: '',
        locationCode: ''
    });
    const [validationMessage, setValidationMessage] = useState('');
    const configuredLocationOptions = locationOptions.length > 0
        ? locationOptions
        : locations.map(location => ({ name: location, code: '' }));
    const findLocationOption = (locationName: string) => configuredLocationOptions.find(location => location.name === locationName);
    const makeEmptyCallsign = (unitOverride = selectedUnit): FormationCallsign => {
        const defaultLocation = configuredLocationOptions[0];
        const defaultUnit = unitOverride !== 'ALL' ? unitOverride : units.length === 1 ? units[0] : '';
        return {
            name: '',
            code: '',
            unit: defaultUnit,
            location: defaultLocation?.name || '',
            locationCode: defaultLocation?.code || ''
        };
    };
    const allowedUnitSet = new Set(units.map(unit => String(unit || '').trim().toUpperCase()).filter(Boolean));
    const isCallsignVisibleForUnitScope = (callsign: FormationCallsign) => {
        if (allowedUnitSet.size === 0) return true;
        const unit = String(callsign.unit || '').trim().toUpperCase();
        return unit ? allowedUnitSet.has(unit) : false;
    };

    const handleEdit = async () => {
        if (!canEditSettings) return;
        if (!isSettingsUnlocked) {
            const unlocked = await onRequestUnlock?.();
            if (!unlocked) return;
        }
        setTempCallsigns([...callsigns]);
        setNewCallsign(makeEmptyCallsign());
        setValidationMessage('');
        setIsEditing(true);
    };

    const handleSave = () => {
        const oldCallsigns = callsigns.map(c => `${c.name} (${c.code})`).join(', ');
        const newCallsignsStr = tempCallsigns.map(c => `${c.name} (${c.code})`).join(', ');
        
        onUpdateCallsigns(tempCallsigns);
        setIsEditing(false);

        if (onAuditLog) {
            onAuditLog({
                timestamp: new Date().toISOString(),
                page: 'Settings - Location - Formation Callsigns',
                action: 'Updated Formation Callsigns',
                changes: `From: [${oldCallsigns}] To: [${newCallsignsStr}]`
            });
        }
    };

    const handleCancel = () => {
        setNewCallsign(makeEmptyCallsign());
        setValidationMessage('');
        setIsEditing(false);
    };

    const handleAdd = () => {
        const locationOption = findLocationOption(newCallsign.location);
        const callsignToAdd: FormationCallsign = {
            ...newCallsign,
            name: newCallsign.name.trim(),
            code: newCallsign.code.trim().toUpperCase(),
            unit: newCallsign.unit.trim(),
            location: newCallsign.location.trim(),
            locationCode: (newCallsign.locationCode || locationOption?.code || '').trim().toUpperCase()
        };
        const missingFields = [
            !callsignToAdd.name ? 'name' : '',
            !callsignToAdd.code ? 'code' : '',
            !callsignToAdd.unit ? 'unit' : '',
            !callsignToAdd.location ? 'location' : '',
            !callsignToAdd.locationCode ? 'location code' : ''
        ].filter(Boolean);
        if (missingFields.length > 0) {
            setValidationMessage(`Enter ${missingFields.join(', ')} before adding the formation callsign.`);
            return;
        }
        setTempCallsigns([...tempCallsigns, callsignToAdd]);
        setNewCallsign(makeEmptyCallsign(callsignToAdd.unit));
        setSelectedUnit(callsignToAdd.unit);
        setValidationMessage('');
    };

    const handleNewLocationChange = (locationName: string) => {
        const locationOption = findLocationOption(locationName);
        setNewCallsign({
            ...newCallsign,
            location: locationName,
            locationCode: (locationOption?.code || '').toUpperCase()
        });
    };

    const handleRemove = (index: number) => {
        setTempCallsigns(tempCallsigns.filter((_, i) => i !== index));
    };

    const handleUpdateCallsign = (index: number, field: keyof FormationCallsign, value: string) => {
        if (index < 0) return;
        const updated = [...tempCallsigns];
        if (field === 'location') {
            const locationOption = findLocationOption(value);
            updated[index] = {
                ...updated[index],
                location: value,
                locationCode: (locationOption?.code || updated[index].locationCode || '').toUpperCase()
            };
        } else {
            updated[index] = { ...updated[index], [field]: value };
        }
        setTempCallsigns(updated);
    };

    const effectiveSelectedUnit = selectedUnit !== 'ALL' && allowedUnitSet.size > 0 && !allowedUnitSet.has(String(selectedUnit || '').trim().toUpperCase())
        ? 'ALL'
        : selectedUnit;
    const scopedCallsigns = (isEditing ? tempCallsigns : callsigns).filter(isCallsignVisibleForUnitScope);
    const filteredCallsigns = effectiveSelectedUnit === 'ALL'
        ? scopedCallsigns
        : scopedCallsigns.filter(c => c.unit === effectiveSelectedUnit);
    const sectionButtonClass = 'w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md disabled:cursor-not-allowed disabled:opacity-50';

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-[800px] h-fit" onKeyDownCapture={stopEditableKeyPropagation}>
            <div className="p-4 flex justify-between items-center border-b border-gray-700">
                <h2 className="text-lg font-semibold text-gray-200">Formation Callsigns</h2>
                {isEditing ? (
                    <div className="flex gap-px">
                        <button onClick={handleSave} className={sectionButtonClass}>Save</button>
                        <button onClick={handleCancel} className={sectionButtonClass}>Cancel</button>
                    </div>
                ) : (
                    <button 
                        onClick={handleEdit} 
                        disabled={!canEditSettings}
                        className={sectionButtonClass}
                    >
                        Edit
                    </button>
                )}
            </div>

            <div className="p-4 space-y-4">
                {/* Unit Filter */}
                <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-400">Filter by Unit:</label>
                    <select
                        value={effectiveSelectedUnit}
                        onChange={(e) => setSelectedUnit(e.target.value)}
                        className="bg-gray-700 border-gray-600 rounded-md py-1 px-2 text-white text-sm focus:outline-none focus:ring-sky-500"
                    >
                        <option value="ALL">ALL</option>
                        {units.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                        ))}
                    </select>
                </div>

                {isEditing ? (
                    <>
                        <p className="text-sm text-gray-400">Manage formation callsigns for units.</p>
                        
                        {/* Callsigns Table */}
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-700 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-gray-300 font-semibold">Name</th>
                                        <th className="px-3 py-2 text-left text-gray-300 font-semibold">Code</th>
                                        <th className="px-3 py-2 text-left text-gray-300 font-semibold">Unit</th>
                                        <th className="px-3 py-2 text-left text-gray-300 font-semibold">Location</th>
                                        <th className="px-3 py-2 text-left text-gray-300 font-semibold">Loc Code</th>
                                        <th className="px-3 py-2 text-center text-gray-300 font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCallsigns.map((callsign, index) => {
                                        const actualIndex = tempCallsigns.findIndex(c => 
                                            c.name === callsign.name && 
                                            c.code === callsign.code && 
                                            c.unit === callsign.unit
                                        );
                                        return (
                                            <tr key={index} className="border-b border-gray-700 hover:bg-gray-700/30">
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="text"
                                                        value={callsign.name}
                                                        onChange={(e) => handleUpdateCallsign(actualIndex, 'name', e.target.value)}
                                                        className="w-full bg-gray-700 border-gray-600 rounded px-2 py-1 text-white text-xs"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="text"
                                                        value={callsign.code}
                                                        onChange={(e) => handleUpdateCallsign(actualIndex, 'code', e.target.value.toUpperCase())}
                                                        className="w-full bg-gray-700 border-gray-600 rounded px-2 py-1 text-white text-xs"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <select
                                                        value={callsign.unit}
                                                        onChange={(e) => handleUpdateCallsign(actualIndex, 'unit', e.target.value)}
                                                        className="w-full bg-gray-700 border-gray-600 rounded px-2 py-1 text-white text-xs"
                                                    >
                                                        <option value="">Select...</option>
                                                        {units.map(unit => (
                                                            <option key={unit} value={unit}>{unit}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <select
                                                        value={callsign.location}
                                                        onChange={(e) => handleUpdateCallsign(actualIndex, 'location', e.target.value)}
                                                        className="w-full bg-gray-700 border-gray-600 rounded px-2 py-1 text-white text-xs"
                                                    >
                                                        <option value="">Select...</option>
                                                        {configuredLocationOptions.map(loc => (
                                                            <option key={`${loc.code || loc.name}-${loc.name}`} value={loc.name}>{loc.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="text"
                                                        value={callsign.locationCode}
                                                        onChange={(e) => handleUpdateCallsign(actualIndex, 'locationCode', e.target.value.toUpperCase())}
                                                        className="w-full bg-gray-700 border-gray-600 rounded px-2 py-1 text-white text-xs"
                                                        maxLength={3}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button 
                                                        onClick={() => handleRemove(actualIndex)} 
                                                        className="p-1 text-gray-400 hover:text-red-400"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Add New Callsign Form */}
                        <div className="border-t border-gray-700 pt-4">
                            <p className="text-sm text-gray-400 mb-2">Add New Callsign:</p>
                            <div className="grid grid-cols-6 gap-2">
                                <input
                                    type="text"
                                    value={newCallsign.name}
                                    onChange={(e) => setNewCallsign({ ...newCallsign, name: e.target.value })}
                                    placeholder="Name"
                                    className="bg-gray-700 border-gray-600 rounded px-2 py-1 text-white text-xs"
                                />
                                <input
                                    type="text"
                                    value={newCallsign.code}
                                    onChange={(e) => setNewCallsign({ ...newCallsign, code: e.target.value.toUpperCase() })}
                                    placeholder="Code"
                                    className="bg-gray-700 border-gray-600 rounded px-2 py-1 text-white text-xs"
                                />
                                <select
                                    value={newCallsign.unit}
                                    onChange={(e) => setNewCallsign({ ...newCallsign, unit: e.target.value })}
                                    className="bg-gray-700 border-gray-600 rounded px-2 py-1 text-white text-xs"
                                >
                                    <option value="">Unit...</option>
                                    {units.map(unit => (
                                        <option key={unit} value={unit}>{unit}</option>
                                    ))}
                                </select>
                                <select
                                    value={newCallsign.location}
                                    onChange={(e) => handleNewLocationChange(e.target.value)}
                                    className="bg-gray-700 border-gray-600 rounded px-2 py-1 text-white text-xs"
                                >
                                    <option value="">Location...</option>
                                    {configuredLocationOptions.map(loc => (
                                        <option key={`${loc.code || loc.name}-${loc.name}`} value={loc.name}>{loc.name}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={newCallsign.locationCode}
                                    onChange={(e) => setNewCallsign({ ...newCallsign, locationCode: e.target.value.toUpperCase() })}
                                    placeholder="Code"
                                    maxLength={3}
                                    className="bg-gray-700 border-gray-600 rounded px-2 py-1 text-white text-xs"
                                />
                                <button 
                                    onClick={handleAdd} 
                                    className={sectionButtonClass}
                                >
                                    Add
                                </button>
                            </div>
                            {validationMessage && (
                                <p className="mt-2 text-xs text-amber-300">{validationMessage}</p>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-gray-400">Configured formation callsigns.</p>
                        
                        {/* Read-only Table */}
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-700 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-gray-300 font-semibold">Name</th>
                                        <th className="px-3 py-2 text-left text-gray-300 font-semibold">Code</th>
                                        <th className="px-3 py-2 text-left text-gray-300 font-semibold">Unit</th>
                                        <th className="px-3 py-2 text-left text-gray-300 font-semibold">Location</th>
                                        <th className="px-3 py-2 text-left text-gray-300 font-semibold">Loc Code</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCallsigns.map((callsign, index) => (
                                        <tr key={index} className="border-b border-gray-700 hover:bg-gray-700/30">
                                            <td className="px-3 py-2 text-white">{callsign.name}</td>
                                            <td className="px-3 py-2 text-white">{callsign.code}</td>
                                            <td className="px-3 py-2 text-white">{callsign.unit}</td>
                                            <td className="px-3 py-2 text-white">{callsign.location}</td>
                                            <td className="px-3 py-2 text-white">{callsign.locationCode}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default FormationCallsignsSection;
