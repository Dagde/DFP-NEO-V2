import React, { useMemo } from 'react';
import { Instructor, Trainee, UnavailabilityPeriod } from '../types';

interface UnavailabilitiesWindowProps {
    instructorsData: Instructor[];
    traineesData: Trainee[];
    date: string;
    title?: string;
}

const formatDateForDisplay = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    const dayStr = String(dateObj.getUTCDate()).padStart(2, '0');
    const monthStr = dateObj.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
    const yearStr = String(dateObj.getUTCFullYear()).slice(-2);
    return `${dayStr}${monthStr}${yearStr}`;
};

const formatMilitaryTime = (timeString: string | undefined): string => {
    if (!timeString) return '';
    return timeString.replace(':', '');
};

const UnavailabilityItem: React.FC<{ name: string; rank: string; period?: UnavailabilityPeriod; status?: string; }> = ({ name, rank, period, status }) => {

  const timeDisplay = useMemo(() => {
    if (status) return status;
    if (!period) return 'N/A';
    
    const { startDate, endDate, allDay, startTime, endTime } = period;
    const startDisplayDate = formatDateForDisplay(startDate);
    
    if (allDay) {
        // The end date is exclusive, so the last day of unavailability is the day before.
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
            ? `${startTimeDisplay} ${startDisplayDate} - ${endTimeDisplay}`
            : `${startTimeDisplay} ${startDisplayDate} to ${endTimeDisplay} ${endDisplayDate}`;
    }
  }, [period, status]);

  return (
    <li className="flex justify-between items-center p-2 bg-gray-700/50 rounded-md text-sm">
        <div className="flex items-center space-x-2">
            <span className="font-mono text-gray-500 w-12 text-right">{rank}</span>
            <span className="font-semibold text-white">{name.split(' – ')[0]}</span>
        </div>
        <div className="text-right">
            <span className={`font-medium ${status ? 'text-amber-300' : 'text-gray-300'}`}>{status ? '' : period?.reason}</span>
            <span className={`font-mono ml-3 ${status ? 'text-amber-300' : 'text-gray-300'}`}>{timeDisplay}</span>
        </div>
    </li>
  );
};


const UnavailabilitiesWindow: React.FC<UnavailabilitiesWindowProps> = ({ instructorsData, traineesData, date, title }) => {
    const formattedHeaderDate = useMemo(() => {
        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    }, [date]);
    
    const { staffUnavailabilities, traineeUnavailabilities, pausedTrainees } = useMemo(() => {
        const staff: { name: string; rank: string; period: UnavailabilityPeriod }[] = [];
        instructorsData.forEach(instructor => {
            (instructor.unavailability || []).forEach(period => {
                const isInDateRange = period.allDay
                    ? (date >= period.startDate && date < period.endDate)
                    : (date >= period.startDate && date <= period.endDate);

                if (isInDateRange) {
                    staff.push({ name: instructor.name, rank: instructor.rank, period });
                }
            });
        });

        const trainees: { name: string; rank: string; period: UnavailabilityPeriod }[] = [];
        const paused: { name: string; rank: string }[] = [];
        traineesData.forEach(trainee => {
            if (trainee.isPaused) {
                paused.push({ name: trainee.name, rank: trainee.rank });
            } else {
                (trainee.unavailability || []).forEach(period => {
                    const isInDateRange = period.allDay
                        ? (date >= period.startDate && date < period.endDate)
                        : (date >= period.startDate && date <= period.endDate);

                    if (isInDateRange) {
                        trainees.push({ name: trainee.fullName, rank: trainee.rank, period });
                    }
                });
            }
        });
        return { 
            staffUnavailabilities: staff.sort((a,b) => a.name.localeCompare(b.name)), 
            traineeUnavailabilities: trainees.sort((a,b) => (a.name ?? 'Unknown').localeCompare(b.name ?? 'Unknown')),
            pausedTrainees: paused.sort((a,b) => (a.name ?? 'Unknown').localeCompare(b.name ?? 'Unknown'))
        };
    }, [instructorsData, traineesData, date]);

    return (
        <div className="flex flex-col bg-gray-800 rounded-lg shadow-lg border border-gray-700 h-fit flex-1 min-w-[350px] max-w-md">
            <h2 className="p-4 text-lg font-semibold text-gray-200 border-b border-gray-700 text-center">
                {title || `Unavailabilities for ${formattedHeaderDate}`}
            </h2>
            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-20rem)]">
                <div>
                    <h3 className="font-semibold text-sky-400 mb-2">Staff</h3>
                    {staffUnavailabilities.length > 0 ? (
                        <ul className="space-y-2">
                            {staffUnavailabilities.map(u => <UnavailabilityItem key={`${u.name}-${u.period.id}`} {...u} />)}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500 italic">No staff unavailable.</p>
                    )}
                </div>
                <div>
                    <h3 className="font-semibold text-sky-400 mb-2">Trainees</h3>
                    {(traineeUnavailabilities.length > 0 || pausedTrainees.length > 0) ? (
                        <ul className="space-y-2">
                            {pausedTrainees.map(u => <UnavailabilityItem key={u.name} name={u.name} rank={u.rank} status="Paused/NTSC" />)}
                            {traineeUnavailabilities.map(u => <UnavailabilityItem key={`${u.name}-${u.period.id}`} {...u} />)}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500 italic">No trainees unavailable.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnavailabilitiesWindow;