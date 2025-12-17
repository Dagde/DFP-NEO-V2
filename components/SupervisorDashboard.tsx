import React, { useMemo } from 'react';
import { Instructor, Trainee, ScheduleEvent } from '../types';
import UnavailabilitiesWindow from './UnavailabilitiesWindow';

interface SupervisorDashboardProps {
    instructorsData: Instructor[];
    traineesData: Trainee[];
    date: string;
    events: ScheduleEvent[];
    onNavigate: (view: string) => void;
    onOpenAuth: (event: ScheduleEvent) => void;
}

const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ instructorsData, traineesData, date, events, onNavigate, onOpenAuth }) => {
    
    const flightsNeedingAuth = useMemo(() => {
        const nowInHours = new Date().getHours() + new Date().getMinutes() / 60;
        return events
            .filter(e => 
                e.type === 'flight' && 
                !(e.authoSignedBy && e.captainSignedBy) &&
                (e.startTime + e.duration) > nowInHours // Only show flights that haven't ended
            )
            .sort((a, b) => a.startTime - b.startTime)
            .slice(0, 5);
    }, [events]);

    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-y-auto">
            <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
                <header>
                    <h1 className="text-3xl font-bold text-white">Supervisor Dashboard</h1>
                    <p className="text-lg text-gray-400">Overview of personnel and program status for today.</p>
                </header>

                <div className="flex flex-wrap gap-6">
                     <UnavailabilitiesWindow 
                        instructorsData={instructorsData}
                        traineesData={traineesData}
                        date={date}
                        title="Today's Unavailabilities"
                    />

                    {/* AUTH Window */}
                    <div className="flex flex-col bg-gray-800 rounded-lg shadow-lg border border-gray-700 h-fit flex-1 min-w-[350px] max-w-md">
                        <h2 className="p-4 text-lg font-semibold text-gray-200 border-b border-gray-700 text-center">
                            AUTH
                        </h2>
                        <div className="p-4 space-y-3">
                            {flightsNeedingAuth.length > 0 ? (
                                <ul className="space-y-3">
                                    {flightsNeedingAuth.map(event => (
                                        <li key={event.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
                                            <div className="flex items-center space-x-3">
                                                <span className="font-mono text-gray-300 text-sm">{formatTime(event.startTime)}</span>
                                                <div>
                                                    <p className="font-semibold text-white text-sm">{event.flightNumber}</p>
                                                    <p className="text-xs text-gray-400">
                                                        {event.instructor?.split(',')[0]} / {event.student?.split(',')[0] || event.pilot?.split(',')[0]}
                                                    </p>
                                                </div>
                                            </div>
                                            <button onClick={() => onOpenAuth(event)} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">
                                                Auth
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500 text-center italic py-8">No flights require authorisation.</p>
                            )}
                        </div>
                         <div className="p-4 border-t border-gray-700">
                            <button 
                                onClick={() => onNavigate('AUTH')}
                                className="w-full text-center px-4 py-2 rounded-md transition-colors font-semibold btn-green-brushed"
                            >
                                Go to Flight Authorisation
                            </button>
                        </div>
                    </div>
                </div>
                {/* More dashboard components can be added here in the future */}
            </div>
        </div>
    );
};

export default SupervisorDashboard;