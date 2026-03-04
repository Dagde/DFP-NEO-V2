import React from 'react';

interface RestoreConfirmationFlyoutProps {
  instructorName: string;
  onConfirm: () => void;
  onClose: () => void;
}

const RestoreConfirmationFlyout: React.FC<RestoreConfirmationFlyoutProps> = ({ instructorName, onConfirm, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-sky-500/50" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-sky-900/20 flex items-center space-x-3">
                    <h2 className="text-xl font-bold text-sky-400">Confirm Restore</h2>
                </div>
                <div className="p-6">
                    <p className="text-gray-300">
                        Are you sure you want to restore <strong className="text-white">{instructorName}</strong> to the active list?
                    </p>
                </div>
                <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold">
                        Yes, Restore
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RestoreConfirmationFlyout;
