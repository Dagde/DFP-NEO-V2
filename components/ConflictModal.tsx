import React from 'react';
import { ScheduleEvent } from '../types';

interface Conflict {
  conflictingEvent: ScheduleEvent;
  newEvent: ScheduleEvent;
  conflictedPerson: 'instructor' | 'trainee';
  personName: string;
}

interface ConflictModalProps {
  conflict: Conflict;
  onResolve: (resolution: 'changeTime' | 'changePerson') => void;
  onCancel: () => void;
}

const ConflictModal: React.FC<ConflictModalProps> = ({ conflict, onResolve, onCancel }) => {
  const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const conflictingEventEndTime = conflict.conflictingEvent.startTime + conflict.conflictingEvent.duration;
  const personTypeDisplay = conflict.conflictedPerson === 'instructor' ? 'Instructor' : 'Trainee';
  const existingEventTypeDisplay = conflict.conflictingEvent.type === 'ftd' ? 'FTD session' : 'flight';
  const newEventTypeDisplay = conflict.newEvent.type === 'ftd' ? 'FTD session' : 'flight';

  return (
    <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center">
      <div 
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-red-500/50 transform transition-all animate-fade-in"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        aria-describedby="conflict-description"
      >
        <div className="p-4 border-b border-gray-700 flex items-center space-x-3 bg-red-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 id="conflict-title" className="text-xl font-bold text-red-400">Scheduling Conflict</h2>
        </div>
        
        <div className="p-6 text-gray-300" id="conflict-description">
          <p className="mb-2">
            <strong className="text-white">{conflict.personName}</strong> is already scheduled for a{' '}
            <strong className="text-white">{existingEventTypeDisplay}</strong> ({conflict.conflictingEvent.flightNumber}) from{' '}
            <strong className="text-white">{formatTime(conflict.conflictingEvent.startTime)}</strong> to{' '} 
            <strong className="text-white">{formatTime(conflictingEventEndTime)}</strong>.
          </p>
          <p className="mb-4">This conflicts with the new <strong className="text-white">{newEventTypeDisplay}</strong> you are trying to schedule.</p>
          <p>Please choose an option to resolve this conflict.</p>
        </div>
        
        <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
          <button 
            onClick={() => onResolve('changeTime')}
            className="w-full sm:w-auto px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold"
          >
            Change Time
          </button>
          <button 
            onClick={() => onResolve('changePerson')}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-sm font-semibold"
          >
            Replace {personTypeDisplay}
          </button>
          <button 
            onClick={onCancel} 
            className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-semibold"
          >
            Cancel & Delete Tile
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictModal;
