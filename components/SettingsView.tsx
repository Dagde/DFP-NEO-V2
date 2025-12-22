

import React, { useState, useEffect, useMemo } from 'react';
import { initDB, getAllFiles, addFile, getFile, deleteFile } from '../utils/db';
import UploadFileFlyout from './UploadFileFlyout';
import SelectDestinationFlyout from './SelectDestinationFlyout';
import DownloadConfirmationFlyout from './DownloadConfirmationFlyout';
import DeleteFileConfirmationFlyout from './DeleteFileConfirmationFlyout';
import UpdateConfirmationFlyout from './UpdateConfirmationFlyout';
import NewRecordConfirmationFlyout from './NewRecordConfirmationFlyout';
import PermissionsManagerFlyout from './PermissionsManagerFlyout';
import UpdateErrorFlyout from './UpdateErrorFlyout';
import UpdateSummaryFlyout from './UpdateSummaryFlyout';
import ScoringMatrixFlyout from './ScoringMatrixFlyout';
import { Instructor, Trainee, SyllabusItemDetail, InstructorRank, InstructorCategory, SeatConfig, TraineeRank, EventLimits, PhraseBank, MasterCurrency, CurrencyRequirement } from '../types';
import PermissionsManagerWindow from './PermissionsManagerWindow';
import AuditButton from './AuditButton';
import { logAudit } from '../utils/auditLogger';
import DutyTurnaroundSection from './DutyTurnaroundSection';
import { CourseSelectionDialog } from './CourseSelectionDialog';
import { INITIAL_SYLLABUS_DETAILS } from '../mockData';
import { filterSyllabusByLMPType } from '../utils/syllabusFilter';


declare var XLSX: any;

interface SettingsViewProps {
    locations: string[];
    onUpdateLocations: (locations: string[]) => void;
    units: string[];
    onUpdateUnits: (units: string[]) => void;
    unitLocations: Record<string, string>;
    onUpdateUnitLocations: (locations: Record<string, string>) => void;
    instructorsData: Instructor[];
    traineesData: Trainee[];
    syllabusDetails: SyllabusItemDetail[];
    onBulkUpdateInstructors: (instructors: Instructor[]) => void;
    onReplaceInstructors: (instructors: Instructor[]) => void;
    onBulkUpdateTrainees: (trainees: Trainee[]) => void;
    onReplaceTrainees: (trainees: Trainee[]) => void;
    onUpdateSyllabus: (syllabus: SyllabusItemDetail[]) => void;
    onShowSuccess: (message: string) => void;
    eventLimits: EventLimits;
    onUpdateEventLimits: (limits: EventLimits) => void;
    phraseBank: PhraseBank;
    onUpdatePhraseBank: (newBank: PhraseBank) => void;
    onNavigate: (view: string) => void;
    masterCurrencies: MasterCurrency[];
    currencyRequirements: CurrencyRequirement[];
    sctEvents: string[];
    onUpdateSctEvents: (events: string[]) => void;
    preferredDutyPeriod: number;
    onUpdatePreferredDutyPeriod: (value: number) => void;
    timezoneOffset: number;
    onUpdateTimezoneOffset: (offset: number) => void;
    maxCrewDutyPeriod: number;
    onUpdateMaxCrewDutyPeriod: (value: number) => void;
    showDepartureDensityOverlay: boolean;
    onUpdateShowDepartureDensityOverlay: (value: boolean) => void;
    onUpdateTraineeLMPs: (updater: (prev: Map<string, any[]>) => Map<string, any[]>) => void;
    flightTurnaround: number;
    onUpdateFlightTurnaround: (value: number) => void;
    ftdTurnaround: number;
    onUpdateFtdTurnaround: (value: number) => void;
    cptTurnaround: number;
    onUpdateCptTurnaround: (value: number) => void;
    currentUserPermission: 'Super Admin' | 'Admin' | 'Staff' | 'Trainee' | 'Ops' | 'Scheduler' | 'Course Supervisor';
    activeSection?: 'scoring-matrix' | 'location' | 'units' | 'duty-turnaround' | 'sct-events' | 'currencies' | 'business-rules' | 'data-loaders' | 'event-limits' | 'permissions';
    maxDispatchPerHour: number;
    onUpdateMaxDispatchPerHour: (value: number) => void;
    courseColors: { [key: string]: string };
}

const FolderIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-400 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
);

const FileIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
);

const UpdateIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
    </svg>
);


// FIX: Export the component to make it available for import.
export const SettingsView: React.FC<SettingsViewProps> = ({ 
    locations, onUpdateLocations, 
    units, onUpdateUnits, 
    unitLocations, onUpdateUnitLocations,
    instructorsData, traineesData, syllabusDetails,
    onBulkUpdateInstructors, onReplaceInstructors,
    onBulkUpdateTrainees, onReplaceTrainees,
    onUpdateSyllabus, onShowSuccess,
    eventLimits, onUpdateEventLimits,
    phraseBank, onUpdatePhraseBank,
    onNavigate,
    masterCurrencies,
    coursePriorities,
    currencyRequirements,
    sctEvents,
    onUpdateSctEvents,
    preferredDutyPeriod,
    onUpdatePreferredDutyPeriod,
    maxCrewDutyPeriod,
    onUpdateMaxCrewDutyPeriod,
    flightTurnaround,
    onUpdateFlightTurnaround,
    ftdTurnaround,
    onUpdateFtdTurnaround,
    cptTurnaround,
    onUpdateCptTurnaround,
    currentUserPermission,
    activeSection = 'scoring-matrix',
    maxDispatchPerHour,
    onUpdateMaxDispatchPerHour,
    timezoneOffset,
    onUpdateTimezoneOffset,
    showDepartureDensityOverlay,
    onUpdateShowDepartureDensityOverlay,
    onUpdateTraineeLMPs,
       courseColors
}) => {
    // --- STATE ---
    
    // Permission Check - Only Super Admin, Admin, and Scheduler can edit Settings
    const canEditSettings = ['Super Admin', 'Admin', 'Scheduler'].includes(currentUserPermission);
    
    // Location State
    const [isEditingLocations, setIsEditingLocations] = useState(false);
    const [tempLocations, setTempLocations] = useState<string[]>([]);
    const [newLocation, setNewLocation] = useState('');

    // Unit State
    const [isEditingUnits, setIsEditingUnits] = useState(false);
    const [tempUnits, setTempUnits] = useState<string[]>([]);
    const [newUnit, setNewUnit] = useState('');
    const [tempUnitLocations, setTempUnitLocations] = useState<Record<string, string>>({});
    
    // SCT Events State
    const [isEditingSctEvents, setIsEditingSctEvents] = useState(false);
    
    // Permissions Manager State
    const [showPermissionsManager, setShowPermissionsManager] = useState(false);
    const [tempSctEvents, setTempSctEvents] = useState<string[]>([]);
    const [newSctEvent, setNewSctEvent] = useState('');
    
    // Event Limits State
    const [isEditingLimits, setIsEditingLimits] = useState(false);
    const [tempLimits, setTempLimits] = useState<EventLimits>(eventLimits);

    // Scoring Matrix State
    const [showScoringMatrix, setShowScoringMatrix] = useState(false);
    const [scoringMatrixTab, setScoringMatrixTab] = useState<'Airmanship' | 'Preparation' | 'Technique' | 'Elements'>('Airmanship');

    // Data Loader State
    const [repoFiles, setRepoFiles] = useState<{ id: string; name: string; folderId: string }[]>([]);
    const [showCourseSelection, setShowCourseSelection] = useState(false);
    const [pendingTrainees, setPendingTrainees] = useState<Trainee[]>([]);
    const [updateMode, setUpdateMode] = useState<'bulk' | 'minor'>('bulk');
    const [folders] = useState([
        { id: 'instructor_loads', name: 'Instructor Loads' },
        { id: 'trainee_loads', name: 'Trainee Loads' },
        { id: 'lmp_loads', name: 'LMP Loads' },
        { id: 'logbook_templates', name: 'Logbook Template' },
        { id: 'miscellaneous', name: 'Miscellaneous' },
        { id: 'trainee_data', name: 'Trainee Data' },
        { id: 'trainee_logbook', name: 'Logbook', isSub: true },
        { id: 'staff_data', name: 'Staff Data' },
        { id: 'staff_logbook', name: 'Logbook', isSub: true },
    ]);

    // Generate course options for selection dialog
    const courseOptions = useMemo(() => {
        if (!courseColors || typeof courseColors !== 'object') {
            console.warn('courseColors is not available:', courseColors);
            return [];
        }
        const courseList = Object.keys(courseColors).sort((a, b) => a.localeCompare(b));
        console.log('🎯 Available courses for selection:', courseList);
        return courseList.map(course => ({
            id: course,
            name: course
        }));
    }, [courseColors]);
    const [showUpload, setShowUpload] = useState(false);
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    const [showSelectDestination, setShowSelectDestination] = useState(false);
    const [fileToDownload, setFileToDownload] = useState<{ id: string; name: string } | null>(null);
    const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);

    // Update process state
    const [fileToProcess, setFileToProcess] = useState<{ id: string; name: string; folderId: string } | null>(null);
    const [showUpdateConfirmation, setShowUpdateConfirmation] = useState(false);
    const [showNewRecordConfirm, setShowNewRecordConfirm] = useState(false);
    const [unmatchedRowData, setUnmatchedRowData] = useState<any>(null);
    const [showUpdateError, setShowUpdateError] = useState(false);
    const [updateErrorMessage, setUpdateErrorMessage] = useState('');
    const [showUpdateSummary, setShowUpdateSummary] = useState(false);
    const [updateSummary, setUpdateSummary] = useState({ added: 0, updated: 0, replaced: 0, skipped: 0, type: '' });
    
    // State for iterative 'minor' update
    const [isMinorUpdateInProgress, setIsMinorUpdateInProgress] = useState(false);
    const [rowsToProcess, setRowsToProcess] = useState<any[]>([]);
    const [updatedRecords, setUpdatedRecords] = useState<any[]>([]);
    const [newRecords, setNewRecords] = useState<any[]>([]);
    const [skippedCount, setSkippedCount] = useState(0);

    // --- COMPUTED / MEMOIZED ---
    const folderIds = useMemo(() => new Set(folders.map(f => f.id)), [folders]);
    const uncategorizedFiles = useMemo(() => repoFiles.filter(file => !folderIds.has(file.folderId)), [repoFiles, folderIds]);

    const visibleCurrencies = useMemo(() => {
        return [...masterCurrencies, ...currencyRequirements]
            .filter(c => c.isVisible)
            .sort((a,b) => a.name.localeCompare(b.name));
    }, [masterCurrencies, currencyRequirements]);


    // --- EFFECTS ---
    useEffect(() => {
        const initAndFetch = async () => {
            try {
                await initDB();
                refreshFiles();
            } catch (error) {
                console.error("Failed to initialize DB:", error);
            }
        };
        initAndFetch();
    }, []);
    
    useEffect(() => {
        if (isMinorUpdateInProgress && rowsToProcess.length > 0) {
            processNextRow();
        } else if (isMinorUpdateInProgress && rowsToProcess.length === 0) {
            // Processing finished
            finishMinorUpdate();
        }
    }, [isMinorUpdateInProgress, rowsToProcess]);


    // --- HANDLERS ---
    
    const refreshFiles = async () => {
        const files = await getAllFiles();
        setRepoFiles(files);
    };

    // Location Handlers
    const handleEditLocations = () => {
        setTempLocations([...locations]);
        setIsEditingLocations(true);
    };

    const handleSaveLocations = () => {
        const oldLocations = locations.join(', ');
        const newLocations = tempLocations.join(', ');
        onUpdateLocations(tempLocations);
        setIsEditingLocations(false);
        logAudit({
            page: 'Settings - Location',
            action: 'update',
            description: 'Updated operating locations',
            changes: `From: [${oldLocations}] To: [${newLocations}]`
        });
    };

    const handleCancelLocations = () => {
        setNewLocation('');
        setIsEditingLocations(false);
    };
    
    const handleAddLocation = () => {
        if (newLocation && !tempLocations.includes(newLocation)) {
            setTempLocations([...tempLocations, newLocation]);
            setNewLocation('');
        }
    };

    const handleRemoveLocation = (locationToRemove: string) => {
        setTempLocations(tempLocations.filter(loc => loc !== locationToRemove));
    };

    // Unit Handlers
    const handleEditUnits = () => {
        setTempUnits([...units]);
        setTempUnitLocations({...unitLocations});
        setIsEditingUnits(true);
    };
    
    const handleSaveUnits = () => {
        const oldUnits = units.join(', ');
        const newUnits = tempUnits.join(', ');
        onUpdateUnits(tempUnits);
        
        const newUnitLocations: Record<string, string> = {};
        for(const unit of tempUnits) {
            newUnitLocations[unit] = tempUnitLocations[unit];
        }
        onUpdateUnitLocations(newUnitLocations);

        setIsEditingUnits(false);
        logAudit({
            page: 'Settings - Units',
            action: 'update',
            description: 'Updated organizational units and locations',
            changes: `From: [${oldUnits}] To: [${newUnits}]`
        });
    };

    const handleCancelUnits = () => {
        setNewUnit('');
        setIsEditingUnits(false);
    };

    const handleAddUnit = () => {
        if (newUnit && !tempUnits.includes(newUnit)) {
            setTempUnits([...tempUnits, newUnit]);
            setTempUnitLocations(prev => ({...prev, [newUnit]: locations[0] || ''}));
            setNewUnit('');
        }
    };

    const handleRemoveUnit = (unitToRemove: string) => {
        setTempUnits(tempUnits.filter(unit => unit !== unitToRemove));
        const newTempLocations = {...tempUnitLocations};
        delete newTempLocations[unitToRemove];
        setTempUnitLocations(newTempLocations);
    };

    // SCT Events Handlers
    const handleEditSctEvents = () => {
        setTempSctEvents([...sctEvents]);
        setIsEditingSctEvents(true);
    };

    const handleSaveSctEvents = () => {
        const oldEvents = sctEvents.join(', ');
        const newEvents = tempSctEvents.join(', ');
        onUpdateSctEvents(tempSctEvents);
        setIsEditingSctEvents(false);
        logAudit({
            page: 'Settings - SCT Events',
            action: 'update',
            description: 'Updated SCT event types',
            changes: `From: [${oldEvents}] To: [${newEvents}]`
        });
    };

    const handleCancelSctEvents = () => {
        setNewSctEvent('');
        setIsEditingSctEvents(false);
    };

    const handleAddSctEvent = () => {
        if (newSctEvent && !tempSctEvents.includes(newSctEvent)) {
            setTempSctEvents([...tempSctEvents, newSctEvent]);
            setNewSctEvent('');
        }
    };

    const handleRemoveSctEvent = (eventToRemove: string) => {
        setTempSctEvents(tempSctEvents.filter(evt => evt !== eventToRemove));
    };

    const handleTempUnitLocationChange = (unit: string, location: string) => {
        setTempUnitLocations(prev => ({
            ...prev,
            [unit]: location
        }));
    };

    // Event Limits Handlers
    const handleEditLimits = () => {
        setTempLimits(JSON.parse(JSON.stringify(eventLimits)));
        setIsEditingLimits(true);
    };

    const handleSaveLimits = () => {
        onUpdateEventLimits(tempLimits);
        setIsEditingLimits(false);
        onShowSuccess('Events limits updated');
        logAudit({
            page: 'Settings - Event Limits',
            action: 'update',
            description: 'Updated event scheduling limits',
            changes: 'Updated limits for QFI, Staff, Trainee, and SIM IP categories'
        });
    };

    // Duty & Turnaround Handlers with Audit Logging
    const handleUpdatePreferredDutyPeriod = (value: number) => {
        onUpdatePreferredDutyPeriod(value);
        logAudit({
            page: 'Settings - Duty & Turnaround',
            action: 'update',
            description: 'Updated preferred duty period',
            changes: `Set to: ${value} hours`
        });
    };

    const handleUpdateMaxCrewDutyPeriod = (value: number) => {
        onUpdateMaxCrewDutyPeriod(value);
        logAudit({
            page: 'Settings - Duty & Turnaround',
            action: 'update',
            description: 'Updated max crew duty period',
            changes: `Set to: ${value} hours`
        });
    };

    const handleUpdateFlightTurnaround = (value: number) => {
        onUpdateFlightTurnaround(value);
        logAudit({
            page: 'Settings - Duty & Turnaround',
            action: 'update',
            description: 'Updated flight turnaround time',
            changes: `Set to: ${value} minutes`
        });
    };

    const handleUpdateFtdTurnaround = (value: number) => {
        onUpdateFtdTurnaround(value);
        logAudit({
            page: 'Settings - Duty & Turnaround',
            action: 'update',
            description: 'Updated FTD turnaround time',
            changes: `Set to: ${value} minutes`
        });
    };

    const handleUpdateCptTurnaround = (value: number) => {
        onUpdateCptTurnaround(value);
        logAudit({
            page: 'Settings - Duty & Turnaround',
            action: 'update',
            description: 'Updated CPT turnaround time',
            changes: `Set to: ${value} minutes`
        });
    };

    // Scoring Matrix Handlers
    const handleOpenScoringMatrix = (tab: 'Airmanship' | 'Preparation' | 'Technique' | 'Elements') => {
        setScoringMatrixTab(tab);
        setShowScoringMatrix(true);
    };

    const handleUpdatePhraseBank = (newBank: PhraseBank) => {
        onUpdatePhraseBank(newBank);
        logAudit({
            page: 'Settings - Scoring Matrix',
            action: 'update',
            description: 'Updated scoring matrix phrase bank',
            changes: 'Modified scoring criteria and phrases'
        });
    };

    // Data Loader Handlers
    const handleUploadClick = () => {
        setShowUpload(true);
    };

    const handleUploadConfirm = (file: File) => {
        setFileToUpload(file);
        setShowUpload(false);
        setShowSelectDestination(true);
    };
    
    const handleDestinationConfirm = async (folderId: string) => {
        if (fileToUpload) {
            const now = new Date();
            const year = now.getFullYear().toString().slice(-2);
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const formattedDate = `${year}${month}${day}`;

            const folder = folders.find(f => f.id === folderId);
            const folderName = folder ? folder.name.replace(/\s+/g, '_') : 'Uncategorized';

            const originalFileName = fileToUpload.name;
            const newFileName = `${formattedDate}_${folderName}_${originalFileName}`;

            await addFile(fileToUpload, folderId, newFileName);
            refreshFiles();
            logAudit({
                page: 'Settings - Data Loaders',
                action: 'create',
                description: `Uploaded file to ${folderName}`,
                changes: `File: ${newFileName}`
            });
        }
        setShowSelectDestination(false);
        setFileToUpload(null);
    };

    const handleDownloadClick = (file: { id: string; name: string }) => {
        setFileToDownload(file);
    };

    const handleDownloadConfirm = async () => {
        if (fileToDownload) {
            const record = await getFile(fileToDownload.id);
            if (record) {
                const url = URL.createObjectURL(record.content);
                const a = document.createElement('a');
                a.href = url;
                a.download = record.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            setFileToDownload(null);
        }
    };

    const handleDeleteClick = (file: { id: string; name: string }) => {
        setFileToDelete(file);
    };

    const handleDeleteConfirm = async () => {
        if (fileToDelete) {
            await deleteFile(fileToDelete.id);
            refreshFiles();
            logAudit({
                page: 'Settings - Data Loaders',
                action: 'delete',
                description: 'Deleted file from data loaders',
                changes: `File: ${fileToDelete.name}`
            });
            setFileToDelete(null);
        }
    };

    const handleDownloadInstructorTemplate = () => {
        const headers = ['PMKeys/ID', 'Srname', 'First name', 'Service', 'Rank', 'callsign number', 'Roles', 'Category', 'Seat config'];
        const ws = XLSX.utils.json_to_sheet([{}], { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Instructors");
        XLSX.writeFile(wb, "Instructor_Bulk_Update_Template.xlsx");
    };

    const handleDownloadTraineeTemplate = () => {
        const headers = ['PMKeys/ID', 'Surname', 'First Name', 'Course', 'Rank', 'Service', 'Unit', 'Location', 'Phone Number', 'Email', 'Primary Instructor', 'Secondary Instructor', 'Tertiary Instructor', 'Seat Config', 'Is Paused (TRUE/FALSE)'];
        const ws = XLSX.utils.json_to_sheet([{}], { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trainees");
        XLSX.writeFile(wb, "Trainee_Bulk_Update_Template.xlsx");
    };
    
    const handleDownloadLmpTemplate = () => {
        const headers = [
            'Code', 
            'Phase', 
            'Module', 
            'Event description', 
            'Pre-requisite Events (Ground School)', 
            'Pre-requisite Events (Sim/Flying)', 
            'Event Details - Common', 
            'Event Details - Sortie', 
            'Total Event Hours', 
            'Flight or Sim Hours', 
            'Method/s of Delivery', 
            'Type/s and Method/s of Assessment', 
            'Resources Required (physical)', 
            'Resources Required (Human)'
        ];
        const ws = XLSX.utils.json_to_sheet([{}], { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Syllabus_LMP");
        XLSX.writeFile(wb, "LMP_Syllabus_Template.xlsx");
    };

    const handleDownloadLogbookTemplate = () => {
        const headers = ['Date', 'Aircraft', 'Pilot', 'Student', 'Sortie', 'Duration', 'Result'];
        const ws = XLSX.utils.json_to_sheet([{}], { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Logbook");
        XLSX.writeFile(wb, "Logbook_Template.xlsx");
    };
    
    const handleDownloadManual = () => {
        const manualHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Daily Flying Program (DFP) Scheduler - User Manual</title>
                <style>
                    body { font-family: Calibri, sans-serif; line-height: 1.6; color: #333; }
                    h1, h2, h3, h4 { font-family: 'Cambria', serif; color: #2F5496; }
                    h1 { font-size: 24pt; border-bottom: 2px solid #4472C4; padding-bottom: 5px; }
                    h2 { font-size: 18pt; border-bottom: 1px solid #A9A9A9; padding-bottom: 3px; margin-top: 2em; }
                    h3 { font-size: 14pt; color: #4472C4; margin-top: 1.5em; }
                    p { margin: 0 0 1em 0; }
                    ul { margin-bottom: 1em; }
                    strong { color: #1F3864; }
                    .image-placeholder {
                        border: 2px dashed #A9A9A9;
                        padding: 20px;
                        margin: 20px 0;
                        background-color: #F0F0F0;
                        text-align: center;
                        font-style: italic;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <h1>Daily Flying Program (DFP) Scheduler - User Manual</h1>
                <p>...</p> 
            </body>
            </html>
        `;

        const blob = new Blob([manualHtml], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'DFP_User_Manual.doc';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- Data Update Logic ---
    const handleUpdateIconClick = (file: { id: string, name: string, folderId: string }) => {
        setFileToProcess(file);
        setShowUpdateConfirmation(true);
    };

    const handleUpdateConfirm = (pin: string, updateType: 'bulk' | 'minor') => {
        if (pin !== '1111') { 
            onShowSuccess('Incorrect PIN.');
            return;
        }
        setShowUpdateConfirmation(false);
        processFileUpdate(updateType);
    };

    const processFileUpdate = async (updateType: 'bulk' | 'minor') => {
        if (!fileToProcess) return;

        try {
            const fileRecord = await getFile(fileToProcess.id);
            if (!fileRecord) throw new Error('File not found');

            const data = await fileRecord.content.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet);

            if (updateType === 'bulk') {
                handleBulkUpdate(jsonRows);
            } else {
                startMinorUpdate(jsonRows);
            }
        } catch (error) {
            console.error("File processing error:", error);
            onShowSuccess(`Error processing file: ${(error as Error).message}`);
        }
    };
    
    // Helper to get a value from a row with fuzzy key matching
    const getValueFromRow = (row: any, possibleKeys: string[]): any => {
        for (const pKey of possibleKeys) {
            // Try exact match first
            if (row[pKey] !== undefined) return row[pKey];
        }
        // Then try case-insensitive, space-insensitive match
        const rowKeys = Object.keys(row);
        for (const pKey of possibleKeys) {
            const lowerPKey = pKey.toLowerCase().replace(/[\s/]/g, '');
            for (const rowKey of rowKeys) {
                if (rowKey.toLowerCase().replace(/[\s/]/g, '') === lowerPKey) {
                    return row[rowKey];
                }
            }
        }
        return undefined;
    };

    const parseBoolean = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
        return !!value;
    };

    const getStr = (row: any, keys: string[]) => {
        const val = getValueFromRow(row, keys);
        return val !== undefined ? String(val).trim() : undefined;
    };
    const getNum = (row: any, keys: string[]) => {
        const val = getValueFromRow(row, keys);
        if (val === undefined || val === null || String(val).trim() === '') return undefined;
        // Handle numbers with trailing letters (e.g., '1.2D')
        const num = parseFloat(String(val).replace(/[A-Za-z]/g, '').trim());
        return isNaN(num) ? undefined : num;
    };
    const getStrArray = (row: any, keys: string[]) => {
        const val = getValueFromRow(row, keys);
        if (val === undefined || val === null) return undefined;
        return String(val).split(';').map(s => s.trim()).filter(Boolean);
    };

    const parseInstructorRow = (row: any): Partial<Instructor> | null => {
        const idValue = getNum(row, ['PMKeys/ID', 'idNumber']);
        if (idValue === undefined) return null;

        const parsed: Partial<Instructor> = { idNumber: idValue };
        
        const surname = getStr(row, ['Srname', 'Surname', 'Last Name']);
        const firstname = getStr(row, ['First name', 'Firstname', 'Given Name']);
        if (surname && firstname) parsed.name = `${surname}, ${firstname}`;

        const rank = getStr(row, ['Rank']); if (rank) parsed.rank = rank as InstructorRank;
        const callsign = getNum(row, ['callsign number', 'callsignnumber']); if (callsign !== undefined) parsed.callsignNumber = callsign;
        const service = getStr(row, ['Service']); if (service) parsed.service = service as 'RAAF' | 'RAN' | 'ARA';
        const category = getStr(row, ['Category']); if (category) parsed.category = category as InstructorCategory;
        const seatConfig = getStr(row, ['Seat config', 'seatConfig']); if (seatConfig) parsed.seatConfig = seatConfig as SeatConfig;
        
        const rolesStr = getStr(row, ['Roles']);
        if (rolesStr) {
            const rolesLower = rolesStr.toLowerCase();
            parsed.isExecutive = rolesLower.includes('executive');
            parsed.isFlyingSupervisor = rolesLower.includes('supervisor');
            parsed.isTestingOfficer = rolesLower.includes('testing');
            parsed.isIRE = rolesLower.includes('ire');
        }

        return parsed;
    };

    const parseTraineeRow = (row: any): Partial<Trainee> | null => {
        console.log('🟠 ========== PARSE TRAINEE ROW START ==========');
        console.log('🟠 Input row:', row);
        console.log('🟠 Available columns:', Object.keys(row));
        
        const idValue = getNum(row, ['PMKeys/ID', 'idNumber']);
        console.log('🟠 Extracted ID:', idValue);
        if (idValue === undefined) {
            console.log('🟠 Row rejected: No ID found');
            return null;
        }

        const parsed: Partial<Trainee> = { idNumber: idValue };

        // Try multiple field name variations for names
        const surname = getStr(row, ['Surname', 'Last Name', 'surname', 'last_name', 'lastName']);
        const firstname = getStr(row, ['First Name', 'Firstname', 'Given Name', 'first_name', 'firstName', 'givenName']);
        console.log('🟠 Name parts - Surname:', surname, 'Firstname:', firstname);
        
        if (surname && firstname) {
            parsed.name = `${surname}, ${firstname}`;
            console.log('🟠 Constructed name:', parsed.name);
        } else {
            // Fallback: try to find any field with "name" in it
            const allColumns = Object.keys(row);
            const nameColumn = allColumns.find(col => 
                col.toLowerCase().includes('name') && row[col] && row[col].toString().trim()
            );
            if (nameColumn) {
                parsed.name = row[nameColumn].toString().trim();
                console.log('🟠 Fallback name from column:', nameColumn, 'value:', parsed.name);
            } else {
                console.log('🟠 Missing name parts - using ID as fallback');
                parsed.name = `Trainee ${idValue}`;
            }
        }

        // Try multiple field name variations for course
        const course = getStr(row, ['Course', 'course', 'COURSE', 'class', 'Class']); 
        if (course) {
            parsed.course = course;
            console.log('🟠 Course:', course);
        } else {
            console.log('🟠 No course found - using default');
            parsed.course = 'No Course';
        }
        
        const rank = getStr(row, ['Rank']); if (rank) parsed.rank = rank as TraineeRank;
        const service = getStr(row, ['Service']); if (service) parsed.service = service as 'RAAF' | 'RAN' | 'ARA';
        const unit = getStr(row, ['Unit']); if (unit) parsed.unit = unit;
        const location = getStr(row, ['Location']); if (location) parsed.location = location;
        const phone = getStr(row, ['Phone Number', 'phoneNumber']); if (phone) parsed.phoneNumber = phone;
        const email = getStr(row, ['Email']); if (email) parsed.email = email;
        const primary = getStr(row, ['Primary Instructor', 'primaryInstructor']); if (primary) parsed.primaryInstructor = primary;
        const secondary = getStr(row, ['Secondary Instructor', 'secondaryInstructor']); if (secondary) parsed.secondaryInstructor = secondary;
        const seatConfig = getStr(row, ['Seat Config', 'seatConfig']); if (seatConfig) parsed.seatConfig = seatConfig as SeatConfig;

        const isPaused = getValueFromRow(row, ['Is Paused', 'isPaused']);
        if (isPaused !== undefined) parsed.isPaused = parseBoolean(isPaused);
        
        // Enhanced LMP field parsing - try multiple column variations including Column F
          const lmpType = getStr(row, ['LMP', 'LMP Type', 'lmp', 'lmpType', 'lmp_type', 'Column F', 'F']) ||
                         getStr(Object.fromEntries(
                             Object.entries(row).filter(([key]) => 
                                 key.trim().toLowerCase() === 'f' || 
                                 key.toLowerCase().includes('lmp')
                             )
                         ), Object.keys(row).find(k => k.trim() === 'F') || '');
        if (lmpType) {
            parsed.lmpType = lmpType;
            console.log('\ud83d\udfe0 LMP Type:', lmpType);
        }

        if (parsed.name && parsed.course) {
            parsed.fullName = `${parsed.name} – ${parsed.course}`;
            console.log('🟠 Constructed fullName:', parsed.fullName);
        } else {
            console.log('🟠 Cannot construct fullName - missing name or course');
        }
        
        console.log('🟠 Final parsed trainee:', parsed);
        console.log('🟠 ========== PARSE TRAINEE ROW END ==========');
        return parsed;
    };

    const parseLmpRow = (row: any): Partial<SyllabusItemDetail> | null => {
        const code = getStr(row, ['Code']);
        if (!code) return null;
        
        const parsed: Partial<SyllabusItemDetail> = { code };

        const phase = getStr(row, ['Phase']); if (phase) parsed.phase = phase;
        const module = getStr(row, ['Module']); if (module) parsed.module = module;
        const desc = getStr(row, ['Event description', 'eventDescription']); if (desc) parsed.eventDescription = desc;
        const prereqGround = getStrArray(row, ['Pre-requisite Events (Ground School)', 'prerequisitesGround']); if (prereqGround) parsed.prerequisitesGround = prereqGround;
        const prereqFlying = getStrArray(row, ['Pre-requisite Events (Sim/Flying)', 'prerequisitesFlying']); if (prereqFlying) parsed.prerequisitesFlying = prereqFlying;
        if (prereqGround || prereqFlying) parsed.prerequisites = [...(prereqGround || []), ...(prereqFlying || [])];
        const detailsCommon = getStrArray(row, ['Event Details - Common', 'eventDetailsCommon']); if (detailsCommon) parsed.eventDetailsCommon = detailsCommon;
        const detailsSortie = getStrArray(row, ['Event Details - Sortie', 'eventDetailsSortie']); if (detailsSortie) parsed.eventDetailsSortie = detailsSortie;
        const totalHours = getNum(row, ['Total Event Hours', 'totalEventHours']); if(totalHours !== undefined) parsed.totalEventHours = totalHours;
        const flightSimHours = getNum(row, ['Flight or Sim Hours', 'flightOrSimHours']);
        if(flightSimHours !== undefined) {
             parsed.flightOrSimHours = flightSimHours;
             parsed.duration = flightSimHours;
        }
        const delivery = getStrArray(row, ['Method/s of Delivery', 'methodOfDelivery']); if (delivery) parsed.methodOfDelivery = delivery;
        const assessment = getStrArray(row, ['Type/s and Method/s of Assessment', 'methodOfAssessment']); if (assessment) parsed.methodOfAssessment = assessment;
        const resourcesPhy = getStrArray(row, ['Resources Required (physical)', 'resourcesPhysical']); if (resourcesPhy) parsed.resourcesPhysical = resourcesPhy;
        const resourcesHum = getStrArray(row, ['Resources Required (Human)', 'resourcesHuman']); if (resourcesHum) parsed.resourcesHuman = resourcesHum;
        
        return parsed;
    };


    const handleBulkUpdate = (rows: any[]) => {
        if (!fileToProcess) return;

        let processedCount = 0;
        let finalRows: any[] = [];
        switch (fileToProcess.folderId) {
            case 'instructor_loads':
                finalRows = rows.map(parseInstructorRow).filter(i => i && i.idNumber);
                onReplaceInstructors(finalRows as Instructor[]);
                break;
            case 'trainee_loads':
                console.log('🔴 ========== BULK UPDATE TRAINEES START ==========');
                console.log('🔴 Raw rows count:', rows.length);
                console.log('🔴 Raw rows sample:', rows.slice(0, 3));
                
                finalRows = rows.map(parseTraineeRow).filter(t => t && t.idNumber);
                console.log('🔴 Parsed trainees count:', finalRows.length);
                console.log('🔴 Parsed trainees sample:', finalRows.slice(0, 3));
                console.log('🔴 Current traineesData count:', traineesData.length);
                
                // Use UPDATE instead of REPLACE to preserve existing trainees
                handleBulkUpdateWithCourseSelection(finalRows as Trainee[], 'bulk');
                console.log('🔴 ========== BULK UPDATE TRAINEES END ==========');
                break;
            case 'lmp_loads':
                finalRows = rows.map(parseLmpRow).filter(s => s && s.code);
                onUpdateSyllabus(finalRows as SyllabusItemDetail[]); // LMP update is always a merge/replace for now
                break;
        }
        processedCount = finalRows.length;
        setUpdateSummary({ type: 'Bulk', replaced: processedCount, added: 0, updated: 0, skipped: rows.length - processedCount });
        setShowUpdateSummary(true);
        
        // Log audit for bulk update
        const dataType = fileToProcess.folderId === 'instructor_loads' ? 'Instructors' : 
                        fileToProcess.folderId === 'trainee_loads' ? 'Trainees' : 'LMP Data';
        logAudit({
            page: 'Settings - Data Loaders',
            action: 'update',
            description: `Bulk update: ${dataType}`,
            changes: `Replaced ${processedCount} records from file: ${fileToProcess.name}`
        });
        
        setFileToProcess(null);
    };
    
    const startMinorUpdate = (rows: any[]) => {
        setRowsToProcess(rows);
        setUpdatedRecords([]);
        setNewRecords([]);
        setSkippedCount(0);
        setIsMinorUpdateInProgress(true);
    };
    
    const processNextRow = () => {
        if (!fileToProcess) {
            setIsMinorUpdateInProgress(false);
            return;
        }

        const [row, ...remainingRows] = rowsToProcess;
        setRowsToProcess(remainingRows);
        
        let parsedData: any;
        let existingRecord: any;

        switch (fileToProcess.folderId) {
            case 'instructor_loads':
                parsedData = parseInstructorRow(row);
                if (!parsedData?.idNumber) { setSkippedCount(prev => prev + 1); return; }
                existingRecord = instructorsData.find(i => i.idNumber === parsedData.idNumber);
                break;
            case 'trainee_loads':
                parsedData = parseTraineeRow(row);
                if (!parsedData?.idNumber) { setSkippedCount(prev => prev + 1); return; }
                existingRecord = traineesData.find(t => t.idNumber === parsedData.idNumber);
                break;
            case 'lmp_loads':
                parsedData = parseLmpRow(row);
                if (!parsedData?.code) { setSkippedCount(prev => prev + 1); return; }
                existingRecord = syllabusDetails.find(s => 
                    s.code.trim().replace(/\s/g, '').toLowerCase() === String(parsedData.code).trim().replace(/\s/g, '').toLowerCase()
                );
                break;
            default:
                setSkippedCount(prev => prev + 1);
                return;
        }

        if (existingRecord) {
            const updated = { ...existingRecord, ...parsedData };
            setUpdatedRecords(prev => [...prev, updated]);
        } else {
            // Unmatched record, pause processing and ask user
            setUnmatchedRowData(parsedData);
            setShowNewRecordConfirm(true);
            setIsMinorUpdateInProgress(false); // Pause
        }
    };
    
    // Custom bulk update function that preserves existing trainees instead of replacing them
    // Custom bulk update function that preserves existing trainees instead of replacing them
    const handleSafeBulkUpdateTrainees = (updatedTrainees: Trainee[]) => {
        console.log('🔵 ========== CUSTOM BULK UPDATE START ==========');
        console.log('🔵 Updated trainees count:', updatedTrainees.length);
        console.log('🔵 Current traineesData count:', traineesData.length);
        
        const updatedMap = new Map(updatedTrainees.map(t => [t.idNumber, t]));
        const existingIds = new Set(traineesData.map(t => t.idNumber));
        const updatedExisting = traineesData.map(t => updatedMap.get(t.idNumber) || t);
        const newToAdd = updatedTrainees.filter(ut => !existingIds.has(ut.idNumber));
        
        const finalTrainees = [...updatedExisting, ...newToAdd];
        console.log('🔵 Final trainees count:', finalTrainees.length);
        console.log('🔵 Updated existing count:', updatedExisting.length);
        console.log('🔵 New trainees added count:', newToAdd.length);
        
        onBulkUpdateTrainees(finalTrainees);
           
           // Update traineeLMPs for new trainees based on their lmpType
           console.log("\ud83d\udd35 Updating traineeLMPs for new trainees...");
           onUpdateTraineeLMPs && onUpdateTraineeLMPs((prevLMPs: Map<string, any[]>) => {
               const newLMPs = new Map(prevLMPs);
               
               newToAdd.forEach(trainee => {
                   if (trainee.fullName && trainee.lmpType) {
                       console.log(`\ud83d\udd35 Adding LMP data for ${trainee.fullName} with type ${trainee.lmpType}`);
                       // For now, use INITIAL_SYLLABUS_DETAILS as default LMP data
                       // In the future, this could be customized based on lmpType
                       // Filter syllabus events by LMP type to get only relevant events
                          const lmpSpecificSyllabus = filterSyllabusByLMPType(INITIAL_SYLLABUS_DETAILS, trainee.lmpType);
                          console.log(`\ud83d\udd35 Filtered ${lmpSpecificSyllabus.length} events for LMP type ${trainee.lmpType}`);
                          newLMPs.set(trainee.fullName, lmpSpecificSyllabus);
                   }
               });
               
               console.log(`\ud83d\udd35 Updated traineeLMPs with ${newToAdd.length} new entries`);
               return newLMPs;
           });
        console.log('🔵 ========== CUSTOM BULK UPDATE END ==========');
    };

    // Course selection handlers
    const handleCourseSelection = (courseId: string) => {
        console.log(`\ud83d\udd35 Selected course for ${updateMode} update:`, courseId);
        
        // Assign the selected course to all pending trainees
        const traineesWithCourse = pendingTrainees.map(trainee => ({
            ...trainee,
            course: courseId,
            fullName: trainee.name ? `${trainee.name} – ${courseId}` : trainee.idNumber
        }));
        
        console.log(`\ud83d\udd35 Updated ${traineesWithCourse.length} trainees with course: ${courseId}`);
        
        // Now proceed with the update
        if (updateMode === 'bulk') {
            handleSafeBulkUpdateTrainees(traineesWithCourse);
        } else {
            // For minor update, add to existing trainees
            const finalUpdatedList = [...traineesData];
            traineesWithCourse.forEach(trainee => {
                const index = finalUpdatedList.findIndex(t => t.idNumber === trainee.idNumber);
                if (index !== -1) {
                    finalUpdatedList[index] = trainee;
                }
            });
            onBulkUpdateTrainees([...finalUpdatedList, ...traineesWithCourse.filter(t => !finalUpdatedList.some(et => et.idNumber === t.idNumber))]);
        }
        
        // Reset state
        setShowCourseSelection(false);
        setPendingTrainees([]);
        setUpdateMode('bulk');
    };

    const handleCourseSelectionCancel = () => {
        console.log('\ud83d\udd35 Course selection cancelled');
        setShowCourseSelection(false);
        setPendingTrainees([]);
        setUpdateMode('bulk');
    };

    // Modified bulk update that prompts for course selection
    const handleBulkUpdateWithCourseSelection = (trainees: Trainee[], mode: 'bulk' | 'minor' = 'bulk') => {
        if (!courseOptions.length) {
            console.warn('\ud83d\udd35 No courses available for selection');
            onShowSuccess('No courses available. Please add courses first.');
            return;
        }
        
        console.log(`\ud83d\udd35 Initiating ${mode} update with course selection`);
        console.log('\ud83d\udd35 Pending trainees:', trainees.length);
        console.log('\ud83d\udd35 Available courses:', courseOptions.map(c => c.name));
        
        setPendingTrainees(trainees);
        setUpdateMode(mode);
        setShowCourseSelection(true);
    };

    const finishMinorUpdate = () => {
        setIsMinorUpdateInProgress(false);
        if (!fileToProcess) return;

        let finalUpdatedList: any[] = [];

        switch(fileToProcess.folderId) {
            case 'instructor_loads':
                finalUpdatedList = [...instructorsData];
                updatedRecords.forEach(ur => {
                    const index = finalUpdatedList.findIndex(i => i.idNumber === ur.idNumber);
                    if (index !== -1) finalUpdatedList[index] = ur;
                });
                onBulkUpdateInstructors([...finalUpdatedList, ...newRecords]);
                break;
            case 'trainee_loads':
                 console.log('🔴 ========== MINOR UPDATE TRAINEES START ==========');
                 console.log('🔴 Current traineesData count:', traineesData.length);
                 console.log('🔴 Updated records count:', updatedRecords.length);
                 console.log('🔴 New records count:', newRecords.length);
                 console.log('🔴 Updated records sample:', updatedRecords.slice(0, 3));
                 console.log('🔴 New records sample:', newRecords.slice(0, 3));
                 
                 finalUpdatedList = [...traineesData];
                 updatedRecords.forEach(ur => {
                    const index = finalUpdatedList.findIndex(t => t.idNumber === ur.idNumber);
                    if (index !== -1) {
                        console.log('🔴 Updating trainee:', ur.idNumber, ur.name);
                        finalUpdatedList[index] = ur;
                    } else {
                        console.log('🔴 Trainee not found for update:', ur.idNumber);
                    }
                });
                console.log('🔴 Final list count before update:', finalUpdatedList.length);
                // Use course selection for new records in minor update
                const allRecordsToUpdate = [...finalUpdatedList, ...newRecords];
                if (newRecords.length > 0) {
                    handleBulkUpdateWithCourseSelection(newRecords as Trainee[], 'minor');
                } else {
                    // Only existing records were updated, no course selection needed
                    onBulkUpdateTrainees([...finalUpdatedList]);
                }
                console.log('🔴 ========== MINOR UPDATE TRAINEES END ==========');
                break;
            case 'lmp_loads':
                const updatedMap = new Map(updatedRecords.map(s => [s.code.trim().replace(/\s/g, '').toLowerCase(), s]));
                const finalSyllabus = syllabusDetails.map(s => {
                    const key = s.code.trim().replace(/\s/g, '').toLowerCase();
                    return updatedMap.get(key) || s;
                });
                onUpdateSyllabus([...finalSyllabus, ...newRecords]);
                break;
        }
        
        setUpdateSummary({ type: 'Minor', added: newRecords.length, updated: updatedRecords.length, skipped: skippedCount, replaced: 0 });
        setShowUpdateSummary(true);

        // Log audit for minor update
        const dataType = fileToProcess.folderId === 'instructor_loads' ? 'Instructors' : 
                        fileToProcess.folderId === 'trainee_loads' ? 'Trainees' : 'LMP Data';
        logAudit({
            page: 'Settings - Data Loaders',
            action: 'update',
            description: `Minor update: ${dataType}`,
            changes: `Added ${newRecords.length}, Updated ${updatedRecords.length}, Skipped ${skippedCount} from file: ${fileToProcess.name}`
        });

        // Reset state
        setFileToProcess(null);
        setRowsToProcess([]);
        setNewRecords([]);
        setUpdatedRecords([]);
        setSkippedCount(0);
    };

    const handleConfirmNewRecord = () => {
        if (unmatchedRowData) {
            setNewRecords(prev => [...prev, unmatchedRowData]);
        }
        setShowNewRecordConfirm(false);
        setUnmatchedRowData(null);
        setIsMinorUpdateInProgress(true); // Resume
    };

    const handleRejectNewRecord = () => {
        setSkippedCount(prev => prev + 1);
        setShowNewRecordConfirm(false);
        setUnmatchedRowData(null);
        setIsMinorUpdateInProgress(true); // Resume
    };


    const FileListItem: React.FC<{file: {id: string; name: string; folderId: string}}> = ({ file }) => (
         <li key={file.id} className="flex items-center justify-between p-2 bg-gray-700/50 rounded text-sm group">
            <div className="flex items-center truncate">
                <FileIcon />
                <span className="truncate text-white" title={file.name}>{file.name}</span>
            </div>
            <div className="flex space-x-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleUpdateIconClick(file)} className="p-1 text-gray-400 hover:text-green-400" aria-label="Update from file">
                    <UpdateIcon />
                </button>
                <button onClick={() => handleDownloadClick(file)} className="p-1 text-gray-400 hover:text-sky-400" aria-label="Download file"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                <button onClick={() => handleDeleteClick(file)} className="p-1 text-gray-400 hover:text-red-400" aria-label="Delete file"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
            </div>
        </li>
    );

    return (
        <>
            <div className="space-y-6">
                {/* Validation Settings Window */}
                {activeSection === 'validation' && (
                <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6 w-96">
                    <div className="p-4 flex justify-between items-center border-b border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-200">Validation Settings</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">
                                One Hour Departure Density Overlay
                            </label>
                            <div className="flex items-center space-x-3">
                                <span className="text-sm text-gray-400">Off</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={showDepartureDensityOverlay}
                                        onChange={(e) => onUpdateShowDepartureDensityOverlay(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                                </label>
                                <span className="text-sm text-gray-400">On</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                When enabled, shows a translucent overlay in Validate mode that counts flight start times within a 1-hour window (30 minutes before/after mouse position).
                            </p>
                        </div>
                    </div>
                </div>
                )}
                
                {/* Timezone Settings Window */}
                {activeSection === 'timezone' && (
                <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6 w-96">
                    <div className="p-4 flex justify-between items-center border-b border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-200">Timezone Settings</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Timezone Offset (UTC)
                            </label>
                            <select 
                                value={timezoneOffset} 
                                onChange={(e) => onUpdateTimezoneOffset(parseFloat(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="-12">UTC-12:00</option>
                                <option value="-11">UTC-11:00</option>
                                <option value="-10">UTC-10:00 (Hawaii)</option>
                                <option value="-9">UTC-09:00 (Alaska)</option>
                                <option value="-8">UTC-08:00 (Pacific)</option>
                                <option value="-7">UTC-07:00 (Mountain)</option>
                                <option value="-6">UTC-06:00 (Central)</option>
                                <option value="-5">UTC-05:00 (Eastern)</option>
                                <option value="-4">UTC-04:00</option>
                                <option value="-3">UTC-03:00</option>
                                <option value="-2">UTC-02:00</option>
                                <option value="-1">UTC-01:00</option>
                                <option value="0">UTC+00:00 (GMT/UTC)</option>
                                <option value="1">UTC+01:00 (CET)</option>
                                <option value="2">UTC+02:00</option>
                                <option value="3">UTC+03:00</option>
                                <option value="4">UTC+04:00</option>
                                <option value="5">UTC+05:00</option>
                                <option value="5.5">UTC+05:30 (India)</option>
                                <option value="6">UTC+06:00</option>
                                <option value="7">UTC+07:00</option>
                                <option value="8">UTC+08:00 (Singapore/Perth)</option>
                                <option value="9">UTC+09:00 (Japan/Korea)</option>
                                <option value="9.5">UTC+09:30 (Adelaide)</option>
                                <option value="10">UTC+10:00 (AEST Sydney/Brisbane)</option>
                                <option value="10.5">UTC+10:30</option>
                                <option value="11">UTC+11:00 (AEDT Sydney)</option>
                                <option value="12">UTC+12:00 (New Zealand)</option>
                                <option value="13">UTC+13:00 (NZDT)</option>
                            </select>
                            <p className="mt-2 text-xs text-gray-400">
                                Current server time: {new Date().toUTCString()}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                                Your local time: {new Date(Date.now() + timezoneOffset * 60 * 60 * 1000).toUTCString()}
                            </p>
                        </div>
                    </div>
                </div>
                )}

                {/* Scoring Matrix Window */}
                {activeSection === 'scoring-matrix' && (
                <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
                        <div className="p-4 flex justify-between items-center border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-200">Scoring Matrix</h2>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3">
                            <button onClick={() => handleOpenScoringMatrix('Airmanship')} className="px-3 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-sky-700 hover:text-white transition-colors text-sm font-medium border border-gray-600">
                                Airmanship
                            </button>
                            <button onClick={() => handleOpenScoringMatrix('Preparation')} className="px-3 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-sky-700 hover:text-white transition-colors text-sm font-medium border border-gray-600">
                                Preparation
                            </button>
                            <button onClick={() => handleOpenScoringMatrix('Technique')} className="px-3 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-sky-700 hover:text-white transition-colors text-sm font-medium border border-gray-600">
                                Technique
                            </button>
                            <button onClick={() => handleOpenScoringMatrix('Elements')} className="px-3 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-sky-700 hover:text-white transition-colors text-sm font-medium border border-gray-600">
                                Elements
                            </button>
                        </div>
                    </div>
                   )}

                    {/* Location Window */}
                   {activeSection === 'location' && (
                    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-80 h-fit">
                        <div className="p-4 flex justify-between items-center border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-200">Location</h2>
                            {isEditingLocations ? (
                                <div className="flex space-x-2">
                                    <button onClick={handleSaveLocations} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">Save</button>
                                    <button onClick={handleCancelLocations} className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-semibold">Cancel</button>
                                </div>
                            ) : (
                                <button 
                                   onClick={handleEditLocations} 
                                   disabled={!canEditSettings}
                                   className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                       canEditSettings 
                                           ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer' 
                                           : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                   }`}
                               >
                                   Edit
                               </button>
                            )}
                        </div>
                        <div className="p-4 space-y-4">
                            {isEditingLocations ? (
                                <>
                                    <p className="text-sm text-gray-400">Manage available operating locations.</p>
                                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                                        {tempLocations.map(loc => (
                                            <li key={loc} className="flex items-center justify-between p-2 bg-gray-700/50 rounded">
                                                <span className="text-white">{loc}</span>
                                                <button onClick={() => handleRemoveLocation(loc)} className="p-1 text-gray-400 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg></button>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="flex space-x-2">
                                        <input type="text" value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="New location name" className="flex-grow bg-gray-700 border-gray-600 rounded-md py-1 px-2 text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        <button onClick={handleAddLocation} className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold">Add</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-400">Configured operating locations.</p>
                                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                                        {locations.map(loc => (
                                            <li key={loc} className="p-2 bg-gray-700/50 rounded text-white">
                                                {loc}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    </div>
                   )}

                    {/* Units Window */}
                   {activeSection === 'units' && (
                    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-80 h-fit">
                        <div className="p-4 flex justify-between items-center border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-200">Units</h2>
                            {isEditingUnits ? (
                                <div className="flex space-x-2">
                                    <button onClick={handleSaveUnits} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">Save</button>
                                    <button onClick={handleCancelUnits} className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-semibold">Cancel</button>
                                </div>
                            ) : (
                                <button 
                                onClick={handleEditUnits} 
                                disabled={!canEditSettings}
                                className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                    canEditSettings 
                                        ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer' 
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                Edit
                            </button>
                            )}
                        </div>
                        <div className="p-4 space-y-4">
                            {isEditingUnits ? (
                                <>
                                    <p className="text-sm text-gray-400">Manage units and their primary locations.</p>
                                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                                        {tempUnits.map(unit => (
                                            <li key={unit} className="p-2 bg-gray-700/50 rounded">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-white">{unit}</span>
                                                    <button onClick={() => handleRemoveUnit(unit)} className="p-1 text-gray-400 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg></button>
                                                </div>
                                                <select
                                                    value={tempUnitLocations[unit] || ''}
                                                    onChange={(e) => handleTempUnitLocationChange(unit, e.target.value)}
                                                    className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md py-1 px-2 text-white text-xs"
                                                >
                                                    {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                                </select>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="flex space-x-2">
                                        <input type="text" value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="New unit name" className="flex-grow bg-gray-700 border-gray-600 rounded-md py-1 px-2 text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        <button onClick={handleAddUnit} className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold">Add</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-400">Configured units and their locations.</p>
                                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                                        {units.map(unit => (
                                            <li key={unit} className="p-2 bg-gray-700/50 rounded text-white flex justify-between">
                                                <span>{unit}</span>
                                                <span className="text-gray-400">{unitLocations[unit]}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    </div>

                   )}
                       {/* Duty & Turnaround Window */}
                   {activeSection === 'duty-turnaround' && (
                    <DutyTurnaroundSection
                        preferredDutyPeriod={preferredDutyPeriod}
                        onUpdatePreferredDutyPeriod={handleUpdatePreferredDutyPeriod}
                        maxCrewDutyPeriod={maxCrewDutyPeriod}
                        onUpdateMaxCrewDutyPeriod={handleUpdateMaxCrewDutyPeriod}
                        flightTurnaround={flightTurnaround}
                        onUpdateFlightTurnaround={handleUpdateFlightTurnaround}
                        ftdTurnaround={ftdTurnaround}
                        onUpdateFtdTurnaround={handleUpdateFtdTurnaround}
                        cptTurnaround={cptTurnaround}
                        onUpdateCptTurnaround={handleUpdateCptTurnaround}
                    />
                   )}

                          {/* SCT Events Window */}
                   {activeSection === 'sct-events' && (
                       <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-80 h-fit">
                           <div className="p-4 flex justify-between items-center border-b border-gray-700">
                               <h2 className="text-lg font-semibold text-gray-200">SCT Events</h2>
                               {isEditingSctEvents ? (
                                   <div className="flex space-x-2">
                                       <button onClick={handleSaveSctEvents} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">Save</button>
                                       <button onClick={handleCancelSctEvents} className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-semibold">Cancel</button>
                                   </div>
                               ) : (
                                   <button 
                                   onClick={handleEditSctEvents} 
                                   disabled={!canEditSettings}
                                   className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                       canEditSettings 
                                           ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer' 
                                           : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                   }`}
                               >
                                   Edit
                               </button>
                               )}
                           </div>
                           <div className="p-4 space-y-4">
                               {isEditingSctEvents ? (
                                   <>
                                       <p className="text-sm text-gray-400">Manage SCT event types.</p>
                                       <ul className="space-y-2 max-h-40 overflow-y-auto">
                                           {tempSctEvents.map(evt => (
                                               <li key={evt} className="flex items-center justify-between p-2 bg-gray-700/50 rounded">
                                                   <span className="text-white">{evt}</span>
                                                   <button onClick={() => handleRemoveSctEvent(evt)} className="p-1 text-gray-400 hover:text-red-400">
                                                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                           <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                       </svg>
                                                   </button>
                                               </li>
                                           ))}
                                       </ul>
                                       <div className="flex space-x-2">
                                           <input 
                                               type="text" 
                                               value={newSctEvent} 
                                               onChange={e => setNewSctEvent(e.target.value)} 
                                               placeholder="New SCT event name" 
                                               className="flex-grow bg-gray-700 border-gray-600 rounded-md py-1 px-2 text-white text-sm focus:outline-none focus:ring-sky-500" 
                                           />
                                           <button onClick={handleAddSctEvent} className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold">+</button>
                                       </div>
                                   </>
                               ) : (
                                   <>
                                       <p className="text-sm text-gray-400">Configured SCT event types.</p>
                                       <ul className="space-y-2 max-h-40 overflow-y-auto">
                                           {sctEvents.map(evt => (
                                               <li key={evt} className="p-2 bg-gray-700/50 rounded text-white">
                                                   {evt}
                                               </li>
                                           ))}
                                       </ul>
                                   </>
                               )}
                           </div>
                       </div>

                   )}
                    {/* Currencies Window */}
                   {activeSection === 'currencies' && (
                    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-[40rem] h-fit flex flex-col">
                        <div className="p-4 flex justify-between items-center shrink-0">
                            <h2 className="text-lg font-semibold text-gray-200">Currencies</h2>
                        </div>
                         <div className="flex-1 overflow-y-auto max-h-[400px]">
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 bg-gray-800">
                                    <tr>
                                        <th className="font-medium text-gray-400 px-4 pt-0 pb-2 border-b border-gray-700">Currency</th>
                                        <th className="font-medium text-gray-400 px-4 pt-0 pb-2 border-b border-gray-700">Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleCurrencies.map((c, i) => (
                                        <tr key={c.id} className="border-t border-gray-700">
                                            <td className="py-2 px-4 text-gray-200">{c.name}</td>
                                            <td className="py-2 px-4 text-gray-300 capitalize">{c.type}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-gray-700 shrink-0">
                            <button onClick={() => onNavigate('CurrencyBuilder')} className="w-full px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold">
                                Currency Builder
                            </button>
                        </div>
                    </div>

                   )}
                    {/* Business Rules Window */}
                   {activeSection === 'business-rules' && (
                    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-[40rem] h-fit">
                        <div className="p-4 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-gray-200">Business Rules</h2>
                        </div>
                        <div className="p-4 border-t border-gray-700">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Max dispatch / hr
                                    </label>
                                    <select 
                                        value={maxDispatchPerHour}
                                        onChange={(e) => onUpdateMaxDispatchPerHour(parseInt(e.target.value))}
                                        disabled={!canEditSettings}
                                        className={`w-full px-3 py-2 rounded-md border focus:ring-sky-500 focus:border-sky-500 ${
                                            canEditSettings 
                                                ? 'bg-gray-700 border-gray-600 text-white' 
                                                : 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed'
                                        }`}
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map(value => (
                                            <option key={value} value={value}>{value}</option>
                                        ))}
                                    </select>
                                    {canEditSettings && (
                                        <p className="mt-1 text-xs text-gray-400">
                                            Maximum number of dispatches allowed per hour
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                   )}
                    {/* Data Loaders Window */}
                   {activeSection === 'data-loaders' && (
                    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-[30rem] h-fit">
                        <div className="p-4 flex justify-between items-center border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-200">Data Loaders</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <fieldset className="p-3 border border-gray-600 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Templates</legend>
                                <div className="mt-2 space-y-2">
                                    <p className="text-xs text-gray-400">Download templates to ensure correct formatting for bulk uploads.</p>
                                    <button onClick={handleDownloadInstructorTemplate} className="w-full px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold">
                                        Download Instructor Template (.xlsx)
                                    </button>
                                    <button onClick={handleDownloadTraineeTemplate} className="w-full px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold">
                                        Download Trainee Template (.xlsx)
                                    </button>
                                    <button onClick={handleDownloadLmpTemplate} className="w-full px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold">
                                        Download LMP Template (.xlsx)
                                    </button>
                                    <button onClick={handleDownloadLogbookTemplate} className="w-full px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold">
                                        Download Logbook Template (.xlsx)
                                    </button>
                                </div>
                            </fieldset>
                            <fieldset className="p-3 border border-gray-600 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Data Storage</legend>
                                <div className="mt-2 space-y-3">
                                    <p className="text-xs text-gray-400">Manage files stored in the local browser repository for bulk updates or other operations.</p>
                                    <div className="max-h-60 overflow-y-auto pr-2">
                                        <div className="space-y-4">
                                            {folders.map(folder => {
                                                const filesInFolder = repoFiles.filter(file => file.folderId === folder.id);
                                                const isSub = (folder as any).isSub;
                                                return (
                                                    <div key={folder.id} className={isSub ? "ml-8" : ""}>
                                                        <div className="flex items-center mb-1">
                                                            <FolderIcon />
                                                            <h4 className="text-sm font-semibold text-gray-300">{folder.name}</h4>
                                                        </div>
                                                        <div className="pl-4 border-l-2 border-gray-600 ml-2.5">
                                                            {filesInFolder.length > 0 ? (
                                                                <ul className="space-y-1 pt-2">
                                                                    {filesInFolder.sort((a, b) => a.name.localeCompare(b.name)).map(file => (
                                                                        <FileListItem key={file.id} file={file} />
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <p className="text-xs text-gray-500 italic pl-3 pt-1">Empty</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {uncategorizedFiles.length > 0 && (
                                                <div key="uncategorized">
                                                    <div className="flex items-center mb-1">
                                                        <FolderIcon />
                                                        <h4 className="text-sm font-semibold text-gray-300">Uncategorized</h4>
                                                    </div>
                                                    <div className="pl-4 border-l-2 border-gray-600 ml-2.5">
                                                        <ul className="space-y-1 pt-2">
                                                            {uncategorizedFiles.sort((a,b) => a.name.localeCompare(b.name)).map(file => (
                                                                <FileListItem key={file.id} file={file} />
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={handleUploadClick} className="w-full mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-semibold">
                                        Upload File
                                    </button>
                                </div>
                            </fieldset>
                        </div>
                    </div>

                   )}
                    {/* Events Limits Window */}
                   {activeSection === 'event-limits' && (
                    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-96 h-fit">
                        <div className="p-4 flex justify-between items-center border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-200">Events Limits</h2>
                            {isEditingLimits ? (
                                <button onClick={handleSaveLimits} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">Save</button>
                            ) : (
                                <button 
                                onClick={handleEditLimits} 
                                disabled={!canEditSettings}
                                className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                    canEditSettings 
                                        ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer' 
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                Edit
                            </button>
                            )}
                        </div>
                        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                            {/* Execs */}
                            <fieldset className="p-3 border border-gray-600 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Execs</legend>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max Flight/FTD:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.exec.maxFlightFtd} onChange={e => setTempLimits({...tempLimits, exec: {...tempLimits.exec, maxFlightFtd: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">1</span>}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max Duty Sup:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.exec.maxDutySup} onChange={e => setTempLimits({...tempLimits, exec: {...tempLimits.exec, maxDutySup: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max total all events:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.exec.maxTotal || 2} onChange={e => setTempLimits({...tempLimits, exec: {...tempLimits.exec, maxTotal: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                </div>
                            </fieldset>
                            {/* Staff */}
                            <fieldset className="p-3 border border-gray-600 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Staff</legend>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max Flight/FTD:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.instructor.maxFlightFtd || 2} onChange={e => setTempLimits({...tempLimits, instructor: {...tempLimits.instructor, maxFlightFtd: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-400">Staff (Flying Supervisor role assigned) - Max Duty Sup:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.instructor.maxDutySup} onChange={e => setTempLimits({...tempLimits, instructor: {...tempLimits.instructor, maxDutySup: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max total all events:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.instructor.maxTotal || 3} onChange={e => setTempLimits({...tempLimits, instructor: {...tempLimits.instructor, maxTotal: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">3</span>}
                                    </div>
                                </div>
                            </fieldset>
                            {/* Trainees */}
                            <fieldset className="p-3 border border-gray-600 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Trainees</legend>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max Flight/FTD:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.trainee.maxFlightFtd || 1} onChange={e => setTempLimits({...tempLimits, trainee: {...tempLimits.trainee, maxFlightFtd: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">1</span>}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max total all events:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.trainee.maxTotal || 2} onChange={e => setTempLimits({...tempLimits, trainee: {maxTotal: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                </div>
                            </fieldset>
                            {/* SIM IPs */}
                            <fieldset className="p-3 border border-gray-600 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">SIM IPs</legend>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max FTD:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.simIp.maxFtd || 2} onChange={e => setTempLimits({...tempLimits, simIp: {...tempLimits.simIp, maxFtd: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-400">Max total all events:</span>
                                        {isEditingLimits ? (
                                            <input type="number" value={tempLimits.simIp.maxTotal || 2} onChange={e => setTempLimits({...tempLimits, simIp: {maxTotal: parseInt(e.target.value) || 0}})} className="w-12 bg-gray-700 border border-gray-600 rounded text-center text-white text-sm focus:outline-none focus:ring-sky-500" />
                                        ) : <span className="text-white font-mono">2</span>}
                                    </div>
                                </div>
                            </fieldset>
                        </div>
                    </div>

                   )}
                   {/* Permissions Manager Window */}
                   {activeSection === 'permissions' && (
                   <PermissionsManagerWindow
                       instructors={instructorsData}
                       trainees={traineesData}
                       onUpdateInstructorPermission={(idNumber, permissionLevel) => {
                           const instructor = instructorsData.find(inst => inst.idNumber === idNumber);
                           const oldPermission = instructor?.permissions?.[0] || 'None';
                           const updatedInstructors = instructorsData.map(inst => 
                               inst.idNumber === idNumber 
                                   ? { ...inst, permissions: [permissionLevel] }
                                   : inst
                           );
                           onBulkUpdateInstructors(updatedInstructors);
                           logAudit({
                               page: 'Settings - Permissions',
                               action: 'update',
                               description: `Updated instructor permission: ${instructor?.name}`,
                               changes: `From: ${oldPermission} To: ${permissionLevel}`
                           });
                       }}
                       onUpdateTraineePermission={(idNumber, permissionLevel) => {
                           const trainee = traineesData.find(t => t.idNumber === idNumber);
                           const oldPermission = trainee?.permissions?.[0] || 'None';
                           const updatedTrainees = traineesData.map(t => 
                               t.idNumber === idNumber 
                                   ? { ...t, permissions: [permissionLevel] }
                                   : t
                           );
                           onBulkUpdateTrainees(updatedTrainees);
                           logAudit({
                               page: 'Settings - Permissions',
                               action: 'update',
                               description: `Updated trainee permission: ${trainee?.name}`,
                               changes: `From: ${oldPermission} To: ${permissionLevel}`
                           });
                       }}
                       onShowSuccess={onShowSuccess}
                          currentUserPermission={currentUserPermission}
                   />

                   )}
               </div>
               {showScoringMatrix && <ScoringMatrixFlyout onClose={() => setShowScoringMatrix(false)} phraseBank={phraseBank} onUpdatePhraseBank={handleUpdatePhraseBank} initialTab={scoringMatrixTab} />}
            {showUpload && <UploadFileFlyout onClose={() => setShowUpload(false)} onConfirm={handleUploadConfirm} />}
            {showSelectDestination && fileToUpload && <SelectDestinationFlyout onClose={() => setShowSelectDestination(false)} onConfirm={handleDestinationConfirm} fileName={fileToUpload.name} folders={folders.filter(f => !(f as any).isSub)} />}
            {fileToDownload && <DownloadConfirmationFlyout fileName={fileToDownload.name} onConfirm={handleDownloadConfirm} onClose={() => setFileToDownload(null)} />}
            {fileToDelete && <DeleteFileConfirmationFlyout fileName={fileToDelete.name} onConfirm={handleDeleteConfirm} onClose={() => setFileToDelete(null)} />}
            {showUpdateConfirmation && fileToProcess && <UpdateConfirmationFlyout fileName={fileToProcess.name} onConfirm={handleUpdateConfirm} onClose={() => setShowUpdateConfirmation(false)} />}
            {showNewRecordConfirm && unmatchedRowData && <NewRecordConfirmationFlyout rowData={unmatchedRowData} onConfirm={handleConfirmNewRecord} onCancel={handleRejectNewRecord} />}
            {showUpdateError && <UpdateErrorFlyout message={updateErrorMessage} onClose={() => setShowUpdateError(false)} />}
            {showUpdateSummary && <UpdateSummaryFlyout summary={updateSummary} onClose={() => setShowUpdateSummary(false)} />}
            <CourseSelectionDialog
                isOpen={showCourseSelection}
                courses={courseOptions}
                onSelect={handleCourseSelection}
                onCancel={handleCourseSelectionCancel}
                mode={updateMode}
            />
        </>
    );
};