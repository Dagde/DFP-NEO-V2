import React, { useState, useEffect } from 'react';

interface EmergencyPageProps {
    currentUserRole?: string;
    onShowSuccess?: (message: string) => void;
}

interface SystemFreezeState {
    isFrozen: boolean;
    freezeReason: string;
    frozenAt: string | null;
    frozenBy: string | null;
    allowedActions: {
        postFlightTimes: boolean;
        pt051Entries: boolean;
        flightAuthorisation: boolean;
        aircraftAvailability: boolean;
    };
}

const EmergencyPage: React.FC<EmergencyPageProps> = ({
    currentUserRole,
    onShowSuccess
}) => {
    const [freezeState, setFreezeState] = useState<SystemFreezeState>({
        isFrozen: false,
        freezeReason: '',
        frozenAt: null,
        frozenBy: null,
        allowedActions: {
            postFlightTimes: false,
            pt051Entries: false,
            flightAuthorisation: false,
            aircraftAvailability: false
        }
    });
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Load freeze state from localStorage on mount
    useEffect(() => {
        const savedState = localStorage.getItem('systemFreezeState');
        if (savedState) {
            try {
                setFreezeState(JSON.parse(savedState));
            } catch (e) {
                console.error('Failed to parse freeze state:', e);
            }
        }
    }, []);

    // Save freeze state to localStorage whenever it changes
    const saveFreezeState = (state: SystemFreezeState) => {
        localStorage.setItem('systemFreezeState', JSON.stringify(state));
        setFreezeState(state);
    };

    const handleFreezeConfirm = async () => {
        setIsProcessing(true);
        
        const newState: SystemFreezeState = {
            isFrozen: true,
            freezeReason: 'Aircraft Emergency',
            frozenAt: new Date().toISOString(),
            frozenBy: currentUserRole || 'Unknown',
            allowedActions: { ...freezeState.allowedActions }
        };
        
        saveFreezeState(newState);
        setShowConfirmDialog(false);
        setIsProcessing(false);
        
        if (onShowSuccess) {
            onShowSuccess('System has been frozen due to Aircraft Emergency');
        }
    };

    const handleUnfreeze = async () => {
        setIsProcessing(true);
        
        const newState: SystemFreezeState = {
            isFrozen: false,
            freezeReason: '',
            frozenAt: null,
            frozenBy: null,
            allowedActions: {
                postFlightTimes: false,
                pt051Entries: false,
                flightAuthorisation: false,
                aircraftAvailability: false
            }
        };
        
        saveFreezeState(newState);
        setIsProcessing(false);
        
        if (onShowSuccess) {
            onShowSuccess('System has been unfrozen and is now fully operational');
        }
    };

    const handleAllowedActionChange = (action: keyof SystemFreezeState['allowedActions']) => {
        if (!freezeState.isFrozen) return;
        
        const newState = {
            ...freezeState,
            allowedActions: {
                ...freezeState.allowedActions,
                [action]: !freezeState.allowedActions[action]
            }
        };
        
        saveFreezeState(newState);
    };

    const formatDateTime = (isoString: string | null) => {
        if (!isoString) return 'N/A';
        return new Date(isoString).toLocaleString();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1">Emergency Controls</h1>
                    <p className="text-gray-400 text-sm">System freeze and emergency management</p>
                </div>
                {freezeState.isFrozen && (
                    <div className="flex items-center gap-2 bg-red-900/50 border border-red-500/50 rounded-lg px-4 py-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-red-400 font-semibold">SYSTEM FROZEN</span>
                    </div>
                )}
            </div>

            {/* Status Card */}
            <div className={`rounded-lg border p-6 ${freezeState.isFrozen ? 'bg-red-900/20 border-red-500/50' : 'bg-gray-800 border-gray-700'}`}>
                <h2 className="text-lg font-semibold text-white mb-4">System Status</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-gray-400 text-sm">Current Status:</span>
                        <p className={`text-lg font-semibold ${freezeState.isFrozen ? 'text-red-400' : 'text-green-400'}`}>
                            {freezeState.isFrozen ? 'FROZEN' : 'OPERATIONAL'}
                        </p>
                    </div>
                    {freezeState.isFrozen && (
                        <>
                            <div>
                                <span className="text-gray-400 text-sm">Frozen At:</span>
                                <p className="text-white">{formatDateTime(freezeState.frozenAt)}</p>
                            </div>
                            <div>
                                <span className="text-gray-400 text-sm">Reason:</span>
                                <p className="text-white">{freezeState.freezeReason}</p>
                            </div>
                            <div>
                                <span className="text-gray-400 text-sm">Frozen By:</span>
                                <p className="text-white">{freezeState.frozenBy}</p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Emergency Freeze Button */}
            {!freezeState.isFrozen ? (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Emergency Freeze</h2>
                    <p className="text-gray-400 text-sm mb-6">
                        In the event of an aircraft emergency, press the button below to freeze the system. 
                        This will prevent all scheduling and data modifications until the situation is resolved.
                    </p>
                    
                    {/* 3D Red Button */}
                    <div className="flex justify-center">
                        <button
                            onClick={() => setShowConfirmDialog(true)}
                            className="relative group"
                        >
                            {/* Button shadow/base */}
                            <div className="absolute inset-0 bg-red-900 rounded-full translate-y-1 group-active:translate-y-0 transition-transform"></div>
                            {/* Button body */}
                            <div className="relative w-32 h-32 rounded-full bg-gradient-to-b from-red-500 to-red-700 
                                border-4 border-red-600 shadow-lg 
                                flex items-center justify-center
                                group-hover:from-red-400 group-hover:to-red-600
                                group-active:from-red-600 group-active:to-red-800
                                transition-all duration-150
                                shadow-[0_6px_0_0_rgba(127,29,29,1),0_8px_15px_rgba(0,0,0,0.5)]
                                active:shadow-[0_2px_0_0_rgba(127,29,29,1),0_3px_8px_rgba(0,0,0,0.5)]
                                active:translate-y-1">
                                <div className="text-center">
                                    <svg className="w-10 h-10 mx-auto text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 4l5 2.5v4.5c0 3.52-2.61 6.82-5 7.92-2.39-1.1-5-4.4-5-7.92V8.5L12 6z"/>
                                        <path d="M12 8l-3 1.5v3c0 2.21 1.79 4 3 4.5 1.21-.5 3-2.29 3-4.5v-3L12 8z"/>
                                    </svg>
                                    <span className="text-white font-bold text-sm mt-1 block drop-shadow">FREEZE</span>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            ) : (
                /* Allowed Actions Configuration */
                <div className="bg-gray-800 rounded-lg border border-red-500/50 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Allowed Actions During Freeze</h2>
                    <p className="text-gray-400 text-sm mb-4">
                        Select which operations should remain available during the system freeze:
                    </p>
                    
                    <div className="space-y-3">
                        {/* Freeze Everything Option */}
                        <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50 border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={!freezeState.allowedActions.postFlightTimes && 
                                        !freezeState.allowedActions.pt051Entries && 
                                        !freezeState.allowedActions.flightAuthorisation && 
                                        !freezeState.allowedActions.aircraftAvailability}
                                onChange={() => {
                                    saveFreezeState({
                                        ...freezeState,
                                        allowedActions: {
                                            postFlightTimes: false,
                                            pt051Entries: false,
                                            flightAuthorisation: false,
                                            aircraftAvailability: false
                                        }
                                    });
                                }}
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
                                checked={freezeState.allowedActions.postFlightTimes}
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
                                checked={freezeState.allowedActions.pt051Entries}
                                onChange={() => handleAllowedActionChange('pt051Entries')}
                                className="w-5 h-5 rounded border-gray-500 text-amber-500 focus:ring-amber-500 focus:ring-offset-gray-800"
                            />
                            <div>
                                <span className="text-white font-medium">PT-051 Entries</span>
                                <p className="text-gray-400 text-xs">Allow PT-051 form submissions</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50 border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={freezeState.allowedActions.flightAuthorisation}
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
                                checked={freezeState.allowedActions.aircraftAvailability}
                                onChange={() => handleAllowedActionChange('aircraftAvailability')}
                                className="w-5 h-5 rounded border-gray-500 text-amber-500 focus:ring-amber-500 focus:ring-offset-gray-800"
                            />
                            <div>
                                <span className="text-white font-medium">Aircraft Availability Entries</span>
                                <p className="text-gray-400 text-xs">Allow aircraft availability updates</p>
                            </div>
                        </label>
                    </div>

                    {/* Unfreeze Button */}
                    <div className="mt-6 pt-6 border-t border-gray-600">
                        <button
                            onClick={handleUnfreeze}
                            disabled={isProcessing}
                            className="w-full py-3 px-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 
                                text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {isProcessing ? (
                                <span>Processing...</span>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    <span>Unfreeze System</span>
                                </>
                            )}
                        </button>
                    </div>
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
                        
                        <p className="text-gray-300 mb-6">
                            Are you sure you wish to <span className="text-red-400 font-semibold">freeze the system</span> due to Aircraft Emergency?
                            <br /><br />
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