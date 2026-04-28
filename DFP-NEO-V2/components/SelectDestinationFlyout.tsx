import React, { useState } from 'react';

interface SelectDestinationFlyoutProps {
  onClose: () => void;
  onConfirm: (folderId: string) => void;
  fileName: string;
  folders: { id: string, name: string }[];
}

const SelectDestinationFlyout: React.FC<SelectDestinationFlyoutProps> = ({ onClose, onConfirm, fileName, folders }) => {
    const [selectedFolder, setSelectedFolder] = useState<string>(folders[0]?.id || '');

    const handleConfirm = () => {
        if (selectedFolder) {
            onConfirm(selectedFolder);
        } else {
            alert('Please select a destination folder.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Select Destination</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-gray-400 text-sm">
                        Select a destination folder for the file: <span className="font-semibold text-gray-200">{fileName}</span>
                    </p>
                    <div className="space-y-2">
                        {folders.map(folder => (
                            <label key={folder.id} className="flex items-center space-x-3 p-3 rounded-md bg-gray-700/50 hover:bg-gray-700 cursor-pointer">
                                <input
                                    type="radio"
                                    name="destination-folder"
                                    value={folder.id}
                                    checked={selectedFolder === folder.id}
                                    onChange={() => setSelectedFolder(folder.id)}
                                    className="h-4 w-4 accent-sky-500 bg-gray-600 border-gray-500"
                                />
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                </svg>
                                <span className="text-white font-medium">{folder.name}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancel</button>
                    <button onClick={handleConfirm} disabled={!selectedFolder} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
                        Confirm & Upload
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SelectDestinationFlyout;