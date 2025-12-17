import React from 'react';
import { Trainee, Score, Pt051Assessment } from '../types';
import AuditButton from './AuditButton';

// Define ALL_ELEMENTS to match PT051View
const PT051_STRUCTURE = [
  { category: 'Core Dimensions', elements: ['Airmanship', 'Preparation', 'Technique'] },
  { category: 'Procedural Framework', elements: ['Pre-Post Flight', 'Walk Around', 'Strap-in', 'Ground Checks', 'Airborne Checks'] },
  { category: 'Takeoff', elements: ['Stationary'] },
  { category: 'Departure', elements: ['Visual'] },
  { category: 'Core Handling Skills', elements: ['Effects of Control', 'Trimming', 'Straight and Level'] },
  { category: 'Turns', elements: ['Level medium Turn', 'Level Steep turn'] },
  { category: 'Recovery', elements: ['Visual - Initial & Pitch'] },
  { category: 'Landing', elements: ['Landing', 'Crosswind'] },
  { category: 'Domestics', elements: ['Radio Comms', 'Situational Awareness', 'Lookout', 'Knowledge'] },
];

const ALL_ELEMENTS = PT051_STRUCTURE.flatMap(cat => cat.elements);

interface HateSheetViewProps {
    trainee: Trainee;
    lmpScores: Score[];
    assessments: Pt051Assessment[];
    onSelectLmpScore: (score: Score) => void;
    onSelectPt051: (assessment: Pt051Assessment) => void;
    onBackToRoster: () => void;
}

const HateSheetView: React.FC<HateSheetViewProps> = ({ trainee, lmpScores, assessments, onSelectLmpScore, onSelectPt051, onBackToRoster }) => {

    const combinedHistory = React.useMemo(() => {
        // FIX: Add 'as const' to create a discriminated union for type-safe property access.
        const lmpItems = lmpScores.map(score => ({ ...score, type: 'LMP Score' as const }));
        const pt051Items = assessments.map(assessment => ({ ...assessment, type: 'PT-051' as const }));
        
        console.log('=== Building combinedHistory ===');
        console.log('LMP Scores:', lmpScores.length, lmpScores);
        console.log('PT-051 Assessments:', assessments.length, assessments);
        
        // Combine and sort by date, newest first
        const combined = [...lmpItems, ...pt051Items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        console.log('Combined History:', combined.length, combined);
        
        return combined;
    }, [lmpScores, assessments]);

    const getScoreDisplay = (item: (typeof combinedHistory)[0]) => {
        let score: number | string | null = null;
        let isDoubleMarginal = false;

        if (item.type === 'LMP Score') {
            score = item.score;
        } else if (item.type === 'PT-051') {
            score = item.overallGrade;
        }

        if (score === null || score === undefined || score === 'No Grade') {
             return <span className="text-sm text-gray-500">-</span>;
        }

        // Check for double marginal if this item has a marginal grade
        if (score === 1) {
            console.log('Checking double marginal for:', item.type === 'LMP Score' ? item.event : item.flightNumber, 'ID:', item.id, 'on', item.date);
            
            // Find the index of this item in the combined history (newest first)
            const currentIndex = combinedHistory.findIndex(history => history.id === item.id);
            
            // Check if there was a previous marginal score in the overall timeline
            if (currentIndex >= 0 && currentIndex < combinedHistory.length - 1) {
                const previousItem = combinedHistory[currentIndex + 1]; // Next item in newest-first order
                const prevScore = previousItem.type === 'LMP Score' ? previousItem.score : previousItem.overallGrade;
                console.log('Previous item in timeline:', previousItem.type === 'LMP Score' ? previousItem.event : previousItem.flightNumber, 'score:', prevScore, 'type:', previousItem.type, 'ID:', previousItem.id);
                
                if (prevScore === 1) {
                    isDoubleMarginal = true;
                    console.log('✅ DOUBLE MARGINAL DETECTED for', item.type === 'LMP Score' ? item.event : item.flightNumber, 'ID:', item.id, '- consecutive with previous event');
                }
            } else {
                console.log('No previous item found in timeline for', item.type === 'LMP Score' ? item.event : item.flightNumber);
            }
        }

        // Check if this is a ground event completion (score = 5 for completed ground events)
        if (item.type === 'LMP Score' && item.score === 5) {
            return (
                <span className="text-green-300 text-sm font-semibold">Complete</span>
            );
        }

        const numScore = Number(score);
        let colorClass = 'bg-gray-500/20 text-gray-300';

        if (!isNaN(numScore)) {
            if (isDoubleMarginal) {
                colorClass = 'bg-red-500/20 text-red-300';
            } else if (numScore >= 2) {
                colorClass = 'bg-green-500/20 text-green-300';
            } else if (numScore === 1) {
                colorClass = 'bg-amber-500/20 text-amber-300';
            } else if (numScore === 0) {
                colorClass = 'bg-red-500/20 text-red-300';
            }
        }
        
        return <span className={`px-3 py-1 text-sm font-bold rounded-full ${colorClass}`}>{score}</span>;
    };

    const handleRowClick = (item: (typeof combinedHistory)[0]) => {
        // Always navigate to PT-051 for all events (including ground events)
        if (item.type === 'LMP Score') {
            // Create a mock PT-051 assessment for the LMP Score
            const mockAssessment: Pt051Assessment = {
                id: `mock-${item.event}`,
                traineeFullName: trainee.fullName,
                eventId: `mock-event-${item.event}`, // Use a mock event ID
                flightNumber: item.event,
                date: item.date,
                instructorName: item.instructor,
                overallGrade: item.score === 5 ? 'No Grade' : item.score as Pt051OverallGrade,
                overallResult: item.score === 5 ? 'P' : null,
                dcoResult: item.score === 5 ? 'DCO' : undefined,
                overallComments: item.notes,
                scores: ALL_ELEMENTS.map(element => ({
                    element,
                    grade: null,
                    comment: ''
                })) // Properly structured scores array
            };
            onSelectPt051(mockAssessment);
        } else if (item.type === 'PT-051') {
            onSelectPt051(item as Pt051Assessment);
        }
    };
    
    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-white">Performance History</h1>
                    <p className="text-sm text-gray-400">{trainee.rank} {trainee.name} - {trainee.course}</p>
                </div>
                   <div className="flex items-center gap-2">
                <button
                    onClick={onBackToRoster}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md"
                >
                    &larr; Back - Trainee Profile
                </button>
                       <AuditButton pageName="Performance History" />
                   </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-4 md:p-6 max-w-7xl mx-auto">
                    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-700/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Event</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Overall Score</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Instructor</th>
                                </tr>
                            </thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                                {combinedHistory.length > 0 ? (
                                    combinedHistory.map((item, index) => (
                                        <tr key={index} onClick={() => handleRowClick(item)} className="hover:bg-gray-700/50 transition-colors cursor-pointer">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{item.date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-semibold text-sky-400">
                                                    {/* FIX: Use discriminated union to safely access event/flightNumber. */}
                                                    {item.type === 'LMP Score' ? item.event : item.flightNumber}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.type === 'LMP Score' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'}`}>
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {getScoreDisplay(item)}
                                            </td>
                                            {/* FIX: Use discriminated union to safely access instructor/instructorName. */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{item.type === 'LMP Score' ? item.instructor : item.instructorName}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="text-center py-10 text-gray-500">
                                            No performance records for this trainee.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HateSheetView;