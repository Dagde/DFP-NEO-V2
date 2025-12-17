
import React, { useMemo } from 'react';
import { NeoProblemTile, NeoRemedy, NeoInstructorRemedy, NeoTimeShiftRemedy, NeoTraineeRemedy } from '../types';

interface NeoRemedyFlyoutProps {
  problemTile: NeoProblemTile;
  remedies: NeoRemedy[];
  onApplyRemedy: (remedy: NeoRemedy) => void;
  onCancel: () => void;
}

const formatTime = (time: number): string => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
};

const NeoRemedyFlyout: React.FC<NeoRemedyFlyoutProps> = ({ problemTile, remedies, onApplyRemedy, onCancel }) => {
    const { event, errors } = problemTile;

    const instructorSwapRemedies = remedies.filter((r): r is NeoInstructorRemedy => r.type === 'instructor');
    console.log('🔧 NeoRemedyFlyout: Received remedies:', remedies.length);
    console.log('🔧 NeoRemedyFlyout: Remedies:', remedies);
    const timeShiftRemedies = remedies.filter((r): r is NeoTimeShiftRemedy => r.type === 'timeshift');
    const traineeSwapRemedies = remedies.filter((r): r is NeoTraineeRemedy => r.type === 'trainee');

    const groupedTimeShifts = useMemo(() => {
        const groups = new Map<number, NeoTimeShiftRemedy[]>();
        timeShiftRemedies.forEach(remedy => {
            if (!groups.has(remedy.newStartTime)) {
                groups.set(remedy.newStartTime, []);
            }
            groups.get(remedy.newStartTime)!.push(remedy);
        });
        return Array.from(groups.entries()).sort((a,b) => a[0] - b[0]);
    }, [timeShiftRemedies]);


    return (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center animate-fade-in" onClick={onCancel}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-orange-500/50 flex flex-col h-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-orange-900/20 flex items-center space-x-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <h2 className="text-xl font-bold text-orange-400">NEO - Suggestions for {event.flightNumber}</h2>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    <fieldset className="p-4 border border-red-500/50 rounded-lg bg-red-900/10">
                        <legend className="px-2 text-sm font-semibold text-red-300">Detected Hard Errors</legend>
                        <ul className="mt-2 space-y-1 text-sm text-red-200 list-disc list-inside">
                            {errors.map((error, index) => <li key={index}>{error}</li>)}
                        </ul>
                    </fieldset>

                    {remedies.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-lg text-gray-400">NEO could not find any available solution.</p>
                            <p className="text-sm text-gray-500 mt-2">Manual intervention is required.</p>
                        </div>
                    ) : (
                        <>
                            {traineeSwapRemedies.length > 0 && (
                                <fieldset className="p-4 border border-gray-600 rounded-lg">
                                    <legend className="px-2 text-sm font-semibold text-gray-300">Trainee Swap Options</legend>
                                    <div className="mt-2 space-y-2">
                                        {traineeSwapRemedies.map((remedy, index) => (
                                            <button 
                                                key={index} 
                                                onClick={() => onApplyRemedy(remedy)} 
                                                className="w-full text-left p-3 bg-gray-700/50 rounded-md hover:bg-sky-700 transition-colors"
                                            >
                                                <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-x-4 text-sm w-full">
                                                    <span className="font-mono text-gray-500 text-right">{remedy.trainee.rank}</span>
                                                    <p className="font-semibold text-white truncate">{remedy.trainee.name.split(' – ')[0]}</p>
                                                    <div className="text-center w-10"><span className="text-gray-400 text-xs">FLT</span><br/><span className="font-mono">{remedy.trainee.flightsToday}</span></div>
                                                    <div className="text-center w-10"><span className="text-gray-400 text-xs">FTD</span><br/><span className="font-mono">{remedy.trainee.ftdsToday}</span></div>
                                                    <div className="text-center w-10"><span className="text-gray-400 text-xs">CPT</span><br/><span className="font-mono">{remedy.trainee.cptsToday}</span></div>
                                                    <div className="text-center w-10"><span className="text-gray-400 text-xs">GRD</span><br/><span className="font-mono">{remedy.trainee.groundToday}</span></div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>
                            )}
                            
                            {instructorSwapRemedies.length > 0 && (
                                <fieldset className="p-4 border border-gray-600 rounded-lg">
                                    <legend className="px-2 text-sm font-semibold text-gray-300">Instructor Swap Options (Current Time)</legend>
                                    <div className="mt-2 space-y-2">
                                        {instructorSwapRemedies.map((remedy, index) => (
                                            <button 
                                                onClick={() => {
                                                    console.log('🔘 NeoRemedyFlyout: Instructor button clicked', remedy);
                                                    onApplyRemedy(remedy);
                                                }} 
                                                className="w-full text-left p-3 bg-gray-700/50 rounded-md hover:bg-sky-700 transition-colors"
                                            >
                                                <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-x-4 text-sm w-full">
                                                    <span className="font-mono text-gray-500 text-right">{remedy.instructor.rank}</span>
                                                    <p className="font-semibold text-white truncate">{remedy.instructor.name}</p>
                                                    <div className="text-center w-10"><span className="text-gray-400 text-xs">FLT</span><br/><span className="font-mono">{remedy.instructor.flightsToday}</span></div>
                                                    <div className="text-center w-10"><span className="text-gray-400 text-xs">FTD</span><br/><span className="font-mono">{remedy.instructor.ftdsToday}</span></div>
                                                    <div className="text-center w-10"><span className="text-gray-400 text-xs">CPT</span><br/><span className="font-mono">{remedy.instructor.cptsToday}</span></div>
                                                    <div className="text-center w-10"><span className="text-gray-400 text-xs">GRD</span><br/><span className="font-mono">{remedy.instructor.groundToday}</span></div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>
                            )}

                            {groupedTimeShifts.length > 0 && (
                                <fieldset className="p-4 border border-gray-600 rounded-lg">
                                    <legend className="px-2 text-sm font-semibold text-gray-300">Time Shift & Instructor Options</legend>
                                    <div className="mt-2 space-y-4">
                                        {groupedTimeShifts.map(([startTime, remediesForTime]) => (
                                            <div key={startTime} className="p-3 bg-gray-700/20 rounded-lg">
                                                <h4 className="font-bold text-sky-400 mb-2">New Start Time: {formatTime(startTime)}</h4>
                                                <div className="space-y-1">
                                                {remediesForTime.map((remedy, index) => (
                                                    <button 
                                                        key={index} 
                                                        onClick={() => {
                                                            console.log('🔘 NeoRemedyFlyout: Time shift instructor button clicked', remedy);
                                                            onApplyRemedy(remedy);
                                                        }} 
                                                        className="w-full text-left p-2 bg-gray-700/50 rounded-md hover:bg-sky-700 transition-colors"
                                                    >
                                                         <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-x-3 w-full">
                                                            <span className="font-mono text-gray-500 text-right text-xs">{remedy.instructor.rank}</span>
                                                            <p className="font-semibold text-white truncate text-sm">{remedy.instructor.name}</p>
                                                            <div className="text-center w-10"><span className="text-gray-500 text-[10px]">FLT</span><br/><span className="font-mono text-xs">{remedy.instructor.flightsToday}</span></div>
                                                            <div className="text-center w-10"><span className="text-gray-500 text-[10px]">FTD</span><br/><span className="font-mono text-xs">{remedy.instructor.ftdsToday}</span></div>
                                                            <div className="text-center w-10"><span className="text-gray-500 text-[10px]">CPT</span><br/><span className="font-mono text-xs">{remedy.instructor.cptsToday}</span></div>
                                                            <div className="text-center w-10"><span className="text-gray-500 text-[10px]">GRD</span><br/><span className="font-mono text-xs">{remedy.instructor.groundToday}</span></div>
                                                        </div>
                                                    </button>
                                                ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </fieldset>
                            )}
                        </>
                    )}
                </div>

                <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NeoRemedyFlyout;
