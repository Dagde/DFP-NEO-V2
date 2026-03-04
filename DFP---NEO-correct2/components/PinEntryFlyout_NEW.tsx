import React, { useState, useEffect, useRef } from 'react';

interface PinEntryFlyoutProps {
    isOpen: boolean;
    onClose: () => void;
    onCorrectPin: () => void;
    title?: string;
    message?: string;
    correctPin: string;
}

export const PinEntryFlyout_NEW: React.FC<PinEntryFlyoutProps> = ({
    isOpen,
    onClose,
    onCorrectPin,
    title,
    message,
    correctPin
}) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [pinDigits, setPinDigits] = useState(['', '', '', '']);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError('');
            setPinDigits(['', '', '', '']);
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
                setPinDigits(['', '', '', '']);
            }, 2000);
        }
    };

    const openPinModal = () => {
        setShowModal(true);
    };

    const closePinModal = () => {
        setShowModal(false);
    };

    const handleDigitChange = (index: number, value: string) => {
        if (/^\d$/.test(value) || value === '') {
            const newDigits = [...pinDigits];
            newDigits[index] = value;
            setPinDigits(newDigits);
            
            const fullPin = newDigits.join('');
            setPin(fullPin);
            
            if (value && index < 3) {
                // Focus next input
                setTimeout(() => {
                    const nextInput = document.getElementById(`pin-digit-${index + 1}`) as HTMLInputElement;
                    if (nextInput) nextInput.focus();
                }, 50);
            }
            
            if (fullPin.length === 4) {
                // Auto-submit when all digits are entered
                setTimeout(() => {
                    if (fullPin === correctPin) {
                        onCorrectPin();
                        closePinModal();
                    } else {
                        setError('Incorrect PIN');
                        setTimeout(() => {
                            setError('');
                            setPin('');
                            setPinDigits(['', '', '', '']);
                            const firstInput = document.getElementById('pin-digit-0') as HTMLInputElement;
                            if (firstInput) firstInput.focus();
                        }, 1500);
                    }
                }, 500);
            }
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
            // Focus previous input and clear it
            const prevInput = document.getElementById(`pin-digit-${index - 1}`) as HTMLInputElement;
            if (prevInput) {
                handleDigitChange(index - 1, '');
                prevInput.focus();
            }
        }
    };

    const clearPin = () => {
        setPin('');
        setPinDigits(['', '', '', '']);
        setError('');
        const firstInput = document.getElementById('pin-digit-0') as HTMLInputElement;
        if (firstInput) firstInput.focus();
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
                    <form onSubmit={handleSubmit} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false">
                        <div className="p-6 space-y-4">
                            <label className="block text-sm font-medium text-gray-400">{message || 'Please enter your PIN to continue.'}</label>
                            
                            {/* Display area */}
                            <div 
                                className="block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-3 px-3 text-white text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm cursor-pointer"
                                style={{ 
                                    fontFamily: 'monospace',
                                    minHeight: '44px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                onClick={openPinModal}
                            >
                                {pin ? '•'.repeat(pin.length) : '••••'}
                            </div>

                            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        </div>
                        <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold">Submit</button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Modal PIN Entry */}
            {showModal && (
                <div className="fixed inset-0 z-[999999] bg-black bg-opacity-90 flex items-center justify-center">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
                        <h3 className="text-white text-center text-lg mb-4">Enter 4-Digit PIN</h3>
                        <div className="flex justify-center gap-3 mb-6">
                            {pinDigits.map((digit, index) => (
                                <input
                                    key={index}
                                    id={`pin-digit-${index}`}
                                    type="text"
                                    maxLength={1}
                                    value={digit ? '•' : ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        handleDigitChange(index, value);
                                    }}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    className="w-12 h-12 text-center text-xl font-mono bg-gray-700 border border-gray-600 rounded text-white"
                                    style={{
                                        WebkitTextSecurity: 'disc',
                                        caretColor: digit ? 'transparent' : 'white'
                                    }}
                                    autoFocus={index === 0}
                                />
                            ))}
                        </div>
                        {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}
                        <div className="flex justify-center gap-3">
                            <button
                                type="button"
                                onClick={clearPin}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={closePinModal}
                                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};