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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-end pr-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 transform transition-all animate-fade-in p-4 w-64 mr-8" onClick={e => e.stopPropagation()}>
                <h3 className="text-sm font-bold text-white mb-3">Visual Adjust</h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">Start Time</label>
                        <div className="px-2 py-1 bg-gray-700 text-white rounded text-sm">
                            {formatTime(startTime)}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">End Time</label>
                        <div className="px-2 py-1 bg-gray-700 text-white rounded text-sm">
                            {formatTime(endTime)}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                    <button
                        onClick={onClose}
                        className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onContinue}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
};