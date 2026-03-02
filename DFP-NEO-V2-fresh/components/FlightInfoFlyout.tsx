
import React from 'react';
import { ScheduleEvent } from '../types';

interface FlightInfoFlyoutProps {
  events: ScheduleEvent[];
  position: { top: number; left: number };
  personName: string;
  personType: 'Instructor' | 'Trainee';
}

const FlightInfoFlyout: React.FC<FlightInfoFlyoutProps> = ({ events, position, personName, personType }) => {
  const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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
          {events.sort((a,b) => a.startTime - b.startTime).map(event => (
            <li key={event.id} className={`p-2 rounded-md border-l-4 ${event.color.replace('bg-', 'border-')}`}>
              <div className="flex justify-between items-center font-semibold text-sm">
                <span>{event.flightNumber}{event.type === 'ftd' && <span className="text-indigo-400 font-bold"> (FTD)</span>}</span>
                <span>{formatTime(event.startTime)}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                <span>{personType === 'Instructor' ? 'Student' : 'Instructor'}: </span>
                <span>{personType === 'Instructor' ? event.student : event.instructor}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400 text-sm">No flights scheduled for today.</p>
      )}
    </div>
  );
};

export default FlightInfoFlyout;