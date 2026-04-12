import React, { useState, useEffect, useMemo } from 'react';
import { ScheduleEvent, SctRequest, Pt051Assessment } from '../types';
import TafWeatherWidget from './TafWeatherWidget';

interface MyDashboardProps {
    userName: string;
    userRank: string;
    events: ScheduleEvent[];
    onSelectEvent: (event: ScheduleEvent) => void;
    onNavigate: (view: string) => void;
    onSelectMyProfile: () => void;
    onSelectMyCurrency: () => void;
    onSelectMySct: () => void;
    sctRequests: SctRequest[];
    pt051Assessments: Map<string, Pt051Assessment>;
    onSelectPt051: (assessment: Pt051Assessment) => void;
}

const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString + 'T00:00:00Z');
        if (isNaN(date.getTime())) return '-';
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase();
        const year = String(date.getUTCFullYear()).slice(-2);
        return `${day}${month}${year}`;
    } catch (e) {
        return '-';
    }
};

const MyDashboard: React.FC<MyDashboardProps> = ({ 
    userName, 
    userRank, 
    events, 
    onSelectEvent, 
    onNavigate, 
    onSelectMyProfile, 
    onSelectMyCurrency, 
    onSelectMySct, 
    sctRequests, 
    pt051Assessments, 
    onSelectPt051 
}) => {
    const sortedEvents = [...events].sort((a, b) => a.startTime - b.startTime);
    
    const mySctRequests = sctRequests.filter(req => req.name === userName.split(' ').reverse().join(', '));
    
    // Get incomplete PT-051 assessments assigned to current user (not yet edited/saved)
    const incompletePt051s = React.useMemo(() => {
        const fullUserName = `${userName.split(' ').reverse().join(', ')}`; // Convert "Joe Bloggs" to "Bloggs, Joe"
        return Array.from(pt051Assessments.values())
            .filter(assessment => 
                !assessment.isCompleted && 
                assessment.instructorName === fullUserName
            )
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [pt051Assessments, userName]);

    const EventRow: React.FC<{event: ScheduleEvent}> = ({event}) => (
        <li className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
            <div className="flex items-center space-x-4">
                <span className={`w-3 h-3 rounded-full ${event.color}`}></span>
                <div>
                    <p className="font-semibold text-white">{event.flightNumber}</p>
                    <p className="text-sm text-gray-400">
                        {event.flightType === 'Solo' ? `Solo: ${event.pilot}` : `w/ ${event.student?.split(' ')[0]}`}
                    </p>
                </div>
            </div>
            <div className="flex items-center space-x-4">
                <span className="font-mono text-gray-300">{formatTime(event.startTime)} - {formatTime(event.startTime + event.duration)}</span>
                <button onClick={() => onSelectEvent(event)} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">
                    Details
                </button>
            </div>
        </li>
    );

    return (
        <div className="flex flex-col bg-gray-900 overflow-y-auto p-6 space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-white">My Dashboard</h1>
                <p className="text-lg text-gray-400">Welcome, {userRank} {userName}</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* My Hub */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold text-sky-400 mb-4">My Hub</h2>
                    <div className="space-y-3">
                        <button onClick={onSelectMyProfile} className="w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-md text-white font-semibold transition-colors">
                            My Profile
                        </button>
                        <button onClick={onSelectMyCurrency} className="w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-md text-white font-semibold transition-colors">
                            My Currency
                        </button>
                        <button onClick={onSelectMySct} className="w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-md text-white font-semibold transition-colors">
                            My SCT
                        </button>
                    </div>
                </div>

                {/* Weather Widget */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                    <TafWeatherWidget />
                </div>
                
                {/* My Active SCT Requests */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold text-sky-400 mb-4">My Active SCT Requests</h2>
                    {mySctRequests.length > 0 ? (
                        <ul className="space-y-2">
                            {mySctRequests.map(req => (
                                <li key={req.id} className="p-2 bg-gray-700/50 rounded-md text-sm">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold text-white">{req.event}</p>
                                        {req.dateRequested && (
                                            <p className="text-xs text-gray-500">{formatDate(req.dateRequested)}</p>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400">Expires: {req.currentExpiry}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-center italic py-4">No active SCT requests.</p>
                    )}
                </div>

                {/* Reports to be completed */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold text-amber-400 mb-4">Reports to be completed</h2>
                    {incompletePt051s.length > 0 ? (
                        <ul className="space-y-2">
                            {incompletePt051s.map(assessment => (
                                <li key={assessment.id} className="p-3 bg-gray-700/50 rounded-md hover:bg-gray-700 transition-colors">
                                    <button 
                                        onClick={() => onSelectPt051(assessment)}
                                        className="w-full text-left"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold text-white">{assessment.flightNumber}</p>
                                                <p className="text-sm text-gray-400">{assessment.trainedFullName}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-gray-300 font-mono">{formatDate(assessment.date)}</p>
                                                <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300">
                                                    Pending
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-center italic py-4">No pending reports.</p>
                    )}
                </div>
            </div>

            {/* Today's Schedule */}
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold text-sky-400 mb-4">Today's Schedule</h2>
                {sortedEvents.length > 0 ? (
                    <ul className="space-y-3">
                        {sortedEvents.map(event => <EventRow key={event.id} event={event} />)}
                    </ul>
                ) : (
                    <p className="text-gray-500 text-center py-8">No events scheduled for today.</p>
                )}
            </div>
        </div>
    );
};

export default MyDashboard;