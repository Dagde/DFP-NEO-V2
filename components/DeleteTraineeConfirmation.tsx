import React, { useState } from 'react';
import { Trainee } from '../types';

interface DeleteTraineeConfirmationProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (trainee: Trainee) => void;
    traineesData: Trainee[];
    courseColors: { [key: string]: string };
}

const DeleteTraineeConfirmation: React.FC<DeleteTraineeConfirmationProps> = ({
    isOpen,
    onClose,
    onConfirm,
    traineesData,
    courseColors
}) => {
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);
    const [pin, setPin] = useState<string>('');
    const [error, setError] = useState<string>('');

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

        onConfirm(selectedTrainee);
        // Reset form
        setSelectedCourse('');
        setSelectedTrainee(null);
        setPin('');
        setError('');
    };

    const handleClose = () => {
        setSelectedCourse('');
        setSelectedTrainee(null);
        setPin('');
        setError('');
        onClose();
    };

    const traineesInCourse = traineesData.filter(t => t.course === selectedCourse);

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in" onClick={handleClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Delete Trainee</h2>
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
                        <div className="bg-red-900/30 border border-red-700 rounded-md p-3">
                            <p className="text-red-200 text-sm">
                                <strong>Warning:</strong> You are about to delete <strong>{selectedTrainee.rank} {selectedTrainee.name}</strong> from <strong>{selectedCourse}</strong>.
                            </p>
                            <p className="text-red-200 text-sm mt-1">
                                This action cannot be undone.
                            </p>
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
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        Delete Trainee
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteTraineeConfirmation;