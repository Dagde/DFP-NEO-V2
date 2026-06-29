import React, { useState, useEffect, useMemo } from 'react';
import { AirCombatTrainingReport, Instructor, ScheduleEvent, SctRequest, Pt051Assessment } from '../types';
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
    trainingReportsToComplete?: Array<{ report: AirCombatTrainingReport; staff: Instructor }>;
    onSelectTrainingReport?: (entry: { report: AirCombatTrainingReport; staff: Instructor }) => void;
    staffOptions?: Instructor[];
    selectedStaffName?: string;
    onSelectStaffName?: (staffName: string) => void;
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

const DASHBOARD_RANK_ORDER = ['WGCDR', 'SQNLDR', 'FLTLT', 'FLGOFF', 'PLTOFF', 'Mr'];

const getDashboardRankWeight = (rank?: string): number => {
    const index = DASHBOARD_RANK_ORDER.indexOf(String(rank || ''));
    return index === -1 ? DASHBOARD_RANK_ORDER.length : index;
};

const formatDashboardStaffName = (staff: Instructor): string => {
    const [lastName, firstName] = String(staff.name || '').split(',').map(part => part.trim());
    const displayName = firstName ? `${firstName} ${lastName}` : staff.name;
    return `${staff.rank || ''} ${displayName}`.trim();
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
    onSelectPt051,
    trainingReportsToComplete = [],
    onSelectTrainingReport,
    staffOptions = [],
    selectedStaffName,
    onSelectStaffName,
}) => {
    const sortedEvents = [...events].sort((a, b) => a.startTime - b.startTime);
    const groupedStaffOptions = useMemo(() => {
        const sortedStaff = [...staffOptions]
            .filter(staff => staff?.name)
            .sort((a, b) => (
                String(a.unit || 'No Unit').localeCompare(String(b.unit || 'No Unit')) ||
                getDashboardRankWeight(a.rank) - getDashboardRankWeight(b.rank) ||
                String(a.name || '').localeCompare(String(b.name || ''))
            ));
        const groups = new Map<string, Instructor[]>();
        sortedStaff.forEach(staff => {
            const unit = String(staff.unit || 'No Unit');
            groups.set(unit, [...(groups.get(unit) || []), staff]);
        });
        return Array.from(groups.entries()).map(([unit, staff]) => ({ unit, staff }));
    }, [staffOptions]);
    const dashboardSelectedName = selectedStaffName || userName;
    
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

    const EventRow: React.FC<{event: ScheduleEvent}> = ({event}) => {
        const isStby = event.resourceId && (
            event.resourceId.startsWith('STBY') ||
            event.resourceId.startsWith('BNF-STBY') ||
            event.resourceId.startsWith('FTD-STBY')
        );
        return (
            <li className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
                <div className="flex items-center space-x-4">
                    <span className={`w-3 h-3 rounded-full ${event.color}`}></span>
                    <div>
                        <div className="flex items-center space-x-2">
                            <p className="font-semibold text-white">{event.flightNumber}</p>
                            {isStby && (
                                <span className="px-1.5 py-0.5 text-xs font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 tracking-wide">
                                    STBY
                                </span>
                            )}
                        </div>
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
    };

    return (
        <div className="flex flex-col bg-gray-900 overflow-y-auto p-6 space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-white">My Dashboard</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="text-lg text-gray-400">Welcome,</span>
                    {groupedStaffOptions.length > 0 && onSelectStaffName ? (
                        <select
                            value={dashboardSelectedName}
                            onChange={(event) => onSelectStaffName(event.target.value)}
                            className="min-w-[280px] rounded-md border border-sky-500/40 bg-gray-950 px-3 py-2 text-lg font-semibold text-white shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                        >
                            {groupedStaffOptions.map(group => (
                                <optgroup key={group.unit} label={group.unit}>
                                    {group.staff.map(staff => (
                                        <option key={`${staff.unit || 'unit'}-${staff.idNumber}-${staff.name}`} value={staff.name}>
                                            {formatDashboardStaffName(staff)}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    ) : (
                        <span className="text-lg text-gray-400">{userRank} {userName}</span>
                    )}
                </div>
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
                    {incompletePt051s.length > 0 || trainingReportsToComplete.length > 0 ? (
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
                            {trainingReportsToComplete.map(entry => (
                                <li key={entry.report.id} className="p-3 bg-gray-700/50 rounded-md hover:bg-gray-700 transition-colors">
                                    <button
                                        onClick={() => onSelectTrainingReport?.(entry)}
                                        className="w-full text-left"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold text-white">{entry.report.eventCode}</p>
                                                <p className="text-sm text-gray-400">{entry.report.staffName}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-gray-300 font-mono">{formatDate(entry.report.date)}</p>
                                                <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300">
                                                    Training Report
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
