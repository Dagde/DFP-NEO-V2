import React, { useState } from 'react';

interface PinEntryFlyoutProps {
  correctPin: string;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
  annotation?: string;
  inputLabel?: string;
  inputType?: string;
  maxLength?: number;
  invalidMessage?: string;
  onValidateEntry?: (entry: string) => Promise<boolean> | boolean;
}

const PinEntryFlyout: React.FC<PinEntryFlyoutProps> = ({
    correctPin,
    onConfirm,
    onCancel,
    title,
    message,
    annotation,
    inputLabel = 'PIN',
    inputType = 'text',
    maxLength = 4,
    invalidMessage = 'Incorrect PIN. Please try again.',
    onValidateEntry,
}) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isChecking, setIsChecking] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsChecking(true);
        try {
            const isValid = onValidateEntry
                ? await onValidateEntry(pin)
                : pin === correctPin;
            if (!isValid) {
                setError(invalidMessage);
                setPin('');
                return;
            }
            onConfirm();
        } catch (error) {
            setError('The app could not verify your password.');
            setPin('');
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center animate-fade-in" onClick={onCancel}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-xs border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="text-xl font-bold text-white">{title || 'Enter PIN'}</h2>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <label htmlFor="pin-input" className="block text-sm font-medium text-gray-400">{message || 'Please enter your PIN to continue.'}</label>
                        {annotation && (
                            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-200">
                                {annotation}
                            </div>
                        )}
                        <input
                            id="pin-input"
                            type={inputType}
                            value={pin}
                            onChange={e => {
                                setPin(e.target.value);
                                setError('');
                            }}
                            maxLength={maxLength}
                            autoFocus
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            placeholder={inputLabel}
                            className={`block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm ${inputType === 'password' ? '' : 'text-center text-2xl tracking-[.5em]'}`}
                        />
                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                    </div>
                    <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">Cancel</button>
                        <button type="submit" disabled={isChecking} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed">
                            {isChecking ? 'Checking...' : 'Submit'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PinEntryFlyout;
