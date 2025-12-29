import React from 'react';

interface DeleteFileConfirmationFlyoutProps {
  fileName: string;
  onConfirm: () => void;
  onClose: () => void;
}

const DeleteFileConfirmationFlyout: React.FC<DeleteFileConfirmationFlyoutProps> = ({ fileName, onConfirm, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-amber-500/50" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-amber-900/20 flex items-center space-x-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h2 className="text-xl font-bold text-amber-400">Confirm Deletion</h2>
                </div>
                <div className="p-6">
                    <p className="text-gray-300">
                        Are you sure you want to permanently delete <strong className="text-white">{fileName}</strong>?
                    </p>
                    <p className="text-gray-400 mt-2 text-sm">
                        This action cannot be undone.
                    </p>
                </div>
                <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-semibold">
                        Yes, Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteFileConfirmationFlyout;
