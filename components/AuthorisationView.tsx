import React, { useMemo } from 'react';
import { ScheduleEvent } from '../types';

interface AuthorisationViewProps {
  date: string;
  onDateChange: (increment: number) => void;
  events: ScheduleEvent[];
  onOpenAuth: (event: ScheduleEvent) => void;
}

const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const AuthorisationView: React.FC<AuthorisationViewProps> = ({ date, onDateChange, events, onOpenAuth }) => {

    const formattedDisplayDate = useMemo(() => {
        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        return dateObj.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC'
        });
    }, [date]);

    const flightsForDay = useMemo(() => {
        return events
            .filter(e => e.type === 'flight')
            .sort((a, b) => a.startTime - b.startTime);
    }, [events]);

    const getStatus = (event: ScheduleEvent) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const isFullySigned = !!(event.authoSignedBy && event.captainSignedBy);
    
        // 1. Fully Authorised (highest priority status, applies to all dates)
        if (isFullySigned) {
            return { text: 'Fully Authorised', textColor: 'text-green-400', bgColor: 'bg-green-400/20' };
        }
    
        // 2. Logic for CURRENT DAY's flights
        if (event.date === todayStr) {
            const nowInHours = new Date().getHours() + new Date().getMinutes() / 60;
            const endTime = event.startTime + event.duration;
            
            // Lapsed (for today's flights that are over)
            if (nowInHours >= endTime) {
                return { text: 'Unauthorised - Lapsed', textColor: 'text-sky-400', bgColor: 'bg-sky-400/20' };
            }
    
            // Awaiting PIC
            if (event.authoSignedBy || event.isVerbalAuth) {
                return { text: 'Awaiting PIC', textColor: 'text-sky-400', bgColor: 'bg-sky-400/20' };
            }
            
            // Time-based warnings for upcoming unsigned flights
            const timeUntilStart = event.startTime - nowInHours;
            if (timeUntilStart <= 0.25) { // Urgent
                return { text: 'Auth Required (Urgent)', textColor: 'text-red-500', bgColor: 'bg-red-500/20' };
            }
            if (timeUntilStart <= 2) { // Warning
                return { text: 'Auth Required', textColor: 'text-amber-400', bgColor: 'bg-amber-400/20' };
            }
        }
        
        // 3. Logic for PAST dates
        if (new Date(event.date) < new Date(todayStr)) {
            return { text: 'Unauthorised - Lapsed', textColor: 'text-sky-400', bgColor: 'bg-sky-400/20' };
        }
    
        // 4. Default for all other unsigned flights (future, or >2hrs away today)
        return { text: 'Awaiting Auth', textColor: 'text-gray-400', bgColor: 'bg-gray-400/20' };
    };

    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-white">Flight Authorisation</h1>
                    <p className="text-sm text-gray-400">{formattedDisplayDate}</p>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={() => onDateChange(-1)} className="p-2 rounded-md hover:bg-gray-700 text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </button>
                    <button onClick={() => onDateChange(1)} className="p-2 rounded-md hover:bg-gray-700 text-white">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
                    {flightsForDay.length > 0 ? (
                        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                            <table className="min-w-full divide-y divide-gray-700">
                                <thead className="bg-gray-700/50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Time (LT)</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Callsign</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Crew</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">Manage Auth</span></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-gray-800 divide-y divide-gray-700">
                                    {flightsForDay.map(event => {
                                        const status = getStatus(event);
                                        return (
                                            <tr key={event.id} className="hover:bg-gray-700/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-300">{formatTime(event.startTime)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-white">{event.flightNumber}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{event.instructor} / {event.student || event.pilot}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.bgColor} ${status.textColor}`}>
                                                        {status.text}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button onClick={() => onOpenAuth(event)} className="text-sky-400 hover:text-sky-300">
                                                        Manage
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            <h3 className="mt-2 text-sm font-medium text-gray-400">No Flights Scheduled</h3>
                            <p className="mt-1 text-sm text-gray-500">There are no flights on the program for this day.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthorisationView;