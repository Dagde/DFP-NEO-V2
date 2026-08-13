import React, { useMemo, useRef, useState } from 'react';
import { Trainee, TraineeRank, SeatConfig, SyllabusItemDetail } from '../types';
import UpdateConfirmationFlyout from './UpdateConfirmationFlyout';
import CourseSelectionFlyout, { CourseUploadPreview } from './CourseSelectionFlyout';
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
    courses?: Array<{ name?: string; code?: string; number?: string; unit?: string; location?: string; status?: string; lmpType?: string; academicLmpType?: string }>;
    allowedCourses?: string[];
    onBulkUpdateTrainees: (trainees: Trainee[]) => void | Promise<void>;
    onReplaceTrainees: (trainees: Trainee[], replacedCourse?: string) => void | Promise<void>;
    onUpdateTraineeLMPs?: (updater: (prevLMPs: Map<string, SyllabusItemDetail[]>) => Map<string, SyllabusItemDetail[]>) => void;
    currentUserRole?: string;
}

type UploadActivationSummary = {
    requested: boolean;
    total: number;
    sent: number;
    skipped: number;
    failed: number;
    error?: string;
    details?: string[];
};

const normaliseDiagnosticToken = (value: unknown): string => String(value || '').trim().toUpperCase();

const downloadJsonFile = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

const parsePersonList = (value?: string): string[] => {
    const clean = String(value || '').trim();
    if (!clean) return [];
    if (clean.includes(';')) return clean.split(';').map(item => item.trim()).filter(Boolean);
    if (clean.includes('\n')) return clean.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    return [clean];
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

    const lmpType = getStr(row, ['LMP', 'LMP Type', 'lmpType']);
    if (lmpType) parsed.lmpType = lmpType;
    const academicLmpType = getStr(row, ['Academic LMP', 'Academic LMP Type', 'academicLmpType']);
    if (academicLmpType) parsed.academicLmpType = academicLmpType;
    const rank = getStr(row, ['Rank']);
    if (rank) parsed.rank = rank as TraineeRank;
    const callsign = getStr(row, ['Callsign', 'Trainee Callsign', 'traineeCallsign', 'callsign']);
    if (callsign) parsed.traineeCallsign = callsign;
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
    if (primary) parsed.primaryInstructor = parsePersonList(primary);
    const secondary = getStr(row, ['Secondary Instructor', 'secondaryInstructor']);
    if (secondary) parsed.secondaryInstructor = parsePersonList(secondary);
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
    courses = [],
    allowedCourses = [],
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
    const [uploadPreview, setUploadPreview] = useState<CourseUploadPreview | null>(null);
    const [summary, setSummary] = useState<{ added: number; updated: number; replaced: number; skipped: number; type: string; activation?: UploadActivationSummary } | null>(null);
    const [issueAccountActivations, setIssueAccountActivations] = useState(false);

    const activeCourses = useMemo(() => {
        const courseNames = new Set<string>();
        allowedCourses.forEach(course => {
            const clean = String(course || '').trim();
            if (clean) courseNames.add(clean);
        });
        Object.keys(courseColors).forEach(course => {
            const clean = String(course || '').trim();
            if (clean) courseNames.add(clean);
        });
        return Array.from(courseNames).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }, [allowedCourses, courseColors]);
    const selectableCourses = useMemo(() => {
        const courseNames = new Set<string>();
        activeCourses.forEach(course => {
            const clean = String(course || '').trim();
            if (clean) courseNames.add(clean);
        });
        if (courseNames.size === 0) {
            coursesFromFile.forEach(course => {
                const clean = String(course || '').trim();
                if (clean) courseNames.add(clean);
            });
        }
        return Array.from(courseNames).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }, [activeCourses, coursesFromFile]);
    const canIssueAccountActivations = ['ADMIN', 'SUPER_ADMIN'].includes(String(currentUserRole || '').trim().toUpperCase().replace(/[\s-]+/g, '_'));

    const handleDownloadCoursePickerDiagnostics = () => {
        const allowedCourseSet = new Set(allowedCourses.map(normaliseDiagnosticToken).filter(Boolean));
        const activeCourseSet = new Set(activeCourses.map(normaliseDiagnosticToken).filter(Boolean));
        const fileCourseSet = new Set(coursesFromFile.map(normaliseDiagnosticToken).filter(Boolean));
        const selectableCourseSet = new Set(selectableCourses.map(normaliseDiagnosticToken).filter(Boolean));
        const scopedCourseColorSet = new Set(Object.keys(courseColors).map(normaliseDiagnosticToken).filter(Boolean));
        const rawCourseNames = courses
            .map(course => String(course?.name || course?.code || course?.number || '').trim())
            .filter(Boolean);
        const rawCourseSet = new Set(rawCourseNames.map(normaliseDiagnosticToken));
        const rawCourseRecords = courses.map(course => {
            const displayName = String(course?.name || course?.code || course?.number || '').trim();
            const normalisedName = normaliseDiagnosticToken(displayName);
            return {
                displayName,
                normalisedName,
                name: course?.name || '',
                code: course?.code || '',
                number: course?.number || '',
                unit: course?.unit || '',
                location: course?.location || '',
                status: course?.status || '',
                lmpType: course?.lmpType || '',
                academicLmpType: course?.academicLmpType || '',
                inAllowedCourses: allowedCourseSet.has(normalisedName),
                inActiveCoursesAfterMerge: activeCourseSet.has(normalisedName),
                inSelectableCourses: selectableCourseSet.has(normalisedName),
                inclusionSource: [
                    allowedCourseSet.has(normalisedName) ? 'allowedCourses' : '',
                    rawCourseSet.has(normalisedName) ? 'coursesProp' : '',
                    fileCourseSet.has(normalisedName) ? 'uploadedFile' : '',
                ].filter(Boolean),
            };
        });
        const selectableDetails = selectableCourses.map(course => {
            const normalisedName = normaliseDiagnosticToken(course);
            const matchingRecords = rawCourseRecords.filter(record => record.normalisedName === normalisedName);
            return {
                course,
                normalisedName,
                fromAllowedCourses: allowedCourseSet.has(normalisedName),
                fromScopedCourseColors: scopedCourseColorSet.has(normalisedName),
                fromCoursesProp: rawCourseSet.has(normalisedName),
                fromUploadedFileFallback: fileCourseSet.has(normalisedName) && activeCourseSet.size === 0,
                matchingCourseRecords: matchingRecords,
                likelyReasonVisible: allowedCourseSet.has(normalisedName)
                    ? 'Included because CourseRosterView allowedCourses includes it.'
                    : scopedCourseColorSet.has(normalisedName)
                        ? 'Included because scoped courseColors contains it for the current unit/combined unit.'
                        : rawCourseSet.has(normalisedName)
                            ? 'Present in the full courses prop, but should not be visible unless allowedCourses or scoped courseColors also includes it.'
                            : fileCourseSet.has(normalisedName)
                                ? 'Included from the uploaded file because no active app courses were available.'
                                : 'Included from an unknown course source.',
            };
        });
        const payload = {
            diagnostic: 'trainee-bulk-upload-course-picker',
            version: 'CCH 8.152',
            generatedAt: new Date().toISOString(),
            updateType,
            file: file ? { name: file.name, size: file.size, type: file.type || '' } : null,
            counts: {
                allowedCourses: allowedCourses.length,
                rawCourseRecords: courses.length,
                rawCourseNames: rawCourseNames.length,
                coursesFromUploadedFile: coursesFromFile.length,
                activeCoursesAfterMerge: activeCourses.length,
                selectableCourses: selectableCourses.length,
                selectableCoursesNotInRosterAllowedCourses: selectableDetails.filter(course => !course.fromAllowedCourses).length,
                selectableCoursesFromScopedCourseColorsOnly: selectableDetails.filter(course => !course.fromAllowedCourses && course.fromScopedCourseColors).length,
                selectableCoursesFromFullCoursesPropOnly: selectableDetails.filter(course => !course.fromAllowedCourses && !course.fromScopedCourseColors && course.fromCoursesProp).length,
            },
            arrays: {
                allowedCourses,
                rawCourseNames,
                coursesFromUploadedFile: coursesFromFile,
                activeCoursesAfterMerge: activeCourses,
                selectableCourses,
                courseColorKeys: Object.keys(courseColors).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
            },
            selectableDetails,
            rawCourseRecords,
        };
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadJsonFile(`dfp-trainee-upload-course-picker-diagnostics_${timestamp}.json`, payload);
    };

    const handleFile = (selectedFile?: File | null) => {
        if (!selectedFile) return;
        setRows([]);
        setCoursesFromFile([]);
        setUploadPreview(null);
        setSummary(null);
        setShowConfirm(false);
        setShowCourseSelection(false);
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

    const buildUploadPreview = (selectedFile: File, jsonRows: any[]): CourseUploadPreview => {
        const parsedRows = jsonRows.map(parseTraineeRow);
        const validRows = parsedRows.filter((trainee): trainee is Partial<Trainee> => Boolean(trainee && trainee.idNumber && trainee.name));
        const courses = extractCourses(jsonRows).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        return {
            fileName: selectedFile.name,
            rowCount: jsonRows.length,
            validRowCount: validRows.length,
            skippedRowCount: jsonRows.length - validRows.length,
            courses,
            sampleRows: validRows.slice(0, 10).map(trainee => ({
                name: String(trainee.name || ''),
                idNumber: trainee.idNumber,
                course: trainee.course,
                email: trainee.email,
            })),
        };
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
            const preview = buildUploadPreview(file, jsonRows);
            setRows(jsonRows);
            setCoursesFromFile(preview.courses);
            setUploadPreview(preview);
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
            const error = new Error(payload.message || 'Account activation emails could not be sent.') as Error & { details?: string[] };
            error.details = Array.isArray(payload.details) ? payload.details.map((detail: unknown) => String(detail)) : [];
            throw error;
        }
        return {
            requested: true,
            total: Number(payload.total || 0),
            sent: Number(payload.sent || 0),
            skipped: Number(payload.skipped || 0),
            failed: Number(payload.failed || 0),
            details: Array.isArray(payload.details) ? payload.details.map((detail: unknown) => String(detail)) : [],
        };
    };

    const issueCourseActivationsSafely = async (course: string, totalTrainees: number): Promise<UploadActivationSummary> => {
        try {
            return await issueCourseActivations(course);
        } catch (error) {
            const activationError = error as Error & { details?: string[] };
            const message = activationError.message || 'Account activation emails could not be sent.';
            return {
                requested: true,
                total: totalTrainees,
                sent: 0,
                skipped: 0,
                failed: totalTrainees,
                error: message,
                details: activationError.details || [],
            };
        }
    };

    const processRows = async (course: string) => {
        const parsedRows = rows.map(parseTraineeRow);
        const validRows = parsedRows.filter((trainee): trainee is Partial<Trainee> => Boolean(trainee && trainee.idNumber && trainee.name));
        const skipped = rows.length - validRows.length;
        const uploadedCourses = Array.from(new Set(validRows.map(trainee => String(trainee.course || '').trim()).filter(Boolean)));
        const mismatchedCourses = uploadedCourses.filter(uploadedCourse => uploadedCourse !== course);
        if (mismatchedCourses.length > 0) {
            throw new Error(
                `This file contains trainee rows for ${mismatchedCourses.join(', ')}, but you selected ${course}. ` +
                `The upload has been stopped so trainees are not moved into the wrong course. Select ${mismatchedCourses[0]} or use a file whose Course column is ${course}.`
            );
        }
        const newTrainees = validRows.map(trainee => ({ ...trainee, uploadedCourse: trainee.course || '', course, fullName: `${trainee.name} – ${course}` } as Trainee & { uploadedCourse?: string }));
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
            await onReplaceTrainees([...otherCourseTrainees, ...newTrainees], course);
            initialiseLmpForNewTrainees(newTrainees.filter(trainee => !traineesData.some(existing => existing.idNumber === trainee.idNumber)));
            if (activationRequested) {
                activation = await issueCourseActivationsSafely(course, newTrainees.length);
            }
            setSummary({ type: 'Bulk', replaced: newTrainees.length, added: 0, updated: 0, skipped, activation });
        } else {
            const existingIds = new Set(traineesData.map(trainee => trainee.idNumber));
            const added = newTrainees.filter(trainee => !existingIds.has(trainee.idNumber));
            const updated = newTrainees.filter(trainee => existingIds.has(trainee.idNumber));
            await onBulkUpdateTrainees(newTrainees);
            initialiseLmpForNewTrainees(added);
            if (activationRequested) {
                activation = await issueCourseActivationsSafely(course, newTrainees.length);
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
                    courses={selectableCourses}
                    updateType={updateType}
                    onConfirm={processRows}
                    onClose={() => setShowCourseSelection(false)}
                    onDownloadDiagnostics={handleDownloadCoursePickerDiagnostics}
                    uploadPreview={uploadPreview}
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
