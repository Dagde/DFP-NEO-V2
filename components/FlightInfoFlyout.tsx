
import React from 'react';
import { ScheduleEvent } from '../types';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, ResourceDisplayNames } from '../utils/resourceDisplayNames';
import { getScheduleEventPersonnelNames, schedulePersonnelNamesMatch } from '../utils/scheduleEventPersonnel';

interface FlightInfoFlyoutProps {
  events: ScheduleEvent[];
  position: { top: number; left: number };
  personName: string;
  personType: 'Instructor' | 'Trainee';
  resourceDisplayNames?: ResourceDisplayNames;
}

const FlightInfoFlyout: React.FC<FlightInfoFlyoutProps> = ({ events, position, personName, personType, resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES }) => {
  const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const getOtherPersonnelText = (event: ScheduleEvent): string => {
    const label = personType === 'Instructor' ? 'Other personnel' : 'Staff/Crew';
    const otherPersonnel = getScheduleEventPersonnelNames(event)
      .filter(name => !schedulePersonnelNamesMatch(name, personName));
    const directCounterpart = personType === 'Instructor' ? event.student : (event.instructor || event.pilot);
    const displayPersonnel = otherPersonnel.length > 0
      ? otherPersonnel
      : (directCounterpart ? [directCounterpart] : []);
    return displayPersonnel.length > 0 ? `${label}: ${displayPersonnel.join(', ')}` : '';
  };

  return (
    <div
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      className="fixed bg-gray-900 border border-sky-500 rounded-lg shadow-2xl z-[60] p-4 w-64 animate-fade-in"
      aria-live="polite"
    >
      <h3 className="text-lg font-bold text-sky-400 mb-2 border-b border-gray-700 pb-2">{personName}</h3>
      {events.length > 0 ? (
        <ul className="space-y-3">
          {events.sort((a,b) => a.startTime - b.startTime).map(event => {
            const otherPersonnelText = getOtherPersonnelText(event);
            return (
              <li key={event.id} className={`p-2 rounded-md border-l-4 ${event.color.replace('bg-', 'border-')}`}>
                <div className="flex justify-between items-center font-semibold text-sm">
                  <span>{event.flightNumber}{event.type === 'ftd' && <span className="text-indigo-400 font-bold"> ({resourceDisplayNames.ftd})</span>}</span>
                  <span>{formatTime(event.startTime)}</span>
                </div>
                {otherPersonnelText && (
                  <div className="text-xs text-gray-400 mt-1">
                    {otherPersonnelText}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-gray-400 text-sm">No events scheduled for this day.</p>
      )}
    </div>
  );
};

export default FlightInfoFlyout;
