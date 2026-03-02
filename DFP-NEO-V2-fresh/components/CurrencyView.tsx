import React, { useMemo, useState, useCallback, useEffect } from 'react';
// FIX: Import the new CurrencyDefinition type and related interfaces.
import { Instructor, Trainee, CurrencyDefinition, PersonCurrencyStatus, MasterCurrency, CurrencyRequirement, ScheduleEvent, SyllabusItemDetail } from '../types';
import AuditButton from './AuditButton';

interface CurrencyViewProps {
  person: Instructor | Trainee;
  // FIX: These props were being passed from App.tsx but were not in the interface.
  masterCurrencies: MasterCurrency[];
  currencyRequirements: CurrencyRequirement[];
  allEvents: ScheduleEvent[];
  syllabusDetails: SyllabusItemDetail[];
  onClose: () => void;
  onUpdateCurrencyStatus: (personId: number, newStatus: PersonCurrencyStatus[]) => void;
  registerDirtyCheck: (isDirty: () => boolean, onSave: () => void, onDiscard: () => void) => void;
}

const CurrencyView: React.FC<CurrencyViewProps> = ({ 
    person, 
    masterCurrencies, 
    currencyRequirements, 
    onClose, 
    onUpdateCurrencyStatus, 
    registerDirtyCheck 
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedStatuses, setEditedStatuses] = useState<Map<string, string>>(new Map());
    
    // FIX: Combine master and requirement currencies into a single list and filter by visibility.
    const visibleCurrencyDefinitions: CurrencyDefinition[] = useMemo(() => {
        return [...masterCurrencies, ...currencyRequirements]
            .filter(c => c.isVisible)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [masterCurrencies, currencyRequirements]);


    const { surname, firstName } = useMemo(() => {
        const name = 'fullName' in person ? person.name : person.name;
        const parts = name.split(', ');
        return { surname: parts[0] || '', firstName: parts[1] || '' };
    }, [person]);

    const hasUnsavedChanges = useMemo(() => {
        if (!isEditing) return false;
    
        const originalMap = new Map(person.currencyStatus?.map(s => [s.currencyName, s.lastEventDate]));
    
        for (const def of visibleCurrencyDefinitions) {
            const originalDate = originalMap.get(def.name) || '';
            const editedDate = editedStatuses.get(def.name) || '';
            if (originalDate !== editedDate) {
                return true;
            }
        }
    
        return false;
    }, [isEditing, editedStatuses, person.currencyStatus, visibleCurrencyDefinitions]);

    const getCurrencyStatus = (currencyName: string): PersonCurrencyStatus | undefined => {
        return person.currencyStatus?.find(c => c.currencyName === currencyName);
    };

    const calculateExpiry = (lastEventDateStr: string, periodInDays: number): Date => {
        const date = new Date(lastEventDateStr);
        date.setDate(date.getDate() + periodInDays);
        return date;
    };

    const calculateDaysRemaining = (expiryDate: Date): number => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiry = new Date(expiryDate);
        expiry.setHours(0, 0, 0, 0);
        const diffTime = expiry.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const getDaysRemainingColor = (days: number): string => {
        if (days <= 0) return 'text-red-400';
        if (days < 30) return 'text-red-400';
        if (days < 61) return 'text-amber-400';
        return 'text-green-400';
    };

    const getStatusIndicatorColor = (days: number | null): string => {
        if (days === null) return 'bg-gray-600'; // No data
        if (days <= 0) return 'bg-red-500';      // Expired
        if (days <= 7) return 'bg-amber-400';   // Expiring soon
        return 'bg-green-500';                  // Current
    };

    const handleEditClick = () => {
        const initialMap = new Map<string, string>();
        visibleCurrencyDefinitions.forEach(def => {
            const status = getCurrencyStatus(def.name);
            initialMap.set(def.name, status?.lastEventDate || '');
        });
        setEditedStatuses(initialMap);
        setIsEditing(true);
    };

    const handleCancelClick = useCallback(() => {
        setIsEditing(false);
        setEditedStatuses(new Map());
    }, []);

    const handleSaveClick = useCallback(() => {
        const newCurrencyStatus: PersonCurrencyStatus[] = [];
        visibleCurrencyDefinitions.forEach(def => {
            const editedDate = editedStatuses.get(def.name);
            if (editedDate) {
                newCurrencyStatus.push({ currencyName: def.name, lastEventDate: editedDate });
            }
        });

        person.currencyStatus?.forEach(status => {
            if (!visibleCurrencyDefinitions.some(def => def.name === status.currencyName)) {
                 if(!editedStatuses.has(status.currencyName)) {
                    newCurrencyStatus.push(status);
                 }
            }
        });

        onUpdateCurrencyStatus(person.idNumber, newCurrencyStatus);
        setIsEditing(false);
    }, [editedStatuses, onUpdateCurrencyStatus, person.idNumber, person.currencyStatus, visibleCurrencyDefinitions]);
    
    useEffect(() => {
        registerDirtyCheck(
            () => hasUnsavedChanges,
            handleSaveClick,
            handleCancelClick
        );
    }, [registerDirtyCheck, hasUnsavedChanges, handleSaveClick, handleCancelClick]);


    const handleDateChange = (currencyName: string, date: string) => {
        setEditedStatuses(prev => new Map(prev).set(currencyName, date));
    };

    const handleAttemptClose = () => {
        onClose();
    };

    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-white">Currency Status</h1>
                    <p className="text-sm text-gray-400">{person.rank} {firstName} {surname}</p>
                </div>
                <button onClick={handleAttemptClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md">
                       &larr; Back
                   </button>
                   <AuditButton pageName="Currency Status" />
            </div>
            <div className="flex-1 overflow-y-auto">
                <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
                    {/* Personal Details Card */}
                    <div className="bg-gray-800 rounded-lg shadow-lg p-4 mb-6 border border-gray-700 grid grid-cols-2 md:grid-cols-6 gap-4 items-center">
                        <div className="text-sm"><span className="text-gray-400">ID: </span><span className="font-semibold text-white">{person.idNumber}</span></div>
                        <div className="text-sm"><span className="text-gray-400">First Name: </span><span className="font-semibold text-white">{firstName}</span></div>
                        <div className="text-sm"><span className="text-gray-400">Surname: </span><span className="font-semibold text-white">{surname}</span></div>
                        <div className="text-sm"><span className="text-gray-400">Rank: </span><span className="font-semibold text-white">{person.rank}</span></div>
                        <div className="text-sm"><span className="text-gray-400">Course: </span><span className="font-semibold text-white">{'course' in person ? person.course : 'N/A'}</span></div>
                        <div className="flex justify-end space-x-2">
                             {isEditing ? (
                                <>
                                    <button onClick={handleSaveClick} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold shadow-md">Save</button>
                                    <button onClick={handleCancelClick} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md">Cancel</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={handleEditClick} className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-sm font-semibold shadow-md">Edit</button>
                                    {/* FIX: onSetupClick is not passed. This button's function needs to be handled in parent.
                                        For now, removing it as it's not implemented. If needed, can be re-added via App.tsx. */}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Currency Table */}
                    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-700/50">
                                <tr>
                                    <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider w-12"></th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-2/5">Currency</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Period</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Last Event</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Expires</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Days Rem.</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Group</th>
                                </tr>
                            </thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                               {visibleCurrencyDefinitions.map(def => {
                                    // FIX: Check for 'validityDays' property and handle union type correctly.
                                    const periodInDays = 'validityDays' in def ? def.validityDays : null;
                                    const statusDateStr = isEditing ? editedStatuses.get(def.name) : getCurrencyStatus(def.name)?.lastEventDate;
                                    const lastEventDate = statusDateStr ? new Date(statusDateStr + 'T00:00:00Z') : null;
                                    const expiryDate = (statusDateStr && periodInDays !== null) ? calculateExpiry(statusDateStr, periodInDays) : null;
                                    const daysRemaining = expiryDate ? calculateDaysRemaining(expiryDate) : null;
                                    const periodText = periodInDays !== null ? (periodInDays === 365 ? "12 Months" : `${periodInDays} Days`) : 'Complex';
                                    const statusColorClass = getStatusIndicatorColor(daysRemaining);
                                    
                                    return (
                                        <tr key={def.name} className="hover:bg-gray-700/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className={`w-3.5 h-3.5 rounded-sm mx-auto ${statusColorClass}`}></div>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-200">{def.name}</td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-400">{periodText}</td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-300 font-mono">
                                                {isEditing ? (
                                                    <input
                                                        type="date"
                                                        value={editedStatuses.get(def.name) || ''}
                                                        onChange={(e) => handleDateChange(def.name, e.target.value)}
                                                        className="bg-gray-700 border border-gray-600 rounded-md text-white py-1 px-2 w-full max-w-[150px] mx-auto focus:ring-sky-500 focus:border-sky-500"
                                                        style={{ colorScheme: 'dark' }}
                                                    />
                                                ) : (
                                                    lastEventDate ? lastEventDate.toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '---'
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-300 font-mono">{expiryDate ? expiryDate.toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '---'}</td>
                                            <td className={`px-4 py-3 text-center text-sm font-bold ${daysRemaining !== null ? getDaysRemainingColor(daysRemaining) : ''}`}>{daysRemaining !== null ? daysRemaining : '---'}</td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-300 font-mono">---</td>
                                        </tr>
                                    );
                               })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CurrencyView;