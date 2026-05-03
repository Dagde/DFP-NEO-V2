import React from 'react';

interface AuthorisationConfirmationProps {
  onConfirm: () => void;
  onCancel: () => void;
  message?: string;
  annotation?: string;
}

const AuthorisationConfirmation: React.FC<AuthorisationConfirmationProps> = ({ onConfirm, onCancel, message, annotation }) => {
    return (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center animate-fade-in" onClick={onCancel}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="text-xl font-bold text-white">Confirm Authorisation</h2>
                </div>
                <div className="p-6 space-y-3">
                    <p className="text-gray-300">{message || 'Are you sure you wish to authorise this flight?'}</p>
                    {annotation && (
                        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-200">
                            {annotation}
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">NO</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-semibold">YES</button>
                </div>
            </div>
        </div>
    );
};

export default AuthorisationConfirmation;
