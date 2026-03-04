import React, { useState } from 'react';
import { Trainee } from '../types';

interface MassBriefCompleteFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  trainees: Trainee[];
  onConfirm: (selectedTrainees: Trainee[]) => void;
}

interface MassBriefConfirmationFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  confirmedTrainees: Trainee[];
}

const MassBriefCompleteFlyout: React.FC<MassBriefCompleteFlyoutProps> = ({
  isOpen,
  onClose,
  event,
  trainees,
  onConfirm
}) => {
  const [selectedTrainees, setSelectedTrainees] = useState<Set<string>>(new Set());

  // Initialize with all trainees selected
  React.useEffect(() => {
    console.log('🔍 MassBriefCompleteFlyout - isOpen:', isOpen);
    console.log('🔍 MassBriefCompleteFlyout - trainees:', trainees);
    console.log('🔍 MassBriefCompleteFlyout - trainees.length:', trainees.length);
    
    if (isOpen && trainees.length > 0) {
      console.log('🔍 MassBriefCompleteFlyout - Trainee details:');
      trainees.forEach((trainee, index) => {
        console.log(`  ${index}:`, trainee);
        console.log(`    Name: ${trainee.name}`);
        console.log(`    FullName: ${trainee.fullName}`);
        console.log(`    ID: ${trainee.idNumber}`);
        console.log(`    Rank: ${trainee.rank}`);
      });
      const traineeFullNames = trainees.map(t => t.fullName);
      console.log('🔍 MassBriefCompleteFlyout - traineeFullNames:', traineeFullNames);
      setSelectedTrainees(new Set(traineeFullNames));
    }
  }, [isOpen, trainees]);

  const handleTraineeToggle = (traineeName: string) => {
    const newSelected = new Set(selectedTrainees);
    if (newSelected.has(traineeName)) {
      newSelected.delete(traineeName);
    } else {
      newSelected.add(traineeName);
    }
    setSelectedTrainees(newSelected);
  };

  const handleConfirm = () => {
    const confirmedTrainees = trainees.filter(t => selectedTrainees.has(t.fullName));
    onConfirm(confirmedTrainees);
    onClose();
  };

  const handleSelectAll = () => {
    if (selectedTrainees.size === trainees.length) {
      setSelectedTrainees(new Set());
    } else {
      setSelectedTrainees(new Set(trainees.map(t => t.fullName)));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">
          Complete Mass Brief: {event.flightNumber}
        </h2>
        
        <p className="text-gray-300 mb-4">
          Confirm which trainees completed this event:
        </p>

        <div className="mb-4">
          <button
            onClick={handleSelectAll}
            className="text-sky-400 hover:text-sky-300 text-sm mb-2"
          >
            {selectedTrainees.size === trainees.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="space-y-2 mb-6">
          {trainees.length === 0 ? (
            <div className="text-yellow-400 text-center py-4">
              No trainees found for this event.
            </div>
          ) : (
            trainees.map(trainee => {
              console.log('🔍 Rendering trainee:', trainee);
              console.log('🔍 Trainee details:', {
                fullName: trainee.fullName,
                name: trainee.name,
                rank: trainee.rank,
                idNumber: trainee.idNumber
              });
              const displayName = trainee.fullName || (trainee.rank && trainee.name ? `${trainee.rank} ${trainee.name}` : trainee.name) || 'Unknown Trainee';
              return (
                <div key={trainee.fullName || trainee.idNumber || trainee.id} className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id={`trainee-${trainee.fullName || trainee.idNumber || trainee.id}`}
                    checked={selectedTrainees.has(trainee.fullName)}
                    onChange={() => handleTraineeToggle(trainee.fullName)}
                    className="w-4 h-4 text-sky-600 bg-gray-700 border-gray-600 rounded focus:ring-sky-500"
                  />
                  <label 
                    htmlFor={`trainee-${trainee.fullName || trainee.idNumber || trainee.id}`}
                    className="text-white flex-1 cursor-pointer"
                  >
                    {displayName}
                  </label>
                </div>
              );
            })
          )}
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleConfirm}
            disabled={selectedTrainees.size === 0}
            className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-sm font-semibold"
          >
            Confirm Complete ({selectedTrainees.size})
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const MassBriefConfirmationFlyout: React.FC<MassBriefConfirmationFlyoutProps> = ({
  isOpen,
  onClose,
  event,
  confirmedTrainees
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">
          Mass Brief Completed!
        </h2>
        
        <div className="mb-4">
          <p className="text-gray-300 mb-3">
            <strong>{event.flightNumber}</strong> has been marked complete for:
          </p>
          
          <div className="space-y-2 mb-4">
            {confirmedTrainees.map(trainee => (
              <div key={trainee.fullName} className="flex items-center space-x-3 bg-gray-700/50 p-3 rounded-lg">
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{trainee.rank} {trainee.name}</p>
                  <p className="text-green-400 text-sm">DCO status set in PT-051</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export { MassBriefConfirmationFlyout };
export default MassBriefCompleteFlyout;