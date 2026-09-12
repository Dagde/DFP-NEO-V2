import React, { useEffect, useState } from 'react';
import { useSystemFreeze, AllowedActions } from '../context/SystemFreezeContext';
import {
    hasEmergencyFreezeAuthority,
    normaliseEmergencyFreezeAuthoritySettings,
    type EmergencyFreezeAuthoritySettings,
} from '../utils/emergencyFreezeAuthority';
import type { StaffQualificationDefinition } from '../utils/staffQualifications';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';
import { showDarkAlert, showDarkPrompt } from './DarkMessageModal';

interface EmergencyPageProps {
    currentUserRole?: string;
    onShowSuccess?: (message: string) => void;
    trainingReportDisplayName?: string;
    emergencyFreezeAuthority?: EmergencyFreezeAuthoritySettings;
    onUpdateEmergencyFreezeAuthority?: (settings: EmergencyFreezeAuthoritySettings) => void;
    qualificationOptions?: StaffQualificationDefinition[];
    currentUserQualificationIds?: string[];
    canEditEmergencyAuthority?: boolean;
    flightAuthorisationRequired?: boolean;
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
    canEditEmergencyAuthority = false,
    flightAuthorisationRequired = true,
}) => {
    const { freezeState, freezeSystem, unfreezeSystem } = useSystemFreeze();
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isEditingAuthority, setIsEditingAuthority] = useState(false);
    const [authorityDraft, setAuthorityDraft] = useState<EmergencyFreezeAuthoritySettings>(() => (
        normaliseEmergencyFreezeAuthoritySettings(emergencyFreezeAuthority)
    ));
    const [pendingAllowedActions, setPendingAllowedActions] = useState<AllowedActions>(defaultAllowedActions);
    const reportDisplayName = String(trainingReportDisplayName || '').trim() || 'Training Report';
    const authoritySettings = normaliseEmergencyFreezeAuthoritySettings(emergencyFreezeAuthority);
    const effectivePendingAllowedActions: AllowedActions = flightAuthorisationRequired
        ? pendingAllowedActions
        : { ...pendingAllowedActions, flightAuthorisation: false };
    const frozenFlightAuthorisationAllowed = flightAuthorisationRequired && freezeState.allowedActions.flightAuthorisation;

    useEffect(() => {
        if (!flightAuthorisationRequired) {
            setPendingAllowedActions(prev => prev.flightAuthorisation ? { ...prev, flightAuthorisation: false } : prev);
        }
    }, [flightAuthorisationRequired]);
    const displayedAuthoritySettings = isEditingAuthority ? authorityDraft : authoritySettings;
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

    useEffect(() => {
        if (!isEditingAuthority) {
            setAuthorityDraft(authoritySettings);
        }
    }, [authoritySettings, isEditingAuthority]);

    const requestPassword = async (message: string, title: string): Promise<boolean> => {
        const password = await showDarkPrompt({
            title,
            message,
            inputLabel: 'Password',
            inputType: 'password',
            inputPlaceholder: 'Enter password',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            variant: 'warning',
        });
        if (!password) return false;
        try {
            const isValid = await verifyCurrentUserPassword(password);
            if (!isValid) {
                await showDarkAlert('The password was not accepted.', title, 'warning');
                return false;
            }
            return true;
        } catch (error) {
            await showDarkAlert('The app could not verify your password.', 'Password Check Failed', 'error');
            return false;
        }
    };

    const handleAuthorityChange = (
        qualificationId: string,
        checked: boolean,
    ) => {
        const current = authorityDraft.activateQualificationIds || [];
        const next = checked
            ? Array.from(new Set([...current, qualificationId]))
            : current.filter(id => id !== qualificationId);
        setAuthorityDraft(normaliseEmergencyFreezeAuthoritySettings({
            ...authorityDraft,
            activateQualificationIds: next,
            deactivateQualificationIds: next,
        }));
    };

    const handleEditAuthority = async () => {
        if (!canEditEmergencyAuthority) return;
        const unlocked = await requestPassword(
            'Enter your password to edit emergency freeze authority.',
            'Emergency Authority Password Required',
        );
        if (!unlocked) return;
        setAuthorityDraft(authoritySettings);
        setIsEditingAuthority(true);
    };

    const handleCancelAuthority = () => {
        setAuthorityDraft(authoritySettings);
        setIsEditingAuthority(false);
    };

    const handleSaveAuthority = async () => {
        if (!canEditEmergencyAuthority || !onUpdateEmergencyFreezeAuthority) return;
        onUpdateEmergencyFreezeAuthority(normaliseEmergencyFreezeAuthoritySettings({
            activateQualificationIds: authorityDraft.activateQualificationIds,
            deactivateQualificationIds: authorityDraft.activateQualificationIds,
        }));
        setIsEditingAuthority(false);
        if (onShowSuccess) {
            onShowSuccess('Emergency freeze authority saved');
        }
    };

    const handleAllowedActionChange = (action: keyof AllowedActions) => {
        if (action === 'flightAuthorisation' && !flightAuthorisationRequired) return;
        setPendingAllowedActions(prev => ({
            ...prev,
            [action]: !prev[action]
        }));
    };

    const handleFreezeEverything = () => {
        setPendingAllowedActions(defaultAllowedActions);
    };

    const isEverythingFrozen = () => {
        return !effectivePendingAllowedActions.postFlightTimes &&
               !effectivePendingAllowedActions.pt051Entries &&
               !effectivePendingAllowedActions.flightAuthorisation &&
               !effectivePendingAllowedActions.aircraftAvailability;
    };

    const handleFreezeClick = () => {
        if (!canActivateFreeze) {
            showDarkAlert('You are not authorised to activate an emergency freeze.', 'Emergency Freeze Locked', 'warning');
            return;
        }
        setShowConfirmDialog(true);
    };

    const handleFreezeConfirm = async () => {
        const unlocked = await requestPassword(
            'Enter your password to activate the emergency freeze.',
            'Emergency Freeze Password Required',
        );
        if (!unlocked) return;
        setIsProcessing(true);
        
        freezeSystem('Aircraft Emergency', effectivePendingAllowedActions, currentUserRole);
        setShowConfirmDialog(false);
        setIsProcessing(false);
        
        if (onShowSuccess) {
            onShowSuccess('System has been frozen due to Aircraft Emergency');
        }
    };

    const handleUnfreeze = async () => {
        if (!canDeactivateFreeze) {
            showDarkAlert('You are not authorised to deactivate an emergency freeze.', 'Emergency Freeze Locked', 'warning');
            return;
        }
        const unlocked = await requestPassword(
            'Enter your password to deactivate the emergency freeze.',
            'Emergency Freeze Password Required',
        );
        if (!unlocked) return;
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

    const getQualificationLabel = (qualificationId: string): string => {
        const match = qualificationOptions.find(qualification => qualification.id === qualificationId);
        return match?.code || match?.name || qualificationId;
    };

    const renderSelectedQualifications = (qualificationIds: string[]) => (
        qualificationIds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
                {qualificationIds.map(id => (
                    <span key={id} className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-200">
                        {getQualificationLabel(id)}
                    </span>
                ))}
            </div>
        ) : (
            <span className="text-sm text-gray-500">No qualifications selected.</span>
        )
    );

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

            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Emergency Freeze Authority</h3>
                        <p className="text-sm text-gray-400">Qualifications authorised to activate and deactivate freeze.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditingAuthority ? (
                            <>
                                <button
                                    onClick={handleCancelAuthority}
                                    className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveAuthority}
                                    className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"
                                >
                                    Save
                                </button>
                            </>
                        ) : canEditEmergencyAuthority ? (
                            <button
                                onClick={handleEditAuthority}
                                className="rounded-md bg-gray-700 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-600"
                            >
                                Edit
                            </button>
                        ) : (
                            <span className="rounded border border-yellow-600/50 bg-yellow-900/30 px-2 py-1 text-xs font-semibold text-yellow-200">Read-only</span>
                        )}
                    </div>
                </div>
                {qualificationOptions.length > 0 ? (
                    isEditingAuthority ? (
                        <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">Can Activate and Deactivate</h4>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                {qualificationOptions.map(qualification => (
                                    <label key={`emergency-authority-${qualification.id}`} className="flex items-center gap-2 text-sm text-gray-200">
                                        <input
                                            type="checkbox"
                                            checked={displayedAuthoritySettings.activateQualificationIds.includes(qualification.id)}
                                            onChange={event => handleAuthorityChange(qualification.id, event.target.checked)}
                                            className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-sky-500 focus:ring-sky-500"
                                        />
                                        <span>{qualification.code || qualification.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">Can Activate and Deactivate</h4>
                            {renderSelectedQualifications(authoritySettings.activateQualificationIds)}
                        </div>
                    )
                ) : (
                    <p className="text-sm text-gray-500">No active qualifications are configured for this unit model.</p>
                )}
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

                            <label className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                flightAuthorisationRequired
                                    ? 'bg-gray-700/50 border-gray-600 cursor-pointer hover:bg-gray-700'
                                    : 'bg-gray-800/70 border-gray-700 cursor-not-allowed opacity-70'
                            }`}>
                                <input
                                    type="checkbox"
                                    checked={flightAuthorisationRequired && pendingAllowedActions.flightAuthorisation}
                                    onChange={() => handleAllowedActionChange('flightAuthorisation')}
                                    disabled={!flightAuthorisationRequired}
                                    className="w-5 h-5 rounded border-gray-500 text-amber-500 focus:ring-amber-500 focus:ring-offset-gray-800"
                                />
                                <div>
                                    <span className={flightAuthorisationRequired ? 'text-white font-medium' : 'text-gray-400 font-medium'}>Flight Authorisation Entries</span>
                                    <p className="text-gray-400 text-xs">
                                        {flightAuthorisationRequired
                                            ? 'Allow flight authorisation processing'
                                            : 'Flight authorisation is optional for this unit, so this emergency exception is disabled.'}
                                    </p>
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
                        <div className={`p-3 rounded-lg ${frozenFlightAuthorisationAllowed ? 'bg-green-900/30 border border-green-500/30' : 'bg-gray-700/30 border border-gray-600'}`}>
                            <span className={frozenFlightAuthorisationAllowed ? 'text-green-400' : 'text-gray-500'}>Flight Authorisation</span>
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
                                        {effectivePendingAllowedActions.postFlightTimes && <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">Post Flight Times</span>}
                                        {effectivePendingAllowedActions.pt051Entries && <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">{reportDisplayName}</span>}
                                        {effectivePendingAllowedActions.flightAuthorisation && <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">Flight Auth</span>}
                                        {effectivePendingAllowedActions.aircraftAvailability && <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">Aircraft Availability</span>}
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
