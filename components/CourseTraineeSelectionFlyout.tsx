import React, { useState, useMemo, useEffect } from 'react';
import { Trainee } from '../types';

interface CourseTraineeSelectionFlyoutProps {
    onClose: () => void;
    onConfirm: (selectedTrainees: string[]) => void;
    courseNumber: string;
    traineesInCourse: Trainee[];
    traineeStatus: Map<string, { isPaused: boolean }>;
}

const CourseTraineeSelectionFlyout: React.FC<CourseTraineeSelectionFlyoutProps> = ({ 
    onClose, 
    onConfirm, 
    courseNumber, 
    traineesInCourse,
    traineeStatus
}) => {
    const activeTraineesInCourse = useMemo(() => 
        traineesInCourse.filter(t => !traineeStatus.get(t.fullName)?.isPaused), 
        [traineesInCourse, traineeStatus]
    );

    const [selectedTrainees, setSelectedTrainees] = useState<string[]>(() => 
        activeTraineesInCourse.map(t => t.fullName)
    );

    const handleToggle = (traineeFullName: string) => {
        setSelectedTrainees(prev =>
            prev.includes(traineeFullName)
                ? prev.filter(t => t !== traineeFullName)
                : [...prev, traineeFullName]
        );
    };

    const handleConfirm = () => {
        onConfirm(selectedTrainees);
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                    <h2 className="text-xl font-bold text-white">Confirm Attendees for {courseNumber}</h2>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    <p className="text-gray-400 mb-4 text-sm">All active trainees are selected by default. Deselect any who will not be attending.</p>
                    <ul className="space-y-2">
                        {activeTraineesInCourse.map(trainee => (
                            <li key={trainee.fullName}>
                                <label className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedTrainees.includes(trainee.fullName)}
                                        onChange={() => handleToggle(trainee.fullName)}
                                        className="h-4 w-4 accent-sky-500 bg-gray-600"
                                    />
                                    <span className="text-sm text-gray-300">{trainee.name} ({trainee.rank})</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">Cancel</button>
                    <button onClick={handleConfirm} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold">Confirm ({selectedTrainees.length})</button>
                </div>
            </div>
        </div>
    );
};

export default CourseTraineeSelectionFlyout;