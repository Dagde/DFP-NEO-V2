import React, { useState } from 'react';
import { UnavailabilityPeriod, UnavailabilityReason } from '../types';
import { validateUnavailabilityPeriod, ValidationResult } from '../utils/unavailabilityValidation';
import ValidationErrorDisplay from './ValidationErrorDisplay';

interface AddUnavailabilityFlyoutProps {
  onClose: () => void;
  onTodayOnly: () => void;
  onSave: (periodData: Omit<UnavailabilityPeriod, 'id'>) => void;
  unavailabilityPeriods: UnavailabilityPeriod[];
  onRemove: (id: string) => void;
}

const AddUnavailabilityFlyout: React.FC<AddUnavailabilityFlyoutProps> = ({ onClose, onTodayOnly, onSave, unavailabilityPeriods, onRemove }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [startTime, setStartTime] = useState(''); // Stored as HHMM
    const [endTime, setEndTime] = useState('');   // Stored as HHMM
    const [reason, setReason] = useState<UnavailabilityReason>('Appointment');
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [showErrors, setShowErrors] = useState(false);

    const unavailabilityReasons: UnavailabilityReason[] = ['TMUF', 'TMUF - Ground Duties only', 'Leave', 'Appointment', 'Other'];

    const clearForm = () => {
        setStartDate('');
        setEndDate('');
        setStartTime('');
        setEndTime('');
        setReason('Appointment');
        setValidation(null);
        setShowErrors(false);
    };

    // Real-time validation on field changes
    const validateField = () => {
        if (startDate || endDate || startTime || endTime) {
            const validationResult = validateUnavailabilityPeriod(
                startDate,
                endDate,
                startTime,
                endTime,
                reason,
                unavailabilityPeriods
            );
            setValidation(validationResult);
        } else {
            setValidation(null);
        }
    };

    // Update validation when any field changes
    React.useEffect(() => {
        if (showErrors) {
            validateField();
        }
    }, [startDate, endDate, startTime, endTime, reason, showErrors]);

    const handleSave = () => {
        console.log('handleSave called', { startDate, endDate, startTime, endTime, reason });
        
        // Perform comprehensive validation
        const validationResult = validateUnavailabilityPeriod(
            startDate,
            endDate,
            startTime,
            endTime,
            reason,
            unavailabilityPeriods
        );
        
        setValidation(validationResult);
        setShowErrors(true);
        
        if (!validationResult.isValid) {
            // Focus on the first error field
            const firstError = validationResult.errors[0];
            if (firstError) {
                // Scroll to error display
                const errorElement = document.getElementById('validation-errors');
                errorElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return;
        }

        // If there are only warnings, we can still proceed but let user know
        if (validationResult.warnings.length > 0) {
            const proceedWithWarnings = window.confirm(
                `This unavailability has ${validationResult.warnings.length} warning(s):\n\n` +
                validationResult.warnings.map(w => `• ${w.message}`).join('\n') +
                '\n\nDo you want to proceed anyway?'
            );
            
            if (!proceedWithWarnings) {
                return;
            }
        }

        // The logic for 'end date' is that it's the first day of return.
        const isAllDay = !startTime && !endTime;
        
        console.log('Calling onSave with period data');
        onSave({
            startDate,
            endDate,
            startTime,
            endTime,
            allDay: isAllDay,
            reason,
        });
        clearForm();
        setValidation(null);
        setShowErrors(false);
    };
    
    const formatDate = (dateString: string): string => {
        if (!dateString) return '';
        const date = new Date(`${dateString}T00:00:00Z`);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    };

    const formatMilitaryTime = (timeString: string | undefined): string => {
        if (!timeString) return '';
        return timeString.replace(':', '');
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Manage Unavailability</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
                    {/* Left Column: Add New */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sky-400 text-lg border-b border-gray-600 pb-2">Add New</h3>
                        <button 
                            onClick={onTodayOnly}
                            className="w-full px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold shadow-md"
                        >
                            Add Today Only (0001-2359)
                        </button>

                        <div className="relative">
                            <hr className="border-gray-600" />
                            <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-gray-800 px-2 text-gray-400 text-sm">OR</span>
                        </div>

                        {/* Custom Period Form */}
                        <div className="space-y-4 p-4 bg-gray-700/30 rounded-lg">
                            <h3 className="font-semibold text-gray-300">Add Custom Period</h3>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="start-date" className="text-sm text-gray-400">Unavailable From</label>
                                    <div className="flex space-x-2 mt-1">
                                        <input
                                            id="start-time"
                                            type="text"
                                            placeholder="HHMM"
                                            maxLength={4}
                                            value={startTime}
                                            onChange={e => {
                                                setStartTime(e.target.value.replace(/\D/g, ''));
                                                if (showErrors) validateField();
                                            }}
                                            className={`block w-24 bg-gray-700 border-gray-600 rounded-md py-2 px-2 text-white font-mono text-center focus:ring-sky-500 focus:border-sky-500 ${
                                                validation?.errors.some(e => e.field === 'startTime') ? 'border-red-500' : ''
                                            }`}
                                        />
                                        <input
                                            id="start-date"
                                            type="date"
                                            value={startDate}
                                            onChange={e => {
                                                setStartDate(e.target.value);
                                                if (showErrors) validateField();
                                            }}
                                            style={{ colorScheme: 'dark' }}
                                            className={`block w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 ${
                                                validation?.errors.some(e => e.field === 'startDate') ? 'border-red-500' : ''
                                            }`}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="end-date" className="text-sm text-gray-400">End Unavailable</label>
                                    <div className="flex space-x-2 mt-1">
                                        <input
                                            id="end-time"
                                            type="text"
                                            placeholder="HHMM"
                                            maxLength={4}
                                            value={endTime}
                                            onChange={e => {
                                                setEndTime(e.target.value.replace(/\D/g, ''));
                                                if (showErrors) validateField();
                                            }}
                                            className={`block w-24 bg-gray-700 border-gray-600 rounded-md py-2 px-2 text-white font-mono text-center focus:ring-sky-500 focus:border-sky-500 ${
                                                validation?.errors.some(e => e.field === 'endTime') ? 'border-red-500' : ''
                                            }`}
                                        />
                                        <input
                                            id="end-date"
                                            type="date"
                                            value={endDate}
                                            onChange={e => {
                                                setEndDate(e.target.value);
                                                if (showErrors) validateField();
                                            }}
                                            style={{ colorScheme: 'dark' }}
                                            className={`block w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 ${
                                                validation?.errors.some(e => e.field === 'endDate') ? 'border-red-500' : ''
                                            }`}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="unavailability-reason" className="block text-sm font-medium text-gray-400">Reason</label>
                                <select 
                                    id="unavailability-reason" 
                                    value={reason} 
                                    onChange={e => {
                                        setReason(e.target.value as UnavailabilityReason);
                                        if (showErrors) validateField();
                                    }} 
                                    className={`mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm ${
                                        validation?.errors.some(e => e.field === 'general') ? 'border-red-500' : ''
                                    }`}
                                >
                                    {unavailabilityReasons.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <button onClick={handleSave} className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-semibold">
                                Add Custom Period
                            </button>
                            
                            {/* Validation Errors Display */}
                            {showErrors && validation && (
                                <div id="validation-errors" className="mt-4">
                                    <ValidationErrorDisplay validation={validation} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Current List */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sky-400 text-lg border-b border-gray-600 pb-2">Current Unavailabilities</h3>
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                            {unavailabilityPeriods.length > 0 ? (
                                [...unavailabilityPeriods].sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).map(p => {
                                    let displayString = '';
                                    const startDisplayDate = formatDate(p.startDate);
                                    
                                    if (p.allDay) {
                                        const lastDayOfUnavailability = new Date(`${p.endDate}T00:00:00Z`);
                                        lastDayOfUnavailability.setUTCDate(lastDayOfUnavailability.getUTCDate() - 1);
                                        const lastDayStr = lastDayOfUnavailability.toISOString().split('T')[0];
                                        const lastDayDisplay = formatDate(lastDayStr);
                                        const dateRange = p.startDate === lastDayStr ? startDisplayDate : `${startDisplayDate} to ${lastDayDisplay}`;
                                        displayString = `${dateRange} @ All Day`;
                                    } else {
                                        const endDisplayDate = formatDate(p.endDate);
                                        const startTimeDisplay = formatMilitaryTime(p.startTime);
                                        const endTimeDisplay = formatMilitaryTime(p.endTime);
                                        if (p.startDate === p.endDate) {
                                            displayString = `${startTimeDisplay} ${startDisplayDate} - ${endTimeDisplay} ${endDisplayDate}`;
                                        } else {
                                            displayString = `${startTimeDisplay} ${startDisplayDate} to ${endTimeDisplay} ${endDisplayDate}`;
                                        }
                                    }

                                    return (
                                        <div key={p.id} className="p-2 bg-gray-700/50 rounded-md text-sm flex justify-between items-center gap-2">
                                            <div className="flex-grow">
                                                <span className="font-semibold text-white">{p.reason}</span>
                                                <div className="text-xs text-gray-300 mt-1 font-mono">
                                                    {displayString}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => onRemove(p.id)} 
                                                className="p-1.5 text-gray-400 hover:text-red-400 rounded-full hover:bg-red-500/20 flex-shrink-0"
                                                aria-label="Remove unavailability"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    );
                                })
                            ) : <p className="text-sm text-gray-500 text-center italic py-4">No unavailability periods recorded.</p>}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">Done</button>
                </div>
            </div>
        </div>
    );
};

export default AddUnavailabilityFlyout;