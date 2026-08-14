import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AirCombatTrainingReport, Instructor, ScheduleEvent, SctRequest, Pt051Assessment, Trainee, SyllabusItemDetail } from '../types';
import TafWeatherWidget from './TafWeatherWidget';
import { normaliseFixedCrewStaffRole } from '../utils/crewPositionTerminology';
import { DEFAULT_SCT_TERMINOLOGY, normaliseSctTerminology, type SctTerminology } from '../utils/sctTerminology';
import { showDarkConfirm } from './DarkMessageModal';

interface MyDashboardProps {
    userName: string;
    userRank: string;
    events: ScheduleEvent[];
    onSelectEvent: (event: ScheduleEvent) => void;
    onNavigate: (view: string) => void;
    onSelectMyProfile: () => void;
    onSelectMyCurrency: () => void;
    onSelectMySct: () => void;
    sctRequests: SctRequest[];
    pt051Assessments: Map<string, Pt051Assessment>;
    onSelectPt051: (assessment: Pt051Assessment) => void;
    syllabusDetails?: SyllabusItemDetail[];
    suppressedPt051EventIds?: string[];
    trainingReportsToComplete?: Array<{ report: AirCombatTrainingReport; staff: Instructor }>;
    onSelectTrainingReport?: (entry: { report: AirCombatTrainingReport; staff: Instructor }) => void;
    onReassignTrainingReport?: (entry: { report: AirCombatTrainingReport; staff: Instructor }, assignee: Instructor) => void;
    staffOptions?: Instructor[];
    messageContactStaffOptions?: Instructor[];
    messageContactTraineeOptions?: Trainee[];
    messageContactUnitCodes?: string[];
    onUnreadMessageCountChange?: (count: number) => void;
    sctTerminology?: SctTerminology;
    currentLocationCode?: string | null;
}

type DashboardMessageContact = {
    id: string;
    name: string;
    displayName: string;
    unit: string;
    role: string;
    rank: string;
    surname: string;
    firstNames: string;
    type: 'Staff' | 'Trainee';
};

type DashboardMessage = {
    id: string;
    from: string;
    to: string;
    body: string;
    sentAt: string;
    readAt?: string;
};

type DashboardMessageContactGroup = {
    title: string;
    contacts: DashboardMessageContact[];
};

type DashboardConversation = {
    contact: DashboardMessageContact;
    lastMessage: DashboardMessage;
    unreadCount: number;
};

const DASHBOARD_MESSAGES_STORAGE_KEY = 'dfp_dashboard_messages_v1';

type DashboardIconProps = {
    className?: string;
    strokeWidth?: number;
};

const DashboardIconX: React.FC<DashboardIconProps> = ({ className = 'h-5 w-5', strokeWidth = 2 }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);

const DashboardIconPlus: React.FC<DashboardIconProps> = ({ className = 'h-5 w-5', strokeWidth = 2 }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
    </svg>
);

const DashboardIconArrowLeft: React.FC<DashboardIconProps> = ({ className = 'h-5 w-5', strokeWidth = 2 }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
    </svg>
);

const DashboardIconChevronRight: React.FC<DashboardIconProps> = ({ className = 'h-5 w-5', strokeWidth = 2 }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
    </svg>
);

const DashboardIconSearch: React.FC<DashboardIconProps> = ({ className = 'h-5 w-5', strokeWidth = 2 }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
    </svg>
);

const DashboardIconSquarePen: React.FC<DashboardIconProps> = ({ className = 'h-5 w-5', strokeWidth = 2 }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
);

const DashboardIconTrash: React.FC<DashboardIconProps> = ({ className = 'h-5 w-5', strokeWidth = 2 }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="m6 6 1 15h10l1-15" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
    </svg>
);

const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString + 'T00:00:00Z');
        if (isNaN(date.getTime())) return '-';
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
        const year = String(date.getUTCFullYear()).slice(-2);
        return `${day} ${month} ${year}`;
    } catch (e) {
        return '-';
    }
};

const compareDashboardRank = (left?: string, right?: string): number => (
    String(left || '').localeCompare(String(right || ''), undefined, { sensitivity: 'base' })
);

const formatDashboardStaffName = (staff: Instructor): string => {
    const [lastName, firstName] = String(staff.name || '').split(',').map(part => part.trim());
    const displayName = firstName ? `${firstName} ${lastName}` : staff.name;
    return `${staff.rank || ''} ${displayName}`.trim();
};

const normaliseDashboardContactName = (value?: string | null): string => (
    String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

const toDashboardSurnameFirstName = (value?: string | null): string => {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.includes(',')) return text;
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return text;
    const surname = parts[parts.length - 1];
    const firstNames = parts.slice(0, -1).join(' ');
    return `${surname}, ${firstNames}`;
};

const normaliseDashboardCode = (value?: string | null): string => (
    String(value || '').trim().toUpperCase()
);

const isDashboardStandbyEvent = (event: ScheduleEvent): boolean => {
    const values = [
        event.resourceId,
        event.flightNumber,
        (event as any).eventCode,
        event.type,
        (event as any).eventType,
    ].map(value => String(value || '').toUpperCase());
    return values.some(value => value.startsWith('STBY') || value.startsWith('BNF-STBY') || value.startsWith('FTD-STBY') || /\bSTBY\b/.test(value) || value.includes('STANDBY'));
};

const getDashboardEventCode = (event: ScheduleEvent): string => (
    String(event.flightNumber || (event as any).eventCode || '').trim()
);

const findDashboardSyllabusDetail = (event: ScheduleEvent, syllabusDetails: SyllabusItemDetail[]): SyllabusItemDetail | undefined => {
    const code = normaliseDashboardCode(getDashboardEventCode(event));
    if (!code) return undefined;
    return syllabusDetails.find(item => normaliseDashboardCode(item.code) === code || normaliseDashboardCode(item.id) === code);
};

const isDashboardGroundOrProceduralEvent = (event: ScheduleEvent, detail?: SyllabusItemDetail): boolean => {
    const code = normaliseDashboardCode(getDashboardEventCode(event));
    const eventType = normaliseDashboardCode(event.type || (event as any).eventType);
    const detailType = normaliseDashboardCode(detail?.type);
    if (detailType === 'FLIGHT' || detailType === 'FTD') return false;
    if (detailType === 'GROUND SCHOOL' || detailType === 'ACADEMICS') return true;
    return eventType === 'GROUND' || eventType === 'CPT' || code.includes('CPT') || code.includes('GND') || code.includes('GROUND');
};

const getDashboardEventFinishTime = (event: ScheduleEvent): Date | null => {
    if (!event.date) return null;
    const start = Number(event.startTime || 0);
    const duration = Number(event.duration || 0);
    if (!Number.isFinite(start) || !Number.isFinite(duration)) return null;
    const [year, month, day] = String(event.date).split('-').map(Number);
    if (!year || !month || !day) return null;
    const finish = new Date(year, month - 1, day);
    finish.setMinutes(Math.round((start + duration) * 60));
    return finish;
};

const downloadDashboardJsonFile = (filename: string, payload: unknown): void => {
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

const getDashboardTrainingReportSuppressionIds = (report: AirCombatTrainingReport): string[] => {
    const traineeName = String(report.traineeFullName || '').trim();
    return [
        report.id,
        report.eventId,
        report.eventCode,
        report.eventId ? `dashboard-due-${report.eventId}-${normaliseDashboardContactName(traineeName)}` : '',
        report.eventId ? `pt051-${report.eventId}-${traineeName}` : '',
    ].map(value => String(value || '').trim()).filter(Boolean);
};

const toDashboardContactDisplayName = (name: string, rank?: string): string => {
    const [lastName, firstName] = String(name || '').split(',').map(part => part.trim());
    const displayName = firstName ? `${lastName}, ${firstName}` : name;
    return `${rank || ''} ${displayName}`.trim();
};

const getDashboardContactNameParts = (name: string): { surname: string; firstNames: string } => {
    const [surname, firstNames] = String(name || '').split(',').map(part => part.trim());
    return { surname: surname || name || '', firstNames: firstNames || '' };
};

const formatDashboardMessageTime = (date: Date): string => (
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
);

const formatDashboardConversationDate = (dateString: string): string => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayDiff = Math.round((today - messageDay) / 86400000);
    if (dayDiff === 0) {
        return formatDashboardMessageTime(date);
    }
    if (dayDiff === 1) return 'Yesterday';
    if (dayDiff > 1 && dayDiff < 7) {
        return date.toLocaleDateString('en-AU', { weekday: 'long' });
    }
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
};

const sortDashboardContacts = (contacts: DashboardMessageContact[]): DashboardMessageContact[] => (
    [...contacts].sort((a, b) => (
        compareDashboardRank(a.rank, b.rank) ||
        a.surname.localeCompare(b.surname) ||
        a.firstNames.localeCompare(b.firstNames) ||
        a.displayName.localeCompare(b.displayName)
    ))
);

const groupDashboardMessageContacts = (contacts: DashboardMessageContact[]): DashboardMessageContactGroup[] => {
    const byUnit = new Map<string, DashboardMessageContact[]>();
    contacts.forEach(contact => {
        const unit = contact.unit || 'No Unit';
        byUnit.set(unit, [...(byUnit.get(unit) || []), contact]);
    });

    return Array.from(byUnit.entries())
        .sort(([unitA], [unitB]) => unitA.localeCompare(unitB))
        .flatMap(([unit, unitContacts]) => {
            const groups: DashboardMessageContactGroup[] = [];
            const staff = sortDashboardContacts(unitContacts.filter(contact => contact.type === 'Staff'));
            if (staff.length > 0) {
                groups.push({ title: `${unit} Staff`, contacts: staff });
            }

            const traineeCourses = new Map<string, DashboardMessageContact[]>();
            unitContacts
                .filter(contact => contact.type === 'Trainee')
                .forEach(contact => {
                    const course = contact.role || 'Unallocated Trainees';
                    traineeCourses.set(course, [...(traineeCourses.get(course) || []), contact]);
                });

            Array.from(traineeCourses.entries())
                .sort(([courseA], [courseB]) => courseA.localeCompare(courseB))
                .forEach(([course, traineeContacts]) => {
                    groups.push({
                        title: `${unit} Trainees - ${course}`,
                        contacts: sortDashboardContacts(traineeContacts),
                    });
                });

            return groups;
        });
};

const renderDashboardMessageContactButton = (
    contact: DashboardMessageContact,
    onSelect: (contact: DashboardMessageContact) => void,
    compact = false,
) => (
    <button
        key={contact.id}
        type="button"
        onClick={() => onSelect(contact)}
        className={`flex w-full items-center justify-between gap-3 text-left hover:bg-gray-100 ${compact ? 'px-4 py-2' : 'rounded-lg px-3 py-2'}`}
    >
        <span>
            <span className="block text-sm font-semibold text-gray-950">{contact.displayName}</span>
            <span className="block text-xs text-gray-500">{contact.unit} - {contact.role}</span>
        </span>
        <span className={`${compact ? 'text-gray-400' : 'rounded-full bg-gray-100 px-2 py-1 text-gray-500'} text-[10px] font-bold uppercase`}>{contact.type}</span>
    </button>
);

const readDashboardMessages = (): DashboardMessage[] => {
    if (typeof window === 'undefined') return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(DASHBOARD_MESSAGES_STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeDashboardMessages = (messages: DashboardMessage[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DASHBOARD_MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    window.dispatchEvent(new Event('dfp-dashboard-messages-updated'));
};

const mergeDashboardMessages = (current: DashboardMessage[], incoming: DashboardMessage[]): DashboardMessage[] => {
    const merged = new Map<string, DashboardMessage>();
    [...current, ...incoming].forEach(message => {
        if (!message?.id) return;
        merged.set(message.id, message);
    });
    return Array.from(merged.values())
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
};

const fetchDashboardMessagesFromApi = async (userName: string): Promise<DashboardMessage[]> => {
    const response = await fetch(`/api/dashboard-messages?userName=${encodeURIComponent(userName)}`, {
        credentials: 'include',
    });
    if (!response.ok) throw new Error(`Dashboard messages fetch failed: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data.messages) ? data.messages : [];
};

const sendDashboardMessageToApi = async (message: DashboardMessage): Promise<DashboardMessage> => {
    const response = await fetch('/api/dashboard-messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error(`Dashboard message send failed: ${response.status}`);
    const data = await response.json();
    return data.message || message;
};

const markDashboardConversationReadInApi = async (reader: string, sender: string, messageIds: string[]) => {
    const response = await fetch('/api/dashboard-messages/read', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reader, sender, messageIds }),
    });
    if (!response.ok) throw new Error(`Dashboard message read update failed: ${response.status}`);
};

const deleteDashboardConversationFromApi = async (participant: string, contact: string) => {
    const response = await fetch('/api/dashboard-messages/conversation', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant, contact }),
    });
    if (!response.ok) throw new Error(`Dashboard conversation delete failed: ${response.status}`);
};

const MyDashboard: React.FC<MyDashboardProps> = ({ 
    userName, 
    userRank, 
    events, 
    onSelectEvent, 
    onNavigate, 
    onSelectMyProfile, 
    onSelectMyCurrency, 
    onSelectMySct, 
    sctRequests, 
    pt051Assessments, 
    onSelectPt051,
    syllabusDetails = [],
    suppressedPt051EventIds = [],
    trainingReportsToComplete = [],
    onSelectTrainingReport,
    onReassignTrainingReport,
    staffOptions = [],
    messageContactStaffOptions = staffOptions,
    messageContactTraineeOptions = [],
    messageContactUnitCodes = [],
    onUnreadMessageCountChange,
    sctTerminology = DEFAULT_SCT_TERMINOLOGY,
    currentLocationCode,
}) => {
    const continuationTerminology = useMemo(() => normaliseSctTerminology(sctTerminology), [sctTerminology]);
    const continuationShortLabel = continuationTerminology.shortLabel;
    const sortedEvents = [...events].sort((a, b) => a.startTime - b.startTime);
    const signedInUserLabel = `${userRank || ''} ${userName}`.trim() || userName;
    const [staffPickerEntry, setStaffPickerEntry] = useState<{ report: AirCombatTrainingReport; staff: Instructor; mode: 'open' | 'reassign' } | null>(null);
    const dashboardActionButtonClass = 'btn-aluminium-brushed relative flex h-[41px] w-[56px] shrink-0 items-center justify-center rounded-md px-1 py-1 text-center text-[9px] font-semibold leading-[0.95]';
    const [isMessagesOpen, setIsMessagesOpen] = useState(false);
    const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
    const [messageToText, setMessageToText] = useState('');
    const [selectedMessageContact, setSelectedMessageContact] = useState<DashboardMessageContact | null>(null);
    const [messageDraft, setMessageDraft] = useState('');
    const [dashboardMessages, setDashboardMessages] = useState<DashboardMessage[]>(() => readDashboardMessages());
    const [messageView, setMessageView] = useState<'inbox' | 'compose'>('inbox');
    const [messageSearchText, setMessageSearchText] = useState('');
    const [incomingToast, setIncomingToast] = useState<DashboardMessage | null>(null);
    const shownIncomingToastIds = useRef<Set<string>>(new Set());
    const activeConversationEndRef = useRef<HTMLDivElement | null>(null);
    const roleTone = (role?: string) => {
        const value = String(role || '').toLowerCase();
        if (value.includes('pilot')) return 'text-sky-300 border-sky-500/30';
        if (value.includes('awo') || value.includes('mpro') || value.includes('ewo')) return 'text-emerald-300 border-emerald-500/30';
        if (value.includes('mission') || value.includes('crew')) return 'text-amber-300 border-amber-500/30';
        return 'text-gray-300 border-gray-600';
    };
    const formatStaffRole = (staff: Instructor): string => (
        normaliseFixedCrewStaffRole(staff.role, staff.unit) || 'Staff'
    );
    const dashboardMessageUserName = userName;
    const dashboardUserKey = normaliseDashboardContactName(dashboardMessageUserName);
    const dashboardUserStaff = useMemo(() => (
        messageContactStaffOptions.find(staff => normaliseDashboardContactName(staff.name) === dashboardUserKey)
    ), [dashboardUserKey, messageContactStaffOptions]);
    const dashboardUserUnitCodes = useMemo(() => {
        const scopedUnits = messageContactUnitCodes
            .flatMap(unitCode => String(unitCode || '').split(/[+/]/))
            .map(unitCode => unitCode.trim().toUpperCase())
            .filter(Boolean);
        if (scopedUnits.length > 0) return Array.from(new Set(scopedUnits));
        const unit = String(dashboardUserStaff?.unit || '').trim().toUpperCase();
        if (unit) return unit.split(/[+/]/).map(code => code.trim()).filter(Boolean);
        return [];
    }, [dashboardUserStaff?.unit, messageContactUnitCodes]);
    const dashboardUserUnitSet = useMemo(() => new Set(dashboardUserUnitCodes), [dashboardUserUnitCodes.join('|')]);
    const messageContacts = useMemo<DashboardMessageContact[]>(() => {
        const staffContacts = messageContactStaffOptions
            .filter(staff => staff?.name)
            .filter(staff => {
                const unit = String(staff.unit || '').trim().toUpperCase();
                return dashboardUserUnitSet.size === 0 || !unit || dashboardUserUnitSet.has(unit);
            })
            .map(staff => {
                const nameParts = getDashboardContactNameParts(staff.name);
                return {
                    id: `staff-${staff.idNumber}-${staff.name}`,
                    name: staff.name,
                    displayName: toDashboardContactDisplayName(staff.name, staff.rank),
                    unit: staff.unit || 'No Unit',
                    role: formatStaffRole(staff),
                    rank: staff.rank || '',
                    surname: nameParts.surname,
                    firstNames: nameParts.firstNames,
                    type: 'Staff' as const,
                };
            });
        const traineeContacts = messageContactTraineeOptions
            .filter(trainee => trainee?.fullName || trainee?.name)
            .filter(trainee => {
                const unit = String(trainee.unit || '').trim().toUpperCase();
                return dashboardUserUnitSet.size === 0 || !unit || dashboardUserUnitSet.has(unit);
            })
            .map(trainee => {
                const name = trainee.fullName || trainee.name;
                const nameParts = getDashboardContactNameParts(name);
                return {
                    id: `trainee-${trainee.idNumber}-${name}`,
                    name,
                    displayName: toDashboardContactDisplayName(name, trainee.rank),
                    unit: trainee.unit || 'No Unit',
                    role: trainee.course || 'Trainee',
                    rank: trainee.rank || '',
                    surname: nameParts.surname,
                    firstNames: nameParts.firstNames,
                    type: 'Trainee' as const,
                };
            });
        const unique = new Map<string, DashboardMessageContact>();
        [...staffContacts, ...traineeContacts]
            .forEach(contact => unique.set(normaliseDashboardContactName(contact.name), contact));
        return Array.from(unique.values()).sort((a, b) => (
            a.unit.localeCompare(b.unit) ||
            (a.type === b.type ? 0 : a.type === 'Staff' ? -1 : 1) ||
            (a.type === 'Trainee' ? a.role.localeCompare(b.role) : 0) ||
            compareDashboardRank(a.rank, b.rank) ||
            a.surname.localeCompare(b.surname) ||
            a.firstNames.localeCompare(b.firstNames) ||
            a.displayName.localeCompare(b.displayName)
        ));
    }, [dashboardUserUnitSet, formatStaffRole, messageContactStaffOptions, messageContactTraineeOptions]);
    const messageSuggestions = useMemo(() => {
        const query = normaliseDashboardContactName(messageToText);
        if (!query) return [];
        return messageContacts
            .filter(contact => normaliseDashboardContactName(contact.displayName).includes(query) || normaliseDashboardContactName(contact.name).includes(query))
            .slice(0, 6);
    }, [messageContacts, messageToText]);
    const getMessageContactForName = (name: string): DashboardMessageContact => {
        const contact = messageContacts.find(candidate => normaliseDashboardContactName(candidate.name) === normaliseDashboardContactName(name));
        if (contact) return contact;
        const nameParts = getDashboardContactNameParts(name);
        return {
            id: `stored-${normaliseDashboardContactName(name)}`,
            name,
            displayName: toDashboardContactDisplayName(name),
            unit: 'Stored Message',
            role: 'Message contact',
            rank: '',
            surname: nameParts.surname,
            firstNames: nameParts.firstNames,
            type: 'Staff',
        };
    };
    const messageConversations = useMemo<DashboardConversation[]>(() => {
        const conversations = new Map<string, DashboardConversation>();
        dashboardMessages.forEach(message => {
            const fromKey = normaliseDashboardContactName(message.from);
            const toKey = normaliseDashboardContactName(message.to);
            if (fromKey !== dashboardUserKey && toKey !== dashboardUserKey) return;
            const otherName = fromKey === dashboardUserKey ? message.to : message.from;
            const otherKey = normaliseDashboardContactName(otherName);
            const existing = conversations.get(otherKey);
            const isNewer = !existing || new Date(message.sentAt).getTime() >= new Date(existing.lastMessage.sentAt).getTime();
            conversations.set(otherKey, {
                contact: existing?.contact || getMessageContactForName(otherName),
                lastMessage: isNewer ? message : existing.lastMessage,
                unreadCount: (existing?.unreadCount || 0) + (toKey === dashboardUserKey && !message.readAt ? 1 : 0),
            });
        });
        return Array.from(conversations.values())
            .sort((a, b) => new Date(b.lastMessage.sentAt).getTime() - new Date(a.lastMessage.sentAt).getTime());
    }, [dashboardMessages, dashboardUserKey, messageContacts]);
    const filteredMessageConversations = useMemo(() => {
        const query = normaliseDashboardContactName(messageSearchText);
        if (!query) return messageConversations;
        return messageConversations.filter(conversation => (
            normaliseDashboardContactName(conversation.contact.displayName).includes(query) ||
            normaliseDashboardContactName(conversation.contact.name).includes(query) ||
            normaliseDashboardContactName(conversation.lastMessage.body).includes(query)
        ));
    }, [messageConversations, messageSearchText]);
    const messageSuggestionGroups = useMemo(() => (
        groupDashboardMessageContacts(messageSuggestions)
    ), [messageSuggestions]);
    const messageContactGroups = useMemo(() => (
        groupDashboardMessageContacts(messageContacts)
    ), [messageContacts]);
    const unreadMessages = useMemo(() => (
        dashboardMessages.filter(message => (
            normaliseDashboardContactName(message.to) === dashboardUserKey &&
            !message.readAt
        ))
    ), [dashboardMessages, dashboardUserKey]);
    useEffect(() => {
        onUnreadMessageCountChange?.(unreadMessages.length);
    }, [onUnreadMessageCountChange, unreadMessages.length]);
    const activeConversationMessages = useMemo(() => {
        if (!selectedMessageContact) return [];
        const contactKey = normaliseDashboardContactName(selectedMessageContact.name);
        return dashboardMessages
            .filter(message => {
                const from = normaliseDashboardContactName(message.from);
                const to = normaliseDashboardContactName(message.to);
                return (from === dashboardUserKey && to === contactKey) || (from === contactKey && to === dashboardUserKey);
            })
            .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    }, [dashboardMessages, dashboardUserKey, selectedMessageContact]);
    const latestConversationMessageId = activeConversationMessages[activeConversationMessages.length - 1]?.id || '';
    useEffect(() => {
        if (!isMessagesOpen || messageView !== 'compose' || !selectedMessageContact || !activeConversationEndRef.current) return;
        const frame = window.requestAnimationFrame(() => {
            activeConversationEndRef.current?.scrollIntoView({ block: 'end' });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [isMessagesOpen, latestConversationMessageId, messageView, selectedMessageContact?.id]);
    const persistDashboardMessages = (updater: (messages: DashboardMessage[]) => DashboardMessage[]) => {
        setDashboardMessages(prev => {
            const next = updater(prev);
            writeDashboardMessages(next);
            return next;
        });
    };
    const refreshDashboardMessages = async () => {
        if (!dashboardMessageUserName) return;
        try {
            const apiMessages = await fetchDashboardMessagesFromApi(dashboardMessageUserName);
            const selectedKey = normaliseDashboardContactName(dashboardMessageUserName);
            setDashboardMessages(prev => {
                const messagesForOtherUsers = prev.filter(message => (
                    normaliseDashboardContactName(message.from) !== selectedKey &&
                    normaliseDashboardContactName(message.to) !== selectedKey
                ));
                const next = mergeDashboardMessages(messagesForOtherUsers, apiMessages);
                writeDashboardMessages(next);
                return next;
            });
        } catch (error) {
            console.warn('[Dashboard Messages] Could not refresh shared messages:', error);
        }
    };
    useEffect(() => {
        const refreshMessages = () => setDashboardMessages(readDashboardMessages());
        const handleStorage = (event: StorageEvent) => {
            if (event.key === DASHBOARD_MESSAGES_STORAGE_KEY) {
                refreshMessages();
            }
        };
        window.addEventListener('storage', handleStorage);
        window.addEventListener('dfp-dashboard-messages-updated', refreshMessages);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('dfp-dashboard-messages-updated', refreshMessages);
        };
    }, []);
    useEffect(() => {
        setDashboardMessages(readDashboardMessages());
        refreshDashboardMessages();
    }, [dashboardUserKey]);
    useEffect(() => {
        if (!dashboardUserKey) return;
        let cancelled = false;
        const pollMessages = async () => {
            if (cancelled) return;
            await refreshDashboardMessages();
        };
        pollMessages();
        const interval = window.setInterval(pollMessages, 8000);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [dashboardUserKey]);
    const selectMessageContact = (contact: DashboardMessageContact) => {
        setSelectedMessageContact(contact);
        setMessageToText(contact.displayName);
        setIsContactPickerOpen(false);
        setMessageView('compose');
    };
    const deleteDashboardConversation = async (contact: DashboardMessageContact) => {
        const confirmed = await showDarkConfirm(
            `Delete the conversation with ${contact.displayName}?`,
            'Delete Conversation',
            'warning'
        );
        if (!confirmed) return;
        const contactKey = normaliseDashboardContactName(contact.name);
        persistDashboardMessages(messages => messages.filter(message => {
            const from = normaliseDashboardContactName(message.from);
            const to = normaliseDashboardContactName(message.to);
            return !(
                (from === dashboardUserKey && to === contactKey) ||
                (from === contactKey && to === dashboardUserKey)
            );
        }));
        if (selectedMessageContact && normaliseDashboardContactName(selectedMessageContact.name) === contactKey) {
            setSelectedMessageContact(null);
            setMessageToText('');
            setMessageDraft('');
            setMessageView('inbox');
        }
        try {
            await deleteDashboardConversationFromApi(dashboardMessageUserName, contact.name);
            await refreshDashboardMessages();
        } catch (error) {
            console.error('[Dashboard Messages] Delete conversation failed:', error);
            await refreshDashboardMessages();
        }
    };
    const sendDashboardMessage = async () => {
        if (!selectedMessageContact || !messageDraft.trim()) return;
        const nextMessage: DashboardMessage = {
            id: `dashboard-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            from: dashboardMessageUserName,
            to: selectedMessageContact.name,
            body: messageDraft.trim(),
            sentAt: new Date().toISOString(),
        };
        persistDashboardMessages(messages => [...messages, nextMessage]);
        setMessageDraft('');
        try {
            const savedMessage = await sendDashboardMessageToApi(nextMessage);
            persistDashboardMessages(messages => mergeDashboardMessages(messages, [savedMessage]));
        } catch (error) {
            console.error('[Dashboard Messages] Send failed:', error);
        }
    };
    useEffect(() => {
        if (!isMessagesOpen || messageView !== 'compose' || !selectedMessageContact || unreadMessages.length === 0) return;
        const selectedKey = normaliseDashboardContactName(selectedMessageContact.name);
        const messageIdsToMarkRead = unreadMessages
            .filter(message => normaliseDashboardContactName(message.from) === selectedKey)
            .map(message => message.id);
        if (messageIdsToMarkRead.length === 0) return;
        const now = new Date().toISOString();
        persistDashboardMessages(messages => messages.map(message => (
            normaliseDashboardContactName(message.to) === dashboardUserKey &&
            normaliseDashboardContactName(message.from) === selectedKey &&
            !message.readAt
                ? { ...message, readAt: now }
                : message
        )));
        markDashboardConversationReadInApi(dashboardMessageUserName, selectedMessageContact.name, messageIdsToMarkRead)
            .then(() => refreshDashboardMessages())
            .catch(error => console.warn('[Dashboard Messages] Could not mark shared messages read:', error));
    }, [dashboardUserKey, isMessagesOpen, messageView, selectedMessageContact?.name, unreadMessages.length]);
    const newestUnreadMessage = unreadMessages[unreadMessages.length - 1] || null;
    useEffect(() => {
        if (!newestUnreadMessage) {
            setIncomingToast(null);
            return;
        }
        if (shownIncomingToastIds.current.has(newestUnreadMessage.id)) return;
        shownIncomingToastIds.current.add(newestUnreadMessage.id);
        const newest = newestUnreadMessage;
        setIncomingToast(newest);
        const timer = window.setTimeout(() => setIncomingToast(null), 4000);
        return () => window.clearTimeout(timer);
    }, [newestUnreadMessage?.id]);
    const sameUnitStaff = useMemo(() => {
        if (!staffPickerEntry) return [];
        const unit = String(staffPickerEntry.staff.unit || staffPickerEntry.report.unitCode || '').trim();
        return staffOptions
            .filter(staff => staff?.name && (!unit || String(staff.unit || '').trim() === unit))
            .sort((a, b) => compareDashboardRank(a.rank, b.rank) || String(a.name || '').localeCompare(String(b.name || '')));
    }, [staffOptions, staffPickerEntry]);
    
    const mySctRequests = sctRequests.filter(req => req.name === userName.split(' ').reverse().join(', '));
    
    // Get incomplete training report assessments assigned to current user.
    const incompletePt051s = React.useMemo(() => {
        const fullUserName = toDashboardSurnameFirstName(userName);
        const fullUserKey = normaliseDashboardContactName(fullUserName);
        const suppressedEventIds = new Set(suppressedPt051EventIds.map(value => String(value || '').trim()).filter(Boolean));
        const assessments = Array.from(pt051Assessments.values());
        const existingAssessmentKeys = new Set(assessments.map(assessment => (
            `${assessment.eventId || ''}::${normaliseDashboardContactName(assessment.traineeFullName)}`
        )));
        const completedAssessmentKeys = new Set(assessments
            .filter(assessment => assessment.isCompleted)
            .map(assessment => `${assessment.eventId || ''}::${normaliseDashboardContactName(assessment.traineeFullName)}`));
        const storedIncomplete = assessments
            .filter(assessment =>
                !assessment.isCompleted &&
                normaliseDashboardContactName(assessment.instructorName) === fullUserKey &&
                ![
                    assessment.eventId,
                    assessment.id,
                    `dashboard-due-${assessment.eventId}-${normaliseDashboardContactName(assessment.traineeFullName)}`,
                    `pt051-${assessment.eventId}-${assessment.traineeFullName}`,
                ].map(value => String(value || '').trim()).filter(Boolean).some(candidateId => suppressedEventIds.has(candidateId))
            );
        const dueScheduledReports = events
            .filter(event => !isDashboardStandbyEvent(event))
            .map(event => ({ event, detail: findDashboardSyllabusDetail(event, syllabusDetails) }))
            .filter(({ event, detail }) => {
                const traineeName = String(event.student || (event as any).traineeFullName || '').trim();
                if (!traineeName) return false;
                const derivedAssessmentId = `dashboard-due-${event.id}-${normaliseDashboardContactName(traineeName)}`;
                if (suppressedEventIds.has(event.id) || suppressedEventIds.has(derivedAssessmentId)) return false;
                if (!isDashboardGroundOrProceduralEvent(event, detail)) return false;
                if (detail && detail.assessmentRequired !== true) return false;
                if (!detail && (event as any).assessmentRequired !== true) return false;
                const assignedInstructor = normaliseDashboardContactName(event.instructor || event.pilot || event.fixedCrewPic);
                if (!assignedInstructor || assignedInstructor !== fullUserKey) return false;
                const finishTime = getDashboardEventFinishTime(event);
                if (!finishTime || finishTime.getTime() > Date.now()) return false;
                const assessmentKey = `${event.id}::${normaliseDashboardContactName(traineeName)}`;
                if (existingAssessmentKeys.has(assessmentKey) || completedAssessmentKeys.has(assessmentKey)) return false;
                return true;
            })
            .map(({ event }) => {
                const traineeName = String(event.student || (event as any).traineeFullName || '').trim();
                const startTime = Number(event.startTime || 0);
                const duration = Number(event.duration || 0);
                return {
                    id: `dashboard-due-${event.id}-${normaliseDashboardContactName(traineeName)}`,
                    traineeFullName: traineeName,
                    eventId: event.id,
                    flightNumber: getDashboardEventCode(event),
                    date: event.date,
                    instructorName: fullUserName,
                    overallGrade: null,
                    overallResult: null,
                    dcoResult: '',
                    overallComments: '',
                    startTime,
                    duration,
                    endTime: startTime + duration,
                    scores: [],
                    isCompleted: false,
                    groundSchoolAssessment: { isAssessment: false },
                } as Pt051Assessment;
            });
        return [...storedIncomplete, ...dueScheduledReports]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [events, pt051Assessments, suppressedPt051EventIds, syllabusDetails, userName]);

    const visibleTrainingReportsToComplete = React.useMemo(() => {
        const suppressedEventIds = new Set(suppressedPt051EventIds.map(value => String(value || '').trim()).filter(Boolean));
        if (suppressedEventIds.size === 0) return trainingReportsToComplete;
        return trainingReportsToComplete.filter(entry => (
            !getDashboardTrainingReportSuppressionIds(entry.report).some(candidateId => suppressedEventIds.has(candidateId))
        ));
    }, [suppressedPt051EventIds, trainingReportsToComplete]);

    const downloadReportCompletionDiagnostics = () => {
        const fullUserName = toDashboardSurnameFirstName(userName);
        const fullUserKey = normaliseDashboardContactName(fullUserName);
        const suppressedEventIds = new Set(suppressedPt051EventIds.map(value => String(value || '').trim()).filter(Boolean));
        const assessmentRows = Array.from(pt051Assessments.entries()).map(([mapKey, assessment]) => {
            const candidateIds = [
                assessment.eventId,
                assessment.id,
                `dashboard-due-${assessment.eventId}-${normaliseDashboardContactName(assessment.traineeFullName)}`,
                `pt051-${assessment.eventId}-${assessment.traineeFullName}`,
                mapKey,
            ].map(value => String(value || '').trim()).filter(Boolean);
            return {
                source: 'pt051Assessments',
                mapKey,
                id: assessment.id,
                eventId: assessment.eventId,
                flightNumber: assessment.flightNumber,
                traineeFullName: assessment.traineeFullName,
                instructorName: assessment.instructorName,
                date: assessment.date,
                isCompleted: assessment.isCompleted === true,
                instructorMatchesCurrentUser: normaliseDashboardContactName(assessment.instructorName) === fullUserKey,
                candidateIds,
                suppressedMatches: candidateIds.filter(candidateId => suppressedEventIds.has(candidateId)),
                visibleInReportsToComplete: incompletePt051s.some(item => item.id === assessment.id || item.eventId === assessment.eventId),
            };
        });
        const scheduleRows = events
            .filter(event => !isDashboardStandbyEvent(event))
            .map(event => {
                const detail = findDashboardSyllabusDetail(event, syllabusDetails);
                const traineeName = String(event.student || (event as any).traineeFullName || '').trim();
                const derivedAssessmentId = `dashboard-due-${event.id}-${normaliseDashboardContactName(traineeName)}`;
                const candidateIds = [
                    event.id,
                    derivedAssessmentId,
                    `pt051-${event.id}-${traineeName}`,
                ].map(value => String(value || '').trim()).filter(Boolean);
                const finishTime = getDashboardEventFinishTime(event);
                return {
                    source: 'scheduledEventDerivedDueReport',
                    eventId: event.id,
                    flightNumber: getDashboardEventCode(event),
                    type: event.type,
                    resourceId: event.resourceId,
                    date: event.date,
                    startTime: event.startTime,
                    duration: event.duration,
                    finishIso: finishTime?.toISOString() || null,
                    finishHasPassed: finishTime ? finishTime.getTime() <= Date.now() : false,
                    traineeName,
                    instructor: event.instructor,
                    pilot: event.pilot,
                    fixedCrewPic: event.fixedCrewPic,
                    detailCode: detail?.code || null,
                    detailType: detail?.type || null,
                    detailAssessmentRequired: detail?.assessmentRequired === true,
                    eventAssessmentRequired: (event as any).assessmentRequired === true,
                    isGroundOrProcedural: isDashboardGroundOrProceduralEvent(event, detail),
                    assignedInstructorMatchesCurrentUser: normaliseDashboardContactName(event.instructor || event.pilot || event.fixedCrewPic) === fullUserKey,
                    candidateIds,
                    suppressedMatches: candidateIds.filter(candidateId => suppressedEventIds.has(candidateId)),
                    visibleInReportsToComplete: incompletePt051s.some(item => item.id === derivedAssessmentId || item.eventId === event.id),
                };
            });
        const staffQueueRows = trainingReportsToComplete.map(entry => {
            const candidateIds = getDashboardTrainingReportSuppressionIds(entry.report);
            return {
                source: 'trainingReportsToComplete',
                report: {
                    id: entry.report.id,
                    eventId: entry.report.eventId,
                    eventCode: entry.report.eventCode,
                    callsign: entry.report.callsign,
                    date: entry.report.date,
                    status: entry.report.status,
                    dashboardAcknowledgedAt: entry.report.dashboardAcknowledgedAt || null,
                    dashboardAssigneeName: entry.report.dashboardAssigneeName || null,
                    instructorName: entry.report.instructorName || null,
                    staffName: (entry.report as any).staffName || null,
                    traineeFullName: (entry.report as any).traineeFullName || null,
                    unitCode: entry.report.unitCode || null,
                    locationCode: entry.report.locationCode || null,
                },
                staff: {
                    id: (entry.staff as any).id || null,
                    idNumber: entry.staff.idNumber,
                    name: entry.staff.name,
                    rank: entry.staff.rank,
                    unit: entry.staff.unit,
                },
                candidateIds,
                suppressedMatches: candidateIds.filter(candidateId => suppressedEventIds.has(candidateId)),
                visibleInReportsToComplete: visibleTrainingReportsToComplete.some(visibleEntry => visibleEntry.report.id === entry.report.id),
            };
        });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadDashboardJsonFile(`dfp-dashboard-report-render-diagnostics_${timestamp}.json`, {
            generatedAt: new Date().toISOString(),
            currentUser: {
                userName,
                userRank,
                fullUserName,
                fullUserKey,
            },
            counts: {
                visiblePt051Reports: incompletePt051s.length,
                visibleStaffTrainingReports: visibleTrainingReportsToComplete.length,
                rawStaffTrainingReports: trainingReportsToComplete.length,
                pt051AssessmentMapEntries: pt051Assessments.size,
                scheduledEventsForDashboard: events.length,
                suppressedIds: suppressedPt051EventIds.length,
            },
            suppressedPt051EventIds,
            visiblePt051Reports: incompletePt051s.map(item => ({
                id: item.id,
                eventId: item.eventId,
                flightNumber: item.flightNumber,
                traineeFullName: item.traineeFullName,
                instructorName: item.instructorName,
                date: item.date,
                isCompleted: item.isCompleted === true,
            })),
            visibleStaffTrainingReports: staffQueueRows,
            pt051AssessmentRows: assessmentRows,
            scheduledEventDerivedRows: scheduleRows,
        });
    };

    const EventRow: React.FC<{event: ScheduleEvent}> = ({event}) => {
        const isStby = isDashboardStandbyEvent(event);
        return (
            <li className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
                <div className="flex items-center space-x-4">
                    <span className={`w-3 h-3 rounded-full ${event.color}`}></span>
                    <div>
                        <div className="flex items-center space-x-2">
                            <p className="font-semibold text-white">{event.flightNumber}</p>
                            {isStby && (
                                <span className="px-1.5 py-0.5 text-xs font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 tracking-wide">
                                    STBY
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-400">
                            {event.flightType === 'Solo' ? `Solo: ${event.pilot}` : `w/ ${event.student?.split(' ')[0]}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="font-mono text-gray-300">{formatTime(event.startTime)} - {formatTime(event.startTime + event.duration)}</span>
                    <button onClick={() => onSelectEvent(event)} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">
                        Details
                    </button>
                </div>
            </li>
        );
    };

    return (
        <div className="flex flex-col bg-gray-900 overflow-y-auto p-6 space-y-6">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <h1 className="text-3xl font-bold text-white">My Dashboard</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className="text-lg text-gray-400">Welcome,</span>
                        <span className="text-lg font-semibold text-gray-100">{signedInUserLabel}</span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-px">
                    <button
                        type="button"
                        onClick={() => {
                            setMessageView('inbox');
                            setIsMessagesOpen(true);
                        }}
                        className={dashboardActionButtonClass}
                    >
                        {unreadMessages.length > 0 && (
                            <span className="absolute -left-1.5 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white shadow-lg">
                                <span className="-translate-x-px">{Math.min(unreadMessages.length, 9)}</span>
                            </span>
                        )}
                        Messages
                    </button>
                    <button
                        type="button"
                        className={dashboardActionButtonClass}
                    >
                        Change<br />Password
                    </button>
                    <button
                        type="button"
                        className={`${dashboardActionButtonClass} text-red-500`}
                    >
                        Sign<br />Out
                    </button>
                </div>
            </header>
            {incomingToast && (
                <div className="fixed inset-0 z-[100] flex pointer-events-none items-center justify-center p-4">
                    <div className="max-w-sm rounded-2xl border border-sky-300/40 bg-gray-950/95 px-5 py-4 text-center shadow-2xl ring-1 ring-white/10">
                        <p className="text-sm font-bold text-white">New Message</p>
                        <p className="mt-1 text-xs text-gray-300">From {toDashboardContactDisplayName(incomingToast.from)}</p>
                    </div>
                </div>
            )}
            {isMessagesOpen && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4">
                    <div className="relative flex h-[78vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] bg-[#f7f7f8] text-gray-950 shadow-2xl ring-1 ring-black/10">
                        <div className="relative px-5 pb-3 pt-5">
                            {messageView === 'compose' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMessageView('inbox');
                                        setIsContactPickerOpen(false);
                                    }}
                                    className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-gray-200 text-gray-950 shadow-inner hover:bg-gray-300"
                                    aria-label="Back to messages"
                                >
                                    <DashboardIconArrowLeft className="h-6 w-6" strokeWidth={2.4} />
                                </button>
                            )}
                            <h2 className="text-center text-2xl font-bold tracking-tight">{messageView === 'inbox' ? 'Messages' : 'New Message'}</h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMessagesOpen(false);
                                    setIsContactPickerOpen(false);
                                    setMessageSearchText('');
                                }}
                                className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-gray-200 text-gray-950 shadow-inner hover:bg-gray-300"
                                aria-label="Close messages"
                            >
                                <DashboardIconX className="h-7 w-7 translate-x-px -translate-y-0.5" strokeWidth={2.1} />
                            </button>
                        </div>
                        {messageView === 'inbox' ? (
                            <>
                                <div className="flex-1 overflow-y-auto px-5 pb-24 pt-2">
                                    {filteredMessageConversations.length > 0 ? (
                                        <div className="divide-y divide-gray-200">
                                            {filteredMessageConversations.map(conversation => (
                                                <div
                                                    key={conversation.contact.id}
                                                    className="relative flex w-full items-start gap-3 py-4 pr-11 text-left hover:bg-white/50"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => selectMessageContact(conversation.contact)}
                                                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                                                    >
                                                        {conversation.unreadCount > 0 && (
                                                            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" aria-label="Unread message" />
                                                        )}
                                                        <div className={`min-w-0 flex-1 ${conversation.unreadCount > 0 ? '' : 'pl-5'}`}>
                                                            <div className="flex items-baseline gap-2">
                                                                <p className="min-w-0 flex-1 truncate text-[22px] font-bold leading-tight text-black">
                                                                    {conversation.contact.displayName}
                                                                </p>
                                                                <span className="shrink-0 text-lg text-gray-500">
                                                                    {formatDashboardConversationDate(conversation.lastMessage.sentAt)}
                                                                </span>
                                                            </div>
                                                            <p className="mt-1 line-clamp-2 text-[20px] leading-snug text-gray-500">
                                                                {conversation.lastMessage.body}
                                                            </p>
                                                        </div>
                                                        <DashboardIconChevronRight className="mt-2 h-7 w-7 shrink-0 text-gray-500" strokeWidth={2.6} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteDashboardConversation(conversation.contact)}
                                                        className="absolute bottom-3 right-1 grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600"
                                                        aria-label={`Delete conversation with ${conversation.contact.displayName}`}
                                                    >
                                                        <DashboardIconTrash className="h-[18px] w-[18px]" strokeWidth={2.1} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="pt-20 text-center text-sm text-gray-400">
                                            {messageSearchText ? 'No messages match your search.' : 'No messages yet.'}
                                        </p>
                                    )}
                                </div>
                                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
                                    <div className="flex h-14 min-w-0 flex-1 items-center rounded-full bg-white/90 px-4 shadow-[0_10px_28px_rgba(15,23,42,0.14)] ring-1 ring-black/5">
                                        <DashboardIconSearch className="mr-3 h-7 w-7 shrink-0 text-black" strokeWidth={2.8} />
                                        <input
                                            value={messageSearchText}
                                            onChange={(event) => setMessageSearchText(event.target.value)}
                                            placeholder="Search"
                                            className="min-w-0 flex-1 bg-transparent text-[22px] font-semibold text-gray-700 outline-none placeholder:text-gray-500"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMessageView('compose');
                                            setSelectedMessageContact(null);
                                            setMessageToText('');
                                            setMessageDraft('');
                                        }}
                                        className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-black shadow-[0_10px_28px_rgba(15,23,42,0.16)] ring-1 ring-black/5 hover:bg-gray-100"
                                        aria-label="New message"
                                    >
                                        <DashboardIconSquarePen className="h-8 w-8" strokeWidth={2.4} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="relative mx-3 rounded-full border border-white bg-white/80 shadow-[0_18px_30px_rgba(15,23,42,0.12)]">
                                    <div className="flex h-14 items-center gap-2 px-4">
                                        <span className="text-xl text-gray-500">To:</span>
                                        <input
                                            value={messageToText}
                                            onChange={(event) => {
                                                setMessageToText(event.target.value);
                                                setSelectedMessageContact(null);
                                            }}
                                            className="min-w-0 flex-1 bg-transparent text-xl text-gray-950 outline-none"
                                            autoComplete="off"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setIsContactPickerOpen(true)}
                                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-200 text-gray-950 hover:bg-gray-300"
                                            aria-label="Open contacts"
                                        >
                                            <DashboardIconPlus className="h-7 w-7 translate-x-px -translate-y-0.5" strokeWidth={2} />
                                        </button>
                                    </div>
                                    {!selectedMessageContact && messageSuggestionGroups.length > 0 && (
                                        <div className="absolute left-8 right-14 top-[58px] z-10 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                                            {messageSuggestionGroups.map(group => (
                                                <div key={group.title}>
                                                    <div className="bg-gray-50 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">{group.title}</div>
                                                    {group.contacts.map(contact => renderDashboardMessageContactButton(contact, selectMessageContact, true))}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto px-4 py-5">
                                    {selectedMessageContact ? (
                                        activeConversationMessages.length > 0 ? (
                                            <div className="space-y-3">
                                                {activeConversationMessages.map(message => {
                                                    const mine = normaliseDashboardContactName(message.from) === dashboardUserKey;
                                                    const sentDate = new Date(message.sentAt);
                                                    const timeLabel = formatDashboardMessageTime(sentDate);
                                                    const dateLabel = `${String(sentDate.getDate()).padStart(2, '0')}/${String(sentDate.getMonth() + 1).padStart(2, '0')}/${String(sentDate.getFullYear()).slice(-2)}`;
                                                    return (
                                                        <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                                            <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                                                                <div className={`rounded-2xl px-4 py-2 shadow-sm ${mine ? 'bg-sky-500 text-white' : 'bg-white text-gray-950'}`}>
                                                                    <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                                                                </div>
                                                                <div className="mt-1 flex items-center justify-end gap-2 pr-1 text-[10px] text-gray-500">
                                                                    <span>{timeLabel} {dateLabel}</span>
                                                                    {mine && <span>{message.readAt ? 'Read' : 'Sent'}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div ref={activeConversationEndRef} />
                                            </div>
                                        ) : (
                                            <p className="pt-20 text-center text-sm text-gray-400">No messages yet.</p>
                                        )
                                    ) : (
                                        <p className="pt-20 text-center text-sm text-gray-400">Choose someone to message.</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 border-t border-gray-200 bg-white/70 px-3 py-3 shadow-[0_-8px_22px_rgba(15,23,42,0.08)]">
                                    <input
                                        value={messageDraft}
                                        onChange={(event) => setMessageDraft(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' && !event.shiftKey) {
                                                event.preventDefault();
                                                sendDashboardMessage();
                                            }
                                        }}
                                        placeholder="Message"
                                        className="h-12 min-w-0 flex-1 rounded-full border border-white bg-white px-4 text-base text-gray-950 shadow-inner outline-none focus:ring-2 focus:ring-sky-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={sendDashboardMessage}
                                        disabled={!selectedMessageContact || !messageDraft.trim()}
                                        className="flex h-12 w-14 items-center justify-center rounded-md bg-white text-sm font-bold text-sky-600 shadow disabled:cursor-not-allowed disabled:text-gray-300"
                                    >
                                        Send
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    {messageView === 'compose' && isContactPickerOpen && (
                        <div className="absolute inset-0 z-[105] flex items-center justify-center bg-black/45 p-4">
                            <div className="w-full max-w-md rounded-2xl bg-white p-4 text-gray-950 shadow-2xl">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-lg font-bold">Select Contact</h3>
                                    <button type="button" onClick={() => setIsContactPickerOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-950" aria-label="Close contacts">
                                        <DashboardIconX className="h-5 w-5 translate-x-px -translate-y-0.5" strokeWidth={2} />
                                    </button>
                                </div>
                                <div className="max-h-[52vh] space-y-3 overflow-y-auto">
                                    {messageContactGroups.map(group => (
                                        <div key={group.title}>
                                            <div className="mb-1 rounded bg-gray-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">{group.title}</div>
                                            <div className="space-y-1">
                                                {group.contacts.map(contact => renderDashboardMessageContactButton(contact, selectMessageContact))}
                                            </div>
                                        </div>
                                    ))}
                                    {messageContactGroups.length === 0 && (
                                        <p className="py-8 text-center text-sm text-gray-500">No contacts found for this unit.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* My Hub */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold text-sky-400 mb-4">My Hub</h2>
                    <div className="space-y-3">
                        <button onClick={onSelectMyProfile} className="w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-md text-white font-semibold transition-colors">
                            My Profile
                        </button>
                        <button onClick={onSelectMyCurrency} className="w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-md text-white font-semibold transition-colors">
                            My Currency
                        </button>
                        <button onClick={onSelectMySct} className="w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-md text-white font-semibold transition-colors">
                            My {continuationShortLabel}
                        </button>
                    </div>
                </div>

                {/* Weather Widget */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                    <TafWeatherWidget defaultLocationCodes={currentLocationCode ? [currentLocationCode] : []} />
                </div>
                
                {/* My Active Continuation Training Requests */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold text-sky-400 mb-4">My Active {continuationShortLabel} Requests</h2>
                    {mySctRequests.length > 0 ? (
                        <ul className="space-y-2">
                            {mySctRequests.map(req => (
                                <li key={req.id} className="p-2 bg-gray-700/50 rounded-md text-sm">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold text-white">{req.event}</p>
                                        {req.dateRequested && (
                                            <p className="text-xs text-gray-500">{formatDate(req.dateRequested)}</p>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400">Expires: {req.currentExpiry}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-center italic py-4">No active {continuationShortLabel} requests.</p>
                    )}
                </div>

                {/* Reports to be completed */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 className="text-xl font-semibold text-amber-400">Reports to be completed</h2>
                        <button
                            type="button"
                            onClick={downloadReportCompletionDiagnostics}
                            className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20"
                        >
                            Diag
                        </button>
                    </div>
                    {incompletePt051s.length > 0 || visibleTrainingReportsToComplete.length > 0 ? (
                        <ul className="space-y-2">
                            {incompletePt051s.map(assessment => (
                                <li key={assessment.id} className="p-3 bg-gray-700/50 rounded-md hover:bg-gray-700 transition-colors">
                                    <button 
                                        onClick={() => onSelectPt051(assessment)}
                                        className="w-full text-left"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold text-white">{assessment.flightNumber}</p>
                                                <p className="text-sm text-gray-400">{assessment.trainedFullName}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-gray-300 font-mono">{formatDate(assessment.date)}</p>
                                                <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300">
                                                    Pending
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                            {visibleTrainingReportsToComplete.map(entry => (
                                <li key={entry.report.id} className="p-3 bg-gray-700/50 rounded-md hover:bg-gray-700 transition-colors">
                                    <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onSelectTrainingReport?.(entry)}
                                        className="min-w-0 flex-1 text-left"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-white">{entry.report.eventCode}</p>
                                                <p className="truncate text-sm text-gray-400">Report to complete from flight {entry.report.callsign || entry.report.eventCode}</p>
                                            </div>
                                            <div className="flex shrink-0 items-center justify-end gap-1.5 text-right">
                                                <span className="whitespace-nowrap text-[10px] font-mono text-gray-300">{formatDate(entry.report.date)}</span>
                                                <span className="inline-flex h-5 items-center whitespace-nowrap rounded-full bg-amber-500/20 px-1.5 text-[9px] font-semibold text-amber-300">
                                                    Training Report
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStaffPickerEntry({ ...entry, mode: 'reassign' })}
                                        className={dashboardActionButtonClass}
                                    >
                                        Re-Assign
                                    </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-center italic py-4">No pending reports.</p>
                    )}
                </div>
            </div>

            {/* Today's Schedule */}
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold text-sky-400 mb-4">Today's Schedule</h2>
                {sortedEvents.length > 0 ? (
                    <ul className="space-y-3">
                        {sortedEvents.map(event => <EventRow key={event.id} event={event} />)}
                    </ul>
                ) : (
                    <p className="text-gray-500 text-center py-8">No events scheduled for today.</p>
                )}
            </div>
            {staffPickerEntry && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-lg rounded-lg border border-gray-600 bg-gray-900 p-4 shadow-2xl">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">{staffPickerEntry.mode === 'reassign' ? 'Re-Assign Report' : 'Select Staff Member to Assess'}</h3>
                                <p className="text-xs text-gray-400">Flight {staffPickerEntry.report.callsign || staffPickerEntry.report.eventCode}</p>
                            </div>
                            <button type="button" onClick={() => setStaffPickerEntry(null)} className="text-2xl leading-none text-gray-400 hover:text-white">x</button>
                        </div>
                        <div className="max-h-[55vh] space-y-1 overflow-y-auto">
                            {sameUnitStaff.map(staff => (
                                <button
                                    key={`${staff.unit || 'unit'}-${staff.idNumber}-${staff.name}`}
                                    type="button"
                                    onClick={() => {
                                        if (staffPickerEntry.mode === 'reassign') {
                                            onReassignTrainingReport?.(staffPickerEntry, staff);
                                        } else {
                                            onSelectTrainingReport?.({ ...staffPickerEntry, staff });
                                        }
                                        setStaffPickerEntry(null);
                                    }}
                                    className={`flex w-full items-center justify-between rounded border bg-gray-800 px-3 py-2 text-left hover:bg-gray-700 ${roleTone(formatStaffRole(staff))}`}
                                >
                                    <span className="text-sm font-semibold">{staff.rank} {staff.name}</span>
                                    <span className="text-[10px] font-bold uppercase">{formatStaffRole(staff)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyDashboard;
