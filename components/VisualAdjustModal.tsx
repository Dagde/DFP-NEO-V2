import React from 'react';
import { ScheduleEvent } from '../types';

interface VisualAdjustModalProps {
    event: ScheduleEvent;
    startTime: number;
    endTime: number;
    onContinue: () => void;
    onClose: () => void;
}

const formatTime = (time: number): string => {
    const hours = Math.floor(time);
    const minutes = Math.round((time - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const VisualAdjustModal: React.FC<VisualAdjustModalProps> = ({
    event,
    startTime,
    endTime,
    onContinue,
    onClose
}) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 transform transition-all animate-fade-in p-6 w-96" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-white mb-4">Visual Adjust Mode</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
                        <div className="px-3 py-2 bg-gray-700 text-white rounded-md">
                            {formatTime(startTime)}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">End Time</label>
                        <div className="px-3 py-2 bg-gray-700 text-white rounded-md">
                            {formatTime(endTime)}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onContinue}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
};