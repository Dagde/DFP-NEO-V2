import React from 'react';
import { Trainee, Score } from '../types';

interface ScoreDetailViewProps {
    trainee: Trainee;
    scoreData: Score;
    onBack: () => void;
}

const ScoreDetailView: React.FC<ScoreDetailViewProps> = ({ trainee, scoreData, onBack }) => {

    const getScoreColor = (score: number, type: 'text' | 'bg') => {
        const colors = {
            '2-5': { text: 'text-green-300', bg: 'bg-green-500/20' },
            '1': { text: 'text-amber-300', bg: 'bg-amber-500/20' },
            '0': { text: 'text-red-300', bg: 'bg-red-500/20' },
        };
        const key = score >= 2 ? '2-5' : score === 1 ? '1' : '0';
        return colors[key][type];
    };
    
    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-white">Scoring Sheet: {scoreData.event}</h1>
                    <p className="text-sm text-gray-400">{trainee.rank} {trainee.name}</p>
                </div>
                <button
                    onClick={onBack}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md"
                >
                    &larr; Back to Summary
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
                {/* Summary Box */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-700 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <label className="block text-xs font-medium text-gray-400 uppercase">Date</label>
                        <p className="text-lg font-semibold text-white">{scoreData.date}</p>
                    </div>
                    <div className="text-center">
                        <label className="block text-xs font-medium text-gray-400 uppercase">Instructor</label>
                        <p className="text-lg font-semibold text-white truncate">{scoreData.instructor}</p>
                    </div>
                    <div className="text-center">
                        <label className="block text-xs font-medium text-gray-400 uppercase">Event</label>
                        <p className="text-lg font-semibold text-white">{scoreData.event}</p>
                    </div>
                    <div className="text-center">
                        <label className="block text-xs font-medium text-gray-400 uppercase">Overall Score</label>
                        <p className={`text-2xl font-bold ${getScoreColor(scoreData.score, 'text')}`}>{scoreData.score}</p>
                    </div>
                </div>

                {/* Overall Notes */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-700">
                     <h2 className="text-lg font-semibold text-sky-400 mb-2">Overall Notes</h2>
                     <p className="text-gray-300 whitespace-pre-wrap">{scoreData.notes}</p>
                </div>

                {/* Detailed Breakdown */}
                 <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                    <h2 className="text-lg font-semibold text-sky-400 p-4 bg-gray-700/30">Detailed Breakdown</h2>
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-700/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-1/3">Criteria</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Score</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Comments</th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {scoreData.details.map((detail, index) => (
                                <tr key={index}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300">{detail.criteria}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-3 py-1 text-sm font-bold rounded-full ${getScoreColor(detail.score, 'bg')} ${getScoreColor(detail.score, 'text')}`}>
                                            {detail.score}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-400">{detail.comment}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ScoreDetailView;
