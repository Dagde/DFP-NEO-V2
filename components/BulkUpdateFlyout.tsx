import React, { useState, useEffect } from 'react';
import { getAllFiles, getFile } from '../utils/db';
import { Instructor, InstructorRank, InstructorCategory, SeatConfig } from '../types';
import {
    CrewPositionTerminology,
    findCrewPositionEntry,
    isPilotCrewPosition,
} from '../utils/crewPositionTerminology';

declare var XLSX: any;

interface BulkUpdateFlyoutProps {
  onClose: () => void;
  onBulkUpdateInstructors: (instructors: Instructor[]) => void | Promise<void>;
  instructorsData?: Instructor[]; // Optional for trainee bulk updates
  traineesData?: Trainee[]; // For trainee bulk updates
  isTraineeMode?: boolean; // Toggle between instructor and trainee mode
  onBulkUpdateTrainees?: (trainees: Trainee[]) => void;
  crewPositionTerminology?: CrewPositionTerminology;
}

interface RepoFile {
    id: string;
    name: string;
    folderId: string;
}

// Helper to get a value from a row with fuzzy key matching
const getValueFromRow = (row: any, possibleKeys: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const key of possibleKeys) {
        // Try exact match first (case-sensitive)
        if (row[key] !== undefined) return row[key];
    }
    // Then try case-insensitive, space-insensitive match
    for (const key of possibleKeys) {
        const lowerKey = key.toLowerCase().replace(/[\s/]/g, '');
        for (const rowKey of rowKeys) {
            if (rowKey.toLowerCase().replace(/[\s/]/g, '') === lowerKey) {
                return row[rowKey];
            }
        }
    }
    return undefined;
};

const getStringFromRow = (row: any, possibleKeys: string[]): string => {
    const value = getValueFromRow(row, possibleKeys);
    return value === undefined || value === null ? '' : String(value).trim();
};

const splitListValue = (value: string): string[] =>
    value
        .split(/\r?\n|;|,/)
        .map(item => item.trim())
        .filter(Boolean);

const normaliseService = (value: string): Instructor['service'] | undefined => {
    const cleanValue = value.trim().toLowerCase();
    if (!cleanValue) return undefined;
    if (['raaf', 'air force', 'airforce', 'royal australian air force'].includes(cleanValue)) return 'RAAF';
    if (['ran', 'navy', 'royal australian navy'].includes(cleanValue)) return 'RAN';
    if (['ara', 'army', 'australian army'].includes(cleanValue)) return 'ARA';
    return value as Instructor['service'];
};

const normaliseCategory = (value: string): InstructorCategory | undefined => {
    const cleanValue = value.trim().toLowerCase();
    if (!cleanValue) return undefined;
    if (['u', 'uncat', 'un cat', 'uncategorised', 'uncategorized'].includes(cleanValue)) return 'UnCat';
    const upperValue = value.trim().toUpperCase();
    if (['A', 'B', 'C', 'D'].includes(upperValue)) return upperValue as InstructorCategory;
    return value as InstructorCategory;
};

const normaliseSeatConfig = (value: string): SeatConfig | undefined => {
    const cleanValue = value.trim().toLowerCase();
    if (!cleanValue) return undefined;
    if (['n', 'normal', 'norm'].includes(cleanValue)) return 'Normal';
    if (['fwd/short', 'forward/short', 'fwd short', 'forward short', 'fwd', 'front'].includes(cleanValue)) return 'FWD/SHORT';
    if (['rear/short', 'rear short', 'rear'].includes(cleanValue)) return 'REAR/SHORT';
    if (['fwd/long', 'forward/long', 'fwd long', 'forward long', 'long'].includes(cleanValue)) return 'FWD/LONG';
    return value as SeatConfig;
};

const normaliseImportedStaffRole = (
    value: string,
    crewPositionTerminology?: CrewPositionTerminology,
): string | undefined => {
    const cleanValue = value.trim();
    const cleanLower = cleanValue.toLowerCase();
    if (!cleanValue) return undefined;
    if (['sim ip', 'simulator ip', 'sim instructor', 'simulator instructor'].includes(cleanLower)) return 'SIM IP';
    if (['qfi', 'instructor', 'flight instructor'].includes(cleanLower)) return 'QFI';

    const crewPosition = findCrewPositionEntry(cleanValue, crewPositionTerminology);
    if (crewPosition) return isPilotCrewPosition(crewPosition.genericName, crewPositionTerminology) ? 'Pilot' : crewPosition.genericName;
    if (['pilot', 'aircrew pilot', 'captain'].includes(cleanLower)) return 'Pilot';

    return cleanValue;
};

const applyQualificationRoles = (
    parsedData: Partial<Instructor>,
    rolesValue: string,
    crewPositionTerminology?: CrewPositionTerminology,
): void => {
    if (!rolesValue) return;
    const roleTokens = splitListValue(rolesValue);
    const rolesLower = roleTokens.join(' ').toLowerCase();
    const importedCrewRole = roleTokens
        .map(role => normaliseImportedStaffRole(role, crewPositionTerminology))
        .find(role => role && role !== 'QFI');

    parsedData.isExecutive = rolesLower.includes('exec') || rolesLower.includes('executive');
    parsedData.isFlyingSupervisor = rolesLower.includes('fly sup') || rolesLower.includes('flying supervisor') || rolesLower.includes('supervisor');
    parsedData.isTestingOfficer = rolesLower.includes('testing') || rolesLower.includes('test officer');
    parsedData.isIRE = rolesLower.includes('ire');
    parsedData.isCFI = rolesLower.includes('cfi');
    parsedData.isOFI = rolesLower.includes('ofi');
    parsedData.isQFI = rolesLower.includes('qfi') || rolesLower.includes('instructor');
    parsedData.isAdminStaff = rolesLower.includes('admin');
    if (importedCrewRole) {
        parsedData.role = importedCrewRole;
    } else if (rolesLower.includes('sim ip')) {
        parsedData.role = 'SIM IP';
    } else if (rolesLower.includes('pilot')) {
        parsedData.role = 'Pilot';
    } else if (rolesLower.includes('qfi') || rolesLower.includes('instructor')) {
        parsedData.role = 'QFI';
    }
};


const BulkUpdateFlyout: React.FC<BulkUpdateFlyoutProps> = ({ 
  onClose, 
  onBulkUpdateInstructors, 
  instructorsData = [],
  traineesData = [],
  isTraineeMode = false,
  onBulkUpdateTrainees,
  crewPositionTerminology,
}) => {
    const [repoFiles, setRepoFiles] = useState<RepoFile[]>([]);
    const [selectedFileId, setSelectedFileId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        const fetchFiles = async () => {
            const files = await getAllFiles();
            // Filter for spreadsheet files
            const spreadsheetFiles = files.filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv'));
            setRepoFiles(spreadsheetFiles);
            if (spreadsheetFiles.length > 0) {
                setSelectedFileId(spreadsheetFiles[0].id);
            }
        };
        fetchFiles();
    }, []);

    const handleConfirm = async () => {
        if (!selectedFileId) {
            setStatusMessage('Please select a file.');
            return;
        }

        setIsLoading(true);
        setStatusMessage('Reading file from repository...');

        try {
            const fileRecord = await getFile(selectedFileId);
            if (!fileRecord) {
                throw new Error('File not found in the repository.');
            }

            setStatusMessage('Parsing spreadsheet...');
            const data = await fileRecord.content.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet);

            setStatusMessage(`Processing ${json.length} rows...`);
            
            const instructorsToProcess: Instructor[] = [];
            const existingInstructorsMap = new Map<number, Instructor>(instructorsData.map(i => [i.idNumber, i]));
            let createdCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;

            for (const row of json) {
                const idValue = getValueFromRow(row, ['PMKeys/ID', 'PMKeys', 'ID', 'ID Number', 'IDNumber', 'Employee ID', 'Employee Number', 'Personnel Number', 'Staff ID']);

                if (idValue === null || idValue === undefined || String(idValue).trim() === '') {
                    skippedCount++;
                    continue;
                }

                const idNumber = Number(idValue);
                if (isNaN(idNumber) || idNumber <= 0) {
                    skippedCount++;
                    continue;
                }

                const existingInstructor = existingInstructorsMap.get(idNumber);
                const parsedData: Partial<Instructor> = {};

                const surname = getStringFromRow(row, ['Srname', 'Surname', 'Last Name']);
                const firstname = getStringFromRow(row, ['First name', 'Firstname', 'Given Name']);
                if (surname && firstname) {
                    parsedData.name = `${surname}, ${firstname}`;
                } else {
                    const fullName = getStringFromRow(row, [
                        'Name',
                        'Full Name',
                        'Name (Surname, FirstName)',
                        'Name (Surname. FirstName)',
                        'Name [Surname, Firstname]',
                    ]);
                    if(fullName) parsedData.name = fullName;
                }

                const rank = getStringFromRow(row, ['Rank']);
                if (rank) parsedData.rank = rank as InstructorRank;
                
                const role = getStringFromRow(row, ['Role', 'Crew Position', 'Crew Role', 'Aircrew Role', 'Seat Role']);
                const normalisedRole = normaliseImportedStaffRole(role, crewPositionTerminology);
                if (normalisedRole) parsedData.role = normalisedRole;
                
                const callsign = getValueFromRow(row, ['callsign number', 'callsignnumber', 'Callsign No', 'Callsign Number']);
                if (callsign !== undefined) parsedData.callsignNumber = Number(callsign) || 0;

                const service = getStringFromRow(row, ['Service']);
                const normalisedService = normaliseService(service);
                if (normalisedService) parsedData.service = normalisedService;

                const category = getStringFromRow(row, ['Category']);
                const normalisedCategory = normaliseCategory(category);
                if (normalisedCategory) parsedData.category = normalisedCategory;

                const location = getStringFromRow(row, ['Location', 'Base', 'Location Code']);
                if (location) parsedData.location = location;

                const unit = getStringFromRow(row, ['Unit', 'Unit Code']);
                if (unit) parsedData.unit = unit;

                const flight = getStringFromRow(row, ['Flight', 'Flight/Sqn', 'Section']);
                if (flight) parsedData.flight = flight;

                const seatConfig = getStringFromRow(row, ['Seat config', 'Seatconfig', 'Seat Configuration']);
                const normalisedSeatConfig = normaliseSeatConfig(seatConfig);
                if (normalisedSeatConfig) parsedData.seatConfig = normalisedSeatConfig;

                const phoneNumber = getStringFromRow(row, ['Phone Number', 'Phone', 'Mobile', 'phoneNumber']);
                if (phoneNumber) parsedData.phoneNumber = phoneNumber;

                const email = getStringFromRow(row, ['Email', 'Email Address']);
                if (email) parsedData.email = email;

                const permissions = getStringFromRow(row, ['Permissions', 'Permission']);
                if (permissions) parsedData.permissions = splitListValue(permissions);

                const rolesStr = getStringFromRow(row, ['Roles', 'Qualifications and Roles', 'Qualifications & Roles', 'Qualifications']);
                applyQualificationRoles(parsedData, rolesStr, crewPositionTerminology);

                if (existingInstructor) {
                    const updatedInstructor = { ...existingInstructor, ...parsedData, idNumber };
                    instructorsToProcess.push(updatedInstructor);
                    updatedCount++;
                } else {
                    const newInstructor: Instructor = {
                        idNumber,
                        name: 'Unnamed Instructor',
                        rank: 'FLTLT',
                        role: 'QFI',
                        callsignNumber: 0,
                        category: 'C',
                        isTestingOfficer: false,
                        seatConfig: 'Normal',
                        isExecutive: false,
                        isFlyingSupervisor: false,
                        isIRE: false,
                        unavailability: [],
                        ...parsedData, // Override defaults with parsed values
                    };
                    
                    if (!newInstructor.name || newInstructor.name === 'Unnamed Instructor') {
                        skippedCount++;
                        continue; // Skip if a name couldn't be constructed
                    }
                    instructorsToProcess.push(newInstructor);
                    createdCount++;
                }
            }

            if (instructorsToProcess.length > 0) {
                await onBulkUpdateInstructors(instructorsToProcess);
            }
            
            let finalMessage = 'Process complete. ';
            if (createdCount > 0) finalMessage += `Added ${createdCount} new. `;
            if (updatedCount > 0) finalMessage += `Updated ${updatedCount}. `;
            if (skippedCount > 0) finalMessage += `Skipped ${skippedCount} rows.`;
            if (createdCount === 0 && updatedCount === 0 && skippedCount === 0) finalMessage = 'No data processed.';

            setStatusMessage(finalMessage.trim());

        } catch (error) {
            console.error("Bulk update failed:", error);
            setStatusMessage(`Error: ${(error as Error).message}`);
        } finally {
            setTimeout(() => {
                setIsLoading(false);
                if (!statusMessage.startsWith('Error')) {
                    onClose();
                }
            }, 3000);
        }
    };


    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Bulk Upload Instructors</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {isLoading ? (
                        <div className="text-center p-8">
                            <p className="text-sky-400 font-semibold">{statusMessage}</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-gray-400 text-sm">Select a spreadsheet from the repository to create or update instructors. The system will match by ID Number.</p>
                            <div>
                                <label htmlFor="repo-file" className="block text-sm font-medium text-gray-400">File from Repository</label>
                                <select 
                                    id="repo-file"
                                    value={selectedFileId}
                                    onChange={e => setSelectedFileId(e.target.value)}
                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm"
                                >
                                    {repoFiles.length > 0 ? (
                                        repoFiles.map(file => <option key={file.id} value={file.id}>{file.name}</option>)
                                    ) : (
                                        <option disabled>No spreadsheet files found in repository.</option>
                                    )}
                                </select>
                            </div>
                            <p className="text-xs text-gray-500">Expected columns: PMKeys/ID, Srname, First name, Service, Rank, callsign number, Roles, Category, Seat config.</p>
                        </>
                    )}
                </div>

                {!isLoading && (
                    <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancel</button>
                        <button onClick={handleConfirm} disabled={!selectedFileId} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
                            Confirm & Process
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkUpdateFlyout;
