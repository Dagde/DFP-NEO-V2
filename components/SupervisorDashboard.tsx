import React, { useMemo } from 'react';
import { Instructor, Trainee, ScheduleEvent } from '../types';
import UnavailabilitiesWindow from './UnavailabilitiesWindow';
import TafWeatherWidget from './TafWeatherWidget';
import FlightTrackingWidget from './FlightTrackingWidget';

interface SupervisorDashboardProps {
    instructorsData: Instructor[];
    traineesData: Trainee[];
    date: string;
    events: ScheduleEvent[];
    school: string;
    currentLocation: string;
    currentLocationProfile?: {
        code?: string | null;
        name?: string | null;
        latitude?: number | null;
        longitude?: number | null;
    } | null;
    flightAuthorisationRequired?: boolean;
    onNavigate: (view: string) => void;
    onOpenAuth: (event: ScheduleEvent) => void;
}

const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getPersonDisplayName = (person: any): string => (
    String(person?.displayName || person?.name || person?.fullName || 'Unnamed').trim() || 'Unnamed'
);

const hasTmufOrMedicalUnavailability = (person: any): boolean => (
    person?.unavailability?.some((item: any) => {
        const reason = String(item?.reason || '').toLowerCase();
        return reason.includes('tmuf') || reason.includes('medical');
    }) || false
);

const hasOtherUnavailability = (person: any): boolean => (
    person?.unavailability?.some((item: any) => {
        const reason = String(item?.reason || '').trim();
        const lowerReason = reason.toLowerCase();
        return reason && !lowerReason.includes('tmuf') && !lowerReason.includes('medical') && lowerReason !== 'leave';
    }) || false
);

const PersonnelCountRow: React.FC<{
    label: string;
    count: number;
    countClassName: string;
    people?: any[];
    tooltipTitle?: string;
}> = ({ label, count, countClassName, people = [], tooltipTitle }) => {
    const names = people.map(getPersonDisplayName).filter(Boolean).sort((a, b) => a.localeCompare(b));
    const hasNames = names.length > 0;
    return (
        <div className="group relative flex items-center justify-between rounded bg-gray-700/50 p-2">
            <span className="text-sm text-white">{label}</span>
            <span className={`font-semibold ${countClassName}`}>{count}</span>
            {hasNames && (
                <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden w-64 -translate-y-1/2 rounded-md border border-gray-600 bg-gray-950 p-3 text-left shadow-2xl shadow-black/40 group-hover:block">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">{tooltipTitle || label}</p>
                    <div className="max-h-56 overflow-y-auto pr-1">
                        {names.map((name, index) => (
                            <p key={`${name}-${index}`} className="border-t border-gray-800 py-1 text-xs font-medium text-gray-100 first:border-t-0">
                                {name}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ instructorsData, traineesData, date, events, school, currentLocation, currentLocationProfile, flightAuthorisationRequired = true, onNavigate, onOpenAuth }) => {
    
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

    // Calculate personnel statistics
    const onLeaveInstructorList = instructorsData.filter(i => i.isPaused);
    const tmufInstructorList = instructorsData.filter(hasTmufOrMedicalUnavailability);
    const otherUnavailInstructorList = instructorsData.filter(hasOtherUnavailability);
    const activeInstructors = instructorsData.filter(i => !i.isPaused).length;
    const onLeaveInstructors = onLeaveInstructorList.length;
    const tmufInstructors = tmufInstructorList.length;
    const otherUnavailInstructors = otherUnavailInstructorList.length;
    const totalInstructors = instructorsData.length;

    const onLeaveTraineeList = traineesData.filter(t => t.isPaused);
    const tmufTraineeList = traineesData.filter(hasTmufOrMedicalUnavailability);
    const otherUnavailTraineeList = traineesData.filter(hasOtherUnavailability);
    const activeTrainees = traineesData.filter(t => !t.isPaused).length;
    const onLeaveTrainees = onLeaveTraineeList.length;
    const tmufTrainees = tmufTraineeList.length;
    const otherUnavailTrainees = otherUnavailTraineeList.length;
    const totalTrainees = traineesData.length;

    return (
        <div className="h-full min-h-0 w-full overflow-auto bg-gray-900">
            <div className="mx-auto flex min-w-[760px] max-w-7xl flex-col space-y-6 p-6">
                <header>
                    <h1 className="text-3xl font-bold text-white">Supervisor Dashboard</h1>
                    <p className="text-lg text-gray-400">Overview of personnel and program status for today.</p>
                </header>

                {/* Top row: AUTH, TAF, and flight tracking */}
                <div className="flex flex-wrap items-stretch gap-6">
                    {/* AUTH Window */}
                    <div className="flex flex-col bg-gray-800 rounded-lg shadow-lg border border-gray-700 flex-1 min-w-[350px] max-w-md min-h-[34rem]">
                        <h2 className="p-4 text-lg font-semibold text-gray-200 border-b border-gray-700 text-center">
                            AUTH
                        </h2>
                        <div className="p-4 space-y-3 flex-1">
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
                                            <button
                                                onClick={() => {
                                                    if (flightAuthorisationRequired) onOpenAuth(event);
                                                }}
                                                disabled={!flightAuthorisationRequired}
                                                className={`px-3 py-1 text-white rounded-md text-xs font-semibold ${flightAuthorisationRequired ? 'bg-sky-600 hover:bg-sky-700' : 'bg-gray-600 cursor-not-allowed opacity-60'}`}
                                                title={flightAuthorisationRequired ? undefined : 'Flight authorisation is optional for this unit'}
                                            >
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
                                onClick={() => {
                                    if (flightAuthorisationRequired) onNavigate('AUTH');
                                }}
                                disabled={!flightAuthorisationRequired}
                                className={`w-full text-center px-4 py-2 rounded-md transition-colors font-semibold btn-green-brushed ${flightAuthorisationRequired ? '' : 'opacity-50 cursor-not-allowed'}`}
                                title={flightAuthorisationRequired ? undefined : 'Flight authorisation is optional for this unit'}
                            >
                                Go to Flight Authorisation
                            </button>
                        </div>
                    </div>

                    {/* Weather Widget */}
                    <div className="flex flex-col bg-gray-800 rounded-lg shadow-lg border border-gray-700 flex-1 min-w-[350px] max-w-md min-h-[34rem]">
                        <h2 className="p-4 text-lg font-semibold text-gray-200 border-b border-gray-700 text-center">
                            Weather (TAF)
                        </h2>
                        <div className="p-0 flex-1 flex flex-col">
                            <TafWeatherWidget defaultLocationCodes={[currentLocationProfile?.code || school]} />
                        </div>
                    </div>

                    {/* Flight Tracking Widget */}
                    <div className="flex flex-col bg-gray-800 rounded-lg shadow-lg border border-gray-700 flex-1 min-w-[350px] max-w-md min-h-[34rem]">
                        <h2 className="p-4 text-lg font-semibold text-gray-200 border-b border-gray-700 text-center">
                            Flight Tracking
                        </h2>
                        <div className="p-0 flex-1 flex flex-col">
                            <FlightTrackingWidget school={school} locationName={currentLocation} locationProfile={currentLocationProfile} />
                        </div>
                    </div>
                </div>

                {/* Bottom row: Personnel Management and Unavailability */}
                <div className="flex flex-wrap gap-6">
                    {/* Personnel Management */}
                    <div className="flex flex-col bg-gray-800 rounded-lg shadow-lg border border-gray-700 h-fit flex-1 min-w-[350px] max-w-md">
                        <h2 className="p-4 text-lg font-semibold text-gray-200 border-b border-gray-700 text-center">
                            Personnel Management
                        </h2>
                        <div className="p-4 space-y-6">
                            {/* Staff Section */}
                            <div>
                                <h3 className="text-sm font-semibold text-sky-400 mb-3">Staff</h3>
                                <div className="space-y-2">
                                    <PersonnelCountRow label="Active" count={activeInstructors} countClassName="text-green-400" />
                                    <PersonnelCountRow label="On Leave" count={onLeaveInstructors} countClassName="text-yellow-400" people={onLeaveInstructorList} tooltipTitle="Staff on leave" />
                                    <PersonnelCountRow label="TMUF" count={tmufInstructors} countClassName="text-orange-400" people={tmufInstructorList} tooltipTitle="Staff TMUF / medical" />
                                    <PersonnelCountRow label="Other Unavailability" count={otherUnavailInstructors} countClassName="text-red-400" people={otherUnavailInstructorList} tooltipTitle="Staff other unavailability" />
                                    <div className="flex justify-between items-center p-2 bg-gray-600/50 rounded border-t border-gray-600">
                                        <span className="text-white text-sm font-medium">Total</span>
                                        <span className="text-gray-300 font-bold">{totalInstructors}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Trainees Section */}
                            <div>
                                <h3 className="text-sm font-semibold text-sky-400 mb-3">Trainees</h3>
                                <div className="space-y-2">
                                    <PersonnelCountRow label="Active" count={activeTrainees} countClassName="text-green-400" />
                                    <PersonnelCountRow label="On Leave" count={onLeaveTrainees} countClassName="text-yellow-400" people={onLeaveTraineeList} tooltipTitle="Trainees on leave" />
                                    <PersonnelCountRow label="TMUF" count={tmufTrainees} countClassName="text-orange-400" people={tmufTraineeList} tooltipTitle="Trainees TMUF / medical" />
                                    <PersonnelCountRow label="Other Unavailability" count={otherUnavailTrainees} countClassName="text-red-400" people={otherUnavailTraineeList} tooltipTitle="Trainees other unavailability" />
                                    <div className="flex justify-between items-center p-2 bg-gray-600/50 rounded border-t border-gray-600">
                                        <span className="text-white text-sm font-medium">Total</span>
                                        <span className="text-gray-300 font-bold">{totalTrainees}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-700 space-y-2">
                            <button 
                                onClick={() => onNavigate && onNavigate('Instructors')}
                                className="w-full px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold transition-colors"
                            >
                                Manage Staff
                            </button>
                            <button 
                                onClick={() => onNavigate && onNavigate('CourseRoster')}
                                className="w-full px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold transition-colors"
                            >
                                Manage Trainees
                            </button>
                        </div>
                    </div>

                    {/* Unavailability Window */}
                    <div className="flex flex-col bg-gray-800 rounded-lg shadow-lg border border-gray-700 h-fit flex-1 min-w-[350px] max-w-md">
                        <h2 className="p-4 text-lg font-semibold text-gray-200 border-b border-gray-700 text-center">
                            Unavailability Management
                        </h2>
                        <UnavailabilitiesWindow 
                            instructorsData={instructorsData}
                            traineesData={traineesData}
                            date={date}
                            title="Today's Unavailabilities"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupervisorDashboard;
