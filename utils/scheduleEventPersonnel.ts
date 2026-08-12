import { ScheduleEvent } from '../types';
import type { PersonIdentityRecord } from './personIdentity';
import { getPersonDisplayName, samePersonRecord } from './personIdentity';

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

const getPersonScheduleName = (person: PersonIdentityRecord): string =>
    String(getPersonDisplayName(person) || person.name || '').trim();

const getIdentityValue = (value: unknown): string => String(value ?? '').trim();

const getExactNameDuplicateCount = (
    person: PersonIdentityRecord,
    allPeople: PersonIdentityRecord[] = [],
): number => {
    const personName = normalisePersonnelNameForScheduleMatch(getPersonScheduleName(person));
    if (!personName) return 0;
    return allPeople.filter(candidate =>
        normalisePersonnelNameForScheduleMatch(getPersonScheduleName(candidate)) === personName
    ).length;
};

const isFirstExactNameDuplicateRecord = (
    person: PersonIdentityRecord,
    allPeople: PersonIdentityRecord[] = [],
): boolean => {
    const personName = normalisePersonnelNameForScheduleMatch(getPersonScheduleName(person));
    if (!personName) return false;
    const firstMatch = allPeople.find(candidate =>
        normalisePersonnelNameForScheduleMatch(getPersonScheduleName(candidate)) === personName
    );
    return Boolean(firstMatch && samePersonRecord(firstMatch, person));
};

export const scheduleEventIncludesPersonRecord = (
    event: ScheduleEvent,
    person: PersonIdentityRecord,
    options: {
        personType?: 'staff' | 'trainee';
        allPeople?: PersonIdentityRecord[];
    } = {},
): boolean => {
    const personName = getPersonScheduleName(person);
    if (!personName) return false;

    const eventRefs = event.personnelRefs || [];
    if (eventRefs.length > 0) {
        const matchingNameRefs = eventRefs.filter(ref => {
            if (options.personType && ref.personType !== options.personType) return false;
            return schedulePersonnelNamesMatch(ref.name, personName);
        });

        const matchingIdentityRef = matchingNameRefs.some(ref => {
            const refId = getIdentityValue(ref.id);
            const personId = getIdentityValue(person.id);
            if (refId && personId && refId === personId) return true;

            const refIdNumber = getIdentityValue(ref.idNumber);
            const personIdNumber = getIdentityValue(person.idNumber);
            if (refIdNumber && personIdNumber && refIdNumber === personIdNumber) return true;

            return samePersonRecord(ref as PersonIdentityRecord, person);
        });
        if (matchingIdentityRef) return true;

        // If the event already has identity refs for this displayed name, do not
        // fall back to name matching and accidentally assign it to another duplicate.
        if (matchingNameRefs.length > 0) return false;
    }

    const duplicateCount = getExactNameDuplicateCount(person, options.allPeople || []);
    if (duplicateCount > 1) {
        return isFirstExactNameDuplicateRecord(person, options.allPeople || [])
            ? scheduleEventIncludesPerson(event, personName)
            : false;
    }
    return scheduleEventIncludesPerson(event, personName);
};
