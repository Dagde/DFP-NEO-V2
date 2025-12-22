import React, { useState, useEffect } from 'react';

interface PinEntryFlyoutProps {
    isOpen: boolean;
    onClose: () => void;
    onCorrectPin: () => void;
    title?: string;
    message?: string;
    correctPin: string;
}

export const PinEntryFlyout: React.FC<PinEntryFlyoutProps> = ({
    isOpen,
    onClose,
    onCorrectPin,
    title,
    message,
    correctPin
}) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError('');
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length !== 4) {
            setError('Please enter a 4-digit PIN');
            return;
        }
        if (pin === correctPin) {
            onCorrectPin();
        } else {
            setError('Incorrect PIN');
            setTimeout(() => {
                setError('');
                setPin('');
            }, 2000);
        }
    };

    const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, ''); // Only allow digits
        setPin(value);
        setError('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75" onClick={onClose}></div>
                
                <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
                    <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                        <h2 className="text-xl font-bold text-white">{title || 'Enter PIN'}</h2>
                    </div>
                    <form onSubmit={handleSubmit} autoComplete="off">
                        <div className="p-6 space-y-4">
                            <label htmlFor="verification-pin" className="block text-sm font-medium text-gray-400">
                                {message || 'Please enter your PIN to continue.'}
                            </label>
                            
                            {/* 4-digit PIN indicator text */}
                            <p className="text-xs text-gray-500 text-center">PINs are 4 digits</p>
                            
                            <input
                                id="verification-pin"
                                type="tel"
                                name="verification"
                                value={pin}
                                onChange={handlePinChange}
                                pattern="[0-9]*"
                                autoComplete="one-time-code"
                                maxLength={4}
                                autoFocus
                                className="block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                style={{ fontFamily: 'monospace' }}
                            />
                            
                            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        </div>
                        <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold">Submit</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PinEntryFlyout;