import React, { useState } from 'react';
import { Instructor, Trainee } from '../types';
import { appendStaffProfileTrace, downloadStaffProfileTrace, summariseStaffProfileForTrace } from '../utils/staffProfileTrace';

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
  const summariseArchivedPersonForTrace = (individual: ArchivedIndividual | null) => {
    if (!individual) return null;
    const person = individual.person as any;
    return {
      kind: individual.kind,
      id: individual.id,
      dbId: String(person.id || '').trim() || null,
      idNumber: person.idNumber ?? null,
      name: individual.name,
      rank: individual.rank,
      role: individual.role,
      unit: individual.unit,
      course: individual.course,
      isActive: person.isActive !== false,
      dataSource: String(person._dataSource || '').trim() || null,
    };
  };
  const mapTraineeToStaffRestoreDraft = (trainee: Trainee): Instructor => ({
    idNumber: Number(trainee.idNumber) || 0,
    name: trainee.name || trainee.fullName || '',
    rank: trainee.rank || '',
    role: 'Pilot',
    callsignNumber: Number((trainee as any).callsignNumber || 0),
    category: 'UnCat',
    isTestingOfficer: false,
    seatConfig: trainee.seatConfig || 'Normal',
    isExecutive: false,
    isFlyingSupervisor: false,
    isIRE: false,
    isQFI: false,
    location: trainee.location || '',
    unit: trainee.unit || '',
    phoneNumber: trainee.phoneNumber || '',
    email: trainee.email || '',
    unavailability: trainee.unavailability || [],
    permissions: ['Staff'],
    preferences: { ...((trainee as any).preferences || {}) },
    _dataSource: 'restore-draft',
    _restoreReviewMode: true,
    _restoreCreatesNewRecord: true,
    _restoreSourceKind: 'Trainee',
    _restoreSourceId: getArchiveIdentifier(trainee),
  } as Instructor);
  const mapStaffToTraineeRestoreDraft = (instructor: Instructor): Trainee => ({
    idNumber: Number(instructor.idNumber) || 0,
    name: instructor.name || '',
    fullName: instructor.name || '',
    rank: instructor.rank || '',
    course: '',
    lmpType: '',
    academicLmpType: '',
    role: 'Trainee',
    seatConfig: instructor.seatConfig || 'Normal',
    isPaused: false,
    unit: instructor.unit || '',
    service: (instructor as any).service || '',
    unavailability: instructor.unavailability || [],
    permissions: ['Trainee'],
    preferences: { ...((instructor as any).preferences || {}) },
    traineeCallsign: '',
    location: instructor.location || '',
    secondaryCallsign: instructor.secondaryCallsign || '',
    crew: instructor.crew || 'N/A',
    phoneNumber: instructor.phoneNumber || '',
    email: instructor.email || '',
    priorExperience: (instructor as any).priorExperience || {
      day: { p1: 0, p2: 0, dual: 0 },
      night: { p1: 0, p2: 0, dual: 0 },
      total: 0,
      captain: 0,
      instructor: 0,
      instrument: { sim: 0, actual: 0 },
      simulator: { p1: 0, p2: 0, dual: 0, total: 0 },
    },
    _dataSource: 'restore-draft',
    _restoreReviewMode: true,
    _restoreCreatesNewRecord: true,
    _restoreSourceKind: 'Staff',
    _restoreSourceId: getArchiveIdentifier(instructor),
  } as Trainee);
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
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-gray-100">{individual.name}</span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${
                                individual.kind === 'Staff'
                                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                                  : 'border-sky-400/40 bg-sky-500/15 text-sky-100'
                              }`}
                            >
                              {individual.kind} Profile
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {individual.kind}{individual.course ? ` - ${individual.course}` : ''}{individual.unit ? ` - ${individual.unit}` : ''}
                          </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                          if (!canRestore) return;
                          appendStaffProfileTrace('archive-restore:open-type-choice', {
                            selected: summariseArchivedPersonForTrace(individual),
                            archivedStaffCount: archivedInstructors.length,
                            archivedTraineeCount: archivedTrainees.length,
                          });
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
        <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center animate-fade-in" onClick={() => setPersonToRestore(null)}>
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-sky-500/50" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-700 bg-sky-900/20 flex items-center space-x-3">
              <h2 className="text-xl font-bold text-sky-400">Restore Profile As</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-300">
                Choose how to restore <strong className="text-white">{personToRestore.name}</strong>.
              </p>
              <button
                type="button"
                onClick={() => downloadStaffProfileTrace('archive-restore-trace')}
                className="rounded border border-amber-400/50 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:border-amber-300 hover:bg-amber-500/20"
              >
                Download Restore Trace
              </button>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={async () => {
                    appendStaffProfileTrace('archive-restore:staff-choice-clicked', {
                      selected: summariseArchivedPersonForTrace(personToRestore),
                    });
                    const passwordAccepted = onRequestRestorePassword
                      ? await onRequestRestorePassword(personToRestore.name)
                      : true;
                    appendStaffProfileTrace('archive-restore:staff-password-result', {
                      accepted: passwordAccepted,
                      selected: summariseArchivedPersonForTrace(personToRestore),
                    });
                    if (!passwordAccepted) return;
                    const staffProfile = personToRestore.kind === 'Staff'
                      ? { ...(personToRestore.person as Instructor), _dataSource: 'archive', _restoreReviewMode: true }
                      : mapTraineeToStaffRestoreDraft(personToRestore.person as Trainee);
                    appendStaffProfileTrace('archive-restore:staff-review-open', {
                      selected: summariseArchivedPersonForTrace(personToRestore),
                      staffProfile: summariseStaffProfileForTrace(staffProfile),
                    });
                    onBeginRestoreReview?.(staffProfile as Instructor);
                    setPersonToRestore(null);
                  }}
                  className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-left text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25"
                >
                  <span className="block text-base text-white">Restore as Staff</span>
                  <span className="mt-1 block text-xs text-emerald-100/75">Use when the person is returning as staff.</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    appendStaffProfileTrace('archive-restore:trainee-choice-clicked', {
                      selected: summariseArchivedPersonForTrace(personToRestore),
                    });
                    const passwordAccepted = onRequestRestorePassword
                      ? await onRequestRestorePassword(personToRestore.name)
                      : true;
                    appendStaffProfileTrace('archive-restore:trainee-password-result', {
                      accepted: passwordAccepted,
                      selected: summariseArchivedPersonForTrace(personToRestore),
                    });
                    if (!passwordAccepted) return;
                    const traineeProfile = personToRestore.kind === 'Trainee'
                      ? { ...(personToRestore.person as Trainee), _dataSource: 'archive', _restoreReviewMode: true }
                      : mapStaffToTraineeRestoreDraft(personToRestore.person as Instructor);
                    appendStaffProfileTrace('archive-restore:trainee-review-open', {
                      selected: summariseArchivedPersonForTrace(personToRestore),
                      traineeProfile: summariseArchivedPersonForTrace({
                        person: traineeProfile,
                        kind: 'Trainee',
                        id: getArchiveIdentifier(traineeProfile),
                        name: traineeProfile.fullName || traineeProfile.name || '',
                        rank: traineeProfile.rank || '',
                        role: traineeProfile.role || 'Trainee',
                        unit: traineeProfile.unit || '',
                        course: traineeProfile.course || '',
                      }),
                    });
                    onBeginRestoreReviewTrainee?.(traineeProfile as Trainee);
                    setPersonToRestore(null);
                  }}
                  className="rounded-md border border-sky-400/40 bg-sky-500/15 px-4 py-3 text-left text-sm font-semibold text-sky-100 hover:bg-sky-500/25"
                >
                  <span className="block text-base text-white">Restore as Trainee</span>
                  <span className="mt-1 block text-xs text-sky-100/75">Use when the person is returning to a course.</span>
                </button>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end">
              <button onClick={() => setPersonToRestore(null)} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ArchivedInstructorsFlyout;
