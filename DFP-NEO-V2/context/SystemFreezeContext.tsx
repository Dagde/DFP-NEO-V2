import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface AllowedActions {
    postFlightTimes: boolean;
    pt051Entries: boolean;
    flightAuthorisation: boolean;
    aircraftAvailability: boolean;
}

export interface SystemFreezeState {
    isFrozen: boolean;
    freezeReason: string;
    frozenAt: string | null;
    frozenBy: string | null;
    allowedActions: AllowedActions;
}

interface SystemFreezeContextValue {
    freezeState: SystemFreezeState;
    freezeSystem: (reason: string, allowedActions: AllowedActions, frozenBy?: string) => void;
    unfreezeSystem: () => void;
    isActionAllowed: (action: keyof AllowedActions) => boolean;
    checkAndWarn: (action: keyof AllowedActions, actionName?: string) => boolean;
}

const defaultFreezeState: SystemFreezeState = {
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

const SystemFreezeContext = createContext<SystemFreezeContextValue>({
    freezeState: defaultFreezeState,
    freezeSystem: () => {},
    unfreezeSystem: () => {},
    isActionAllowed: () => true,
    checkAndWarn: () => true
});

const STORAGE_KEY = 'systemFreezeState';

export const SystemFreezeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [freezeState, setFreezeState] = useState<SystemFreezeState>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Validate the structure
                if (typeof parsed.isFrozen === 'boolean') {
                    return {
                        ...defaultFreezeState,
                        ...parsed,
                        allowedActions: {
                            ...defaultFreezeState.allowedActions,
                            ...(parsed.allowedActions || {})
                        }
                    };
                }
            }
        } catch (e) {
            console.error('Failed to parse freeze state:', e);
        }
        return defaultFreezeState;
    });

    // Persist state to localStorage
    useEffect(() => {
        if (freezeState.isFrozen) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(freezeState));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [freezeState]);

    const freezeSystem = useCallback((reason: string, allowedActions: AllowedActions, frozenBy?: string) => {
        setFreezeState({
            isFrozen: true,
            freezeReason: reason,
            frozenAt: new Date().toISOString(),
            frozenBy: frozenBy || 'Unknown',
            allowedActions
        });
        // Notify all useSystemFreeze hooks in the same tab
        setTimeout(() => window.dispatchEvent(new CustomEvent('systemFreezeChanged')), 50);
    }, []);

    const unfreezeSystem = useCallback(() => {
        setFreezeState(defaultFreezeState);
        localStorage.removeItem(STORAGE_KEY);
        // Notify all useSystemFreeze hooks in the same tab
        setTimeout(() => window.dispatchEvent(new CustomEvent('systemFreezeChanged')), 50);
    }, []);

    const isActionAllowed = useCallback((action: keyof AllowedActions): boolean => {
        if (!freezeState.isFrozen) return true;
        return freezeState.allowedActions[action] === true;
    }, [freezeState]);

    const checkAndWarn = useCallback((action: keyof AllowedActions, actionName?: string): boolean => {
        if (!freezeState.isFrozen) return true;
        
        if (freezeState.allowedActions[action]) return true;
        
        // Show warning
        const name = actionName || action;
        alert(`System is currently frozen. "${name}" action is not permitted during the freeze.`);
        return false;
    }, [freezeState]);

    return (
        <SystemFreezeContext.Provider value={{
            freezeState,
            freezeSystem,
            unfreezeSystem,
            isActionAllowed,
            checkAndWarn
        }}>
            {children}
        </SystemFreezeContext.Provider>
    );
};

export const useSystemFreeze = () => useContext(SystemFreezeContext);
export default SystemFreezeContext;