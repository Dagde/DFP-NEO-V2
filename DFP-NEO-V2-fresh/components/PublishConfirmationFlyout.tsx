import React from 'react';

interface PublishConfirmationFlyoutProps {
  date: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const PublishConfirmationFlyout: React.FC<PublishConfirmationFlyoutProps> = ({ date, onConfirm, onCancel }) => {
    // Robustly parse the date string as UTC to avoid timezone issues.
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));

    const formattedDate = dateObj.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    });

    return (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center animate-fade-in" onClick={onCancel}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-sky-500/50" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-sky-900/20 flex items-center space-x-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h2 className="text-xl font-bold text-sky-400">Confirm Publication</h2>
                </div>
                <div className="p-6">
                    <p className="text-gray-300">
                        You are about to publish the schedule for <strong className="text-white">{formattedDate}</strong>.
                    </p>
                    <p className="text-gray-300 mt-4">
                        This action will <strong className="text-amber-400">replace the active program schedule for {formattedDate}</strong> with the contents of this build. This cannot be undone.
                    </p>
                </div>
                <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-semibold">
                        Confirm & Publish
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PublishConfirmationFlyout;