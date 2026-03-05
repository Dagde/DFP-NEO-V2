import React, { useState } from 'react';

interface EditCourseFlyoutProps {
    courseName: string;
    startDate: string;
    gradDate: string;
    onClose: () => void;
    onSave: (startDate: string, gradDate: string) => void;
}

const EditCourseFlyout: React.FC<EditCourseFlyoutProps> = ({
    courseName,
    startDate: initialStartDate,
    gradDate: initialGradDate,
    onClose,
    onSave
}) => {
    const [startDate, setStartDate] = useState(initialStartDate);
    const [gradDate, setGradDate] = useState(initialGradDate);

    const handleSave = () => {
        onSave(startDate, gradDate);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h2 className="text-xl font-bold text-sky-400">Edit Course Dates</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Course</label>
                        <div className="p-3 bg-gray-700/50 rounded-md text-white font-semibold">{courseName}</div>
                    </div>

                    <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-gray-400 mb-2">
                            Start Date
                        </label>
                        <input
                            type="date"
                            id="start-date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ colorScheme: 'dark' }}
                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="grad-date" className="block text-sm font-medium text-gray-400 mb-2">
                            Graduation Date
                        </label>
                        <input
                            type="date"
                            id="grad-date"
                            value={gradDate}
                            onChange={(e) => setGradDate(e.target.value)}
                            style={{ colorScheme: 'dark' }}
                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-transparent border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditCourseFlyout;