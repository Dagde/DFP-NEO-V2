import React from 'react';

interface RestoreCourseConfirmationProps {
  courseNumber: string;
  onConfirm: (courseNumber: string) => void;
  onClose: () => void;
}

const RestoreCourseConfirmation: React.FC<RestoreCourseConfirmationProps> = ({ courseNumber, onConfirm, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h2 className="text-xl font-bold text-green-400">Restore Course</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-gray-300">Are you sure you want to restore <span className="font-bold text-white">CSE {courseNumber}</span> to the active courses list?</p>
                </div>

                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={() => onConfirm(courseNumber)} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-semibold">Restore</button>
                    <button onClick={onClose} className="px-4 py-2 bg-transparent border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors text-sm">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default RestoreCourseConfirmation;