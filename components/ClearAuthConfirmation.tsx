import React from 'react';

interface ClearAuthConfirmationProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const ClearAuthConfirmation: React.FC<ClearAuthConfirmationProps> = ({ onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center animate-fade-in" onClick={onCancel}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm border border-red-500/50" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="text-xl font-bold text-red-400">Clear Authorisation</h2>
                </div>
                <div className="p-6 space-y-3">
                    <p className="text-gray-300">Are you sure you want to clear all signatures for this flight?</p>
                    <p className="text-amber-400 text-sm">This action requires PIN verification and cannot be undone.</p>
                </div>
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">No, Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-semibold">Yes, Clear</button>
                </div>
            </div>
        </div>
    );
};

export default ClearAuthConfirmation;