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

// Dispatch a custom event whenever freeze state changes (same-tab communication)
export const dispatchFreezeChange = () => {
    window.dispatchEvent(new CustomEvent(FREEZE_EVENT));
};

export const useSystemFreeze = () => {
    const [isFrozen, setIsFrozen] = useState(() => {
        const raw = localStorage.getItem(FREEZE_KEY);
        if (raw) {
            try { return JSON.parse(raw).isFrozen === true; } catch { return false; }
        }
        return false;
    });

    useEffect(() => {
        const checkFreeze = () => {
            const raw = localStorage.getItem(FREEZE_KEY);
            if (raw) {
                try {
                    const freeze: SystemFreezeState = JSON.parse(raw);
                    setIsFrozen(freeze.isFrozen === true);
                } catch {
                    setIsFrozen(false);
                }
            } else {
                setIsFrozen(false);
            }
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
        const raw = localStorage.getItem(FREEZE_KEY);
        if (raw) {
            try {
                const freeze: SystemFreezeState = JSON.parse(raw);
                return !freeze.isFrozen || freeze.allowedActions[action];
            } catch { return true; }
        }
        return true;
    };

    return { isFrozen, isActionAllowed };
};// freeze-fix-v2
