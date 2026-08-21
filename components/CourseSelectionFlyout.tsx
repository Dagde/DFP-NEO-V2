import React, { useState } from 'react';

export type CourseUploadPreview = {
  fileName?: string;
  rowCount: number;
  validRowCount: number;
  skippedRowCount: number;
  courses: string[];
  sampleRows: Array<{
    name: string;
    idNumber?: string | number;
    course?: string;
    email?: string;
  }>;
};

interface CourseSelectionFlyoutProps {
  courses: string[];
  onConfirm: (selectedCourse: string) => void | Promise<void>;
  onClose: () => void;
  updateType: 'bulk' | 'minor';
  uploadPreview?: CourseUploadPreview | null;
}

const CourseSelectionFlyout: React.FC<CourseSelectionFlyoutProps> = ({ 
  courses, 
  onConfirm, 
  onClose,
  updateType,
  uploadPreview,
}) => {
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const uploadedCourses = uploadPreview?.courses?.filter(Boolean) || [];
    const hasCourseMismatch = Boolean(
        selectedCourse &&
        uploadedCourses.length > 0 &&
        !uploadedCourses.includes(selectedCourse)
    );
    const hasNoValidRows = Boolean(uploadPreview && uploadPreview.validRowCount === 0);
    const disableSubmit = isSubmitting || hasCourseMismatch || hasNoValidRows;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCourse) {
            setError('Please select a course.');
            return;
        }
        if (hasCourseMismatch) {
            setError(`This file contains ${uploadedCourses.join(', ')}, but ${selectedCourse} is selected.`);
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            await onConfirm(selectedCourse);
        } catch (submitError) {
            setError((submitError as Error).message || 'The course update could not be completed.');
        } finally {
            setIsSubmitting(false);
        }
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

                    {uploadPreview && (
                        <div className="rounded-md border border-sky-700/60 bg-sky-950/20 p-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-sky-200">Uploaded File Preview</p>
                                    {uploadPreview.fileName && <p className="mt-0.5 text-xs text-gray-400">{uploadPreview.fileName}</p>}
                                </div>
                                <div className="text-right text-xs text-gray-300">
                                    <p>{uploadPreview.validRowCount} valid rows</p>
                                    {uploadPreview.skippedRowCount > 0 && <p className="text-amber-300">{uploadPreview.skippedRowCount} skipped</p>}
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-300">
                                <div>
                                    <span className="text-gray-500">Course values in file: </span>
                                    <span className="font-semibold text-white">{uploadedCourses.length > 0 ? uploadedCourses.join(', ') : 'None found'}</span>
                                </div>
                                {uploadPreview.sampleRows.length > 0 && (
                                    <div className="max-h-32 overflow-y-auto rounded border border-gray-700 bg-gray-900/40 p-2">
                                        {uploadPreview.sampleRows.map((row, index) => (
                                            <div key={`${row.idNumber || row.name}-${index}`} className="flex justify-between gap-3 py-0.5">
                                                <span className="truncate text-white">{row.name}</span>
                                                <span className="shrink-0 text-gray-400">{row.idNumber ? `ID ${row.idNumber}` : 'No ID'}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

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
                    {hasCourseMismatch && (
                        <div className="rounded-md border border-amber-600 bg-amber-950/30 p-3 text-xs text-amber-200">
                            The selected course does not match the course values parsed from this file. Select {uploadedCourses.join(', ')} or choose a corrected spreadsheet.
                        </div>
                    )}
                    {hasNoValidRows && (
                        <div className="rounded-md border border-red-700 bg-red-950/30 p-3 text-xs text-red-200">
                            No valid trainee rows were found. Each uploaded trainee must have a Personnel ID and name before the course can be updated.
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex flex-wrap justify-end gap-3">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        disabled={disableSubmit}
                        className={`px-4 py-2 rounded-md transition-colors text-sm font-semibold ${
                            updateType === 'bulk' 
                                ? 'bg-red-600 hover:bg-red-700 text-white' 
                                : 'bg-sky-600 hover:bg-sky-700 text-white'
                        } disabled:cursor-not-allowed disabled:bg-gray-600`}
                    >
                        {isSubmitting ? 'Processing...' : updateType === 'bulk' ? 'Replace Course Data' : 'Update Course'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CourseSelectionFlyout;
