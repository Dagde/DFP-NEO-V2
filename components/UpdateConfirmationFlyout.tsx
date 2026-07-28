import React, { useRef, useState } from 'react';

interface UpdateConfirmationFlyoutProps {
  fileName: string;
  onConfirm: (password: string, updateType: 'bulk' | 'minor') => Promise<string | void> | string | void;
  onClose: () => void;
}

const UpdateConfirmationFlyout: React.FC<UpdateConfirmationFlyoutProps> = ({ fileName, onConfirm, onClose }) => {
    const passwordInputRef = useRef<HTMLInputElement | null>(null);
    const [updateType, setUpdateType] = useState<'bulk' | 'minor'>('minor');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const password = passwordInputRef.current?.value || '';
        if (!password.trim()) {
            setError('Enter your password.');
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await onConfirm(password, updateType);
            if (typeof result === 'string' && result.trim()) {
                setError(result);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="text-xl font-bold text-white">Confirm Update</h2>
                </div>
                <div className="p-6 space-y-6">
                    <p className="text-gray-400">
                        Enter your password to apply updates from <strong className="text-gray-200">{fileName}</strong>.
                    </p>

                    <div>
                        <label htmlFor="password-input" className="block text-sm font-medium text-gray-400">Password</label>
                        <input
                            id="password-input"
                            type="password"
                            ref={passwordInputRef}
                            onInput={() => {
                                if (error) setError('');
                            }}
                            autoFocus
                            className="block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        />
                         {error && <p className="text-red-400 text-sm text-center mt-1">{error}</p>}
                    </div>
                    
                    <fieldset>
                        <legend className="text-sm font-medium text-gray-400 mb-2">Select Update Type</legend>
                        <div className="space-y-2">
                             <label className="flex items-start space-x-3 p-3 rounded-md bg-gray-700/50 hover:bg-gray-700 cursor-pointer">
                                <input
                                    type="radio"
                                    name="update-type"
                                    value="minor"
                                    checked={updateType === 'minor'}
                                    onChange={() => setUpdateType('minor')}
                                    className="h-5 w-5 mt-0.5 accent-sky-500 bg-gray-600 border-gray-500 flex-shrink-0"
                                />
                                <div>
                                    <span className="text-white font-medium">Minor Update</span>
                                    <p className="text-xs text-gray-400">Update existing records and add new ones. You will be prompted to confirm new entries.</p>
                                </div>
                            </label>
                             <label className="flex items-start space-x-3 p-3 rounded-md bg-gray-700/50 hover:bg-gray-700 cursor-pointer">
                                <input
                                    type="radio"
                                    name="update-type"
                                    value="bulk"
                                    checked={updateType === 'bulk'}
                                    onChange={() => setUpdateType('bulk')}
                                    className="h-5 w-5 mt-0.5 accent-sky-500 bg-gray-600 border-gray-500 flex-shrink-0"
                                />
                                <div>
                                    <span className="text-white font-medium">Bulk Update</span>
                                    <p className="text-xs text-gray-400">Warning: This will delete all existing data and replace it with the contents of the file.</p>
                                </div>
                            </label>
                        </div>
                    </fieldset>

                </div>
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Checking...' : 'Confirm Update'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default UpdateConfirmationFlyout;
