import React, { useState, useEffect, useMemo } from 'react';
import { AirCombatTrainingReport, Instructor, ScheduleEvent, SctRequest, Pt051Assessment, Trainee } from '../types';
import TafWeatherWidget from './TafWeatherWidget';
import { normaliseFixedCrewStaffRole } from '../utils/crewPositionTerminology';

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
    trainingReportsToComplete?: Array<{ report: AirCombatTrainingReport; staff: Instructor }>;
    onSelectTrainingReport?: (entry: { report: AirCombatTrainingReport; staff: Instructor }) => void;
    onReassignTrainingReport?: (entry: { report: AirCombatTrainingReport; staff: Instructor }, assignee: Instructor) => void;
    staffOptions?: Instructor[];
    messageContactStaffOptions?: Instructor[];
    messageContactTraineeOptions?: Trainee[];
    selectedStaffName?: string;
    onSelectStaffName?: (staffName: string) => void;
}

type DashboardMessageContact = {
    id: string;
    name: string;
    displayName: string;
    unit: string;
    role: string;
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

const DASHBOARD_MESSAGES_STORAGE_KEY = 'dfp_dashboard_messages_v1';

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

const DASHBOARD_RANK_ORDER = ['WGCDR', 'SQNLDR', 'FLTLT', 'FLGOFF', 'PLTOFF', 'Mr'];

const getDashboardRankWeight = (rank?: string): number => {
    const index = DASHBOARD_RANK_ORDER.indexOf(String(rank || ''));
    return index === -1 ? DASHBOARD_RANK_ORDER.length : index;
};

const formatDashboardStaffName = (staff: Instructor): string => {
    const [lastName, firstName] = String(staff.name || '').split(',').map(part => part.trim());
    const displayName = firstName ? `${firstName} ${lastName}` : staff.name;
    return `${staff.rank || ''} ${displayName}`.trim();
};

const normaliseDashboardContactName = (value?: string | null): string => (
    String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

const toDashboardContactDisplayName = (name: string, rank?: string): string => {
    const [lastName, firstName] = String(name || '').split(',').map(part => part.trim());
    const displayName = firstName ? `${firstName} ${lastName}` : name;
    return `${rank || ''} ${displayName}`.trim();
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
    trainingReportsToComplete = [],
    onSelectTrainingReport,
    onReassignTrainingReport,
    staffOptions = [],
    messageContactStaffOptions = staffOptions,
    messageContactTraineeOptions = [],
    selectedStaffName,
    onSelectStaffName,
}) => {
    const sortedEvents = [...events].sort((a, b) => a.startTime - b.startTime);
    const groupedStaffOptions = useMemo(() => {
        const sortedStaff = [...staffOptions]
            .filter(staff => staff?.name)
            .sort((a, b) => (
                String(a.unit || 'No Unit').localeCompare(String(b.unit || 'No Unit')) ||
                getDashboardRankWeight(a.rank) - getDashboardRankWeight(b.rank) ||
                String(a.name || '').localeCompare(String(b.name || ''))
            ));
        const groups = new Map<string, Instructor[]>();
        sortedStaff.forEach(staff => {
            const unit = String(staff.unit || 'No Unit');
            groups.set(unit, [...(groups.get(unit) || []), staff]);
        });
        return Array.from(groups.entries()).map(([unit, staff]) => ({ unit, staff }));
    }, [staffOptions]);
    const dashboardSelectedName = selectedStaffName || userName;
    const [staffPickerEntry, setStaffPickerEntry] = useState<{ report: AirCombatTrainingReport; staff: Instructor; mode: 'open' | 'reassign' } | null>(null);
    const dashboardActionButtonClass = 'btn-aluminium-brushed relative flex h-[41px] w-[56px] shrink-0 items-center justify-center rounded-md px-1 py-1 text-center text-[9px] font-semibold leading-[0.95]';
    const [isMessagesOpen, setIsMessagesOpen] = useState(false);
    const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
    const [messageToText, setMessageToText] = useState('');
    const [selectedMessageContact, setSelectedMessageContact] = useState<DashboardMessageContact | null>(null);
    const [messageDraft, setMessageDraft] = useState('');
    const [dashboardMessages, setDashboardMessages] = useState<DashboardMessage[]>(() => readDashboardMessages());
    const [incomingToast, setIncomingToast] = useState<DashboardMessage | null>(null);
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
    const dashboardUserKey = normaliseDashboardContactName(dashboardSelectedName);
    const dashboardUserStaff = useMemo(() => (
        messageContactStaffOptions.find(staff => normaliseDashboardContactName(staff.name) === dashboardUserKey)
    ), [dashboardUserKey, messageContactStaffOptions]);
    const dashboardUserUnitCodes = useMemo(() => {
        const unit = String(dashboardUserStaff?.unit || '').trim().toUpperCase();
        if (unit) return unit.split(/[+/]/).map(code => code.trim()).filter(Boolean);
        return String(selectedStaffName || '').split(/[+/]/).map(code => code.trim().toUpperCase()).filter(Boolean);
    }, [dashboardUserStaff?.unit, selectedStaffName]);
    const dashboardUserUnitSet = useMemo(() => new Set(dashboardUserUnitCodes), [dashboardUserUnitCodes.join('|')]);
    const messageContacts = useMemo<DashboardMessageContact[]>(() => {
        const staffContacts = messageContactStaffOptions
            .filter(staff => staff?.name)
            .filter(staff => {
                const unit = String(staff.unit || '').trim().toUpperCase();
                return dashboardUserUnitSet.size === 0 || !unit || dashboardUserUnitSet.has(unit);
            })
            .map(staff => ({
                id: `staff-${staff.idNumber}-${staff.name}`,
                name: staff.name,
                displayName: toDashboardContactDisplayName(staff.name, staff.rank),
                unit: staff.unit || 'No Unit',
                role: formatStaffRole(staff),
                type: 'Staff' as const,
            }));
        const traineeContacts = messageContactTraineeOptions
            .filter(trainee => trainee?.fullName || trainee?.name)
            .filter(trainee => {
                const unit = String(trainee.unit || '').trim().toUpperCase();
                return dashboardUserUnitSet.size === 0 || !unit || dashboardUserUnitSet.has(unit);
            })
            .map(trainee => ({
                id: `trainee-${trainee.idNumber}-${trainee.fullName || trainee.name}`,
                name: trainee.fullName || trainee.name,
                displayName: toDashboardContactDisplayName(trainee.fullName || trainee.name, trainee.rank),
                unit: trainee.unit || 'No Unit',
                role: trainee.course || 'Trainee',
                type: 'Trainee' as const,
            }));
        const unique = new Map<string, DashboardMessageContact>();
        [...staffContacts, ...traineeContacts]
            .filter(contact => normaliseDashboardContactName(contact.name) !== dashboardUserKey)
            .forEach(contact => unique.set(normaliseDashboardContactName(contact.name), contact));
        return Array.from(unique.values()).sort((a, b) => (
            a.unit.localeCompare(b.unit) ||
            a.type.localeCompare(b.type) ||
            a.displayName.localeCompare(b.displayName)
        ));
    }, [dashboardUserKey, dashboardUserUnitSet, formatStaffRole, messageContactStaffOptions, messageContactTraineeOptions]);
    const messageSuggestions = useMemo(() => {
        const query = normaliseDashboardContactName(messageToText);
        if (!query) return [];
        return messageContacts
            .filter(contact => normaliseDashboardContactName(contact.displayName).includes(query) || normaliseDashboardContactName(contact.name).includes(query))
            .slice(0, 6);
    }, [messageContacts, messageToText]);
    const unreadMessages = useMemo(() => (
        dashboardMessages.filter(message => (
            normaliseDashboardContactName(message.to) === dashboardUserKey &&
            !message.readAt
        ))
    ), [dashboardMessages, dashboardUserKey]);
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
    const persistDashboardMessages = (updater: (messages: DashboardMessage[]) => DashboardMessage[]) => {
        setDashboardMessages(prev => {
            const next = updater(prev);
            writeDashboardMessages(next);
            return next;
        });
    };
    const selectMessageContact = (contact: DashboardMessageContact) => {
        setSelectedMessageContact(contact);
        setMessageToText(contact.displayName);
        setIsContactPickerOpen(false);
    };
    const sendDashboardMessage = () => {
        if (!selectedMessageContact || !messageDraft.trim()) return;
        const nextMessage: DashboardMessage = {
            id: `dashboard-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            from: dashboardSelectedName,
            to: selectedMessageContact.name,
            body: messageDraft.trim(),
            sentAt: new Date().toISOString(),
        };
        persistDashboardMessages(messages => [...messages, nextMessage]);
        setMessageDraft('');
    };
    useEffect(() => {
        if (!isMessagesOpen || unreadMessages.length === 0) return;
        const now = new Date().toISOString();
        persistDashboardMessages(messages => messages.map(message => (
            normaliseDashboardContactName(message.to) === dashboardUserKey && !message.readAt
                ? { ...message, readAt: now }
                : message
        )));
    }, [dashboardUserKey, isMessagesOpen, unreadMessages.length]);
    useEffect(() => {
        if (unreadMessages.length === 0) return;
        const newest = unreadMessages[unreadMessages.length - 1];
        setIncomingToast(newest);
        const timer = window.setTimeout(() => setIncomingToast(null), 4000);
        return () => window.clearTimeout(timer);
    }, [unreadMessages.length]);
    const sameUnitStaff = useMemo(() => {
        if (!staffPickerEntry) return [];
        const unit = String(staffPickerEntry.staff.unit || staffPickerEntry.report.unitCode || '').trim();
        return staffOptions
            .filter(staff => staff?.name && (!unit || String(staff.unit || '').trim() === unit))
            .sort((a, b) => getDashboardRankWeight(a.rank) - getDashboardRankWeight(b.rank) || String(a.name || '').localeCompare(String(b.name || '')));
    }, [staffOptions, staffPickerEntry]);
    
    const mySctRequests = sctRequests.filter(req => req.name === userName.split(' ').reverse().join(', '));
    
    // Get incomplete PT-051 assessments assigned to current user (not yet edited/saved)
    const incompletePt051s = React.useMemo(() => {
        const fullUserName = `${userName.split(' ').reverse().join(', ')}`; // Convert "Joe Bloggs" to "Bloggs, Joe"
        return Array.from(pt051Assessments.values())
            .filter(assessment => 
                !assessment.isCompleted && 
                assessment.instructorName === fullUserName
            )
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [pt051Assessments, userName]);

    const EventRow: React.FC<{event: ScheduleEvent}> = ({event}) => {
        const isStby = event.resourceId && (
            event.resourceId.startsWith('STBY') ||
            event.resourceId.startsWith('BNF-STBY') ||
            event.resourceId.startsWith('FTD-STBY')
        );
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
                        {groupedStaffOptions.length > 0 && onSelectStaffName ? (
                            <select
                                value={dashboardSelectedName}
                                onChange={(event) => onSelectStaffName(event.target.value)}
                                className="min-w-[280px] rounded-md border border-sky-500/40 bg-gray-950 px-3 py-2 text-lg font-semibold text-white shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                            >
                                {groupedStaffOptions.map(group => (
                                    <optgroup key={group.unit} label={group.unit}>
                                        {group.staff.map(staff => (
                                            <option key={`${staff.unit || 'unit'}-${staff.idNumber}-${staff.name}`} value={staff.name}>
                                                {formatDashboardStaffName(staff)}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        ) : (
                            <span className="text-lg text-gray-400">{userRank} {userName}</span>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-px">
                    <button
                        type="button"
                        onClick={() => setIsMessagesOpen(true)}
                        className={dashboardActionButtonClass}
                    >
                        {unreadMessages.length > 0 && (
                            <span className="absolute -left-2 -bottom-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[13px] font-bold text-white shadow-lg">
                                {Math.min(unreadMessages.length, 9)}
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
                            <h2 className="text-center text-2xl font-bold tracking-tight">New Message</h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMessagesOpen(false);
                                    setIsContactPickerOpen(false);
                                }}
                                className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-gray-200 text-4xl font-light leading-none text-gray-950 shadow-inner hover:bg-gray-300"
                                aria-label="Close messages"
                            >
                                x
                            </button>
                        </div>
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
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-3xl font-bold leading-none text-gray-950 hover:bg-gray-300"
                                    aria-label="Open contacts"
                                >
                                    +
                                </button>
                            </div>
                            {!selectedMessageContact && messageSuggestions.length > 0 && (
                                <div className="absolute left-8 right-14 top-[58px] z-10 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                                    {messageSuggestions.map(contact => (
                                        <button
                                            key={contact.id}
                                            type="button"
                                            onClick={() => selectMessageContact(contact)}
                                            className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-gray-100"
                                        >
                                            <span>
                                                <span className="block text-sm font-semibold text-gray-950">{contact.displayName}</span>
                                                <span className="block text-xs text-gray-500">{contact.unit} - {contact.role}</span>
                                            </span>
                                            <span className="text-[10px] font-bold uppercase text-gray-400">{contact.type}</span>
                                        </button>
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
                                            const timeLabel = sentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            return (
                                                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[78%] rounded-2xl px-4 py-2 shadow-sm ${mine ? 'bg-sky-500 text-white' : 'bg-white text-gray-950'}`}>
                                                        <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                                                        <div className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${mine ? 'text-sky-50/80' : 'text-gray-500'}`}>
                                                            <span>{timeLabel}</span>
                                                            {mine && <span>{message.readAt ? 'Read' : 'Sent'}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
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
                    </div>
                    {isContactPickerOpen && (
                        <div className="absolute inset-0 z-[105] flex items-center justify-center bg-black/45 p-4">
                            <div className="w-full max-w-md rounded-2xl bg-white p-4 text-gray-950 shadow-2xl">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-lg font-bold">Select Contact</h3>
                                    <button type="button" onClick={() => setIsContactPickerOpen(false)} className="text-2xl leading-none text-gray-500 hover:text-gray-950">x</button>
                                </div>
                                <div className="max-h-[52vh] space-y-1 overflow-y-auto">
                                    {messageContacts.map(contact => (
                                        <button
                                            key={contact.id}
                                            type="button"
                                            onClick={() => selectMessageContact(contact)}
                                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-gray-100"
                                        >
                                            <span>
                                                <span className="block text-sm font-semibold">{contact.displayName}</span>
                                                <span className="block text-xs text-gray-500">{contact.unit} - {contact.role}</span>
                                            </span>
                                            <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-500">{contact.type}</span>
                                        </button>
                                    ))}
                                    {messageContacts.length === 0 && (
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
                            My SCT
                        </button>
                    </div>
                </div>

                {/* Weather Widget */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                    <TafWeatherWidget />
                </div>
                
                {/* My Active SCT Requests */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold text-sky-400 mb-4">My Active SCT Requests</h2>
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
                        <p className="text-gray-500 text-center italic py-4">No active SCT requests.</p>
                    )}
                </div>

                {/* Reports to be completed */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold text-amber-400 mb-4">Reports to be completed</h2>
                    {incompletePt051s.length > 0 || trainingReportsToComplete.length > 0 ? (
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
                            {trainingReportsToComplete.map(entry => (
                                <li key={entry.report.id} className="p-3 bg-gray-700/50 rounded-md hover:bg-gray-700 transition-colors">
                                    <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setStaffPickerEntry({ ...entry, mode: 'open' })}
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
