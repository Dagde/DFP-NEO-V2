import React from 'react';

interface NewRecordConfirmationFlyoutProps {
  rowData: any;
  onConfirm: () => void;
  onCancel: () => void;
}

const NewRecordConfirmationFlyout: React.FC<NewRecordConfirmationFlyoutProps> = ({ rowData, onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center animate-fade-in" onClick={onCancel}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-sky-500/50" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-sky-900/20 flex items-center space-x-3">
                    <h2 className="text-xl font-bold text-sky-400">New Record Found</h2>
                </div>
                <div className="p-6">
                    <p className="text-gray-300">
                        A record from the file could not be matched to any existing data.
                    </p>
                     <div className="mt-4 bg-gray-900/50 p-3 rounded-md text-xs font-mono text-gray-400 max-h-40 overflow-auto">
                        <pre>{JSON.stringify(rowData, null, 2)}</pre>
                    </div>
                    <p className="text-gray-300 mt-4">
                        Do you want to add this as a new person/event?
                    </p>
                </div>
                <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">
                        No, Skip
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-semibold">
                        Yes, Add New
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewRecordConfirmationFlyout;
