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

export const useSystemFreeze = () => {
    const [isFrozen, setIsFrozen] = useState(false);
    
    useEffect(() => {
        const checkFreeze = () => {
            const freezeRaw = localStorage.getItem('systemFreezeState');
            if (freezeRaw) {
                const freeze: SystemFreezeState = JSON.parse(freezeRaw);
                setIsFrozen(freeze.isFrozen);
            } else {
                setIsFrozen(false);
            }
        };
        
        checkFreeze();
        
        // Listen for storage changes
        const handleStorageChange = () => {
            checkFreeze();
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);
    
    const isActionAllowed = (action: keyof AllowedActions): boolean => {
        const freezeRaw = localStorage.getItem('systemFreezeState');
        if (freezeRaw) {
            const freeze: SystemFreezeState = JSON.parse(freezeRaw);
            return !freeze.isFrozen || freeze.allowedActions[action];
        }
        return true;
    };
    
    return { isFrozen, isActionAllowed };
};