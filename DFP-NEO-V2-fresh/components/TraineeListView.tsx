import React, { useState } from 'react';
import { ScheduleEvent, Trainee } from '../types';
import FlightInfoFlyout from './FlightInfoFlyout';
import TraineeProfileFlyout from './TraineeProfileFlyout';

interface TraineeListViewProps {
  onClose: () => void;
  events: ScheduleEvent[];
  traineesData: Trainee[];
  onUpdateTrainee: (data: Trainee) => void;
}

const TraineeListView: React.FC<TraineeListViewProps> = ({ onClose, events, traineesData, onUpdateTrainee }) => {
  const [hoveredTrainee, setHoveredTrainee] = useState<string | null>(null);
  const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLLIElement>, traineeFullName: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTrainee(traineeFullName);
    setFlyoutPosition({ top: rect.top, left: rect.right + 10 });
  };

  const handleMouseLeave = () => {
    setHoveredTrainee(null);
    setFlyoutPosition(null);
  };
  
  const handleTraineeClick = (trainee: Trainee) => {
    setSelectedTrainee(trainee);
  };

  const handleCloseProfile = () => {
    setSelectedTrainee(null);
  };

  const hoveredEvents = hoveredTrainee 
    ? events.filter(f => f.student === hoveredTrainee || (f.flightType === 'Solo' && f.pilot === hoveredTrainee))
    : [];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
        aria-modal="true"
        role="dialog"
        onClick={onClose}
      >
        <div
          className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg h-3/4 flex flex-col border border-gray-700 transform transition-all animate-fade-in"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-lg">
            <h2 id="trainee-list-title" className="text-xl font-bold text-white">Trainees</h2>
            <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close trainees list">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6 overflow-y-auto" aria-labelledby="trainee-list-title">
            <ul className="space-y-2">
              {traineesData.map((trainee) => (
                <li 
                  key={trainee.fullName}
                  className="p-3 bg-gray-700/50 rounded-md text-gray-300 hover:bg-sky-800 hover:text-white transition-colors cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnter(e, trainee.fullName)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleTraineeClick(trainee)}
                >
                  {trainee.fullName}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      {hoveredTrainee && flyoutPosition && (
        <FlightInfoFlyout
          events={hoveredEvents}
          position={flyoutPosition}
          personName={hoveredTrainee}
          personType="Trainee"
        />
      )}
      {/* The TraineeProfileFlyout is currently opened from other views, so we don't need it here unless functionality changes.
          If needed, it would look like this:
      {selectedTrainee && (
        <TraineeProfileFlyout
          trainee={selectedTrainee}
          onClose={handleCloseProfile}
          // ... other required props
        />
      )}
      */}
    </>
  );
};

export default TraineeListView;
