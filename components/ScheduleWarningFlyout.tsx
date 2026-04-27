import React from 'react';

interface ScheduleWarningFlyoutProps {
  traineeName: string;
  onAcknowledge: () => void;
}

const ScheduleWarningFlyout: React.FC<ScheduleWarningFlyoutProps> = ({ traineeName, onAcknowledge }) => {
    return (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center animate-fade-in" onClick={onAcknowledge}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-amber-500/50" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-amber-900/20 flex items-center space-x-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h2 className="text-xl font-bold text-amber-400">Schedule Warning</h2>
                </div>
                <div className="p-6">
                    <p className="text-gray-300">
                        Warning: <strong className="text-white">{traineeName}</strong> is scheduled for one or more events today.
                    </p>
                    <p className="text-gray-400 mt-2">
                        Pausing their status will not automatically remove them from the program. Please update the schedule manually to avoid conflicts.
                    </p>
                </div>
                <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end">
                    <button onClick={onAcknowledge} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold">
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScheduleWarningFlyout;
