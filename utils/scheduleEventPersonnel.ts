import { ScheduleEvent } from '../types';

const PERSONNEL_RANK_PREFIX_RE = /^(ACM|AIRMSHL|AVM|AIRCDRE|GPCAPT|WGCDR|SQNLDR|FLTLT|FLGOFF|PLTOFF|OFFCDT|WOFF|FSGT|SGT|CPL|LACW?|ACW?|MIDN|CMDR|LCDR|LEUT|SBLT|ASLT|CDRE|CAPT|COL|LTCOL|MAJ|LT|2LT|WO1|WO2|SSGT|PTE|MR|MRS|MS|MISS|DR)\s+/i;

const PLACEHOLDER_PERSONNEL_NAMES = new Set(['tba', 'to be advised', 'multiple', 'group']);

export const normalisePersonnelNameForScheduleMatch = (name?: string): string =>
    String(name || '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(PERSONNEL_RANK_PREFIX_RE, '')
        .replace(/\s+[–-]\s+[A-Z]{2,}\d+$/i, '')
        .toLowerCase();

const isPlaceholderPersonnelName = (name?: string): boolean => {
    const normalised = normalisePersonnelNameForScheduleMatch(name);
    return !normalised || PLACEHOLDER_PERSONNEL_NAMES.has(normalised);
};

const addPersonnelName = (personnel: Set<string>, name?: string) => {
    if (!isPlaceholderPersonnelName(name)) {
        personnel.add(String(name || '').trim());
    }
};

export const getScheduleEventPersonnelNames = (event: ScheduleEvent): string[] => {
    const personnel = new Set<string>();
    const eventRecord = event as ScheduleEvent & {
        fixedCrewPic?: string;
        crewSelectionOrder?: string[];
        _scheduledPrimaryStaff?: string[];
        _scheduledSupportStaff?: string[];
    };

    addPersonnelName(personnel, event.instructor);
    addPersonnelName(personnel, event.student);
    addPersonnelName(personnel, event.pilot);
    addPersonnelName(personnel, event.crew);
    addPersonnelName(personnel, eventRecord.fixedCrewPic);
    event.attendees?.forEach(person => addPersonnelName(personnel, person));
    event.crewSelectionOrder?.forEach(person => addPersonnelName(personnel, person));
    eventRecord._scheduledPrimaryStaff?.forEach(person => addPersonnelName(personnel, person));
    eventRecord._scheduledSupportStaff?.forEach(person => addPersonnelName(personnel, person));

    return Array.from(personnel);
};

export const schedulePersonnelNamesMatch = (a?: string, b?: string): boolean => {
    const left = normalisePersonnelNameForScheduleMatch(a);
    const right = normalisePersonnelNameForScheduleMatch(b);
    return !!left && left === right;
};

export const scheduleEventIncludesPerson = (event: ScheduleEvent, personName?: string): boolean =>
    getScheduleEventPersonnelNames(event).some(eventPerson => schedulePersonnelNamesMatch(eventPerson, personName));
