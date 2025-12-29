import React, { useState, useMemo } from 'react';

interface RemoveCourseFlyoutProps {
  onClose: () => void;
  onArchive: (courseNumber: string) => void;
  activeCourses: { [key: string]: string };
}

const RemoveCourseFlyout: React.FC<RemoveCourseFlyoutProps> = ({ onClose, onArchive, activeCourses }) => {
    const courseNames = useMemo(() => Object.keys(activeCourses), [activeCourses]);
    const [selectedCourse, setSelectedCourse] = useState<string>(courseNames[0] || '');

    const handleArchive = () => {
        if (selectedCourse) {
            onArchive(selectedCourse);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <h2 className="text-xl font-bold text-amber-400">Archive a Course</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-gray-300">Which course would you like to move to the archive?</p>
                    <div>
                        <label htmlFor="course-to-archive" className="block text-sm font-medium text-gray-400">Active Courses</label>
                        <select
                            id="course-to-archive"
                            value={selectedCourse}
                            onChange={e => setSelectedCourse(e.target.value)}
                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                        >
                            {courseNames.length > 0 ? (
                                courseNames.map(name => <option key={name} value={name}>{name}</option>)
                            ) : (
                                <option disabled>No active courses</option>
                            )}
                        </select>
                    </div>
                    <p className="text-xs text-gray-500">Archived courses are removed from the main list but are not deleted from the system.</p>
                </div>

                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={handleArchive} disabled={!selectedCourse} className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-sm font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed">Archive Course</button>
                    <button onClick={onClose} className="px-4 py-2 bg-transparent border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors text-sm">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default RemoveCourseFlyout;