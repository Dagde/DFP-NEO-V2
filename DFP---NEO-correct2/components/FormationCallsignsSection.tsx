import React, { useState } from 'react';
import { FormationCallsign } from '../types';

interface FormationCallsignsSectionProps {
    callsigns: FormationCallsign[];
    onUpdateCallsigns: (callsigns: FormationCallsign[]) => void;
    units: string[];
    locations: string[];
    canEditSettings: boolean;
    onAuditLog?: (entry: any) => void;
}

const FormationCallsignsSection: React.FC<FormationCallsignsSectionProps> = ({
    callsigns,
    onUpdateCallsigns,
    units,
    locations,
    canEditSettings,
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

    const handleEdit = () => {
        setTempCallsigns([...callsigns]);
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
        setNewCallsign({ name: '', code: '', unit: '', location: '', locationCode: '' });
        setIsEditing(false);
    };

    const handleAdd = () => {
        if (newCallsign.name && newCallsign.code && newCallsign.unit && newCallsign.location && newCallsign.locationCode) {
            setTempCallsigns([...tempCallsigns, { ...newCallsign }]);
            setNewCallsign({ name: '', code: '', unit: '', location: '', locationCode: '' });
        }
    };

    const handleRemove = (index: number) => {
        setTempCallsigns(tempCallsigns.filter((_, i) => i !== index));
    };

    const handleUpdateCallsign = (index: number, field: keyof FormationCallsign, value: string) => {
        const updated = [...tempCallsigns];
        updated[index] = { ...updated[index], [field]: value };
        setTempCallsigns(updated);
    };

    const filteredCallsigns = isEditing
        ? (selectedUnit === 'ALL' ? tempCallsigns : tempCallsigns.filter(c => c.unit === selectedUnit))
        : (selectedUnit === 'ALL' ? callsigns : callsigns.filter(c => c.unit === selectedUnit));

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-[800px] h-fit">
            <div className="p-4 flex justify-between items-center border-b border-gray-700">
                <h2 className="text-lg font-semibold text-gray-200">Formation Callsigns</h2>
                {isEditing ? (
                    <div className="flex space-x-2">
                        <button onClick={handleSave} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">Save</button>
                        <button onClick={handleCancel} className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-semibold">Cancel</button>
                    </div>
                ) : (
                    <button 
                        onClick={handleEdit} 
                        disabled={!canEditSettings}
                        className={`px-3 py-1 rounded-md text-xs font-semibold ${
                            canEditSettings 
                                ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer' 
                                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
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
                        value={selectedUnit}
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
                                                        {locations.map(loc => (
                                                            <option key={loc} value={loc}>{loc}</option>
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
                                    onChange={(e) => setNewCallsign({ ...newCallsign, location: e.target.value })}
                                    className="bg-gray-700 border-gray-600 rounded px-2 py-1 text-white text-xs"
                                >
                                    <option value="">Location...</option>
                                    {locations.map(loc => (
                                        <option key={loc} value={loc}>{loc}</option>
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
                                    className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-semibold"
                                >
                                    Add
                                </button>
                            </div>
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