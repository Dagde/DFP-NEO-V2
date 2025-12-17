import React, { useState, useEffect } from 'react';
import { getAllFiles, getFile } from '../utils/db';
import { Instructor, InstructorRank, InstructorCategory, SeatConfig } from '../types';

declare var XLSX: any;

interface BulkUpdateFlyoutProps {
  onClose: () => void;
  onBulkUpdateInstructors: (instructors: Instructor[]) => void;
  instructorsData: Instructor[];
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


const BulkUpdateFlyout: React.FC<BulkUpdateFlyoutProps> = ({ onClose, onBulkUpdateInstructors, instructorsData }) => {
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

                const surname = getValueFromRow(row, ['Srname', 'Surname', 'Last Name']);
                const firstname = getValueFromRow(row, ['First name', 'Firstname', 'Given Name']);
                if (surname && firstname) {
                    parsedData.name = `${surname}, ${firstname}`;
                } else {
                    const fullName = getValueFromRow(row, ['Name', 'Full Name']);
                    if(fullName) parsedData.name = fullName;
                }

                const rank = getValueFromRow(row, ['Rank']);
                if (rank) parsedData.rank = rank as InstructorRank;
                
                const role = getValueFromRow(row, ['Role']);
                if (role) parsedData.role = role as 'QFI' | 'SIM IP';
                
                const callsign = getValueFromRow(row, ['callsign number', 'callsignnumber', 'Callsign No', 'Callsign Number']);
                if (callsign !== undefined) parsedData.callsignNumber = Number(callsign) || 0;

                const service = getValueFromRow(row, ['Service']);
                if (service) parsedData.service = service as 'RAAF' | 'RAN' | 'ARA';

                const category = getValueFromRow(row, ['Category']);
                if (category) parsedData.category = category as InstructorCategory;

                const seatConfig = getValueFromRow(row, ['Seat config', 'Seatconfig', 'Seat Configuration']);
                if (seatConfig) parsedData.seatConfig = seatConfig as SeatConfig;

                const rolesStr = getValueFromRow(row, ['Roles']);
                if (rolesStr !== undefined && rolesStr !== null) {
                    const rolesLower = String(rolesStr).toLowerCase();
                    parsedData.isExecutive = rolesLower.includes('executive');
                    parsedData.isFlyingSupervisor = rolesLower.includes('flying supervisor');
                    parsedData.isTestingOfficer = rolesLower.includes('testing officer');
                    parsedData.isIRE = rolesLower.includes('ire');
                }

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
                onBulkUpdateInstructors(instructorsToProcess);
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