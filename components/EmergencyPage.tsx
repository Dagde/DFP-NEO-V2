import React, { useState } from 'react';
import { useSystemFreeze, AllowedActions } from '../context/SystemFreezeContext';
import {
    hasEmergencyFreezeAuthority,
    normaliseEmergencyFreezeAuthoritySettings,
    type EmergencyFreezeAuthoritySettings,
} from '../utils/emergencyFreezeAuthority';
import type { StaffQualificationDefinition } from '../utils/staffQualifications';

interface EmergencyPageProps {
    currentUserRole?: string;
    onShowSuccess?: (message: string) => void;
    trainingReportDisplayName?: string;
    emergencyFreezeAuthority?: EmergencyFreezeAuthoritySettings;
    onUpdateEmergencyFreezeAuthority?: (settings: EmergencyFreezeAuthoritySettings) => void;
    qualificationOptions?: StaffQualificationDefinition[];
    currentUserQualificationIds?: string[];
    canEditEmergencyAuthority?: boolean;
}

const defaultAllowedActions: AllowedActions = {
    postFlightTimes: false,
    pt051Entries: false,
    flightAuthorisation: false,
    aircraftAvailability: false
};

const EmergencyPage: React.FC<EmergencyPageProps> = ({
    currentUserRole,
    onShowSuccess,
    trainingReportDisplayName,
    emergencyFreezeAuthority,
    onUpdateEmergencyFreezeAuthority,
    qualificationOptions = [],
    currentUserQualificationIds = [],
    canEditEmergencyAuthority = false
}) => {
    const { freezeState, freezeSystem, unfreezeSystem } = useSystemFreeze();
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [pendingAllowedActions, setPendingAllowedActions] = useState<AllowedActions>(defaultAllowedActions);
    const reportDisplayName = String(trainingReportDisplayName || '').trim() || 'Training Report';
    const authoritySettings = normaliseEmergencyFreezeAuthoritySettings(emergencyFreezeAuthority);
    const canActivateFreeze = hasEmergencyFreezeAuthority({
        action: 'activate',
        settings: authoritySettings,
        userQualificationIds: currentUserQualificationIds,
        userPermission: currentUserRole,
    });
    const canDeactivateFreeze = hasEmergencyFreezeAuthority({
        action: 'deactivate',
        settings: authoritySettings,
        userQualificationIds: currentUserQualificationIds,
        userPermission: currentUserRole,
    });

    const handleAuthorityChange = (
        action: keyof EmergencyFreezeAuthoritySettings,
        qualificationId: string,
        checked: boolean,
    ) => {
        if (!onUpdateEmergencyFreezeAuthority) return;
        const current = authoritySettings[action] || [];
        const next = checked
            ? Array.from(new Set([...current, qualificationId]))
            : current.filter(id => id !== qualificationId);
        onUpdateEmergencyFreezeAuthority(normaliseEmergencyFreezeAuthoritySettings({
            ...authoritySettings,
            [action]: next,
        }));
    };

    const handleAllowedActionChange = (action: keyof AllowedActions) => {
        setPendingAllowedActions(prev => ({
            ...prev,
            [action]: !prev[action]
        }));
    };

    const handleFreezeEverything = () => {
        setPendingAllowedActions(defaultAllowedActions);
    };

    const isEverythingFrozen = () => {
        return !pendingAllowedActions.postFlightTimes &&
               !pendingAllowedActions.pt051Entries &&
               !pendingAllowedActions.flightAuthorisation &&
               !pendingAllowedActions.aircraftAvailability;
    };

    const handleFreezeClick = () => {
        if (!canActivateFreeze) {
            alert('You are not authorised to activate an emergency freeze.');
            return;
        }
        setShowConfirmDialog(true);
    };

    const handleFreezeConfirm = async () => {
        setIsProcessing(true);
        
        freezeSystem('Aircraft Emergency', pendingAllowedActions, currentUserRole);
        setShowConfirmDialog(false);
        setIsProcessing(false);
        
        if (onShowSuccess) {
            onShowSuccess('System has been frozen due to Aircraft Emergency');
        }
    };

    const handleUnfreeze = async () => {
        if (!canDeactivateFreeze) {
            alert('You are not authorised to deactivate an emergency freeze.');
            return;
        }
        setIsProcessing(true);
        unfreezeSystem();
        setIsProcessing(false);
        
        if (onShowSuccess) {
            onShowSuccess('System has been unfrozen and is now fully operational');
        }
    };

    const formatDateTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-900/30">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Emergency Controls</h1>
                    <p className="text-gray-400">System freeze and emergency management</p>
                </div>
            </div>

            {/* System Status Card */}
            <div className={`rounded-xl border p-6 ${freezeState.isFrozen 
                ? 'bg-gradient-to-br from-red-900/30 to-red-950/30 border-red-500/50' 
                : 'bg-gradient-to-br from-green-900/20 to-green-950/20 border-green-500/30'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${freezeState.isFrozen ? 'bg-red-600 animate-pulse' : 'bg-green-600'}`}>
                            {freezeState.isFrozen ? (
                                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                                </svg>
                            ) : (
                                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                            )}
                        </div>
                        <div>
                            <h2 className={`text-xl font-bold ${freezeState.isFrozen ? 'text-red-400' : 'text-green-400'}`}>
                                {freezeState.isFrozen ? 'SYSTEM FROZEN' : 'SYSTEM OPERATIONAL'}
                            </h2>
                            {freezeState.isFrozen && (
                                <p className="text-gray-400 text-sm mt-1">
                                    Reason: {freezeState.freezeReason} • Since: {freezeState.frozenAt && formatDateTime(freezeState.frozenAt)}
                                </p>
                            )}
                        </div>
                    </div>
                    
                    {!freezeState.isFrozen && (
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                    )}
                    {freezeState.isFrozen && (
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                    )}
                </div>
            </div>

            {/* If NOT frozen - show freeze options */}
            {!freezeState.isFrozen && (
                <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                        </svg>
                        Freeze System
                    </h3>
                    
                    <p className="text-gray-400 text-sm mb-4">
                        Select which operations should remain available during the system freeze. These options must be selected BEFORE initiating the freeze.
                    </p>

                    {/* 3D Freeze Button */}
                    <div className="flex justify-center mb-6">
                        <button
                            onClick={handleFreezeClick}
                            disabled={!canActivateFreeze}
                            className="relative group"
                        >
                            {/* 3D effect layers */}
                            <div className="absolute inset-0 bg-red-800 rounded-xl transform translate-y-1 group-active:translate-y-0 transition-transform"></div>
                            <div className="absolute inset-0 bg-red-700 rounded-xl transform translate-y-0.5 group-active:translate-y-0 transition-transform"></div>
                            <div className={`relative px-8 py-4 rounded-xl text-white font-bold text-lg shadow-lg shadow-red-900/50 flex items-center gap-3 group-active:transform group-active:translate-y-1 transition-transform ${canActivateFreeze ? 'bg-gradient-to-b from-red-500 to-red-600' : 'bg-gray-600 cursor-not-allowed opacity-70'}`}>
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                                </svg>
                                FREEZE SYSTEM
                            </div>
                        </button>
                    </div>
                    <div className="mb-6 rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold text-white">Emergency Freeze Authority</h3>
                                <p className="text-xs text-gray-400">Qualifications authorised to activate and deactivate freeze.</p>
                            </div>
                            {!canEditEmergencyAuthority && (
                                <span className="rounded border border-yellow-600/50 bg-yellow-900/30 px-2 py-1 text-xs font-semibold text-yellow-200">Read-only</span>
                            )}
                        </div>
                        {qualificationOptions.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">Can Activate</h4>
                                    <div className="space-y-2">
                                        {qualificationOptions.map(qualification => (
                                            <label key={`activate-${qualification.id}`} className="flex items-center gap-2 text-sm text-gray-200">
                                                <input
                                                    type="checkbox"
                                                    checked={authoritySettings.activateQualificationIds.includes(qualification.id)}
                                                    disabled={!canEditEmergencyAuthority}
                                                    onChange={event => handleAuthorityChange('activateQualificationIds', qualification.id, event.target.checked)}
                                                    className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-sky-500 focus:ring-sky-500"
                                                />
                                                <span>{qualification.code || qualification.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">Can Deactivate</h4>
                                    <div className="space-y-2">
                                        {qualificationOptions.map(qualification => (
                                            <label key={`deactivate-${qualification.id}`} className="flex items-center gap-2 text-sm text-gray-200">
                                                <input
                                                    type="checkbox"
                                                    checked={authoritySettings.deactivateQualificationIds.includes(qualification.id)}
                                                    disabled={!canEditEmergencyAuthority}
                                                    onChange={event => handleAuthorityChange('deactivateQualificationIds', qualification.id, event.target.checked)}
                                                    className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-sky-500 focus:ring-sky-500"
                                                />
                                                <span>{qualification.code || qualification.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">No active qualifications are configured for this unit model.</p>
                        )}
                    </div>

                    {/* Allowed Actions Selection */}
                    <div className="border-t border-gray-700 pt-4 mt-4">
                        <h4 className="text-sm font-medium text-gray-300 mb-3">
                            Select operations to allow during freeze:
                        </h4>
                        
                        <div className="space-y-3">
                            {/* Freeze Everything Option */}
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50 border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={isEverythingFrozen()}
                                    onChange={handleFreezeEverything}
                                    className="w-5 h-5 rounded border-gray-500 text-red-500 focus:ring-red-500 focus:ring-offset-gray-800"
                                />
                                <div>
                                    <span className="text-white font-medium">Freeze Everything</span>
                                    <p className="text-gray-400 text-xs">No operations allowed during freeze</p>
                                </div>
                            </label>

                            {/* Individual Options */}
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50 border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={pendingAllowedActions.postFlightTimes}
                                    onChange={() => handleAllowedActionChange('postFlightTimes')}
                                    className="w-5 h-5 rounded border-gray-500 text-amber-500 focus:ring-amber-500 focus:ring-offset-gray-800"
                                />
                                <div>
                                    <span className="text-white font-medium">Post Flight Times Entries</span>
                                    <p className="text-gray-400 text-xs">Allow recording of post-flight time entries</p>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50 border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={pendingAllowedActions.pt051Entries}
                                    onChange={() => handleAllowedActionChange('pt051Entries')}
                                    className="w-5 h-5 rounded border-gray-500 text-amber-500 focus:ring-amber-500 focus:ring-offset-gray-800"
                                />
                                <div>
                                    <span className="text-white font-medium">{reportDisplayName} Entries</span>
                                    <p className="text-gray-400 text-xs">Allow {reportDisplayName} submissions</p>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50 border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={pendingAllowedActions.flightAuthorisation}
                                    onChange={() => handleAllowedActionChange('flightAuthorisation')}
                                    className="w-5 h-5 rounded border-gray-500 text-amber-500 focus:ring-amber-500 focus:ring-offset-gray-800"
                                />
                                <div>
                                    <span className="text-white font-medium">Flight Authorisation Entries</span>
                                    <p className="text-gray-400 text-xs">Allow flight authorisation processing</p>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50 border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={pendingAllowedActions.aircraftAvailability}
                                    onChange={() => handleAllowedActionChange('aircraftAvailability')}
                                    className="w-5 h-5 rounded border-gray-500 text-amber-500 focus:ring-amber-500 focus:ring-offset-gray-800"
                                />
                                <div>
                                    <span className="text-white font-medium">Aircraft Availability Entries</span>
                                    <p className="text-gray-400 text-xs">Allow aircraft availability updates</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* If frozen - show current allowed actions and unfreeze option */}
            {freezeState.isFrozen && (
                <div className="bg-gray-800/50 rounded-xl border border-red-500/30 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Allowed Operations During Freeze
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className={`p-3 rounded-lg ${freezeState.allowedActions.postFlightTimes ? 'bg-green-900/30 border border-green-500/30' : 'bg-gray-700/30 border border-gray-600'}`}>
                            <span className={freezeState.allowedActions.postFlightTimes ? 'text-green-400' : 'text-gray-500'}>Post Flight Times</span>
                        </div>
                        <div className={`p-3 rounded-lg ${freezeState.allowedActions.pt051Entries ? 'bg-green-900/30 border border-green-500/30' : 'bg-gray-700/30 border border-gray-600'}`}>
                            <span className={freezeState.allowedActions.pt051Entries ? 'text-green-400' : 'text-gray-500'}>{reportDisplayName} Entries</span>
                        </div>
                        <div className={`p-3 rounded-lg ${freezeState.allowedActions.flightAuthorisation ? 'bg-green-900/30 border border-green-500/30' : 'bg-gray-700/30 border border-gray-600'}`}>
                            <span className={freezeState.allowedActions.flightAuthorisation ? 'text-green-400' : 'text-gray-500'}>Flight Authorisation</span>
                        </div>
                        <div className={`p-3 rounded-lg ${freezeState.allowedActions.aircraftAvailability ? 'bg-green-900/30 border border-green-500/30' : 'bg-gray-700/30 border border-gray-600'}`}>
                            <span className={freezeState.allowedActions.aircraftAvailability ? 'text-green-400' : 'text-gray-500'}>Aircraft Availability</span>
                        </div>
                    </div>

                    {/* Unfreeze Button */}
                    <button
                        onClick={handleUnfreeze}
                        disabled={isProcessing || !canDeactivateFreeze}
                        className="w-full py-3 px-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <span>Processing...</span>
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
                                </svg>
                                <span>Unfreeze System</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg border border-red-500 p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-900/50 flex items-center justify-center">
                                <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white">Confirm System Freeze</h3>
                        </div>
                        
                        <p className="text-gray-300 mb-4">
                            Are you sure you wish to <span className="text-red-400 font-semibold">freeze the system</span> due to Aircraft Emergency?
                        </p>

                        {/* Summary of what will be allowed */}
                        <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
                            <p className="text-sm text-gray-400 mb-2">Operations allowed during freeze:</p>
                            <div className="flex flex-wrap gap-2">
                                {isEverythingFrozen() ? (
                                    <span className="text-red-400 text-sm font-medium">None (Full Freeze)</span>
                                ) : (
                                    <>
                                        {pendingAllowedActions.postFlightTimes && <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">Post Flight Times</span>}
                                        {pendingAllowedActions.pt051Entries && <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">{reportDisplayName}</span>}
                                        {pendingAllowedActions.flightAuthorisation && <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">Flight Auth</span>}
                                        {pendingAllowedActions.aircraftAvailability && <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">Aircraft Availability</span>}
                                    </>
                                )}
                            </div>
                        </div>
                        
                        <p className="text-gray-400 text-sm mb-6">
                            This will prevent all scheduling and data modifications until manually unfrozen.
                        </p>
                        
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmDialog(false)}
                                className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleFreezeConfirm}
                                disabled={isProcessing}
                                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                            >
                                {isProcessing ? 'Processing...' : 'Yes, Freeze System'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmergencyPage;
