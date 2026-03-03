import React, { useState } from 'react';
import { Trainee } from '../types';

interface DeleteTraineeConfirmationProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (trainee: Trainee) => void;
    onArchive?: (trainee: Trainee) => void;
    traineesData: Trainee[];
    courseColors: { [key: string]: string };
}

const DeleteTraineeConfirmation: React.FC<DeleteTraineeConfirmationProps> = ({
    isOpen,
    onClose,
    onConfirm,
    onArchive,
    traineesData,
    courseColors
}) => {
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);
    const [pin, setPin] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [action, setAction] = useState<'delete' | 'archive'>('delete');

    if (!isOpen) return null;

    const courses = Object.keys(courseColors).sort();

    const handleCourseChange = (course: string) => {
        setSelectedCourse(course);
        setSelectedTrainee(null);
        setError('');
    };

    const handleTraineeChange = (traineeFullName: string) => {
        const trainee = traineesData.find(t => t.fullName === traineeFullName);
        setSelectedTrainee(trainee || null);
        setError('');
    };

    const handleConfirm = () => {
        // Validation
        if (!selectedCourse) {
            setError('Please select a course');
            return;
        }

        if (!selectedTrainee) {
            setError('Please select a trainee');
            return;
        }

        if (pin !== '1111') {
            setError('Incorrect PIN');
            return;
        }

        if (action === 'archive' && onArchive) {
            onArchive(selectedTrainee);
        } else {
            onConfirm(selectedTrainee);
        }
        // Reset form
        setSelectedCourse('');
        setSelectedTrainee(null);
        setPin('');
        setError('');
        setAction('delete');
    };

    const handleClose = () => {
        setSelectedCourse('');
        setSelectedTrainee(null);
        setPin('');
        setError('');
        setAction('delete');
        onClose();
    };

    const traineesInCourse = traineesData.filter(t => t.course === selectedCourse);

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in" onClick={handleClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Delete or Archive Trainee</h2>
                    <button onClick={handleClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Course *
                        </label>
                        <select
                            value={selectedCourse}
                            onChange={(e) => handleCourseChange(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                            <option value="">Select a course</option>
                            {courses.map(course => (
                                <option key={course} value={course}>{course}</option>
                            ))}
                        </select>
                    </div>

                    {selectedCourse && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Trainee *
                            </label>
                            <select
                                value={selectedTrainee?.fullName || ''}
                                onChange={(e) => handleTraineeChange(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="">Select a trainee</option>
                                {traineesInCourse.map(trainee => (
                                    <option key={trainee.fullName} value={trainee.fullName}>
                                        {trainee.rank} {trainee.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {selectedTrainee && (
                        <div className="bg-amber-900/30 border border-amber-600 rounded-md p-4 space-y-3">
                            <div className="flex items-start space-x-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="text-amber-200 text-sm font-semibold">
                                        {selectedTrainee.rank} {selectedTrainee.name} from {selectedCourse}
                                    </p>
                                    <p className="text-amber-100 text-xs mt-1">
                                        You are about to remove this trainee from the <strong className="text-amber-200">database</strong>.
                                    </p>
                                </div>
                            </div>
                            
                            <div className="border-t border-amber-700/50 pt-3 mt-3">
                                <p className="text-gray-300 text-xs mb-2">Choose an action:</p>
                                <div className="space-y-2">
                                    <label className={`flex items-start space-x-3 p-2 rounded border cursor-pointer ${action === 'archive' ? 'border-sky-500 bg-sky-900/30' : 'border-gray-600 hover:border-gray-500'}`}>
                                        <input
                                            type="radio"
                                            name="action"
                                            value="archive"
                                            checked={action === 'archive'}
                                            onChange={() => setAction('archive')}
                                            className="mt-1"
                                        />
                                        <div>
                                            <span className="text-white text-sm font-medium">Archive Trainee (Recommended)</span>
                                            <p className="text-gray-400 text-xs">Hide from active roster but keep all data. Can be restored later.</p>
                                        </div>
                                    </label>
                                    <label className={`flex items-start space-x-3 p-2 rounded border cursor-pointer ${action === 'delete' ? 'border-red-500 bg-red-900/30' : 'border-gray-600 hover:border-gray-500'}`}>
                                        <input
                                            type="radio"
                                            name="action"
                                            value="delete"
                                            checked={action === 'delete'}
                                            onChange={() => setAction('delete')}
                                            className="mt-1"
                                        />
                                        <div>
                                            <span className="text-red-400 text-sm font-medium">Delete Permanently</span>
                                            <p className="text-gray-400 text-xs">Remove from database completely. This action cannot be undone.</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            PIN *
                        </label>
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            placeholder="Enter PIN to confirm"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedCourse || !selectedTrainee || !pin}
                        className={`px-4 py-2 text-white rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed ${
                            action === 'archive' 
                                ? 'bg-sky-600 hover:bg-sky-700' 
                                : 'bg-red-600 hover:bg-red-700'
                        }`}
                    >
                        {action === 'archive' ? 'Archive Trainee' : 'Delete Trainee'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteTraineeConfirmation;