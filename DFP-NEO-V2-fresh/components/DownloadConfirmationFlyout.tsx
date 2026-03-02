import React from 'react';

interface DownloadConfirmationFlyoutProps {
  fileName: string;
  onConfirm: () => void;
  onClose: () => void;
}

const DownloadConfirmationFlyout: React.FC<DownloadConfirmationFlyoutProps> = ({ fileName, onConfirm, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="text-xl font-bold text-white">Download File</h2>
                </div>
                <div className="p-6">
                    <p className="text-gray-300">
                        Do you want to download <strong className="text-sky-400">{fileName}</strong> to your computer?
                    </p>
                </div>
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold">
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DownloadConfirmationFlyout;