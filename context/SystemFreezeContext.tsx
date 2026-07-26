import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAppApiBase } from '../utils/externalDataControls';
import { LIVE_CHANGE_EVENT } from '../utils/liveChangeBus';

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
const ORG_ID = 'default';

const parseStoredFreezeState = (raw: string | null): SystemFreezeState => {
    if (!raw) return defaultFreezeState;
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.isFrozen === 'boolean') {
            return {
                ...defaultFreezeState,
                ...parsed,
                allowedActions: {
                    ...defaultFreezeState.allowedActions,
                    ...(parsed.allowedActions || {})
                }
            };
        }
    } catch (e) {
        console.error('Failed to parse freeze state:', e);
    }
    return defaultFreezeState;
};

const saveFreezeState = (nextState: SystemFreezeState) => {
    if (nextState.isFrozen) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
};

const loadSharedFreezeState = async (): Promise<SystemFreezeState | null> => {
    try {
        const response = await fetch(`${getAppApiBase()}/emergency-freeze?orgId=${encodeURIComponent(ORG_ID)}`);
        if (!response.ok) return null;
        const json = await response.json();
        return parseStoredFreezeState(JSON.stringify(json.freezeState || defaultFreezeState));
    } catch (error) {
        console.warn('Failed to load shared emergency freeze state:', error);
        return null;
    }
};

const saveSharedFreezeState = async (nextState: SystemFreezeState): Promise<void> => {
    try {
        await fetch(`${getAppApiBase()}/emergency-freeze`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orgId: ORG_ID,
                freezeState: nextState,
            }),
        });
    } catch (error) {
        console.warn('Failed to save shared emergency freeze state:', error);
    }
};

export const SystemFreezeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [freezeState, setFreezeState] = useState<SystemFreezeState>(() => {
        return parseStoredFreezeState(localStorage.getItem(STORAGE_KEY));
    });

    // Persist state to localStorage
    useEffect(() => {
        saveFreezeState(freezeState);
    }, [freezeState]);

    useEffect(() => {
        const syncFreezeState = () => {
            setFreezeState(parseStoredFreezeState(localStorage.getItem(STORAGE_KEY)));
        };
        const handleStorage = (event: StorageEvent) => {
            if (event.key === STORAGE_KEY) {
                setFreezeState(parseStoredFreezeState(event.newValue));
            }
        };
        window.addEventListener('storage', handleStorage);
        window.addEventListener('systemFreezeChanged', syncFreezeState);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('systemFreezeChanged', syncFreezeState);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const syncSharedFreezeState = async () => {
            const sharedState = await loadSharedFreezeState();
            if (!isMounted || !sharedState) return;
            saveFreezeState(sharedState);
            setFreezeState(sharedState);
        };
        void syncSharedFreezeState();
        window.addEventListener(LIVE_CHANGE_EVENT, syncSharedFreezeState);
        const intervalId = window.setInterval(syncSharedFreezeState, 5000);
        return () => {
            isMounted = false;
            window.removeEventListener(LIVE_CHANGE_EVENT, syncSharedFreezeState);
            window.clearInterval(intervalId);
        };
    }, []);

    const freezeSystem = useCallback((reason: string, allowedActions: AllowedActions, frozenBy?: string) => {
        const nextState: SystemFreezeState = {
            isFrozen: true,
            freezeReason: reason,
            frozenAt: new Date().toISOString(),
            frozenBy: frozenBy || 'Unknown',
            allowedActions
        };
        saveFreezeState(nextState);
        void saveSharedFreezeState(nextState);
        setFreezeState(nextState);
        // Notify all useSystemFreeze hooks in the same tab
        setTimeout(() => window.dispatchEvent(new CustomEvent('systemFreezeChanged')), 50);
    }, []);

    const unfreezeSystem = useCallback(() => {
        saveFreezeState(defaultFreezeState);
        void saveSharedFreezeState(defaultFreezeState);
        setFreezeState(defaultFreezeState);
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
