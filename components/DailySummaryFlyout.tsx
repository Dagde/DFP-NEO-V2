import React from 'react';

interface DailySummaryFlyoutProps {
  onClose: () => void;
  onConfirm: () => void;
}

const DailySummaryFlyout: React.FC<DailySummaryFlyoutProps> = ({ onClose, onConfirm }) => {
    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
            aria-modal="true"
            role="dialog"
            onClick={onClose}
        >
            <div
                className="bg-gray-800 rounded-lg shadow-xl m-4 w-full max-w-sm flex flex-col border border-gray-700 transform transition-all animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-lg">
                    <h2 id="summary-flyout-title" className="text-xl font-bold text-white">Confirmation</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-8 text-center" aria-labelledby="summary-flyout-title">
                    <p className="text-lg text-white">Confirm Delete</p>
                </div>
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end">
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-semibold shadow-md"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailySummaryFlyout;