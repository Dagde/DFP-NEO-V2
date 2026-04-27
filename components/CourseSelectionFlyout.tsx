import React, { useState } from 'react';

interface CourseSelectionFlyoutProps {
  courses: string[];
  onConfirm: (selectedCourse: string) => void;
  onClose: () => void;
  updateType: 'bulk' | 'minor';
}

const CourseSelectionFlyout: React.FC<CourseSelectionFlyoutProps> = ({ 
  courses, 
  onConfirm, 
  onClose,
  updateType 
}) => {
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCourse) {
            setError('Please select a course.');
            return;
        }
        onConfirm(selectedCourse);
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="text-xl font-bold text-white">Select Course</h2>
                </div>
                <div className="p-6 space-y-6">
                    <p className="text-gray-400">
                        {updateType === 'minor' 
                            ? 'Select the course to update. Existing trainees will be updated and new trainees will be added.'
                            : 'Select the course to update. WARNING: All existing trainees in this course will be replaced with the uploaded data.'}
                    </p>

                    <div>
                        <label htmlFor="course-select" className="block text-sm font-medium text-gray-400 mb-2">
                            Course
                        </label>
                        <select
                            id="course-select"
                            value={selectedCourse}
                            onChange={e => {
                                setSelectedCourse(e.target.value);
                                setError('');
                            }}
                            autoFocus
                            className="block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                        >
                            <option value="">-- Select a Course --</option>
                            {courses.map(course => (
                                <option key={course} value={course}>
                                    {course}
                                </option>
                            ))}
                        </select>
                        {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
                    </div>

                    {updateType === 'bulk' && selectedCourse && (
                        <div className="bg-red-900/20 border border-red-700 rounded-md p-3">
                            <div className="flex items-start space-x-2">
                                <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <p className="text-red-400 font-medium text-sm">Warning</p>
                                    <p className="text-red-300 text-xs mt-1">
                                        This will permanently delete all trainees currently in <strong>{selectedCourse}</strong> and replace them with the uploaded data.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        className={`px-4 py-2 rounded-md transition-colors text-sm font-semibold ${
                            updateType === 'bulk' 
                                ? 'bg-red-600 hover:bg-red-700 text-white' 
                                : 'bg-sky-600 hover:bg-sky-700 text-white'
                        }`}
                    >
                        {updateType === 'bulk' ? 'Replace Course Data' : 'Update Course'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CourseSelectionFlyout;