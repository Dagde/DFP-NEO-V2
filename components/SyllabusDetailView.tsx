import React from 'react';
import { SyllabusItemDetail } from '../types';

interface SyllabusDetailViewProps {
    item: SyllabusItemDetail;
    onBack: () => void;
}

const SyllabusDetailView: React.FC<SyllabusDetailViewProps> = ({ item, onBack }) => {
    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-white">LMP Details: {item.code}</h1>
                    <p className="text-sm text-gray-400">{item.eventDescription}</p>
                </div>
                <button
                    onClick={onBack}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md"
                >
                    &larr; Back to Program
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 space-y-6">
                    
                    {/* Key Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                            <label className="block text-xs font-medium text-gray-400 uppercase">Type</label>
                            <p className="text-lg font-semibold text-white">{item.type}</p>
                        </div>
                        <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                            <label className="block text-xs font-medium text-gray-400 uppercase">Duration</label>
                            <p className="text-lg font-semibold text-white">{item.duration} hrs</p>
                        </div>
                        <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                            <label className="block text-xs font-medium text-gray-400 uppercase">Location</label>
                            <p className="text-lg font-semibold text-white">{item.location}</p>
                        </div>
                         <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                            <label className="block text-xs font-medium text-gray-400 uppercase">Pre-Flight</label>
                            <p className="text-lg font-semibold text-white">{item.preFlightTime * 60} mins</p>
                        </div>
                         <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                            <label className="block text-xs font-medium text-gray-400 uppercase">Post-Flight</label>
                            <p className="text-lg font-semibold text-white">{item.postFlightTime * 60} mins</p>
                        </div>
                    </div>

                    {/* Prerequisites */}
                    <div>
                        <h2 className="text-lg font-semibold text-sky-400 mb-2">Prerequisites</h2>
                        <div className="bg-gray-700/50 p-4 rounded-lg">
                            <p className="text-gray-300 italic">
                                {item.prerequisites.length > 0 ? item.prerequisites.join(', ') : 'None'}
                            </p>
                        </div>
                    </div>

                    {/* Syllabus Events */}
                    <div>
                        <h2 className="text-lg font-semibold text-sky-400 mb-2">Syllabus Events</h2>
                        <div className="bg-gray-700/50 p-4 rounded-lg">
                            <ul className="space-y-2 list-disc list-inside text-gray-300">
                                {item.eventDetailsCommon.map((event, index) => (
                                    <li key={index}>{event}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SyllabusDetailView;