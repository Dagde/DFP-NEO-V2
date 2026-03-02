import React, { useMemo } from 'react';
import { logAudit } from '../utils/auditLogger';

interface DutyTurnaroundSectionProps {
    preferredDutyPeriod: number;
    onUpdatePreferredDutyPeriod: (value: number) => void;
    maxCrewDutyPeriod: number;
    onUpdateMaxCrewDutyPeriod: (value: number) => void;
    flightTurnaround: number;
    onUpdateFlightTurnaround: (value: number) => void;
    ftdTurnaround: number;
    onUpdateFtdTurnaround: (value: number) => void;
    cptTurnaround: number;
    onUpdateCptTurnaround: (value: number) => void;
}

const DutyTurnaroundSection: React.FC<DutyTurnaroundSectionProps> = ({
    preferredDutyPeriod,
    onUpdatePreferredDutyPeriod,
    maxCrewDutyPeriod,
    onUpdateMaxCrewDutyPeriod,
    flightTurnaround,
    onUpdateFlightTurnaround,
    ftdTurnaround,
    onUpdateFtdTurnaround,
    cptTurnaround,
    onUpdateCptTurnaround
}) => {
    const turnaroundOptions = useMemo(() => Array.from({ length: 30 }, (_, i) => parseFloat(((i + 1) * 0.1).toFixed(1))), []);

    const TurnaroundInput: React.FC<{ label: string, value: number, onChange: (value: number) => void, options: number[] }> = ({ label, value, onChange, options }) => (
        <div>
            <label htmlFor={`turnaround-${label}`} className="block text-sm font-medium text-gray-400">{label}</label>
            <select
                id={`turnaround-${label}`}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 text-center"
            >
                {options.map(opt => <option key={opt} value={opt}>{opt.toFixed(1)} hrs</option>)}
            </select>
        </div>
    );

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 h-fit">
            <div className="p-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-200">Duty & Turnaround</h2>
            </div>
            <div className="p-4 border-t border-gray-700 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400">Crew Duty Period (hrs)</label>
                    <div className="flex items-center space-x-2 mt-1">
                        <div className="flex flex-col flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Soft Limit</label>
                            <input 
                                type="number" 
                                value={preferredDutyPeriod} 
                                onChange={(e) => { 
                                    logAudit("Settings", "Edit", "Updated soft limit duty period", `${preferredDutyPeriod} → ${parseInt(e.target.value)}`); 
                                    onUpdatePreferredDutyPeriod(parseInt(e.target.value)); 
                                }} 
                                className="w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 text-center"
                            />
                        </div>
                        <div className="flex flex-col flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Hard Limit</label>
                            <input 
                                type="number" 
                                value={maxCrewDutyPeriod} 
                                onChange={(e) => { 
                                    logAudit("Settings", "Edit", "Updated hard limit duty period", `${maxCrewDutyPeriod} → ${parseInt(e.target.value)}`); 
                                    onUpdateMaxCrewDutyPeriod(parseInt(e.target.value)); 
                                }} 
                                className="w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 text-center"
                            />
                        </div>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400">Turnaround Times</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                        <TurnaroundInput 
                            label="Flight" 
                            value={flightTurnaround} 
                            onChange={(v) => { 
                                logAudit("Settings", "Edit", "Updated flight turnaround time", `${flightTurnaround} → ${v}`); 
                                onUpdateFlightTurnaround(v); 
                            }} 
                            options={turnaroundOptions} 
                        />
                        <TurnaroundInput 
                            label="FTD" 
                            value={ftdTurnaround} 
                            onChange={(v) => { 
                                logAudit("Settings", "Edit", "Updated FTD turnaround time", `${ftdTurnaround} → ${v}`); 
                                onUpdateFtdTurnaround(v); 
                            }} 
                            options={turnaroundOptions} 
                        />
                        <TurnaroundInput 
                            label="CPT" 
                            value={cptTurnaround} 
                            onChange={(v) => { 
                                logAudit("Settings", "Edit", "Updated CPT turnaround time", `${cptTurnaround} → ${v}`); 
                                onUpdateCptTurnaround(v); 
                            }} 
                            options={turnaroundOptions} 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DutyTurnaroundSection;