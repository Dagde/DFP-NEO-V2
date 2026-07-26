import React from 'react';
import { useSystemFreeze } from '../context/SystemFreezeContext';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';
import { showDarkAlert, showDarkPrompt } from './DarkMessageModal';

interface SystemFreezeBannerProps {
    canUnfreeze?: boolean;
}

const SystemFreezeBanner: React.FC<SystemFreezeBannerProps> = ({ canUnfreeze = false }) => {
    const { freezeState, unfreezeSystem } = useSystemFreeze();

    if (!freezeState.isFrozen) return null;

    const formatDateTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleUnfreeze = async () => {
        const password = await showDarkPrompt({
            title: 'Emergency Freeze Password Required',
            message: 'Enter your password to deactivate the emergency freeze.',
            inputLabel: 'Password',
            inputType: 'password',
            inputPlaceholder: 'Enter password',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            variant: 'warning',
        });
        if (!password) return;
        try {
            const isValid = await verifyCurrentUserPassword(password);
            if (!isValid) {
                await showDarkAlert('The password was not accepted.', 'Emergency Freeze Password Required', 'warning');
                return;
            }
            unfreezeSystem();
        } catch (error) {
            await showDarkAlert('The app could not verify your password.', 'Password Check Failed', 'error');
        }
    };

    return (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-4 animate-pulse">
            <div className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <span className="font-bold">SYSTEM FROZEN</span>
                <span className="text-red-200">- {freezeState.freezeReason}</span>
                {freezeState.frozenAt && (
                    <span className="text-red-200 text-sm">since {formatDateTime(freezeState.frozenAt)}</span>
                )}
            </div>
            {canUnfreeze ? (
                <button
                    onClick={handleUnfreeze}
                    className="ml-4 px-3 py-1 bg-white text-red-600 rounded text-sm font-semibold hover:bg-red-100 transition-colors"
                >
                    Unfreeze
                </button>
            ) : null}
        </div>
    );
};

export default SystemFreezeBanner;
