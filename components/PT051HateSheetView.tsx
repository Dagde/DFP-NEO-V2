import React from 'react';
import { Trainee, Pt051Assessment } from '../types';

interface PT051HateSheetViewProps {
    trainee: Trainee;
    assessments: Pt051Assessment[];
    onBack: () => void;
    onSelectAssessment: (assessment: Pt051Assessment) => void;
    onCreateNew: () => void;
}

const PT051HateSheetView: React.FC<PT051HateSheetViewProps> = ({ trainee, assessments, onBack, onSelectAssessment, onCreateNew }) => {
    
    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-white">PT-051 History</h1>
                    <p className="text-sm text-gray-400">{trainee.rank} {trainee.name} - {trainee.course}</p>
                </div>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onCreateNew}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-semibold shadow-md"
                    >
                        Create New Assessment
                    </button>
                     <button
                        onClick={onBack}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md"
                    >
                        &larr; Back
                    </button>
                </div>
            </div>

            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Event</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Instructor</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">View</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {assessments.length > 0 ? (
                                assessments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(assessment => (
                                    <tr key={assessment.id} className="hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{assessment.date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-white">{assessment.flightNumber}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{assessment.instructorName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => onSelectAssessment(assessment)} className="text-sky-400 hover:text-sky-300">View Details</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-10 text-gray-500">
                                        No PT-051 assessments recorded for this trainee.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PT051HateSheetView;