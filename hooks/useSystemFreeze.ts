import { useState, useEffect } from 'react';

export interface AllowedActions {
    postFlightTimes: boolean;
    pt051Entries: boolean;
    flightAuthorisation: boolean;
    aircraftAvailability: boolean;
}

export interface SystemFreezeState {
    isFrozen: boolean;
    reason: string;
    timestamp: string;
    allowedActions: AllowedActions;
}

const FREEZE_KEY = 'systemFreezeState';
const FREEZE_EVENT = 'systemFreezeChanged';

const defaultAllowedActions: AllowedActions = {
    postFlightTimes: false,
    pt051Entries: false,
    flightAuthorisation: false,
    aircraftAvailability: false,
};

const readFreezeFromStorage = (): { isFrozen: boolean; allowedActions: AllowedActions } => {
    const raw = localStorage.getItem(FREEZE_KEY);
    if (raw) {
        try {
            const freeze = JSON.parse(raw);
            return {
                isFrozen: freeze.isFrozen === true,
                allowedActions: {
                    ...defaultAllowedActions,
                    ...(freeze.allowedActions || {}),
                },
            };
        } catch {
            return { isFrozen: false, allowedActions: { ...defaultAllowedActions } };
        }
    }
    return { isFrozen: false, allowedActions: { ...defaultAllowedActions } };
};

// Dispatch a custom event whenever freeze state changes (same-tab communication)
export const dispatchFreezeChange = () => {
    window.dispatchEvent(new CustomEvent(FREEZE_EVENT));
};

export const useSystemFreeze = () => {
    const [isFrozen, setIsFrozen] = useState(() => readFreezeFromStorage().isFrozen);
    const [allowedActions, setAllowedActions] = useState<AllowedActions>(
        () => readFreezeFromStorage().allowedActions
    );

    useEffect(() => {
        const checkFreeze = () => {
            const { isFrozen: frozen, allowedActions: actions } = readFreezeFromStorage();
            setIsFrozen(frozen);
            setAllowedActions(actions);
        };

        // Listen for same-tab custom events
        window.addEventListener(FREEZE_EVENT, checkFreeze);
        // Listen for cross-tab storage events
        window.addEventListener('storage', checkFreeze);
        // Polling fallback every 500ms to guarantee reactivity
        const poll = setInterval(checkFreeze, 500);

        return () => {
            window.removeEventListener(FREEZE_EVENT, checkFreeze);
            window.removeEventListener('storage', checkFreeze);
            clearInterval(poll);
        };
    }, []);

    const isActionAllowed = (action: keyof AllowedActions): boolean => {
        if (!isFrozen) return true;
        return allowedActions[action] === true;
    };

    return { isFrozen, allowedActions, isActionAllowed };
};// freeze-fix-v2