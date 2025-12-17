import React from 'react';

interface PauseConfirmationFlyoutProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const PauseConfirmationFlyout: React.FC<PauseConfirmationFlyoutProps> = ({ onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center animate-fade-in" onClick={onCancel}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="text-xl font-bold text-white">Confirm Action</h2>
                </div>
                <div className="p-6">
                    <p className="text-gray-300">Are you sure you want to pause this trainee?</p>
                </div>
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">No, Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-sm font-semibold">Yes, Pause</button>
                </div>
            </div>
        </div>
    );
};

export default PauseConfirmationFlyout;
