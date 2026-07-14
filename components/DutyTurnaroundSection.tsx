import React, { useEffect, useMemo, useState } from 'react';
import { logAudit } from '../utils/auditLogger';
import { stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';

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
    canEdit?: boolean;
    onShowSuccess?: (message: string) => void;
    resourceDisplayNames?: ResourceDisplayNames;
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
    onUpdateCptTurnaround,
    canEdit = true,
    onShowSuccess,
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draftPreferredDutyPeriod, setDraftPreferredDutyPeriod] = useState(preferredDutyPeriod);
    const [draftMaxCrewDutyPeriod, setDraftMaxCrewDutyPeriod] = useState(maxCrewDutyPeriod);
    const [draftFlightTurnaround, setDraftFlightTurnaround] = useState(flightTurnaround);
    const [draftFtdTurnaround, setDraftFtdTurnaround] = useState(ftdTurnaround);
    const [draftCptTurnaround, setDraftCptTurnaround] = useState(cptTurnaround);
    const [openTurnaroundMenu, setOpenTurnaroundMenu] = useState<string | null>(null);
    const turnaroundOptions = useMemo(() => Array.from({ length: 30 }, (_, i) => parseFloat(((i + 1) * 0.1).toFixed(1))), []);
    const standardSettingsButtonClass = 'w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md disabled:cursor-not-allowed disabled:opacity-50';

    useEffect(() => {
        if (isEditing) return;
        setDraftPreferredDutyPeriod(preferredDutyPeriod);
        setDraftMaxCrewDutyPeriod(maxCrewDutyPeriod);
        setDraftFlightTurnaround(flightTurnaround);
        setDraftFtdTurnaround(ftdTurnaround);
        setDraftCptTurnaround(cptTurnaround);
    }, [cptTurnaround, flightTurnaround, ftdTurnaround, isEditing, maxCrewDutyPeriod, preferredDutyPeriod]);

    const handleEdit = () => {
        setDraftPreferredDutyPeriod(preferredDutyPeriod);
        setDraftMaxCrewDutyPeriod(maxCrewDutyPeriod);
        setDraftFlightTurnaround(flightTurnaround);
        setDraftFtdTurnaround(ftdTurnaround);
        setDraftCptTurnaround(cptTurnaround);
        setOpenTurnaroundMenu(null);
        setIsEditing(true);
    };

    const handleCancel = () => {
        setDraftPreferredDutyPeriod(preferredDutyPeriod);
        setDraftMaxCrewDutyPeriod(maxCrewDutyPeriod);
        setDraftFlightTurnaround(flightTurnaround);
        setDraftFtdTurnaround(ftdTurnaround);
        setDraftCptTurnaround(cptTurnaround);
        setOpenTurnaroundMenu(null);
        setIsEditing(false);
    };

    const handleSave = () => {
        onUpdatePreferredDutyPeriod(draftPreferredDutyPeriod);
        onUpdateMaxCrewDutyPeriod(draftMaxCrewDutyPeriod);
        onUpdateFlightTurnaround(draftFlightTurnaround);
        onUpdateFtdTurnaround(draftFtdTurnaround);
        onUpdateCptTurnaround(draftCptTurnaround);
        setOpenTurnaroundMenu(null);
        setIsEditing(false);
        logAudit(
            'Settings - Duty & Turnaround',
            'update',
            'Updated duty and turnaround settings',
            `Duty period soft/hard: ${preferredDutyPeriod}/${maxCrewDutyPeriod} → ${draftPreferredDutyPeriod}/${draftMaxCrewDutyPeriod}; turnaround ${flightTurnaround}/${ftdTurnaround}/${cptTurnaround} → ${draftFlightTurnaround}/${draftFtdTurnaround}/${draftCptTurnaround}`,
        );
        onShowSuccess?.('Duty and turnaround settings updated');
    };

    const TurnaroundInput: React.FC<{ label: string, value: number, onChange: (value: number) => void, options: number[] }> = ({ label, value, onChange, options }) => {
        const inputId = `turnaround-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const isOpen = openTurnaroundMenu === inputId;
        return (
            <div
                className="relative"
                onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setOpenTurnaroundMenu((current) => (current === inputId ? null : current));
                    }
                }}
            >
                <label id={`${inputId}-label`} className="block text-sm font-medium text-gray-400">{label}</label>
                <button
                    type="button"
                    id={inputId}
                    disabled={!isEditing}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-labelledby={`${inputId}-label ${inputId}`}
                    onClick={() => setOpenTurnaroundMenu((current) => (current === inputId ? null : inputId))}
                    className={`w-full mt-1 border rounded-md py-2 px-3 focus:outline-none focus:ring-sky-500 text-center ${
                        isEditing
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed'
                    }`}
                >
                    <span>{value.toFixed(1)} hrs</span>
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3 top-[35px] h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-gray-300"
                    />
                </button>
                {isEditing && isOpen && (
                    <div
                        role="listbox"
                        aria-labelledby={`${inputId}-label`}
                        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-md border border-gray-600 bg-gray-900 py-1 shadow-2xl"
                    >
                        {options.map((opt) => {
                            const selected = opt === value;
                            return (
                                <button
                                    type="button"
                                    key={opt}
                                    role="option"
                                    aria-selected={selected}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                        onChange(opt);
                                        setOpenTurnaroundMenu(null);
                                    }}
                                    className={`block w-full px-3 py-2 text-left text-sm ${
                                        selected
                                            ? 'bg-cyan-500/20 text-cyan-100'
                                            : 'text-gray-200 hover:bg-gray-700'
                                    }`}
                                >
                                    {opt.toFixed(1)} hrs
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 h-fit" onKeyDownCapture={stopEditableKeyPropagation}>
            <div className="p-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-200">Duty & Turnaround</h2>
                {isEditing ? (
                    <div className="flex gap-[1px]">
                        <button onClick={handleSave} className={standardSettingsButtonClass}>Save</button>
                        <button onClick={handleCancel} className={standardSettingsButtonClass}>Cancel</button>
                    </div>
                ) : (
                    <button onClick={handleEdit} disabled={!canEdit} className={standardSettingsButtonClass}>Edit</button>
                )}
            </div>
            <div className="p-4 border-t border-gray-700 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400">Crew Duty Period (hrs)</label>
                    <div className="flex items-center space-x-2 mt-1">
                        <div className="flex flex-col flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Soft Limit</label>
                            <input
                                type="number"
                                value={draftPreferredDutyPeriod}
                                onChange={(e) => setDraftPreferredDutyPeriod(parseInt(e.target.value) || 0)}
                                disabled={!isEditing}
                                className={`w-full border rounded-md py-2 px-3 focus:outline-none focus:ring-sky-500 text-center ${
                                    isEditing
                                        ? 'bg-gray-700 border-gray-600 text-white'
                                        : 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed'
                                }`}
                            />
                        </div>
                        <div className="flex flex-col flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Hard Limit</label>
                            <input
                                type="number"
                                value={draftMaxCrewDutyPeriod}
                                onChange={(e) => setDraftMaxCrewDutyPeriod(parseInt(e.target.value) || 0)}
                                disabled={!isEditing}
                                className={`w-full border rounded-md py-2 px-3 focus:outline-none focus:ring-sky-500 text-center ${
                                    isEditing
                                        ? 'bg-gray-700 border-gray-600 text-white'
                                        : 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed'
                                }`}
                            />
                        </div>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400">Turnaround Times</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                        <TurnaroundInput
                            label="Flight"
                            value={draftFlightTurnaround}
                            onChange={setDraftFlightTurnaround}
                            options={turnaroundOptions}
                        />
                        <TurnaroundInput
                            label={resourceDisplayNames.ftd}
                            value={draftFtdTurnaround}
                            onChange={setDraftFtdTurnaround}
                            options={turnaroundOptions}
                        />
                        <TurnaroundInput
                            label={resourceDisplayNames.cpt}
                            value={draftCptTurnaround}
                            onChange={setDraftCptTurnaround}
                            options={turnaroundOptions}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DutyTurnaroundSection;
