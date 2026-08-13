import React, { useMemo, useRef, useState } from 'react';
import { Trainee, TraineeRank, SeatConfig, SyllabusItemDetail } from '../types';
import UpdateConfirmationFlyout from './UpdateConfirmationFlyout';
import CourseSelectionFlyout from './CourseSelectionFlyout';
import UpdateSummaryFlyout from './UpdateSummaryFlyout';
import { logAudit } from '../utils/auditLogger';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';
import { getAppApiBase } from '../utils/externalDataControls';

declare var XLSX: any;

interface TraineeBulkUploadFlyoutProps {
    onClose: () => void;
    traineesData: Trainee[];
    syllabusDetails: SyllabusItemDetail[];
    courseColors: { [key: string]: string };
    onBulkUpdateTrainees: (trainees: Trainee[]) => void | Promise<void>;
    onReplaceTrainees: (trainees: Trainee[]) => void | Promise<void>;
    onUpdateTraineeLMPs?: (updater: (prevLMPs: Map<string, SyllabusItemDetail[]>) => Map<string, SyllabusItemDetail[]>) => void;
    currentUserRole?: string;
}

type UploadActivationSummary = {
    requested: boolean;
    total: number;
    sent: number;
    skipped: number;
    failed: number;
};

const getValueFromRow = (row: any, possibleKeys: string[]): any => {
    for (const key of possibleKeys) {
        if (row[key] !== undefined) return row[key];
    }
    const rowKeys = Object.keys(row);
    for (const key of possibleKeys) {
        const normalisedKey = key.toLowerCase().replace(/[\s/]/g, '');
        for (const rowKey of rowKeys) {
            if (rowKey.toLowerCase().replace(/[\s/]/g, '') === normalisedKey) {
                return row[rowKey];
            }
        }
    }
    return undefined;
};

const getStr = (row: any, keys: string[]) => {
    const val = getValueFromRow(row, keys);
    return val !== undefined && val !== null ? String(val).trim() : undefined;
};

const getNum = (row: any, keys: string[]) => {
    const val = getValueFromRow(row, keys);
    if (val === undefined || val === null || String(val).trim() === '') return undefined;
    const num = parseFloat(String(val).replace(/[A-Za-z]/g, '').trim());
    return Number.isFinite(num) ? num : undefined;
};

const parseBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
    return Boolean(value);
};

const parseTraineeRow = (row: any): Partial<Trainee> | null => {
    const idValue = getNum(row, ['Personnel ID', 'Service ID', 'Employee ID', 'Employee Number', 'Personnel Number', 'Staff ID', 'ID', 'ID Number', 'IDNumber', 'idNumber']);
    if (idValue === undefined) return null;

    const parsed: Partial<Trainee> = { idNumber: idValue };
    const nameField = getStr(row, [
        'Name\n [Surname, Firstname]',
        'Name [Surname, Firstname]',
        'Name',
        'Full Name',
        'FullName',
    ]);
    if (nameField) {
        parsed.name = nameField;
    } else {
        const surname = getStr(row, ['Surname', 'Last Name']);
        const firstname = getStr(row, ['First Name', 'Firstname', 'Given Name']);
        if (surname && firstname) parsed.name = `${surname}, ${firstname}`;
    }

    const coursePrefix = getStr(row, ['Course Prefix', 'coursePrefix']);
    const courseNumber = getStr(row, ['Course Number', 'courseNumber']);
    if (coursePrefix && courseNumber) {
        parsed.course = `${coursePrefix}${courseNumber}`;
    } else {
        const course = getStr(row, ['Course']);
        if (course) parsed.course = course;
    }

    const lmpType = getStr(row, ['LMP', 'lmpType']);
    if (lmpType) parsed.lmpType = lmpType;
    const rank = getStr(row, ['Rank']);
    if (rank) parsed.rank = rank as TraineeRank;
    const callsign = getStr(row, ['Callsign', 'callsign']);
    if (callsign) parsed.callsignNumber = parseInt(callsign, 10) || undefined;
    const serviceRaw = getStr(row, ['Service']);
    if (serviceRaw) {
        parsed.service = serviceRaw.trim();
    }
    const unit = getStr(row, ['Unit']);
    if (unit) parsed.unit = unit;
    const flight = getStr(row, ['Flight', 'flight']);
    if (flight) parsed.flight = flight;
    const location = getStr(row, ['Location']);
    if (location) parsed.location = location;
    const seatConfigRaw = getStr(row, ['Seat Config', 'seatConfig', 'Seat config']);
    if (seatConfigRaw) {
        const sc = seatConfigRaw.trim().toLowerCase();
        if (['normal', 'norm'].includes(sc)) parsed.seatConfig = 'Normal';
        else if (['fwd/short', 'forward/short', 'fwd', 'front'].includes(sc)) parsed.seatConfig = 'FWD/SHORT';
        else if (['rear/short', 'rear'].includes(sc)) parsed.seatConfig = 'REAR/SHORT';
        else if (['fwd/long', 'forward/long', 'long'].includes(sc)) parsed.seatConfig = 'FWD/LONG';
        else parsed.seatConfig = seatConfigRaw as SeatConfig;
    }
    const phone = getStr(row, ['Phone Number', 'phoneNumber']);
    if (phone) parsed.phoneNumber = phone;
    const email = getStr(row, ['Email']);
    if (email) parsed.email = email;
    const primary = getStr(row, ['Primary Instructor', 'primaryInstructor']);
    if (primary) parsed.primaryInstructor = primary.split(',').map((s: string) => s.trim()).filter(Boolean);
    const secondary = getStr(row, ['Secondary Instructor', 'secondaryInstructor']);
    if (secondary) parsed.secondaryInstructor = secondary.split(',').map((s: string) => s.trim()).filter(Boolean);
    const permissions = getStr(row, ['Permissions', 'permissions']);
    if (permissions) parsed.permissions = permissions.split(/\r?\n/).map((p: string) => p.trim()).filter(Boolean);
    const isPaused = getValueFromRow(row, ['Is Paused', 'isPaused']);
    if (isPaused !== undefined) parsed.isPaused = parseBoolean(isPaused);

    if (!parsed.isPaused) parsed.isPaused = false;
    if (!parsed.unit) parsed.unit = '';
    if (!parsed.rank) parsed.rank = 'FLGOFF' as TraineeRank;
    if (!parsed.seatConfig) parsed.seatConfig = 'Normal' as SeatConfig;
    if (!parsed.unavailability) parsed.unavailability = [];
    if (parsed.name && parsed.course) parsed.fullName = `${parsed.name} – ${parsed.course}`;
    else if (parsed.name) parsed.fullName = parsed.name;

    return parsed;
};

const readWorkbookRows = async (file: File): Promise<any[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(worksheet);
};

const TraineeBulkUploadFlyout: React.FC<TraineeBulkUploadFlyoutProps> = ({
    onClose,
    traineesData,
    syllabusDetails,
    courseColors,
    onBulkUpdateTrainees,
    onReplaceTrainees,
    onUpdateTraineeLMPs,
    currentUserRole,
}) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [isDragActive, setIsDragActive] = useState(false);
    const [status, setStatus] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [showCourseSelection, setShowCourseSelection] = useState(false);
    const [updateType, setUpdateType] = useState<'bulk' | 'minor'>('minor');
    const [rows, setRows] = useState<any[]>([]);
    const [coursesFromFile, setCoursesFromFile] = useState<string[]>([]);
    const [summary, setSummary] = useState<{ added: number; updated: number; replaced: number; skipped: number; type: string; activation?: UploadActivationSummary } | null>(null);
    const [issueAccountActivations, setIssueAccountActivations] = useState(false);

    const activeCourses = useMemo(() => Object.keys(courseColors).sort((a, b) => a.localeCompare(b)), [courseColors]);
    const canIssueAccountActivations = ['ADMIN', 'SUPER_ADMIN'].includes(String(currentUserRole || '').trim().toUpperCase().replace(/[\s-]+/g, '_'));

    const handleFile = (selectedFile?: File | null) => {
        if (!selectedFile) return;
        if (!/\.(xlsx|xls|csv)$/i.test(selectedFile.name)) {
            setStatus('Please select an .xlsx, .xls or .csv file.');
            setFile(null);
            return;
        }
        setFile(selectedFile);
        setStatus('');
    };

    const extractCourses = (jsonRows: any[]) => {
        const courses = new Set<string>();
        jsonRows.forEach(row => {
            const coursePrefix = getStr(row, ['Course Prefix', 'coursePrefix']);
            const courseNumber = getStr(row, ['Course Number', 'courseNumber']);
            if (coursePrefix && courseNumber) courses.add(`${coursePrefix}${courseNumber}`);
            else {
                const course = getStr(row, ['Course']);
                if (course) courses.add(course);
            }
        });
        return Array.from(courses);
    };

    const handleConfirm = async (password: string, selectedUpdateType: 'bulk' | 'minor'): Promise<string | void> => {
        try {
            const isValidPassword = await verifyCurrentUserPassword(password);
            if (!isValidPassword) {
                return 'The password was not accepted.';
            }
        } catch (error) {
            return 'The app could not verify your password.';
        }
        if (!file) return;
        try {
            const jsonRows = await readWorkbookRows(file);
            setRows(jsonRows);
            setCoursesFromFile(extractCourses(jsonRows));
            setUpdateType(selectedUpdateType);
            setShowConfirm(false);
            setShowCourseSelection(true);
        } catch (error) {
            return `Error reading file: ${(error as Error).message}`;
        }
    };

    const initialiseLmpForNewTrainees = (newTrainees: Trainee[]) => {
        if (!onUpdateTraineeLMPs || newTrainees.length === 0) return;
        onUpdateTraineeLMPs((prevLMPs) => {
            const nextLMPs = new Map(prevLMPs);
            newTrainees.forEach(trainee => {
                if (!trainee.fullName || !trainee.lmpType || nextLMPs.has(trainee.fullName)) return;
                const masterLMP = syllabusDetails.filter(item => item.courses?.includes(trainee.lmpType as string));
                if (masterLMP.length > 0) nextLMPs.set(trainee.fullName, [...masterLMP]);
            });
            return nextLMPs;
        });
    };

    const issueCourseActivations = async (course: string): Promise<UploadActivationSummary> => {
        const sessionToken = localStorage.getItem('dfp_session_token') || '';
        const response = await fetch(`${getAppApiBase()}/admin/direct-course-activations`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
            },
            body: JSON.stringify({ course }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.message || 'Account activation emails could not be sent.');
        }
        return {
            requested: true,
            total: Number(payload.total || 0),
            sent: Number(payload.sent || 0),
            skipped: Number(payload.skipped || 0),
            failed: Number(payload.failed || 0),
        };
    };

    const processRows = async (course: string) => {
        const parsedRows = rows.map(parseTraineeRow);
        const validRows = parsedRows.filter((trainee): trainee is Partial<Trainee> => Boolean(trainee && trainee.idNumber && trainee.name));
        const skipped = rows.length - validRows.length;
        const newTrainees = validRows.map(trainee => ({ ...trainee, course, fullName: `${trainee.name} – ${course}` } as Trainee));
        const activationRequested = issueAccountActivations && canIssueAccountActivations;

        if (activationRequested) {
            const missingEmail = newTrainees.filter(trainee => !String(trainee.email || '').trim());
            if (missingEmail.length > 0) {
                const names = missingEmail.slice(0, 5).map(trainee => trainee.name || trainee.fullName || String(trainee.idNumber)).join(', ');
                setShowCourseSelection(false);
                setStatus(`Account activation requires an Email for every uploaded trainee. Missing Email: ${names}${missingEmail.length > 5 ? ` and ${missingEmail.length - 5} more` : ''}.`);
                return;
            }
        }

        let activation: UploadActivationSummary | undefined;

        if (updateType === 'bulk') {
            const otherCourseTrainees = traineesData.filter(trainee => trainee.course !== course);
            await onReplaceTrainees([...otherCourseTrainees, ...newTrainees]);
            initialiseLmpForNewTrainees(newTrainees.filter(trainee => !traineesData.some(existing => existing.idNumber === trainee.idNumber)));
            if (activationRequested) {
                activation = await issueCourseActivations(course);
            }
            setSummary({ type: 'Bulk', replaced: newTrainees.length, added: 0, updated: 0, skipped, activation });
        } else {
            const existingIds = new Set(traineesData.map(trainee => trainee.idNumber));
            const added = newTrainees.filter(trainee => !existingIds.has(trainee.idNumber));
            const updated = newTrainees.filter(trainee => existingIds.has(trainee.idNumber));
            await onBulkUpdateTrainees(newTrainees);
            initialiseLmpForNewTrainees(added);
            if (activationRequested) {
                activation = await issueCourseActivations(course);
            }
            setSummary({ type: 'Minor', replaced: 0, added: added.length, updated: updated.length, skipped, activation });
        }

        logAudit({
            page: 'Trainee Roster',
            action: 'update',
            description: `${updateType === 'bulk' ? 'Bulk' : 'Minor'} trainee upload for ${course}`,
            changes: `Processed ${newTrainees.length} trainees from ${file?.name || 'local file'}`,
        });
        setShowCourseSelection(false);
        setStatus('');
    };

    return (
        <>
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 animate-fade-in" onClick={onClose}>
                <div className="w-full max-w-lg rounded-lg border border-gray-700 bg-gray-800 shadow-xl" onClick={event => event.stopPropagation()}>
                    <div className="flex items-center justify-between border-b border-gray-700 bg-gray-900/50 p-4">
                        <h2 className="text-xl font-bold text-white">Upload Trainee Data</h2>
                        <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">x</button>
                    </div>
                    <div className="space-y-4 p-6">
                        <p className="text-sm text-gray-400">Upload the trainee template from this computer. The file is processed directly and is not stored in Data Import.</p>
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={event => handleFile(event.target.files?.[0])}
                        />
                        <div
                            onDragEnter={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                setIsDragActive(true);
                            }}
                            onDragOver={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                event.dataTransfer.dropEffect = 'copy';
                                setIsDragActive(true);
                            }}
                            onDragLeave={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                setIsDragActive(false);
                            }}
                            onDrop={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                setIsDragActive(false);
                                handleFile(event.dataTransfer.files?.[0]);
                            }}
                            className={`rounded-lg border border-dashed p-5 text-center transition-colors ${isDragActive ? 'border-sky-300 bg-sky-500/15' : file ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-gray-500 bg-gray-900/40'}`}
                        >
                            <p className="text-sm font-semibold text-white">{file ? file.name : 'Drag and drop a trainee spreadsheet here'}</p>
                            <p className="mt-1 text-xs text-gray-400">Accepted formats: .xlsx, .xls, .csv</p>
                            <p className="mt-1 text-xs text-gray-500">ID column can be Personnel ID, Service ID, ID Number, or Employee ID.</p>
                            <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 rounded-md bg-gray-100 px-4 py-2 font-semibold text-gray-900 hover:bg-white">
                                Select File
                            </button>
                        </div>
                        <label className={`flex items-start gap-3 rounded-md border p-3 text-sm ${canIssueAccountActivations ? 'border-sky-500/40 bg-sky-950/20 text-gray-200' : 'border-gray-700 bg-gray-900/40 text-gray-500'}`}>
                            <input
                                type="checkbox"
                                checked={issueAccountActivations && canIssueAccountActivations}
                                disabled={!canIssueAccountActivations}
                                onChange={event => setIssueAccountActivations(event.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-gray-500 bg-gray-900 text-sky-500 focus:ring-sky-500"
                            />
                            <span>
                                <span className="block font-semibold text-white">Create/link login accounts and email activation codes for this course</span>
                                <span className="mt-1 block text-xs text-gray-400">
                                    Requires Personnel ID and Email for every uploaded trainee. The email sends only the activation code; the user signs in with Personnel ID plus that code.
                                </span>
                                {!canIssueAccountActivations && (
                                    <span className="mt-1 block text-xs text-amber-300">Admin or Super Admin access is required.</span>
                                )}
                            </span>
                        </label>
                        {status && <p className="text-sm text-amber-300">{status}</p>}
                    </div>
                    <div className="flex justify-end gap-3 border-t border-gray-700 bg-gray-800/50 px-6 py-4">
                        <button onClick={onClose} className="rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">Cancel</button>
                        <button onClick={() => setShowConfirm(true)} disabled={!file} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-gray-500">
                            Upload
                        </button>
                    </div>
                </div>
            </div>
            {showConfirm && file && (
                <UpdateConfirmationFlyout
                    fileName={file.name}
                    onConfirm={handleConfirm}
                    onClose={() => setShowConfirm(false)}
                />
            )}
            {showCourseSelection && (
                <CourseSelectionFlyout
                    courses={coursesFromFile.length > 0 ? coursesFromFile : activeCourses}
                    updateType={updateType}
                    onConfirm={processRows}
                    onClose={() => setShowCourseSelection(false)}
                />
            )}
            {summary && (
                <UpdateSummaryFlyout
                    summary={summary}
                    onClose={() => {
                        setSummary(null);
                        onClose();
                    }}
                />
            )}
        </>
    );
};

export default TraineeBulkUploadFlyout;
