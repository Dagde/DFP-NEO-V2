import React, { useMemo } from 'react';
import { Instructor, Trainee, UnavailabilityPeriod, ScheduleEvent } from '../types';

// Helper to format date string as ddMmmYY
const formatDateForDisplay = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    const dayStr = String(dateObj.getUTCDate()).padStart(2, '0');
    const monthStr = dateObj.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
    const yearStr = String(dateObj.getUTCFullYear()).slice(-2);
    return `${dayStr}${monthStr}${yearStr}`;
};

// Helper to format time string from HH:mm to HHMM
const formatMilitaryTime = (timeString: string | undefined): string => {
    if (!timeString) return '';
    return timeString.replace(':', '');
};

const formatEventTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getRole = (event: ScheduleEvent, personName: string): string => {
    if (event.instructor === personName) return 'Instructor';
    if (event.student === personName) return 'Student';
    if (event.pilot === personName) return 'Pilot';
    if (event.attendees?.includes(personName)) return 'Attendee';
    return 'Unknown Role';
};

interface PersonEntryProps {
    person: {
        name: string;
        rank: string;
        period?: UnavailabilityPeriod;
        scheduledEvents: ScheduleEvent[];
    };
    status?: string;
}

const PersonEntry: React.FC<PersonEntryProps> = ({ person, status }) => {
    const timeDisplay = useMemo(() => {
        if (status) return status;
        if (!person.period) return 'N/A';
    
        const { startDate, endDate, allDay, startTime, endTime } = person.period;
        const startDisplayDate = formatDateForDisplay(startDate);
    
        if (allDay) {
            const lastDayOfUnavailability = new Date(`${endDate}T00:00:00Z`);
            lastDayOfUnavailability.setUTCDate(lastDayOfUnavailability.getUTCDate() - 1);
            const lastDayStr = lastDayOfUnavailability.toISOString().split('T')[0];
            const lastDayDisplay = formatDateForDisplay(lastDayStr);
    
            return startDate === lastDayStr ? `${startDisplayDate} All Day` : `${startDisplayDate} to ${lastDayDisplay}`;
        } else {
            const endDisplayDate = formatDateForDisplay(endDate);
            const startTimeDisplay = formatMilitaryTime(startTime);
            const endTimeDisplay = formatMilitaryTime(endTime);
            
            return startDate === endDate
                ? `${startTimeDisplay} ${startDisplayDate} - ${endTimeDisplay} ${endDisplayDate}`
                : `${startTimeDisplay} ${startDisplayDate} to ${endTimeDisplay} ${endDisplayDate}`;
        }
    }, [person.period, status]);

    return (
        <li className="p-3 bg-gray-700/50 rounded-md text-sm space-y-3">
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <span className="font-mono text-gray-500 w-12 text-right">{person.rank}</span>
                    <span className="font-semibold text-white">{person.name.split(' – ')[0]}</span>
                </div>
                <div className="text-right">
                    <span className={`font-medium ${status ? 'text-amber-300' : 'text-gray-300'}`}>{status ? '' : person.period?.reason}</span>
                    <span className={`font-mono ml-3 ${status ? 'text-amber-300' : 'text-gray-300'}`}>{timeDisplay}</span>
                </div>
            </div>
            {person.scheduledEvents.length > 0 && (
                <div className="pl-16 border-t border-gray-600/50 pt-3">
                    <h4 className="text-xs font-semibold text-amber-300 mb-2">Scheduled Events for this Day:</h4>
                    <ul className="space-y-1">
                        {person.scheduledEvents.sort((a,b) => a.startTime - b.startTime).map(event => (
                            <li key={event.id} className="flex justify-between items-center text-xs p-1.5 bg-gray-900/40 rounded">
                                <span className="font-mono text-gray-300">{formatEventTime(event.startTime)}</span>
                                <span className="font-semibold text-sky-400">{event.flightNumber}</span>
                                <span className="text-gray-400 w-24 text-right">{getRole(event, person.name)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </li>
    );
};

interface UnavailabilityReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  instructors: Instructor[];
  trainees: Trainee[];
  events: ScheduleEvent[];
}

const UnavailabilityReportModal: React.FC<UnavailabilityReportModalProps> = ({ 
    isOpen, 
    onClose, 
    date, 
    instructors, 
    trainees,
    events
}) => {
    if (!isOpen) return null;

    const { unavailableStaff, unavailableTrainees, pausedTrainees } = useMemo(() => {
        const staff: PersonEntryProps['person'][] = [];
        instructors.forEach(instructor => {
            (instructor.unavailability || []).forEach(period => {
                const isInDateRange = period.allDay
                    ? (date >= period.startDate && date < period.endDate)
                    : (date >= period.startDate && date <= period.endDate);
                
                if (isInDateRange) {
                    const scheduledEvents = events.filter(e => 
                        e.instructor === instructor.name ||
                        e.student === instructor.name || 
                        e.attendees?.includes(instructor.name)
                    );
                    staff.push({ name: instructor.name, rank: instructor.rank, period, scheduledEvents });
                }
            });
        });

        const traineesUnavailable: PersonEntryProps['person'][] = [];
        const paused: PersonEntryProps['person'][] = [];
        trainees.forEach(trainee => {
            const scheduledEvents = events.filter(e => 
                e.student === trainee.fullName || 
                e.pilot === trainee.fullName ||
                e.attendees?.includes(trainee.fullName)
            );

            if (trainee.isPaused) {
                paused.push({ name: trainee.fullName, rank: trainee.rank, scheduledEvents });
            } else {
                (trainee.unavailability || []).forEach(period => {
                    const isInDateRange = period.allDay
                        ? (date >= period.startDate && date < period.endDate)
                        : (date >= period.startDate && date <= period.endDate);
                    
                    if (isInDateRange) {
                        traineesUnavailable.push({ name: trainee.fullName, rank: trainee.rank, period, scheduledEvents });
                    }
                });
            }
        });
        
        return { 
            unavailableStaff: staff.sort((a,b) => a.name.localeCompare(b.name)), 
            unavailableTrainees: traineesUnavailable.sort((a,b) => a.name.localeCompare(b.name)),
            pausedTrainees: paused.sort((a,b) => a.name.localeCompare(b.name))
        };
    }, [instructors, trainees, date, events]);

    const formattedHeaderDate = useMemo(() => {
        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    }, [date]);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl h-[80vh] flex flex-col border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Unavailabilities & Conflicts for {formattedHeaderDate}</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close modal">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 p-6 overflow-y-auto space-y-6">
                    <div>
                        <h3 className="font-semibold text-sky-400 mb-2">Staff</h3>
                        {unavailableStaff.length > 0 ? (
                            <ul className="space-y-3">
                                {unavailableStaff.map(u => <PersonEntry key={`${u.name}-${u.period?.id}`} person={u} />)}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500 italic">No staff unavailable.</p>
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-sky-400 mb-2">Trainees</h3>
                        {(unavailableTrainees.length > 0 || pausedTrainees.length > 0) ? (
                            <ul className="space-y-3">
                                {pausedTrainees.map(u => <PersonEntry key={u.name} person={u} status="Paused/NTSC" />)}
                                {unavailableTrainees.map(u => <PersonEntry key={`${u.name}-${u.period?.id}`} person={u} />)}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500 italic">No trainees unavailable.</p>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">Close</button>
                </div>
            </div>
        </div>
    );
};

export default UnavailabilityReportModal;