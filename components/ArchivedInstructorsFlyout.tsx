import React, { useState } from 'react';
import { Instructor } from '../types';
import RestoreConfirmationFlyout from './RestoreConfirmationFlyout';

interface ArchivedInstructorsFlyoutProps {
  archivedInstructors: Instructor[];
  onClose: () => void;
  onRestore: (id: number) => void;
}

const ArchivedInstructorsFlyout: React.FC<ArchivedInstructorsFlyoutProps> = ({ archivedInstructors, onClose, onRestore }) => {
  const [instructorToRestore, setInstructorToRestore] = useState<Instructor | null>(null);

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
            <h2 id="archived-list-title" className="text-xl font-bold text-white">Archived Profiles</h2>
            <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close archived profiles list">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6 flex-1 overflow-y-auto" aria-labelledby="archived-list-title">
            {archivedInstructors.length > 0 ? (
                <ul className="space-y-2">
                {archivedInstructors.map((instructor) => (
                    <li 
                    key={instructor.idNumber}
                    className="p-3 bg-gray-700/50 rounded-md text-gray-300 flex items-center justify-between"
                    >
                    <div className="flex items-center space-x-4">
                        <span className="font-mono text-gray-500 w-16 flex-shrink-0 text-right">{instructor.rank}</span>
                        <span>{instructor.name}</span>
                    </div>
                    <button
                        onClick={() => setInstructorToRestore(instructor)}
                        className="p-1 rounded-full text-gray-400 hover:bg-green-500/20 hover:text-green-400 transition-colors"
                        aria-label={`Restore ${instructor.name}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                    </li>
                ))}
                </ul>
            ) : (
                <p className="text-gray-500 text-center italic py-8">No instructors have been archived.</p>
            )}
          </div>
        </div>
      </div>

      {instructorToRestore && (
        <RestoreConfirmationFlyout
          instructorName={instructorToRestore.name}
          onConfirm={() => {
            onRestore(instructorToRestore.idNumber);
            setInstructorToRestore(null);
          }}
          onClose={() => setInstructorToRestore(null)}
        />
      )}
    </>
  );
};

export default ArchivedInstructorsFlyout;
