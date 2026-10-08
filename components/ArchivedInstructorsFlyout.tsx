import React, { useState } from 'react';
import { Instructor, Trainee } from '../types';
import RestoreConfirmationFlyout from './RestoreConfirmationFlyout';

interface ArchivedInstructorsFlyoutProps {
  archivedInstructors: Instructor[];
  archivedTrainees?: Trainee[];
  onClose: () => void;
  onRestore: (id: string | number | null) => Promise<void> | void;
  onRestoreTrainee?: (id: string | number | null) => Promise<void> | void;
  onBeginRestoreReview?: (person: Instructor) => void;
  onBeginRestoreReviewTrainee?: (person: Trainee) => void;
  canRestore?: boolean;
  onRequestRestorePassword?: (personName: string) => Promise<boolean>;
}

const ArchivedInstructorsFlyout: React.FC<ArchivedInstructorsFlyoutProps> = ({
  archivedInstructors,
  archivedTrainees = [],
  onClose,
  onRestore,
  onRestoreTrainee,
  onBeginRestoreReview,
  onBeginRestoreReviewTrainee,
  canRestore = false,
  onRequestRestorePassword,
}) => {
  type ArchivedIndividual = {
    person: Instructor | Trainee;
    kind: 'Staff' | 'Trainee';
    id: string | number | null;
    name: string;
    rank: string;
    role: string;
    unit: string;
    course: string;
  };

  const [personToRestore, setPersonToRestore] = useState<ArchivedIndividual | null>(null);
  const [searchText, setSearchText] = useState('');
  const getArchiveIdentifier = (person: Instructor | Trainee): string | number | null => {
    const dbId = String((person as any).id || '').trim();
    return dbId || person.idNumber || null;
  };
  const archivedIndividuals: ArchivedIndividual[] = [
    ...archivedInstructors.map((instructor) => ({
      person: instructor,
      kind: 'Staff' as const,
      id: getArchiveIdentifier(instructor),
      name: instructor.name || '',
      rank: instructor.rank || '',
      role: instructor.role || 'Staff',
      unit: instructor.unit || '',
      course: '',
    })),
    ...archivedTrainees.map((trainee) => ({
      person: trainee,
      kind: 'Trainee' as const,
      id: getArchiveIdentifier(trainee),
      name: trainee.fullName || trainee.name || '',
      rank: trainee.rank || '',
      role: trainee.role || 'Trainee',
      unit: trainee.unit || '',
      course: trainee.course || '',
    })),
  ].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const normalisedSearchText = searchText.trim().toLowerCase();
  const filteredArchivedIndividuals = normalisedSearchText
    ? archivedIndividuals.filter((individual) => {
        const searchableText = [
          individual.name,
          individual.rank,
          individual.role,
          individual.kind,
          individual.unit,
          individual.course,
          individual.id,
          (individual.person as any).personnelId,
          (individual.person as any).personnelNumber,
        ].map(value => String(value || '').toLowerCase()).join(' ');
        return searchableText.includes(normalisedSearchText);
      })
    : archivedIndividuals;

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
            <h2 id="archived-list-title" className="text-xl font-bold text-white">Archived Individuals</h2>
            <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close archived individuals list">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6 flex-1 overflow-y-auto" aria-labelledby="archived-list-title">
            <div className="mb-4">
              <label className="sr-only" htmlFor="archived-profile-search">Search archived individuals</label>
              <input
                id="archived-profile-search"
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search by name, role, course, unit or ID number..."
                className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm font-semibold text-gray-100 placeholder-gray-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            {filteredArchivedIndividuals.length > 0 ? (
                <ul className="space-y-2">
                {filteredArchivedIndividuals.map((individual) => (
                    <li 
                    key={`${individual.kind}-${String(individual.id || individual.name)}`}
                    className="p-3 bg-gray-700/50 rounded-md text-gray-300 flex items-center justify-between"
                    >
                    <div className="flex items-center space-x-4">
                        <span className="font-mono text-gray-500 w-16 flex-shrink-0 text-right">{individual.rank}</span>
                        <div>
                          <div className="text-gray-100">{individual.name}</div>
                          <div className="text-xs text-gray-500">
                            {individual.kind}{individual.course ? ` - ${individual.course}` : ''}{individual.unit ? ` - ${individual.unit}` : ''}
                          </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                          if (!canRestore) return;
                          setPersonToRestore(individual);
                        }}
                        className={`p-1 rounded-full text-gray-400 hover:bg-green-500/20 hover:text-green-400 transition-colors ${canRestore ? '' : 'cursor-not-allowed'}`}
                        aria-label={`Restore ${individual.name}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                    </li>
                ))}
                </ul>
            ) : (
                <p className="text-gray-500 text-center italic py-8">
                  {archivedIndividuals.length > 0 ? 'No archived individuals match that search.' : 'No individuals have been archived.'}
                </p>
            )}
          </div>
        </div>
      </div>

      {personToRestore && (
        <RestoreConfirmationFlyout
          instructorName={personToRestore.name}
          onConfirm={() => {
            if (personToRestore.kind === 'Trainee') {
              if (onBeginRestoreReviewTrainee) {
                onBeginRestoreReviewTrainee(personToRestore.person as Trainee);
              } else {
                void onRestoreTrainee?.(personToRestore.id);
              }
            } else {
              if (onBeginRestoreReview) {
                onBeginRestoreReview(personToRestore.person as Instructor);
              } else {
                void onRestore(personToRestore.id);
              }
            }
            setPersonToRestore(null);
          }}
          onClose={() => setPersonToRestore(null)}
        />
      )}
    </>
  );
};

export default ArchivedInstructorsFlyout;
