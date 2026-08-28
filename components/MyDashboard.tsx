import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AirCombatTrainingReport, Instructor, ScheduleEvent, SctRequest, TrainingReportAssessment, Trainee, SyllabusItemDetail } from '../types';
import TafWeatherWidget from './TafWeatherWidget';
import { normaliseFixedCrewStaffRole } from '../utils/crewPositionTerminology';
import { DEFAULT_SCT_TERMINOLOGY, normaliseSctTerminology, type SctTerminology } from '../utils/sctTerminology';
import {
    getPersonAssignedQualificationIds,
    normaliseStaffQualificationCatalogue,
    type StaffQualificationCatalogue,
} from '../utils/staffQualifications';
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
    pt051Assessments: Map<string, TrainingReportAssessment>;
    onSelectPt051: (assessment: TrainingReportAssessment) => void;
    syllabusDetails?: SyllabusItemDetail[];
    suppressedPt051EventIds?: string[];
    trainingReportsToComplete?: Array<{ report: AirCombatTrainingReport; staff: Instructor }>;
    onSelectTrainingReport?: (entry: { report: AirCombatTrainingReport; staff: Instructor }) => void;
    onReassignTrainingReport?: (entry: { report: AirCombatTrainingReport; staff: Instructor }, assignee: Instructor) => void;
    onDeletePt051ReportMessage?: (assessment: TrainingReportAssessment) => void | Promise<void>;
    onDeleteTrainingReportMessage?: (entry: { report: AirCombatTrainingReport; staff: Instructor }) => void | Promise<void>;
    staffOptions?: Instructor[];
    messageContactStaffOptions?: Instructor[];
    messageContactTraineeOptions?: Trainee[];
    messageContactUnitCodes?: string[];
    canCreateUnitMessageGroups?: boolean;
    staffQualificationCatalogue?: StaffQualificationCatalogue;
    onUnreadMessageCountChange?: (count: number) => void;
    sctTerminology?: SctTerminology;
    currentLocationCode?: string | null;
    onLogout?: () => void;
    onShowChangePassword?: () => void;
}

type DashboardMessageContact = {
    id: string;
    name: string;
    displayName: string;
    unit: string;
    role: string;
    course?: string;
    flight?: string;
    qualification?: string;
    qualificationIds?: string[];
    rank: string;
    surname: string;
    firstNames: string;
    type: 'Staff' | 'Trainee' | 'Group';
    memberIds?: string[];
    memberNames?: string[];
    idNumber?: string;
};

type DashboardMessage = {
    id: string;
    from: string;
    to: string;
    body: string;
    sentAt: string;
    readAt?: string;
    fromId?: string;
    toId?: string;
    recipientIds?: string[];
    groupId?: string;
    groupName?: string;
    groupMemberIds?: string[];
    groupMemberNames?: string[];
    readByIds?: string[];
    readByNames?: string[];
    deletedForIds?: string[];
    deletedForNames?: string[];
};

type DashboardMessageContactGroup = {
    title: string;
    contacts: DashboardMessageContact[];
};

type DashboardMessageGroupRecord = {
    id: string;
    name: string;
    scopeType: 'personal' | 'unit' | 'combined_unit' | 'organisation';
    ownerId?: string;
    ownerName?: string;
    unitCode?: string;
    members: Array<{
        id: string;
        name: string;
        displayName: string;
        type: 'Staff' | 'Trainee';
        rank?: string;
        unit?: string;
        course?: string;
        flight?: string;
        qualification?: string;
        qualificationIds?: string[];
        idNumber?: string;
    }>;
    createdAt?: string;
    updatedAt?: string;
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

const DashboardIconUsers: React.FC<DashboardIconProps> = ({ className = 'h-5 w-5', strokeWidth = 2 }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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

const DASHBOARD_RANK_ORDER = [
    'AIRCDRE', 'AIR COMMODORE',
    'GPCAPT', 'GROUP CAPTAIN',
    'WGCDR', 'WING COMMANDER',
    'SQNLDR', 'SQUADRON LEADER',
    'FLTLT', 'FLIGHT LIEUTENANT',
    'FLGOFF', 'FLYING OFFICER',
    'PLTOFF', 'PILOT OFFICER',
    'OCDT', 'MIDN', 'SBLT', '2LT',
    'WOFF', 'FSGT', 'SGT', 'CPL', 'LAC', 'AC',
];

const normaliseDashboardRank = (value?: string): string => String(value || '').trim().toUpperCase();

const compareDashboardRank = (left?: string, right?: string): number => {
    const leftRank = normaliseDashboardRank(left);
    const rightRank = normaliseDashboardRank(right);
    const leftIndex = DASHBOARD_RANK_ORDER.indexOf(leftRank);
    const rightIndex = DASHBOARD_RANK_ORDER.indexOf(rightRank);
    if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? DASHBOARD_RANK_ORDER.length : leftIndex) -
            (rightIndex === -1 ? DASHBOARD_RANK_ORDER.length : rightIndex);
    }
    return leftRank.localeCompare(rightRank, undefined, { sensitivity: 'base' });
};

const formatDashboardStaffName = (staff: Instructor): string => {
    const [lastName, firstName] = String(staff.name || '').split(',').map(part => part.trim());
    const displayName = firstName ? `${firstName} ${lastName}` : staff.name;
    return `${staff.rank || ''} ${displayName}`.trim();
};

const normaliseDashboardContactName = (value?: string | null): string => (
    String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

const stripDashboardRankFromName = (value?: string | null): string => {
    let text = String(value || '').trim();
    if (!text) return '';
    const sortedRanks = [...DASHBOARD_RANK_ORDER].sort((a, b) => b.length - a.length);
    for (const rank of sortedRanks) {
        const rankPattern = rank.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
        const next = text.replace(new RegExp(`^${rankPattern}\\s+`, 'i'), '').trim();
        if (next !== text) {
            text = next;
            break;
        }
    }
    return text;
};

const stripDashboardCourseFromName = (value?: string | null): string => (
    String(value || '')
        .replace(/\s*[‐‑‒–—-]\s*[A-Z]{2,}\d+[A-Z0-9]*\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
);

const normaliseDashboardPersonName = (value?: string | null): string => (
    normaliseDashboardContactName(stripDashboardRankFromName(stripDashboardCourseFromName(value)))
);

const dashboardPersonNameKeys = (value?: string | null): Set<string> => {
    const base = stripDashboardRankFromName(stripDashboardCourseFromName(value));
    return new Set([
        normaliseDashboardPersonName(base),
        normaliseDashboardPersonName(toDashboardSurnameFirstName(base)),
    ].filter(Boolean));
};

const dashboardPersonNamesMatch = (left?: string | null, right?: string | null): boolean => {
    const rightKeys = dashboardPersonNameKeys(right);
    return Array.from(dashboardPersonNameKeys(left)).some(key => rightKeys.has(key));
};

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

const formatDashboardMessageDaySeparator = (dateString: string): string => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayDiff = Math.round((today - messageDay) / 86400000);
    if (dayDiff === 0) return `Today ${formatDashboardMessageTime(date)}`;
    if (dayDiff === 1) return 'Yesterday';
    if (dayDiff > 1 && dayDiff < 7) return date.toLocaleDateString('en-AU', { weekday: 'long' });
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

const shouldShowDashboardMessageDaySeparator = (message: DashboardMessage, previous?: DashboardMessage): boolean => {
    if (!previous) return true;
    const messageDate = new Date(message.sentAt);
    const previousDate = new Date(previous.sentAt);
    if (isNaN(messageDate.getTime()) || isNaN(previousDate.getTime())) return false;
    return (
        messageDate.getFullYear() !== previousDate.getFullYear() ||
        messageDate.getMonth() !== previousDate.getMonth() ||
        messageDate.getDate() !== previousDate.getDate()
    );
};

const getDashboardMessageInitials = (value?: string | null): string => {
    const cleanName = stripDashboardRankFromName(stripDashboardCourseFromName(value));
    const [surname, firstNames] = cleanName.includes(',')
        ? cleanName.split(',').map(part => part.trim())
        : ['', cleanName];
    const parts = [firstNames, surname].join(' ').split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
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
    const groupContacts = sortDashboardContacts(contacts.filter(contact => contact.type === 'Group'));
    const byUnit = new Map<string, DashboardMessageContact[]>();
    contacts.filter(contact => contact.type !== 'Group').forEach(contact => {
        const unit = contact.unit || 'No Unit';
        byUnit.set(unit, [...(byUnit.get(unit) || []), contact]);
    });

    const groupedPeople = Array.from(byUnit.entries())
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
                    const course = contact.course || 'Unallocated Trainees';
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

    return [
        ...(groupContacts.length > 0 ? [{ title: 'Groups', contacts: groupContacts }] : []),
        ...groupedPeople,
    ];
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
            <span className="block text-xs text-gray-500">
                {contact.type === 'Group'
                    ? `${contact.memberIds?.length || 0} recipients`
                    : contact.type === 'Trainee'
                        ? `${contact.unit}${contact.idNumber ? ` - ID ${contact.idNumber}` : ''}`
                        : `${contact.unit} - ${contact.role}${contact.idNumber ? ` - ID ${contact.idNumber}` : ''}`}
            </span>
        </span>
        <span className={`${compact ? 'text-gray-400' : 'rounded-full bg-gray-100 px-2 py-1 text-gray-500'} text-[10px] font-bold uppercase`}>{contact.type}</span>
    </button>
);

const formatDashboardGroupScope = (scopeType: DashboardMessageGroupRecord['scopeType']): string => {
    if (scopeType === 'personal') return 'Personal Group';
    if (scopeType === 'unit') return 'Unit Group';
    if (scopeType === 'combined_unit') return 'Combined Unit Group';
    return 'Organisation Group';
};

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

const fetchDashboardMessagesFromApi = async (userName: string, userId?: string): Promise<DashboardMessage[]> => {
    const params = new URLSearchParams();
    if (userName) params.set('userName', userName);
    if (userId) params.set('userId', userId);
    const response = await fetch(`/api/dashboard-messages?${params.toString()}`, {
        credentials: 'include',
    });
    if (!response.ok) throw new Error(`Dashboard messages fetch failed: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data.messages) ? data.messages : [];
};

const fetchAllDashboardMessagesForTrace = async (): Promise<DashboardMessage[]> => {
    const response = await fetch('/api/dashboard-messages', {
        credentials: 'include',
    });
    if (!response.ok) throw new Error(`Dashboard messages trace fetch failed: ${response.status}`);
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

const sendDashboardMessagesToApi = async (messages: DashboardMessage[]): Promise<DashboardMessage[]> => {
    const response = await fetch('/api/dashboard-messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
    });
    if (!response.ok) throw new Error(`Dashboard messages send failed: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data.messages) ? data.messages : messages;
};

const fetchDashboardMessageGroupsFromApi = async (ownerId: string, userName: string, unitCode?: string): Promise<DashboardMessageGroupRecord[]> => {
    const params = new URLSearchParams();
    if (ownerId) params.set('ownerId', ownerId);
    if (userName) params.set('userName', userName);
    if (unitCode) params.set('unitCode', unitCode);
    const response = await fetch(`/api/dashboard-message-groups?${params.toString()}`, {
        credentials: 'include',
    });
    if (!response.ok) throw new Error(`Dashboard message groups fetch failed: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data.groups) ? data.groups : [];
};

const saveDashboardMessageGroupToApi = async (
    group: DashboardMessageGroupRecord,
    options: { canCreateUnitGroup?: boolean } = {},
): Promise<DashboardMessageGroupRecord> => {
    const response = await fetch('/api/dashboard-message-groups', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group, canCreateUnitGroup: options.canCreateUnitGroup === true }),
    });
    if (!response.ok) throw new Error(`Dashboard message group save failed: ${response.status}`);
    const data = await response.json();
    return data.group || group;
};

const markDashboardConversationReadInApi = async (reader: string, sender: string, messageIds: string[], readerId?: string, senderId?: string) => {
    const response = await fetch('/api/dashboard-messages/read', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reader, sender, messageIds, readerId, senderId }),
    });
    if (!response.ok) throw new Error(`Dashboard message read update failed: ${response.status}`);
};

const deleteDashboardConversationFromApi = async (
    participant: string,
    contact: string,
    participantId?: string,
    contactId?: string,
    groupId?: string,
) => {
    const response = await fetch('/api/dashboard-messages/conversation', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant, contact, participantId, contactId, groupId }),
    });
    if (!response.ok) throw new Error(`Dashboard conversation delete failed: ${response.status}`);
};

const deleteDashboardMessageFromApi = async (messageId: string) => {
    const response = await fetch(`/api/dashboard-messages/${encodeURIComponent(messageId)}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!response.ok) throw new Error(`Dashboard message delete failed: ${response.status}`);
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
    suppressedPt051EventIds = [],
    trainingReportsToComplete = [],
    onSelectTrainingReport,
    onReassignTrainingReport,
    onDeletePt051ReportMessage,
    onDeleteTrainingReportMessage,
    staffOptions = [],
    messageContactStaffOptions = staffOptions,
    messageContactTraineeOptions = [],
    messageContactUnitCodes = [],
    canCreateUnitMessageGroups = false,
    staffQualificationCatalogue,
    onUnreadMessageCountChange,
    sctTerminology = DEFAULT_SCT_TERMINOLOGY,
    currentLocationCode,
    onLogout,
    onShowChangePassword,
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
    const [selectedMessageContacts, setSelectedMessageContacts] = useState<DashboardMessageContact[]>([]);
    const [selectedMessageGroupContact, setSelectedMessageGroupContact] = useState<DashboardMessageContact | null>(null);
    const [messageDraft, setMessageDraft] = useState('');
    const [dashboardMessages, setDashboardMessages] = useState<DashboardMessage[]>(() => readDashboardMessages());
    const [dashboardMessageGroups, setDashboardMessageGroups] = useState<DashboardMessageGroupRecord[]>([]);
    const [messageView, setMessageView] = useState<'inbox' | 'compose' | 'groups' | 'group'>('inbox');
    const [messageSearchText, setMessageSearchText] = useState('');
    const [groupNameDraft, setGroupNameDraft] = useState('');
    const [groupBuilderSearch, setGroupBuilderSearch] = useState('');
    const [groupBuilderScope, setGroupBuilderScope] = useState<'personal' | 'unit'>('personal');
    const [groupBuilderTypeFilter, setGroupBuilderTypeFilter] = useState<'all' | 'Staff' | 'Trainee'>('all');
    const [groupBuilderUnitFilter, setGroupBuilderUnitFilter] = useState('all');
    const [groupBuilderFlightFilter, setGroupBuilderFlightFilter] = useState('all');
    const [groupBuilderRankFilter, setGroupBuilderRankFilter] = useState('all');
    const [groupBuilderRoleFilter, setGroupBuilderRoleFilter] = useState('all');
    const [groupBuilderCourseFilter, setGroupBuilderCourseFilter] = useState('all');
    const [groupBuilderQualificationFilter, setGroupBuilderQualificationFilter] = useState('all');
    const [groupBuilderSelectedIds, setGroupBuilderSelectedIds] = useState<Set<string>>(() => new Set());
    const [editingMessageGroupId, setEditingMessageGroupId] = useState<string | null>(null);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [openGroupMemberFlyoutId, setOpenGroupMemberFlyoutId] = useState<string | null>(null);
    const [incomingToast, setIncomingToast] = useState<DashboardMessage | null>(null);
    const [messageSendError, setMessageSendError] = useState('');
    const [failedMessageIds, setFailedMessageIds] = useState<Set<string>>(() => new Set());
    const [hasNewConversationMessages, setHasNewConversationMessages] = useState(false);
    const shownIncomingToastIds = useRef<Set<string>>(new Set());
    const activeConversationScrollRef = useRef<HTMLDivElement | null>(null);
    const activeConversationEndRef = useRef<HTMLDivElement | null>(null);
    const activeConversationKeyRef = useRef('');
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
    const normalisedStaffQualificationCatalogue = useMemo(
        () => normaliseStaffQualificationCatalogue(staffQualificationCatalogue),
        [staffQualificationCatalogue],
    );
    const qualificationLabelById = useMemo(() => new Map(
        normalisedStaffQualificationCatalogue.qualifications
            .filter(qualification => String(qualification.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
            .map(qualification => [qualification.id, qualification.code || qualification.name || qualification.id]),
    ), [normalisedStaffQualificationCatalogue]);
    const formatQualificationLabels = (qualificationIds: string[]): string => (
        qualificationIds
            .map(id => qualificationLabelById.get(id))
            .filter(Boolean)
            .join(', ') || 'None'
    );
    const dashboardMessageUserName = userName;
    const dashboardUserKey = normaliseDashboardContactName(dashboardMessageUserName);
    const dashboardUserContactId = `user-${dashboardUserKey}`;
    const dashboardUserStaff = useMemo(() => (
        messageContactStaffOptions.find(staff => normaliseDashboardPersonName(staff.name) === normaliseDashboardPersonName(dashboardMessageUserName))
    ), [dashboardUserKey, messageContactStaffOptions]);
    const dashboardUserTrainee = useMemo(() => {
        const userKey = normaliseDashboardPersonName(dashboardMessageUserName);
        const surnameFirstKey = normaliseDashboardPersonName(toDashboardSurnameFirstName(dashboardMessageUserName));
        return messageContactTraineeOptions.find(trainee => {
            const traineeName = stripDashboardCourseFromName(trainee.fullName || trainee.name);
            const traineeKey = normaliseDashboardPersonName(traineeName);
            return traineeKey === userKey || traineeKey === surnameFirstKey;
        });
    }, [dashboardUserKey, messageContactTraineeOptions]);
    const dashboardSenderContactId = dashboardUserStaff
        ? `staff-${dashboardUserStaff.idNumber}-${dashboardUserStaff.name}`
        : dashboardUserTrainee
            ? `trainee-${dashboardUserTrainee.idNumber}-${stripDashboardCourseFromName(dashboardUserTrainee.fullName || dashboardUserTrainee.name)}`
        : dashboardUserContactId;
    const dashboardUserUnitCodes = useMemo(() => {
        const scopedUnits = messageContactUnitCodes
            .flatMap(unitCode => String(unitCode || '').split(/[+/]/))
            .map(unitCode => unitCode.trim().toUpperCase())
            .filter(Boolean);
        if (scopedUnits.length > 0) return Array.from(new Set(scopedUnits));
        const unit = String(dashboardUserStaff?.unit || '').trim().toUpperCase();
        const traineeUnit = String(dashboardUserTrainee?.unit || '').trim().toUpperCase();
        if (traineeUnit) return traineeUnit.split(/[+/]/).map(code => code.trim()).filter(Boolean);
        if (unit) return unit.split(/[+/]/).map(code => code.trim()).filter(Boolean);
        return [];
    }, [dashboardUserStaff?.unit, dashboardUserTrainee?.unit, messageContactUnitCodes]);
    const dashboardUserUnitSet = useMemo(() => new Set(dashboardUserUnitCodes), [dashboardUserUnitCodes.join('|')]);
    const peopleMessageContacts = useMemo<DashboardMessageContact[]>(() => {
        const staffContacts = messageContactStaffOptions
            .filter(staff => staff?.name)
            .filter(staff => {
                const unit = String(staff.unit || '').trim().toUpperCase();
                return dashboardUserUnitSet.size === 0 || !unit || dashboardUserUnitSet.has(unit);
            })
            .map(staff => {
                const nameParts = getDashboardContactNameParts(staff.name);
                const qualificationIds = getPersonAssignedQualificationIds(staff, normalisedStaffQualificationCatalogue, false);
                return {
                    id: `staff-${staff.idNumber}-${staff.name}`,
                    name: staff.name,
                    displayName: toDashboardContactDisplayName(staff.name, staff.rank),
                    idNumber: String(staff.idNumber || ''),
                    unit: staff.unit || 'No Unit',
                    role: formatStaffRole(staff),
                    flight: staff.flight || '',
                    qualification: formatQualificationLabels(qualificationIds),
                    qualificationIds,
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
                const name = stripDashboardCourseFromName(trainee.fullName || trainee.name);
                const nameParts = getDashboardContactNameParts(name);
                const qualificationIds = getPersonAssignedQualificationIds(trainee, normalisedStaffQualificationCatalogue, false);
                return {
                    id: `trainee-${trainee.idNumber}-${name}`,
                    name,
                    displayName: toDashboardContactDisplayName(name, trainee.rank),
                    idNumber: String(trainee.idNumber || ''),
                    unit: trainee.unit || 'No Unit',
                    role: 'Trainee',
                    course: trainee.course || 'Unallocated Trainees',
                    flight: trainee.flight || '',
                    qualification: formatQualificationLabels(qualificationIds),
                    qualificationIds,
                    rank: trainee.rank || '',
                    surname: nameParts.surname,
                    firstNames: nameParts.firstNames,
                    type: 'Trainee' as const,
                };
            });
        const unique = new Map<string, DashboardMessageContact>();
        [...staffContacts, ...traineeContacts]
            .forEach(contact => unique.set(contact.id, contact));
        return Array.from(unique.values()).sort((a, b) => (
            a.unit.localeCompare(b.unit) ||
            (a.type === b.type ? 0 : a.type === 'Staff' ? -1 : 1) ||
            (a.type === 'Trainee' ? String(a.course || '').localeCompare(String(b.course || '')) : 0) ||
            compareDashboardRank(a.rank, b.rank) ||
            a.surname.localeCompare(b.surname) ||
            a.firstNames.localeCompare(b.firstNames) ||
            a.displayName.localeCompare(b.displayName)
        ));
    }, [dashboardUserUnitSet, formatQualificationLabels, formatStaffRole, messageContactStaffOptions, messageContactTraineeOptions, normalisedStaffQualificationCatalogue]);
    const messageContacts = useMemo<DashboardMessageContact[]>(() => {
        const contactsById = new Map(peopleMessageContacts.map(contact => [contact.id, contact]));
        const groupContacts = dashboardMessageGroups.map(group => ({
            id: `group-${group.id}`,
            name: group.name,
            displayName: group.name,
            unit: group.unitCode || 'Groups',
            role: group.scopeType === 'personal' ? 'Personal Group' : 'Shared Group',
            rank: '',
            surname: group.name,
            firstNames: '',
            type: 'Group' as const,
            memberIds: group.members.map(member => member.id).filter(Boolean),
            memberNames: group.members.map(member => member.name).filter(Boolean),
            idNumber: '',
        }));
        return [
            ...groupContacts,
            ...peopleMessageContacts.filter(contact => contact.id !== dashboardSenderContactId),
        ].filter(contact => (
            contact.type !== 'Group' ||
            (contact.memberIds || []).some(memberId => contactsById.has(memberId) && memberId !== dashboardSenderContactId)
        ));
    }, [dashboardMessageGroups, dashboardSenderContactId, peopleMessageContacts]);
    const messageSuggestions = useMemo(() => {
        const query = normaliseDashboardContactName(messageToText);
        if (!query) return [];
        return messageContacts
            .filter(contact => normaliseDashboardContactName(contact.displayName).includes(query) || normaliseDashboardContactName(contact.name).includes(query))
            .slice(0, 6);
    }, [messageContacts, messageToText]);
    const getMessageContactForName = (name: string): DashboardMessageContact => {
        const contact = messageContacts.find(candidate => (
            dashboardPersonNamesMatch(candidate.name, name) ||
            dashboardPersonNamesMatch(candidate.displayName, name)
        ));
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
    const messageContactsById = useMemo(() => new Map(
        peopleMessageContacts.map(contact => [contact.id, contact])
    ), [peopleMessageContacts]);
    const messageFromDashboardUser = (message: DashboardMessage): boolean => (
        message.fromId === dashboardSenderContactId ||
        dashboardPersonNamesMatch(message.from, dashboardMessageUserName)
    );
    const messageDeletedForDashboardUser = (message: DashboardMessage): boolean => (
        (Array.isArray(message.deletedForIds) && message.deletedForIds.includes(dashboardSenderContactId)) ||
        (Array.isArray(message.deletedForNames) && message.deletedForNames.some(name => dashboardPersonNamesMatch(name, dashboardMessageUserName)))
    );
    const messageAddressedToDashboardUser = (message: DashboardMessage): boolean => (
        message.toId === dashboardSenderContactId ||
        (Array.isArray(message.recipientIds) && message.recipientIds.includes(dashboardSenderContactId)) ||
        (Array.isArray(message.groupMemberIds) && message.groupMemberIds.includes(dashboardSenderContactId)) ||
        dashboardPersonNamesMatch(message.to, dashboardMessageUserName)
    );
    const messageReadByDashboardUser = (message: DashboardMessage): boolean => {
        if (Array.isArray(message.readByIds) && message.readByIds.includes(dashboardSenderContactId)) return true;
        if (Array.isArray(message.readByNames) && message.readByNames.some(name => dashboardPersonNamesMatch(name, dashboardMessageUserName))) return true;
        const isMultiRecipient = Boolean(message.groupId) ||
            (Array.isArray(message.recipientIds) && message.recipientIds.length > 1) ||
            (Array.isArray(message.groupMemberIds) && message.groupMemberIds.length > 1);
        return Boolean(message.readAt && !isMultiRecipient);
    };
    const messageMatchesContact = (message: DashboardMessage, contact: DashboardMessageContact): boolean => (
        message.fromId === contact.id ||
        message.toId === contact.id ||
        (Array.isArray(message.recipientIds) && message.recipientIds.includes(contact.id)) ||
        (Array.isArray(message.groupMemberIds) && message.groupMemberIds.includes(contact.id)) ||
        dashboardPersonNamesMatch(message.from, contact.name) ||
        dashboardPersonNamesMatch(message.from, contact.displayName) ||
        dashboardPersonNamesMatch(message.to, contact.name) ||
        dashboardPersonNamesMatch(message.to, contact.displayName)
    );
    const messageBelongsToDashboardUser = (message: DashboardMessage): boolean => (
        !messageDeletedForDashboardUser(message) && (
            messageFromDashboardUser(message) ||
            messageAddressedToDashboardUser(message)
        )
    );
    const getDashboardUnreadMessageKey = (message: DashboardMessage): string => (
        message.groupId
            ? ['group', message.groupId, message.fromId || message.from, message.body, message.sentAt].join('|')
            : message.id
    );
    const resolveMessageContact = (id?: string, name?: string): DashboardMessageContact | null => {
        if (id && messageContactsById.has(id)) return messageContactsById.get(id) || null;
        return messageContacts.find(contact => (
            dashboardPersonNamesMatch(contact.name, name) ||
            dashboardPersonNamesMatch(contact.displayName, name)
        )) || null;
    };
    const getGroupConversationContact = (message: DashboardMessage): DashboardMessageContact | null => {
        if (!message.groupId || !message.groupName) return null;
        const storedGroup = dashboardMessageGroups.find(group => group.id === message.groupId);
        const memberIds = storedGroup?.members.map(member => member.id).filter(Boolean) || message.groupMemberIds || message.recipientIds || [];
        const memberNames = storedGroup?.members.map(member => member.displayName || member.name).filter(Boolean) || message.groupMemberNames || [];
        return {
            id: `group-conversation-${message.groupId}`,
            name: message.groupName,
            displayName: message.groupName,
            unit: storedGroup?.unitCode || 'Groups',
            role: storedGroup ? formatDashboardGroupScope(storedGroup.scopeType) : 'Group',
            rank: '',
            surname: message.groupName,
            firstNames: '',
            type: 'Group',
            memberIds,
            memberNames,
        };
    };
    const messageConversations = useMemo<DashboardConversation[]>(() => {
        const conversations = new Map<string, DashboardConversation>();
        const unreadKeysByConversation = new Map<string, Set<string>>();
        dashboardMessages.forEach(message => {
            if (!messageBelongsToDashboardUser(message)) return;
            const mineById = messageFromDashboardUser(message);
            const groupContact = getGroupConversationContact(message);
            const otherId = groupContact?.id || (mineById ? message.toId : message.fromId);
            const otherName = groupContact?.name || (mineById ? message.to : message.from);
            const resolvedContact = groupContact || resolveMessageContact(otherId, otherName);
            const otherKey = message.groupId
                ? `group-${message.groupId}`
                : resolvedContact?.id || `person-${normaliseDashboardPersonName(otherName)}`;
            const existing = conversations.get(otherKey);
            const isNewer = !existing || new Date(message.sentAt).getTime() >= new Date(existing.lastMessage.sentAt).getTime();
            if (!messageFromDashboardUser(message) && messageAddressedToDashboardUser(message) && !messageReadByDashboardUser(message)) {
                const unreadKeys = unreadKeysByConversation.get(otherKey) || new Set<string>();
                unreadKeys.add(getDashboardUnreadMessageKey(message));
                unreadKeysByConversation.set(otherKey, unreadKeys);
            }
            conversations.set(otherKey, {
                contact: resolvedContact || existing?.contact || getMessageContactForName(otherName),
                lastMessage: isNewer ? message : existing.lastMessage,
                unreadCount: unreadKeysByConversation.get(otherKey)?.size || 0,
            });
        });
        return Array.from(conversations.values())
            .sort((a, b) => new Date(b.lastMessage.sentAt).getTime() - new Date(a.lastMessage.sentAt).getTime());
    }, [dashboardMessageGroups, dashboardMessages, dashboardSenderContactId, dashboardUserKey, messageContacts, messageContactsById]);
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
    const groupBuilderUnitOptions = useMemo(() => (
        Array.from(new Set(peopleMessageContacts.map(contact => contact.unit).filter(Boolean))).sort()
    ), [peopleMessageContacts]);
    const groupBuilderFlightOptions = useMemo(() => (
        Array.from(new Set(peopleMessageContacts.map(contact => contact.flight).filter(Boolean) as string[])).sort()
    ), [peopleMessageContacts]);
    const groupBuilderRankOptions = useMemo(() => (
        Array.from(new Set(peopleMessageContacts.map(contact => contact.rank).filter(Boolean))).sort(compareDashboardRank)
    ), [peopleMessageContacts]);
    const groupBuilderRoleOptions = useMemo(() => (
        Array.from(new Set(peopleMessageContacts.map(contact => contact.role).filter(Boolean))).sort()
    ), [peopleMessageContacts]);
    const groupBuilderCourseOptions = useMemo(() => (
        Array.from(new Set(peopleMessageContacts.map(contact => contact.course).filter(Boolean) as string[])).sort()
    ), [peopleMessageContacts]);
    const groupBuilderQualificationOptions = useMemo(() => (
        normalisedStaffQualificationCatalogue.qualifications
            .filter(qualification => String(qualification.status || 'ACTIVE').toUpperCase() !== 'INACTIVE')
            .map(qualification => ({
                id: qualification.id,
                label: qualification.code || qualification.name || qualification.id,
            }))
            .sort((a, b) => a.label.localeCompare(b.label))
    ), [normalisedStaffQualificationCatalogue]);
    const filteredGroupBuilderContacts = useMemo(() => {
        const query = normaliseDashboardContactName(groupBuilderSearch);
        return peopleMessageContacts
            .filter(contact => groupBuilderTypeFilter === 'all' || contact.type === groupBuilderTypeFilter)
            .filter(contact => groupBuilderUnitFilter === 'all' || contact.unit === groupBuilderUnitFilter)
            .filter(contact => groupBuilderFlightFilter === 'all' || contact.flight === groupBuilderFlightFilter)
            .filter(contact => groupBuilderRankFilter === 'all' || contact.rank === groupBuilderRankFilter)
            .filter(contact => groupBuilderRoleFilter === 'all' || contact.role === groupBuilderRoleFilter)
            .filter(contact => groupBuilderCourseFilter === 'all' || contact.course === groupBuilderCourseFilter)
            .filter(contact => groupBuilderQualificationFilter === 'all' || (contact.qualificationIds || []).includes(groupBuilderQualificationFilter))
            .filter(contact => !query || (
                normaliseDashboardContactName(contact.displayName).includes(query) ||
                normaliseDashboardContactName(contact.name).includes(query) ||
                normaliseDashboardContactName(contact.rank).includes(query) ||
                normaliseDashboardContactName(contact.role).includes(query) ||
                normaliseDashboardContactName(contact.unit).includes(query) ||
                normaliseDashboardContactName(contact.flight).includes(query) ||
                normaliseDashboardContactName(contact.course).includes(query) ||
                normaliseDashboardContactName(contact.qualification).includes(query)
            ));
    }, [
        groupBuilderCourseFilter,
        groupBuilderFlightFilter,
        groupBuilderQualificationFilter,
        groupBuilderRankFilter,
        groupBuilderRoleFilter,
        groupBuilderSearch,
        groupBuilderTypeFilter,
        groupBuilderUnitFilter,
        peopleMessageContacts,
    ]);
    const groupBuilderSelectedContacts = useMemo(() => (
        peopleMessageContacts.filter(contact => groupBuilderSelectedIds.has(contact.id))
    ), [groupBuilderSelectedIds, peopleMessageContacts]);
    const displayMessageRecipients = useMemo(() => {
        const groupMemberIds = new Set(selectedMessageGroupContact?.memberIds || []);
        return [
            ...(selectedMessageGroupContact ? [selectedMessageGroupContact] : []),
            ...selectedMessageContacts.filter(contact => !groupMemberIds.has(contact.id)),
        ];
    }, [selectedMessageContacts, selectedMessageGroupContact]);
    const getGroupMemberDisplayNames = (contact: DashboardMessageContact): string[] => {
        if (contact.memberNames?.length) return contact.memberNames;
        return (contact.memberIds || [])
            .map(memberId => messageContactsById.get(memberId)?.displayName || memberId)
            .filter(Boolean);
    };
    const unreadMessages = useMemo(() => {
        const unreadByKey = new Map<string, DashboardMessage>();
        dashboardMessages.filter(message => (
            !messageDeletedForDashboardUser(message) &&
            !messageFromDashboardUser(message) &&
            messageAddressedToDashboardUser(message) &&
            !messageReadByDashboardUser(message)
        )).forEach(message => {
            const key = getDashboardUnreadMessageKey(message);
            if (!unreadByKey.has(key)) unreadByKey.set(key, message);
        });
        return Array.from(unreadByKey.values());
    }, [dashboardMessages, dashboardSenderContactId, dashboardUserKey]);
    const buildDashboardMessageBadgeTrace = (allMessages?: DashboardMessage[], scopedMessages?: DashboardMessage[]) => ({
        generatedAt: new Date().toISOString(),
        view: 'MyDashboard',
        dashboardMessageUserName,
        dashboardSenderContactId,
        dashboardUserKey,
        signedInUserLabel,
        localMessageCount: dashboardMessages.length,
        scopedApiMessageCount: scopedMessages?.length ?? null,
        allApiMessageCount: allMessages?.length ?? null,
        unreadCount: unreadMessages.length,
        selectedMessageContact: selectedMessageContact ? {
            id: selectedMessageContact.id,
            name: selectedMessageContact.name,
            displayName: selectedMessageContact.displayName,
            type: selectedMessageContact.type,
        } : null,
        localMessages: dashboardMessages.slice(-120).map(message => ({
            id: message.id,
            from: message.from,
            to: message.to,
            fromId: message.fromId,
            toId: message.toId,
            recipientIds: message.recipientIds,
            groupId: message.groupId,
            groupName: message.groupName,
            groupMemberIds: message.groupMemberIds,
            body: message.body,
            sentAt: message.sentAt,
            readAt: message.readAt,
            readByIds: message.readByIds,
            readByNames: message.readByNames,
            deletedForIds: message.deletedForIds,
            deletedForNames: message.deletedForNames,
            matched: {
                deletedForDashboardUser: messageDeletedForDashboardUser(message),
                fromDashboardUser: messageFromDashboardUser(message),
                addressedToDashboardUser: messageAddressedToDashboardUser(message),
                readByDashboardUser: messageReadByDashboardUser(message),
                countedUnread: !messageDeletedForDashboardUser(message) && !messageFromDashboardUser(message) && messageAddressedToDashboardUser(message) && !messageReadByDashboardUser(message),
                unreadMessageKey: getDashboardUnreadMessageKey(message),
            },
        })),
        scopedApiMessages: scopedMessages?.slice(-120) ?? null,
        allApiMessages: allMessages?.slice(-160) ?? null,
        sidebarTrace: typeof window !== 'undefined' ? (window as any).__dfpSidebarUnreadTrace || null : null,
    });
    useEffect(() => {
        if (typeof window === 'undefined') return;
        (window as any).__dfpDashboardMessageBadgeTrace = buildDashboardMessageBadgeTrace();
    }, [dashboardMessages, dashboardSenderContactId, dashboardUserKey, unreadMessages.length, selectedMessageContact?.id]);
    useEffect(() => {
        onUnreadMessageCountChange?.(unreadMessages.length);
    }, [onUnreadMessageCountChange, unreadMessages.length]);
    const downloadDashboardMessageBadgeTrace = async () => {
        let scopedMessages: DashboardMessage[] | undefined;
        let allMessages: DashboardMessage[] | undefined;
        let fetchError = '';
        try {
            scopedMessages = await fetchDashboardMessagesFromApi(dashboardMessageUserName, dashboardSenderContactId);
        } catch (error) {
            fetchError = `Scoped fetch: ${error instanceof Error ? error.message : String(error)}`;
        }
        try {
            allMessages = await fetchAllDashboardMessagesForTrace();
        } catch (error) {
            fetchError = [fetchError, `All fetch: ${error instanceof Error ? error.message : String(error)}`].filter(Boolean).join(' | ');
        }
        const trace = {
            ...buildDashboardMessageBadgeTrace(allMessages, scopedMessages),
            fetchError: fetchError || null,
        };
        if (typeof window !== 'undefined') {
            (window as any).__dfpDashboardMessageBadgeTrace = trace;
        }
        const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `dashboard-message-badge-trace-${normaliseDashboardContactName(dashboardMessageUserName).replace(/[^a-z0-9]+/g, '-') || 'user'}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };
    const activeConversationMessages = useMemo(() => {
        if (!selectedMessageContact) return [];
        return dashboardMessages
            .filter(message => {
                if (messageDeletedForDashboardUser(message)) return false;
                if (selectedMessageContact.type === 'Group') {
                    const selectedGroupId = selectedMessageContact.id.replace(/^group-conversation-/, '').replace(/^group-/, '');
                    return !!message.groupId && message.groupId === selectedGroupId;
                }
                return (
                    (messageFromDashboardUser(message) && messageMatchesContact(message, selectedMessageContact)) ||
                    (messageMatchesContact(message, selectedMessageContact) && messageAddressedToDashboardUser(message))
                );
            })
            .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    }, [dashboardMessages, dashboardSenderContactId, dashboardUserKey, selectedMessageContact]);
    const visibleActiveConversationMessages = useMemo(() => {
        const visible = new Map<string, DashboardMessage>();
        activeConversationMessages.forEach(message => {
            const key = message.groupId
                ? [
                    'group',
                    message.groupId,
                    message.fromId || message.from,
                    message.body,
                    message.sentAt,
                ].join('|')
                : message.id;
            if (!visible.has(key)) {
                visible.set(key, message);
            }
        });
        return Array.from(visible.values())
            .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    }, [activeConversationMessages]);
    const latestConversationMessageId = visibleActiveConversationMessages[visibleActiveConversationMessages.length - 1]?.id || '';
    useEffect(() => {
        if (!isMessagesOpen || messageView !== 'compose' || !selectedMessageContact || !activeConversationEndRef.current) return;
        const scroller = activeConversationScrollRef.current;
        const activeKey = selectedMessageContact.id;
        const changedConversation = activeConversationKeyRef.current !== activeKey;
        activeConversationKeyRef.current = activeKey;
        const distanceFromBottom = scroller ? scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight : 0;
        const nearBottom = !scroller || distanceFromBottom < 96;
        if (!changedConversation && !nearBottom) {
            setHasNewConversationMessages(true);
            return;
        }
        const frame = window.requestAnimationFrame(() => {
            activeConversationEndRef.current?.scrollIntoView({ block: 'end' });
            setHasNewConversationMessages(false);
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
            const apiMessages = await fetchDashboardMessagesFromApi(dashboardMessageUserName, dashboardSenderContactId);
            setDashboardMessages(prev => {
                const messagesForOtherUsers = prev.filter(message => !(
                    messageFromDashboardUser(message) ||
                    messageAddressedToDashboardUser(message)
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
    }, [dashboardUserKey, dashboardSenderContactId]);
    const refreshDashboardMessageGroups = async () => {
        try {
            const groups = await fetchDashboardMessageGroupsFromApi(dashboardSenderContactId, dashboardMessageUserName, dashboardUserUnitCodes.join('+'));
            setDashboardMessageGroups(groups);
        } catch (error) {
            console.warn('[Dashboard Messages] Could not refresh message groups:', error);
        }
    };
    useEffect(() => {
        refreshDashboardMessageGroups();
    }, [dashboardSenderContactId, dashboardMessageUserName, dashboardUserUnitCodes.join('+')]);
    useEffect(() => {
        if (!dashboardUserKey) return;
        let cancelled = false;
        const pollMessages = async () => {
            if (cancelled) return;
            await refreshDashboardMessages();
        };
        pollMessages();
        const interval = window.setInterval(pollMessages, 3000);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [dashboardSenderContactId, dashboardUserKey]);
    const addMessageContactRecipient = (contact: DashboardMessageContact) => {
        const contactsById = new Map(peopleMessageContacts.map(person => [person.id, person]));
        const contactsToAdd = contact.type === 'Group'
            ? (contact.memberIds || [])
                .map(memberId => contactsById.get(memberId))
                .filter((member): member is DashboardMessageContact => Boolean(member) && member.id !== dashboardSenderContactId)
            : [contact];
        if (contact.type === 'Group') {
            setSelectedMessageGroupContact(contact);
            setSelectedMessageContacts(contactsToAdd);
            setSelectedMessageContact(null);
            setMessageToText('');
            return;
        }
        setSelectedMessageContacts(prev => {
            const merged = new Map(prev.map(item => [item.id, item]));
            contactsToAdd.forEach(item => merged.set(item.id, item));
            const next = Array.from(merged.values());
            setSelectedMessageContact(next.length === 1 ? next[0] : null);
            setMessageToText('');
            return next;
        });
    };
    const removeMessageContactRecipient = (contactId: string) => {
        if (selectedMessageGroupContact?.id === contactId) {
            const groupMemberIds = new Set(selectedMessageGroupContact.memberIds || []);
            setSelectedMessageGroupContact(null);
            setSelectedMessageContacts(prev => {
                const next = prev.filter(contact => !groupMemberIds.has(contact.id));
                setSelectedMessageContact(next.length === 1 ? next[0] : null);
                return next;
            });
            return;
        }
        setSelectedMessageContacts(prev => {
            const next = prev.filter(contact => contact.id !== contactId);
            setSelectedMessageContact(next.length === 1 ? next[0] : null);
            return next;
        });
    };
    const toggleGroupBuilderContact = (contactId: string) => {
        setGroupBuilderSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(contactId)) {
                next.delete(contactId);
            } else {
                next.add(contactId);
            }
            return next;
        });
    };
    const addAllFilteredGroupBuilderContacts = () => {
        if (filteredGroupBuilderContacts.length === 0) return;
        setGroupBuilderSelectedIds(prev => {
            const next = new Set(prev);
            filteredGroupBuilderContacts.forEach(contact => next.add(contact.id));
            return next;
        });
    };
    const clearFilteredGroupBuilderContacts = () => {
        if (filteredGroupBuilderContacts.length === 0) return;
        setGroupBuilderSelectedIds(prev => {
            const next = new Set(prev);
            filteredGroupBuilderContacts.forEach(contact => next.delete(contact.id));
            return next;
        });
    };
    const resetGroupBuilder = () => {
        setEditingMessageGroupId(null);
        setGroupNameDraft('');
        setGroupBuilderSearch('');
        setGroupBuilderScope('personal');
        setGroupBuilderTypeFilter('all');
        setGroupBuilderUnitFilter('all');
        setGroupBuilderFlightFilter('all');
        setGroupBuilderRankFilter('all');
        setGroupBuilderRoleFilter('all');
        setGroupBuilderCourseFilter('all');
        setGroupBuilderQualificationFilter('all');
        setGroupBuilderSelectedIds(new Set());
    };
    const openMessageGroupBuilder = (group?: DashboardMessageGroupRecord) => {
        resetGroupBuilder();
        if (group) {
            setEditingMessageGroupId(group.id);
            setGroupNameDraft(group.name);
            setGroupBuilderScope(group.scopeType === 'personal' ? 'personal' : 'unit');
            setGroupBuilderSelectedIds(new Set(group.members.map(member => member.id).filter(Boolean)));
        }
        setMessageView('group');
    };
    const saveSelectedRecipientsAsGroup = async () => {
        const groupName = groupNameDraft.trim();
        if (!groupName || selectedMessageContacts.length === 0) return;
        const now = new Date().toISOString();
        const group: DashboardMessageGroupRecord = {
            id: `message-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: groupName,
            scopeType: 'personal',
            ownerId: dashboardSenderContactId,
            ownerName: dashboardMessageUserName,
            unitCode: dashboardUserUnitCodes.join('+') || dashboardUserStaff?.unit || undefined,
            members: selectedMessageContacts.map(contact => ({
                id: contact.id,
                name: contact.name,
                displayName: contact.displayName,
                type: contact.type === 'Trainee' ? 'Trainee' : 'Staff',
                rank: contact.rank,
                unit: contact.unit,
                course: contact.course,
                flight: contact.flight,
                qualification: contact.qualification,
                qualificationIds: contact.qualificationIds,
                idNumber: contact.idNumber,
            })),
            createdAt: now,
            updatedAt: now,
        };
        setIsCreatingGroup(false);
        setGroupNameDraft('');
        setDashboardMessageGroups(prev => [group, ...prev.filter(existing => existing.id !== group.id)]);
        try {
            const savedGroup = await saveDashboardMessageGroupToApi(group);
            setDashboardMessageGroups(prev => [savedGroup, ...prev.filter(existing => existing.id !== savedGroup.id)]);
            await refreshDashboardMessageGroups();
        } catch (error) {
            console.error('[Dashboard Messages] Group save failed:', error);
            await refreshDashboardMessageGroups();
        }
    };
    const saveGroupFromContacts = async (contacts: DashboardMessageContact[], scopeType: 'personal' | 'unit') => {
        const groupName = groupNameDraft.trim();
        if (!groupName || contacts.length === 0) return;
        if (scopeType === 'unit' && !canCreateUnitMessageGroups) return;
        const now = new Date().toISOString();
        const existingGroup = editingMessageGroupId
            ? dashboardMessageGroups.find(group => group.id === editingMessageGroupId)
            : null;
        const group: DashboardMessageGroupRecord = {
            id: existingGroup?.id || `message-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: groupName,
            scopeType,
            ownerId: dashboardSenderContactId,
            ownerName: dashboardMessageUserName,
            unitCode: dashboardUserUnitCodes.join('+') || dashboardUserStaff?.unit || undefined,
            members: contacts.map(contact => ({
                id: contact.id,
                name: contact.name,
                displayName: contact.displayName,
                type: contact.type === 'Trainee' ? 'Trainee' : 'Staff',
                rank: contact.rank,
                unit: contact.unit,
                course: contact.course,
                flight: contact.flight,
                qualification: contact.qualification,
                qualificationIds: contact.qualificationIds,
                idNumber: contact.idNumber,
            })),
            createdAt: existingGroup?.createdAt || now,
            updatedAt: now,
        };
        setDashboardMessageGroups(prev => [group, ...prev.filter(existing => existing.id !== group.id)]);
        resetGroupBuilder();
        setMessageView('groups');
        try {
            const savedGroup = await saveDashboardMessageGroupToApi(group, { canCreateUnitGroup: canCreateUnitMessageGroups });
            setDashboardMessageGroups(prev => [savedGroup, ...prev.filter(existing => existing.id !== savedGroup.id)]);
            await refreshDashboardMessageGroups();
        } catch (error) {
            console.error('[Dashboard Messages] Group save failed:', error);
            await refreshDashboardMessageGroups();
        }
    };
    const selectMessageContact = (contact: DashboardMessageContact) => {
        addMessageContactRecipient(contact);
        setIsContactPickerOpen(false);
        setMessageView('compose');
    };
    const openDashboardMessageConversation = (contact: DashboardMessageContact) => {
        setOpenGroupMemberFlyoutId(null);
        setSelectedMessageContact(contact);
        setMessageToText('');
        setMessageDraft('');
        setMessageSendError('');
        setHasNewConversationMessages(false);
        setIsContactPickerOpen(false);
        if (contact.type === 'Group') {
            const contactsById = new Map(peopleMessageContacts.map(person => [person.id, person]));
            const memberContacts = (contact.memberIds || [])
                .map(memberId => contactsById.get(memberId))
                .filter((member): member is DashboardMessageContact => Boolean(member) && member.id !== dashboardSenderContactId);
            setSelectedMessageGroupContact(contact);
            setSelectedMessageContacts(memberContacts);
        } else {
            setSelectedMessageGroupContact(null);
            setSelectedMessageContacts([contact]);
        }
        setMessageView('compose');
    };
    const deleteDashboardMessage = async (message: DashboardMessage) => {
        const confirmed = await showDarkConfirm(
            'This message will be permanently deleted.',
            'Delete Message?',
            'warning',
        );
        if (!confirmed) return;
        persistDashboardMessages(messages => messages.filter(candidate => candidate.id !== message.id));
        try {
            await deleteDashboardMessageFromApi(message.id);
            await refreshDashboardMessages();
        } catch (error) {
            console.error('[Dashboard Messages] Delete message failed:', error);
            await refreshDashboardMessages();
        }
    };
    const deleteDashboardConversation = async (contact: DashboardMessageContact) => {
        const confirmed = await showDarkConfirm(
            'This will permanently delete this conversation and its messages from your Messenger.',
            'Delete Conversation?',
            'warning'
        );
        if (!confirmed) return;
        const groupId = contact.type === 'Group'
            ? contact.id.replace(/^group-conversation-/, '').replace(/^group-/, '')
            : '';
        persistDashboardMessages(messages => messages.map(message => {
            const matches = groupId
                ? message.groupId === groupId
                : (
                    (messageFromDashboardUser(message) && messageMatchesContact(message, contact)) ||
                    (messageMatchesContact(message, contact) && messageAddressedToDashboardUser(message))
                );
            if (!matches || messageDeletedForDashboardUser(message)) return message;
            return {
                ...message,
                deletedForIds: Array.from(new Set([...(message.deletedForIds || []), dashboardSenderContactId])),
                deletedForNames: Array.from(new Set([...(message.deletedForNames || []), normaliseDashboardPersonName(dashboardMessageUserName)])),
            };
        }));
        if (selectedMessageContact && selectedMessageContact.id === contact.id) {
            setSelectedMessageContact(null);
            setSelectedMessageContacts([]);
            setSelectedMessageGroupContact(null);
            setMessageToText('');
            setMessageDraft('');
            setMessageView('inbox');
        }
        try {
            await deleteDashboardConversationFromApi(
                dashboardMessageUserName,
                contact.name,
                dashboardSenderContactId,
                groupId ? undefined : contact.id,
                groupId || undefined,
            );
            await refreshDashboardMessages();
        } catch (error) {
            console.error('[Dashboard Messages] Delete conversation failed:', error);
            await refreshDashboardMessages();
        }
    };
    const sendDashboardMessage = async () => {
        if (selectedMessageContacts.length === 0 || !messageDraft.trim()) return;
        setMessageSendError('');
        const sentAt = new Date().toISOString();
        const messageBody = messageDraft.trim();
        const groupId = selectedMessageGroupContact?.id.replace(/^group-conversation-/, '').replace(/^group-/, '');
        const groupName = selectedMessageGroupContact?.displayName;
        const groupMemberIds = selectedMessageGroupContact
            ? Array.from(new Set([
                ...(selectedMessageGroupContact.memberIds || []),
                ...selectedMessageContacts.map(contact => contact.id),
                dashboardSenderContactId,
            ].filter(Boolean)))
            : undefined;
        const groupMemberNames = selectedMessageGroupContact
            ? Array.from(new Set([
                ...(selectedMessageGroupContact.memberNames || []),
                ...(groupMemberIds || [])
                    .map(memberId => (
                        messageContactsById.get(memberId)?.displayName ||
                        (memberId === dashboardSenderContactId ? signedInUserLabel : '')
                    ))
                    .filter(Boolean),
            ].filter(Boolean)))
            : undefined;
        const nextMessages: DashboardMessage[] = selectedMessageContacts.map(contact => ({
            id: `dashboard-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${contact.id.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`,
            from: dashboardMessageUserName,
            fromId: dashboardSenderContactId,
            to: contact.name,
            toId: contact.id,
            recipientIds: [contact.id],
            groupId,
            groupName,
            groupMemberIds,
            groupMemberNames,
            body: messageBody,
            sentAt,
        }));
        persistDashboardMessages(messages => [...messages, ...nextMessages]);
        if (selectedMessageGroupContact && nextMessages[0]) {
            setSelectedMessageContact(getGroupConversationContact(nextMessages[0]) || selectedMessageGroupContact);
        } else if (selectedMessageContacts.length === 1) {
            setSelectedMessageContact(selectedMessageContacts[0]);
        }
        setMessageDraft('');
        try {
            const savedMessages = await sendDashboardMessagesToApi(nextMessages);
            setFailedMessageIds(prev => {
                const next = new Set(prev);
                nextMessages.forEach(message => next.delete(message.id));
                return next;
            });
            persistDashboardMessages(messages => mergeDashboardMessages(messages, savedMessages));
        } catch (error) {
            console.error('[Dashboard Messages] Send failed:', error);
            setFailedMessageIds(prev => {
                const next = new Set(prev);
                nextMessages.forEach(message => next.add(message.id));
                return next;
            });
            setMessageSendError('Message failed to send. Check the connection and try again.');
        }
    };
    const retryDashboardMessage = async (message: DashboardMessage) => {
        setMessageSendError('');
        try {
            const savedMessages = await sendDashboardMessagesToApi([message]);
            setFailedMessageIds(prev => {
                const next = new Set(prev);
                next.delete(message.id);
                return next;
            });
            persistDashboardMessages(messages => mergeDashboardMessages(messages, savedMessages));
        } catch (error) {
            console.error('[Dashboard Messages] Retry failed:', error);
            setMessageSendError('Retry failed. Check the connection and try again.');
        }
    };
    useEffect(() => {
        if (!isMessagesOpen || messageView !== 'compose' || !selectedMessageContact || unreadMessages.length === 0) return;
        const selectedGroupId = selectedMessageContact.type === 'Group'
            ? selectedMessageContact.id.replace(/^group-conversation-/, '').replace(/^group-/, '')
            : '';
        const messageIdsToMarkRead = dashboardMessages
            .filter(message => (
                !messageDeletedForDashboardUser(message) &&
                !messageFromDashboardUser(message) &&
                messageAddressedToDashboardUser(message) &&
                !messageReadByDashboardUser(message) &&
                (selectedMessageContact.type === 'Group'
                    ? message.groupId === selectedGroupId
                    : messageMatchesContact(message, selectedMessageContact))
            ))
            .map(message => message.id);
        if (messageIdsToMarkRead.length === 0) return;
        const now = new Date().toISOString();
        persistDashboardMessages(messages => messages.map(message => (
            messageAddressedToDashboardUser(message) &&
            (
                selectedMessageContact.type === 'Group'
                    ? `group-conversation-${message.groupId || ''}` === selectedMessageContact.id
                    : messageMatchesContact(message, selectedMessageContact)
            ) &&
            !messageReadByDashboardUser(message)
                ? {
                    ...message,
                    readAt: message.groupId ? message.readAt : now,
                    readByIds: Array.from(new Set([...(message.readByIds || []), dashboardSenderContactId])),
                    readByNames: Array.from(new Set([...(message.readByNames || []), dashboardMessageUserName])),
                }
                : message
        )));
        markDashboardConversationReadInApi(
            dashboardMessageUserName,
            selectedMessageContact.type === 'Group' ? '' : selectedMessageContact.name,
            messageIdsToMarkRead,
            dashboardSenderContactId,
            selectedMessageContact.type === 'Group' ? undefined : selectedMessageContact.id
        )
            .then(() => refreshDashboardMessages())
            .catch(error => console.warn('[Dashboard Messages] Could not mark shared messages read:', error));
    }, [dashboardSenderContactId, dashboardUserKey, isMessagesOpen, messageView, selectedMessageContact?.id, selectedMessageContact?.name, unreadMessages.length]);
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
        const storedIncomplete = assessments
            .filter(assessment =>
                !assessment.isCompleted &&
                (assessment.dcoResult === 'DCO' || assessment.dcoResult === 'DPCO') &&
                normaliseDashboardContactName(assessment.instructorName) === fullUserKey &&
                ![
                    assessment.eventId,
                    assessment.id,
                    `dashboard-due-${assessment.eventId}-${normaliseDashboardContactName(assessment.traineeFullName)}`,
                    `pt051-${assessment.eventId}-${assessment.traineeFullName}`,
                ].map(value => String(value || '').trim()).filter(Boolean).some(candidateId => suppressedEventIds.has(candidateId))
            );
        return storedIncomplete
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [pt051Assessments, suppressedPt051EventIds, userName]);

    const visibleTrainingReportsToComplete = React.useMemo(() => {
        const suppressedEventIds = new Set(suppressedPt051EventIds.map(value => String(value || '').trim()).filter(Boolean));
        if (suppressedEventIds.size === 0) return trainingReportsToComplete;
        return trainingReportsToComplete.filter(entry => (
            !getDashboardTrainingReportSuppressionIds(entry.report).some(candidateId => suppressedEventIds.has(candidateId))
        ));
    }, [suppressedPt051EventIds, trainingReportsToComplete]);

    const visiblePt051ReportsToComplete = React.useMemo(() => {
        if (visibleTrainingReportsToComplete.length === 0) return incompletePt051s;
        const staffReportEventIds = new Set(visibleTrainingReportsToComplete
            .map(entry => String(entry.report.eventId || '').trim())
            .filter(Boolean));
        const staffReportCodeDates = new Set(visibleTrainingReportsToComplete
            .map(entry => `${String(entry.report.eventCode || '').trim().toUpperCase()}::${String(entry.report.date || '').trim()}`)
            .filter(value => !value.startsWith('::') && !value.endsWith('::')));
        return incompletePt051s.filter(assessment => {
            const eventId = String(assessment.eventId || '').trim();
            if (eventId && staffReportEventIds.has(eventId)) return false;
            const codeDate = `${String(assessment.flightNumber || '').trim().toUpperCase()}::${String(assessment.date || '').trim()}`;
            return !staffReportCodeDates.has(codeDate);
        });
    }, [incompletePt051s, visibleTrainingReportsToComplete]);

    const confirmDeleteReportMessage = async (
        label: string,
        onDelete: () => void | Promise<void>,
    ) => {
        const confirmed = await showDarkConfirm(
            `Delete ${label} from Reports to be completed? This removes the dashboard message and stops it returning.`,
            'Delete message?',
            'warning',
        );
        if (confirmed) {
            await onDelete();
        }
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
        <div className="h-full min-h-0 w-full overflow-auto bg-gray-900">
            <div className="flex min-w-[760px] flex-col space-y-6 p-6">
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
                                <span className="-translate-x-px">{Math.min(unreadMessages.length, 99)}</span>
                            </span>
                        )}
                        Messages
                    </button>
                    <button
                        type="button"
                        onClick={downloadDashboardMessageBadgeTrace}
                        className={dashboardActionButtonClass}
                        title="Download Messenger unread badge diagnostic trace"
                    >
                        Badge<br />Trace
                    </button>
                    <button
                        type="button"
                        onClick={onShowChangePassword}
                        className={dashboardActionButtonClass}
                    >
                        Change<br />Password
                    </button>
                    <button
                        type="button"
                        onClick={onLogout}
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
                            {messageView !== 'inbox' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMessageView(messageView === 'group' ? 'groups' : 'inbox');
                                        setIsContactPickerOpen(false);
                                        if (messageView === 'group') {
                                            resetGroupBuilder();
                                        }
                                    }}
                                    className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-gray-200 text-gray-950 shadow-inner hover:bg-gray-300"
                                    aria-label="Back to messages"
                                >
                                    <DashboardIconArrowLeft className="h-6 w-6" strokeWidth={2.4} />
                                </button>
                            )}
                            {messageView === 'inbox' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMessageView('groups');
                                    }}
                                    className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-gray-200 text-gray-950 shadow-inner hover:bg-gray-300"
                                    aria-label="Manage message groups"
                                    title="Groups"
                                >
                                    <DashboardIconUsers className="h-6 w-6" strokeWidth={2.2} />
                                </button>
                            )}
                            <h2 className="text-center text-2xl font-bold tracking-tight">
                                {messageView === 'inbox'
                                    ? 'Messages'
                                    : messageView === 'groups'
                                        ? 'Groups'
                                        : messageView === 'group'
                                            ? editingMessageGroupId ? 'Edit Group' : 'New Group'
                                            : 'New Message'}
                            </h2>
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
                                <div className="mx-4 flex-1 overflow-y-auto rounded-3xl bg-slate-200/70 px-3 pb-24 pt-3 ring-1 ring-slate-300/50">
                                    {filteredMessageConversations.length > 0 ? (
                                        <div className="space-y-2">
                                            {filteredMessageConversations.map((conversation, index) => (
                                                <div
                                                    key={conversation.contact.id}
                                                    className={`relative flex w-full items-start gap-3 rounded-2xl border px-3 py-4 pr-11 text-left shadow-sm transition-colors ${
                                                        conversation.unreadCount > 0
                                                            ? 'border-sky-200 bg-sky-100 hover:bg-sky-50'
                                                            : index % 2 === 0
                                                                ? 'border-white bg-white hover:bg-white/90'
                                                                : 'border-slate-200 bg-slate-100 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => openDashboardMessageConversation(conversation.contact)}
                                                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                                                    >
                                                        <div className="relative shrink-0">
                                                            <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-700 text-sm font-bold text-white shadow-inner">
                                                                {getDashboardMessageInitials(conversation.contact.displayName)}
                                                            </div>
                                                            {conversation.unreadCount > 0 && (
                                                                <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-sky-500 ring-2 ring-white" aria-label="Unread message" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="relative flex items-baseline gap-2">
                                                                {conversation.contact.type === 'Group' ? (
                                                                    <span className="min-w-0 flex-1">
                                                                        <span
                                                                            role="button"
                                                                            tabIndex={0}
                                                                            onClick={(event) => {
                                                                                event.preventDefault();
                                                                                event.stopPropagation();
                                                                                setOpenGroupMemberFlyoutId(prev => prev === conversation.contact.id ? null : conversation.contact.id);
                                                                            }}
                                                                            onKeyDown={(event) => {
                                                                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                                                                event.preventDefault();
                                                                                event.stopPropagation();
                                                                                setOpenGroupMemberFlyoutId(prev => prev === conversation.contact.id ? null : conversation.contact.id);
                                                                            }}
                                                                            className="block truncate text-[22px] font-bold leading-tight text-black underline decoration-gray-300 underline-offset-4 hover:text-sky-700"
                                                                        >
                                                                            {conversation.contact.displayName}
                                                                        </span>
                                                                        {openGroupMemberFlyoutId === conversation.contact.id && (
                                                                            <span
                                                                                className="absolute left-0 top-8 z-20 block max-h-44 w-72 overflow-y-auto rounded-xl bg-white p-3 text-left shadow-2xl ring-1 ring-gray-200"
                                                                                onClick={(event) => {
                                                                                    event.preventDefault();
                                                                                    event.stopPropagation();
                                                                                }}
                                                                            >
                                                                                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-gray-400">Group Members</span>
                                                                                {getGroupMemberDisplayNames(conversation.contact).map(memberName => (
                                                                                    <span key={memberName} className="block truncate py-1 text-sm font-semibold text-gray-700">
                                                                                        {memberName}
                                                                                    </span>
                                                                                ))}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                ) : (
                                                                    <p className="min-w-0 flex-1 truncate text-[22px] font-bold leading-tight text-black">
                                                                        {conversation.contact.displayName}
                                                                    </p>
                                                                )}
                                                                <span className="shrink-0 text-lg text-gray-500">
                                                                    {formatDashboardConversationDate(conversation.lastMessage.sentAt)}
                                                                </span>
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-2">
                                                                <p className="line-clamp-2 min-w-0 flex-1 text-[20px] leading-snug text-gray-500">
                                                                    {conversation.lastMessage.body}
                                                                </p>
                                                                {conversation.unreadCount > 0 && (
                                                                    <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-sky-500 px-1.5 text-xs font-bold text-white">
                                                                        {Math.min(conversation.unreadCount, 99)}
                                                                    </span>
                                                                )}
                                                            </div>
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
                                            setSelectedMessageContacts([]);
                                            setSelectedMessageGroupContact(null);
                                            setMessageToText('');
                                            setMessageDraft('');
                                            setGroupNameDraft('');
                                            setIsCreatingGroup(false);
                                        }}
                                        className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-black shadow-[0_10px_28px_rgba(15,23,42,0.16)] ring-1 ring-black/5 hover:bg-gray-100"
                                        aria-label="New message"
                                    >
                                        <DashboardIconSquarePen className="h-8 w-8" strokeWidth={2.4} />
                                    </button>
                                </div>
                            </>
                        ) : messageView === 'groups' ? (
                            <>
                                <div className="flex-1 overflow-y-auto px-5 pb-24 pt-2">
                                    {dashboardMessageGroups.length > 0 ? (
                                        <div className="space-y-3">
                                            {dashboardMessageGroups.map(group => {
                                                const canEditGroup = group.scopeType === 'personal' || canCreateUnitMessageGroups;
                                                return (
                                                    <div key={group.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-lg font-bold text-gray-950">{group.name}</p>
                                                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                                                                    {formatDashboardGroupScope(group.scopeType)}
                                                                    {group.unitCode ? ` - ${group.unitCode}` : ''}
                                                                </p>
                                                                <p className="mt-2 text-sm text-gray-500">
                                                                    {group.members.length} {group.members.length === 1 ? 'recipient' : 'recipients'}
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => canEditGroup && openMessageGroupBuilder(group)}
                                                                disabled={!canEditGroup}
                                                                className="h-10 shrink-0 rounded-lg bg-sky-600 px-4 text-sm font-bold text-white shadow disabled:cursor-not-allowed disabled:bg-gray-300"
                                                            >
                                                                Edit
                                                            </button>
                                                        </div>
                                                        <div className="mt-3 flex max-h-16 flex-wrap gap-1.5 overflow-y-auto">
                                                            {group.members.slice(0, 12).map(member => (
                                                                <span key={`${group.id}-${member.id}`} className="max-w-[180px] truncate rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                                                                    {member.displayName}
                                                                </span>
                                                            ))}
                                                            {group.members.length > 12 && (
                                                                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
                                                                    +{group.members.length - 12} more
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="pt-20 text-center text-sm text-gray-400">No saved groups yet.</p>
                                    )}
                                </div>
                                <div className="absolute bottom-4 left-4 right-4">
                                    <button
                                        type="button"
                                        onClick={() => openMessageGroupBuilder()}
                                        className="h-12 w-full rounded-xl bg-sky-600 text-sm font-bold text-white shadow-[0_10px_28px_rgba(15,23,42,0.14)] hover:bg-sky-700"
                                    >
                                        New Group
                                    </button>
                                </div>
                            </>
                        ) : messageView === 'compose' ? (
                            <>
                                <div className="relative mx-3 shrink-0 rounded-[28px] border border-white bg-white/80 shadow-[0_18px_30px_rgba(15,23,42,0.12)]">
                                    <div className="flex max-h-[126px] min-h-14 flex-wrap items-center gap-2 overflow-y-auto px-4 py-2">
                                        <span className="shrink-0 text-xl text-gray-500">To:</span>
                                        {displayMessageRecipients.map(contact => (
                                            <span key={contact.id} className="inline-flex max-w-[190px] shrink-0 items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-800 ring-1 ring-sky-100">
                                                <span className="truncate">{contact.displayName}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeMessageContactRecipient(contact.id)}
                                                    className="grid h-5 w-5 place-items-center rounded-full bg-sky-100 text-sky-700 hover:bg-sky-200"
                                                    aria-label={`Remove ${contact.displayName}`}
                                                >
                                                    <DashboardIconX className="h-3.5 w-3.5" strokeWidth={2.4} />
                                                </button>
                                            </span>
                                        ))}
                                        <input
                                            value={messageToText}
                                            onChange={(event) => {
                                                setMessageToText(event.target.value);
                                                if (selectedMessageContacts.length === 0) {
                                                    setSelectedMessageContact(null);
                                                }
                                            }}
                                            placeholder={displayMessageRecipients.length > 0 ? 'Add another recipient' : 'Add recipient'}
                                            className="min-w-[120px] flex-1 bg-transparent text-xl text-gray-950 outline-none"
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
                                <div
                                    ref={activeConversationScrollRef}
                                    onScroll={(event) => {
                                        const target = event.currentTarget;
                                        const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
                                        if (distanceFromBottom < 96) {
                                            setHasNewConversationMessages(false);
                                        }
                                    }}
                                    className="relative flex-1 overflow-y-auto px-4 py-5"
                                >
                                    {selectedMessageContact ? (
                                        visibleActiveConversationMessages.length > 0 ? (
                                            <div>
                                                {visibleActiveConversationMessages.map((message, index) => {
                                                    const previousMessage = visibleActiveConversationMessages[index - 1];
                                                    const sentDate = new Date(message.sentAt);
                                                    const timeLabel = formatDashboardMessageTime(sentDate);
                                                    const dateLabel = `${String(sentDate.getDate()).padStart(2, '0')}/${String(sentDate.getMonth() + 1).padStart(2, '0')}/${String(sentDate.getFullYear()).slice(-2)}`;
                                                    const mine = messageFromDashboardUser(message);
                                                    const failed = failedMessageIds.has(message.id);
                                                    const previousMine = previousMessage ? messageFromDashboardUser(previousMessage) : false;
                                                    const sameSenderCluster = !!previousMessage && previousMine === mine && dashboardPersonNamesMatch(previousMessage.from, message.from);
                                                    const showGroupSender = selectedMessageContact?.type === 'Group' && !mine && !!message.from && !sameSenderCluster;
                                                    const showDateSeparator = shouldShowDashboardMessageDaySeparator(message, previousMessage);
                                                    return (
                                                        <React.Fragment key={message.id}>
                                                            {showDateSeparator && (
                                                                <div className="my-4 text-center text-[11px] font-semibold text-gray-400">
                                                                    {formatDashboardMessageDaySeparator(message.sentAt)}
                                                                </div>
                                                            )}
                                                            <div className={`group flex ${sameSenderCluster ? 'mt-1' : 'mt-3'} ${mine ? 'justify-end' : 'justify-start'}`}>
                                                                {!mine && (
                                                                    <div className={`${showGroupSender ? 'opacity-100' : 'opacity-0'} mr-2 mt-5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-300 text-[10px] font-bold text-slate-700`}>
                                                                        {getDashboardMessageInitials(message.from)}
                                                                    </div>
                                                                )}
                                                                <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                                                                    {showGroupSender && (
                                                                        <p className="mb-1 max-w-full truncate pl-2 text-[11px] font-semibold text-gray-500">
                                                                            {message.from}
                                                                        </p>
                                                                    )}
                                                                    <div
                                                                        className={`relative rounded-2xl px-4 py-2 shadow-sm ${
                                                                            mine ? 'rounded-br-md bg-sky-500 text-white' : 'rounded-bl-md bg-white text-gray-950'
                                                                        }`}
                                                                        title={`${timeLabel} ${dateLabel}`}
                                                                    >
                                                                        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => deleteDashboardMessage(message)}
                                                                            className={`absolute ${mine ? '-left-9' : '-right-9'} top-1/2 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white text-gray-400 shadow ring-1 ring-gray-200 hover:text-red-600 group-hover:grid`}
                                                                            aria-label="Delete message"
                                                                        >
                                                                            <DashboardIconTrash className="h-4 w-4" strokeWidth={2.2} />
                                                                        </button>
                                                                    </div>
                                                                    {mine && (failed || index === visibleActiveConversationMessages.length - 1) && (
                                                                        <div className="mt-1 flex items-center justify-end gap-2 pr-1 text-[10px] text-gray-500">
                                                                            {failed ? (
                                                                                <>
                                                                                    <span className="font-bold text-red-600">Not sent</span>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => retryDashboardMessage(message)}
                                                                                        className="font-bold text-sky-600 hover:text-sky-700"
                                                                                    >
                                                                                        Retry
                                                                                    </button>
                                                                                </>
                                                                            ) : (
                                                                                <span>{message.readAt ? 'Read' : 'Sent'}</span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    );
                                                })}
                                                <div ref={activeConversationEndRef} />
                                            </div>
                                        ) : (
                                            <p className="pt-20 text-center text-sm text-gray-400">No messages yet.</p>
                                        )
                                    ) : selectedMessageGroupContact ? (
                                        <p className="pt-20 text-center text-sm text-gray-400">
                                            {selectedMessageGroupContact.displayName} selected. {selectedMessageContacts.length} recipients.
                                        </p>
                                    ) : selectedMessageContacts.length > 1 ? (
                                        <p className="pt-20 text-center text-sm text-gray-400">
                                            {selectedMessageContacts.length} recipients selected.
                                        </p>
                                    ) : (
                                        <p className="pt-20 text-center text-sm text-gray-400">Choose someone to message.</p>
                                    )}
                                    {hasNewConversationMessages && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                activeConversationEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
                                                setHasNewConversationMessages(false);
                                            }}
                                            className="sticky bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-lg"
                                        >
                                            ↓ New Message
                                        </button>
                                    )}
                                </div>
                                {messageSendError && (
                                    <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
                                        {messageSendError}
                                    </p>
                                )}
                                <div className="flex items-end gap-2 border-t border-gray-200 bg-white/80 px-3 py-3 shadow-[0_-8px_22px_rgba(15,23,42,0.08)]">
                                    <textarea
                                        value={messageDraft}
                                        onChange={(event) => setMessageDraft(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' && !event.shiftKey) {
                                                event.preventDefault();
                                                sendDashboardMessage();
                                            }
                                        }}
                                        placeholder="Message"
                                        rows={1}
                                        className="max-h-32 min-h-12 min-w-0 flex-1 resize-none rounded-3xl border border-white bg-white px-4 py-3 text-base text-gray-950 shadow-inner outline-none focus:ring-2 focus:ring-sky-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={sendDashboardMessage}
                                        disabled={selectedMessageContacts.length === 0 || !messageDraft.trim()}
                                        className="flex h-12 w-14 items-center justify-center rounded-md bg-white text-sm font-bold text-sky-600 shadow disabled:cursor-not-allowed disabled:text-gray-300"
                                    >
                                        Send
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mx-4 space-y-3">
                                    <input
                                        value={groupNameDraft}
                                        onChange={(event) => setGroupNameDraft(event.target.value)}
                                        placeholder="Group name"
                                        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base font-semibold text-gray-950 shadow-sm outline-none focus:ring-2 focus:ring-sky-400"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setGroupBuilderScope('personal')}
                                            className={`h-10 rounded-lg text-sm font-bold ${groupBuilderScope === 'personal' ? 'bg-sky-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}
                                        >
                                            Personal Group
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => canCreateUnitMessageGroups && setGroupBuilderScope('unit')}
                                            disabled={!canCreateUnitMessageGroups}
                                            className={`h-10 rounded-lg text-sm font-bold ${groupBuilderScope === 'unit' ? 'bg-sky-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'} disabled:cursor-not-allowed disabled:text-gray-300`}
                                        >
                                            Unit Group
                                        </button>
                                    </div>
                                    <input
                                        value={groupBuilderSearch}
                                        onChange={(event) => setGroupBuilderSearch(event.target.value)}
                                        placeholder="Search name, rank, role, unit, flight or qualification"
                                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-950 shadow-sm outline-none focus:ring-2 focus:ring-sky-400"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <select value={groupBuilderTypeFilter} onChange={(event) => setGroupBuilderTypeFilter(event.target.value as 'all' | 'Staff' | 'Trainee')} className="h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm">
                                            <option value="all">All people</option>
                                            <option value="Staff">Staff</option>
                                            <option value="Trainee">Trainees</option>
                                        </select>
                                        <select value={groupBuilderUnitFilter} onChange={(event) => setGroupBuilderUnitFilter(event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm">
                                            <option value="all">All units</option>
                                            {groupBuilderUnitOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                        <select value={groupBuilderFlightFilter} onChange={(event) => setGroupBuilderFlightFilter(event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm">
                                            <option value="all">All flights</option>
                                            {groupBuilderFlightOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                        <select value={groupBuilderRankFilter} onChange={(event) => setGroupBuilderRankFilter(event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm">
                                            <option value="all">All ranks</option>
                                            {groupBuilderRankOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                        <select value={groupBuilderRoleFilter} onChange={(event) => setGroupBuilderRoleFilter(event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm">
                                            <option value="all">All roles</option>
                                            {groupBuilderRoleOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                        <select value={groupBuilderCourseFilter} onChange={(event) => setGroupBuilderCourseFilter(event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm">
                                            <option value="all">All courses</option>
                                            {groupBuilderCourseOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                        <select value={groupBuilderQualificationFilter} onChange={(event) => setGroupBuilderQualificationFilter(event.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm">
                                            <option value="all">All qualifications</option>
                                            {groupBuilderQualificationOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={addAllFilteredGroupBuilderContacts}
                                            disabled={filteredGroupBuilderContacts.length === 0}
                                            className="h-9 rounded-lg bg-sky-600 px-3 text-xs font-bold text-white shadow disabled:cursor-not-allowed disabled:bg-gray-300"
                                        >
                                            Add All
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearFilteredGroupBuilderContacts}
                                            disabled={filteredGroupBuilderContacts.length === 0}
                                            className="h-9 rounded-lg bg-white px-3 text-xs font-bold text-gray-700 shadow-sm ring-1 ring-gray-200 disabled:cursor-not-allowed disabled:text-gray-300"
                                        >
                                            Clear Visible
                                        </button>
                                        <span className="min-w-0 text-xs font-semibold text-gray-500">
                                            {filteredGroupBuilderContacts.length} shown
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-3 flex-1 overflow-y-auto px-4 pb-3">
                                    <div className="space-y-1">
                                        {filteredGroupBuilderContacts.map(contact => {
                                            const isSelected = groupBuilderSelectedIds.has(contact.id);
                                            return (
                                                <button
                                                    key={contact.id}
                                                    type="button"
                                                    onClick={() => toggleGroupBuilderContact(contact.id)}
                                                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${isSelected ? 'bg-sky-50 ring-1 ring-sky-200' : 'bg-white hover:bg-gray-50'}`}
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-sm font-semibold text-gray-950">{contact.displayName}</span>
                                                        <span className="block truncate text-xs text-gray-500">
                                                            {[contact.unit, contact.flight, contact.type === 'Trainee' ? contact.course : contact.role, contact.qualification, contact.idNumber ? `ID ${contact.idNumber}` : ''].filter(Boolean).join(' - ')}
                                                        </span>
                                                    </span>
                                                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${isSelected ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                        {isSelected ? 'On' : '+'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                        {filteredGroupBuilderContacts.length === 0 && (
                                            <p className="py-8 text-center text-sm text-gray-500">No matching contacts.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 border-t border-gray-200 bg-white/70 px-3 py-3 shadow-[0_-8px_22px_rgba(15,23,42,0.08)]">
                                    <span className="min-w-0 flex-1 text-sm font-semibold text-gray-500">
                                        {groupBuilderSelectedContacts.length} selected
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => saveGroupFromContacts(groupBuilderSelectedContacts, groupBuilderScope)}
                                        disabled={!groupNameDraft.trim() || groupBuilderSelectedContacts.length === 0 || (groupBuilderScope === 'unit' && !canCreateUnitMessageGroups)}
                                        className="h-11 rounded-lg bg-sky-600 px-4 text-sm font-bold text-white shadow disabled:cursor-not-allowed disabled:bg-gray-300"
                                    >
                                        {editingMessageGroupId ? 'Update Group' : 'Save Group'}
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
                    <h2 className="text-xl font-semibold mb-4 text-amber-400">Reports to be completed</h2>
                    {visiblePt051ReportsToComplete.length > 0 || visibleTrainingReportsToComplete.length > 0 ? (
                        <ul className="space-y-2">
                            {visiblePt051ReportsToComplete.map(assessment => (
                                <li
                                    key={assessment.id}
                                    className="p-3 bg-gray-700/50 rounded-md hover:bg-gray-700 transition-colors"
                                    onContextMenu={(event) => event.preventDefault()}
                                >
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="min-w-0">
                                            <button
                                                onClick={() => onSelectPt051(assessment)}
                                                className="block text-left"
                                            >
                                                <p className="font-semibold text-white">{assessment.flightNumber}</p>
                                            </button>
                                            {onDeletePt051ReportMessage && (
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        void confirmDeleteReportMessage(
                                                            assessment.flightNumber || 'report',
                                                            () => onDeletePt051ReportMessage(assessment),
                                                        );
                                                    }}
                                                    className="mt-1 grid h-7 w-7 place-items-center rounded text-red-300 hover:bg-red-500/15 hover:text-red-200"
                                                    title="Delete message"
                                                    aria-label={`Delete ${assessment.flightNumber || 'report'} message`}
                                                >
                                                    <DashboardIconTrash className="h-[18px] w-[18px]" strokeWidth={2.2} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => onSelectPt051(assessment)}
                                                className="block min-w-0 text-left"
                                            >
                                                <p className="text-sm text-gray-400">{assessment.trainedFullName}</p>
                                            </button>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-sm text-gray-300 font-mono">{formatDate(assessment.date)}</p>
                                            <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300">
                                                Pending
                                            </span>
                                        </div>
                                    </div>
                                </li>
                            ))}
                            {visibleTrainingReportsToComplete.map(entry => (
                                <li
                                    key={entry.report.id}
                                    className="p-3 bg-gray-700/50 rounded-md hover:bg-gray-700 transition-colors"
                                    onContextMenu={(event) => event.preventDefault()}
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <button
                                                onClick={() => onSelectTrainingReport?.(entry)}
                                                className="w-full min-w-0 text-left"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-white">{entry.report.eventCode}</p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center justify-end gap-1.5 text-right">
                                                        <span className="whitespace-nowrap text-[10px] font-mono text-gray-300">{formatDate(entry.report.date)}</span>
                                                        <span className="inline-flex h-5 items-center whitespace-nowrap rounded-full bg-amber-500/20 px-1.5 text-[9px] font-semibold text-amber-300">
                                                            Training Report
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                            {onDeleteTrainingReportMessage && (
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        void confirmDeleteReportMessage(
                                                            entry.report.eventCode || 'report',
                                                            () => onDeleteTrainingReportMessage(entry),
                                                        );
                                                    }}
                                                    className="mt-1 grid h-7 w-7 place-items-center rounded text-red-300 hover:bg-red-500/15 hover:text-red-200"
                                                    title="Delete message"
                                                    aria-label={`Delete ${entry.report.eventCode || 'report'} message`}
                                                >
                                                    <DashboardIconTrash className="h-[18px] w-[18px]" strokeWidth={2.2} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => onSelectTrainingReport?.(entry)}
                                                className="block w-full min-w-0 text-left"
                                            >
                                                <p className="truncate text-sm text-gray-400">Report to complete from flight {entry.report.callsign || entry.report.eventCode}</p>
                                            </button>
                                        </div>
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
        </div>
    );
};

export default MyDashboard;
