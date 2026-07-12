import React, { useState, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import { Trainee, ScheduleEvent, Pt051Assessment, Pt051Grade, Instructor, Pt051OverallGrade, Score, SyllabusItemDetail, PhraseBank } from '../types';
import AuditButton from './AuditButton';
import { showDarkAlert, showDarkConfirm } from './DarkMessageModal';
import { useSystemFreeze } from '../context/SystemFreezeContext';
import {
    DEFAULT_TRAINING_REPORT_TEMPLATE,
    DEFAULT_TRAINING_REPORT_TERMINOLOGY,
    getUnitTrainingReportTemplate,
    normaliseTrainingReportTemplate,
    type TrainingReportTerminology,
    type TrainingReportTemplate,
} from '../utils/trainingReportTerminology';
import { loadPlatformConfigFromDB } from '../utils/platformConfigService';

interface PT051ViewProps {
    trainee: Trainee;
    event: ScheduleEvent;
    onBack: () => void;
    onSave: (assessment: Pt051Assessment, isAutoSave?: boolean) => void | Promise<void>;
    onDeleteAssessment?: (assessmentId: string) => void | Promise<void>;
    onEventUpdate?: (event: ScheduleEvent) => void;
    initialAssessment?: Pt051Assessment;
    instructors: Instructor[];
    pt051Assessments: Map<string, Pt051Assessment>;
    events: ScheduleEvent[];
    lmpScores: Score[];
    syllabusDetails: SyllabusItemDetail[];
    registerDirtyCheck: (isDirty: () => boolean, onSave: () => void, onDiscard: () => void) => void;
    phraseBank: PhraseBank;
    currentUserPin: string;
    canEditPt051?: boolean;
    instructorLabel?: string;
    trainingReportTerminology?: Partial<TrainingReportTerminology> | null;
    trainingReportTemplate?: Partial<TrainingReportTemplate> | null;
    trainingReportUnitCode?: string;
    trainingReportContextUnitCode?: string;
    embeddedInProfile?: boolean;
}

const PT051_STRUCTURE = [
  { category: 'Core Dimensions', elements: ['Airmanship', 'Preparation', 'Technique'] },
  { category: 'Procedural Framework', elements: ['Pre-Post Flight', 'Walk Around', 'Strap-in', 'Ground Checks', 'Airborne Checks'] },
  { category: 'Takeoff', elements: ['Stationary'] },
  { category: 'Departure', elements: ['Visual'] },
  { category: 'Core Handling Skills', elements: ['Effects of Control', 'Trimming', 'Straight and Level'] },
  { category: 'Turns', elements: ['Level medium Turn', 'Level Steep turn'] },
  { category: 'Recovery', elements: ['Visual - Initial & Pitch'] },
  { category: 'Landing', elements: ['Landing', 'Crosswind'] },
  { category: 'Domestics', elements: ['Radio Comms', 'Situational Awareness', 'Lookout', 'Knowledge'] },
];

const ALL_ELEMENTS = PT051_STRUCTURE.flatMap(cat => cat.elements);
const DEFAULT_ASSESSED_ELEMENTS = ['Airmanship', 'Preparation', 'Technique'];
const SCORING_MATRIX_ELEMENT_GROUPS_KEY = '__scoringMatrixElementGroups';
const COMMENT_SECTIONS = ['QFI', 'Weather', 'Profile', 'Overall', 'NEST', 'Notes'] as const;
type DpcoFollowUpAction = 'extra-event' | 'extra-hours-next-event' | 'continue-no-additions' | '';

const stripGeneratedFollowUpNotes = (value: string, generatedPrefix = ''): string => {
    const lines = String(value || '').split('\n');
    const cleanedPrefix = generatedPrefix.trim();
    const cleanedLines = lines.flatMap((line) => {
        const trimmedLine = line.trim();
        if (cleanedPrefix && trimmedLine.startsWith(cleanedPrefix)) {
            const prefixStart = line.indexOf(cleanedPrefix);
            const remainder = line.slice(prefixStart + cleanedPrefix.length).replace(/^\s/, '');
            return remainder ? [remainder] : [];
        }
        return /^(?:\d+(?:\.\d+)?\s+hrs?\s+added to\s+.+|Re-fly requested:\s+.+)$/i.test(trimmedLine) ? [] : [line];
    });
    return cleanedLines.join('\n').replace(/^\s+/, '');
};

const formatFollowUpHours = (value?: number): string => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue.toFixed(1) : '';
};

const extractPreFlightNotes = (eventLike?: Partial<ScheduleEvent> | null): string => {
    const source = eventLike as any;
    const explicitNotes = String(source?.preFlightNotes || '').trim();
    if (explicitNotes) return explicitNotes;

    const metadataNotes = Object.values((source?.trainingReportForwardedNotes || {}) as Record<string, any>)
        .map((entry: any) => String(entry?.notes || '').trim())
        .filter(Boolean)
        .join('\n\n');
    if (metadataNotes) return metadataNotes;

    const raw = String(source?.notes || '').trim();
    if (!raw) return '';
    const preFlightMatch = raw.match(/^Pre-flight Notes\s*\n([\s\S]*)$/i);
    if (preFlightMatch) return preFlightMatch[1].trim();
    const legacyMatch = raw.match(/^Training report notes from [^\n]+:\s*\n([\s\S]*)$/i);
    if (legacyMatch) return legacyMatch[1].trim();
    return '';
};

const pushTrainingReportNotesDiag = (stage: string, payload: Record<string, any> = {}) => {
    try {
        const existing = JSON.parse(window.localStorage.getItem('neo_training_report_notes_diag') || '[]');
        const next = [
            ...(Array.isArray(existing) ? existing : []),
            {
                ts: new Date().toISOString(),
                stage,
                ...payload,
            },
        ].slice(-250);
        window.localStorage.setItem('neo_training_report_notes_diag', JSON.stringify(next));
    } catch {
        // Diagnostics must never affect training report behaviour.
    }
};

const normaliseAssessedElements = (elements?: string[]): string[] => {
    const source = Array.isArray(elements) && elements.length > 0 ? elements : DEFAULT_ASSESSED_ELEMENTS;
    const seen = new Set<string>();
    const selected = source
        .map(element => String(element || '').trim())
        .filter(Boolean)
        .filter(element => {
            const key = element.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    return selected.length > 0 ? selected : DEFAULT_ASSESSED_ELEMENTS;
};

const getDefaultElementGroup = (element: string): string => (
    PT051_STRUCTURE.find(category =>
        category.elements.some(candidate => candidate.toLowerCase() === element.toLowerCase())
    )?.category || 'Additional Elements'
);

const buildAssessmentStructure = (elements?: string[], phraseBank?: PhraseBank) => {
    const selectedElements = normaliseAssessedElements(elements);
    const configuredGroups = (phraseBank as any)?.[SCORING_MATRIX_ELEMENT_GROUPS_KEY] || {};
    const categoryOrder = PT051_STRUCTURE.map(category => category.category);
    const grouped = new Map<string, string[]>();

    selectedElements.forEach(element => {
        const configuredGroup = String(configuredGroups[element] || '').trim();
        const category = configuredGroup || getDefaultElementGroup(element);
        if (!categoryOrder.includes(category)) categoryOrder.push(category);
        grouped.set(category, [...(grouped.get(category) || []), element]);
    });

    const categories = categoryOrder
        .map(category => ({ category, elements: grouped.get(category) || [] }))
        .filter(category => category.elements.length > 0);

    return categories.length > 0 ? categories : [{ category: 'Core Dimensions', elements: DEFAULT_ASSESSED_ELEMENTS }];
};

const InfoField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <dt className="text-sm font-medium text-gray-400">{label}</dt>
        <dd className="mt-1 text-sm text-white font-semibold">{value || 'N/A'}</dd>
    </div>
);

const formatTime = (time: number): string => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const parseComments = (raw: string | undefined) => {
    const defaults = { QFI: '', Weather: '', Profile: '', Overall: '', NEST: '', Notes: '' };
    if (!raw) return defaults;
    
    const result = { ...defaults };
    
    COMMENT_SECTIONS.forEach((section, index) => {
        const nextSection = COMMENT_SECTIONS[index + 1];
        const startMarker = `${section}:`;
        const startIndex = raw.indexOf(startMarker);
        
        if (startIndex !== -1) {
            let contentStart = startIndex + startMarker.length;
            let endIndex = -1;
            
            if (nextSection) {
                const nextMarker = `${nextSection}:`;
                endIndex = raw.indexOf(nextMarker, contentStart);
            }
            
            let content = '';
            if (endIndex !== -1) {
                content = raw.substring(contentStart, endIndex);
            } else {
                content = raw.substring(contentStart);
            }
            
            result[section] = content.trim();
        }
    });
    
    return result;
};

interface PhraseSelectorProps {
    element: string;
    onClose: () => void;
    onInsert: (text: string) => void;
    phraseBank: PhraseBank;
}

const PhraseSelector: React.FC<PhraseSelectorProps> = ({ element, onClose, onInsert, phraseBank }) => {
    const [selectedPhrases, setSelectedPhrases] = useState<Set<string>>(new Set());

    // Logic to determine which phrase list to show.
    // 1. Check if there are specific phrases defined for this exact element name.
    let phraseData = phraseBank?.[element];

    // 2. If no specific phrases found, and it is NOT a Core Dimension, use the Generic Flying Elements list.
    const isCoreDimension = ['Airmanship', 'Preparation', 'Technique'].includes(element);
    if (!phraseData && !isCoreDimension) {
        phraseData = phraseBank?.['Generic Flying Elements'];
    }

    const togglePhrase = (phrase: string) => {
        const newSet = new Set(selectedPhrases);
        if (newSet.has(phrase)) {
            newSet.delete(phrase);
        } else {
            newSet.add(phrase);
        }
        setSelectedPhrases(newSet);
    };

    const handleInsert = () => {
        const text = Array.from(selectedPhrases).join(' ');
        onInsert(text);
    };

    const getGradeLabel = (grade: string) => {
        switch(grade) {
            case '5': return '5 - Excellent';
            case '4': return '4 - High Satisfactory';
            case '3': return '3 - Satisfactory';
            case '2': return '2 - Low Satisfactory';
            case '1': return '1 - Marginal';
            case '0': return '0 - Unsatisfactory';
            default: return grade;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-gray-700 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Select Phrases: <span className="text-sky-400">{element}</span></h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1 space-y-4">
                    {phraseData ? (
                        // Render phrases grouped by grade, sorted descending (5 to 0)
                        Object.entries(phraseData).sort((a, b) => Number(b[0]) - Number(a[0])).map(([grade, phrases]) => {
                            const typedPhrases = phrases as string[];
                            return typedPhrases.length > 0 && (
                                <div key={grade}>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 border-b border-gray-700 pb-1">{getGradeLabel(grade)}</h4>
                                    <div className="space-y-2">
                                        {typedPhrases.map((phrase, idx) => (
                                            <label key={idx} className="flex items-start space-x-3 cursor-pointer p-2 rounded hover:bg-gray-700/50">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedPhrases.has(phrase)} 
                                                    onChange={() => togglePhrase(phrase)}
                                                    className="mt-1 h-4 w-4 accent-sky-500 bg-gray-600 border-gray-500 rounded"
                                                />
                                                <span className="text-sm text-gray-200">{phrase}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-8 text-gray-500 italic">
                            <p>No phrase list available for this element.</p>
                            <p className="text-xs mt-2">Configure in Settings → Scoring Matrix.</p>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-700 bg-gray-900/50 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-semibold">Cancel</button>
                    <button onClick={handleInsert} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-semibold">Insert Selected</button>
                </div>
            </div>
        </div>
    );
};

const PT051View: React.FC<PT051ViewProps> = ({ trainee, event, onBack, onSave, onDeleteAssessment, onEventUpdate, initialAssessment, instructors, pt051Assessments, events, lmpScores, syllabusDetails, registerDirtyCheck, phraseBank, currentUserPin, canEditPt051 = true, instructorLabel = 'QFI', trainingReportTerminology = DEFAULT_TRAINING_REPORT_TERMINOLOGY, trainingReportTemplate = null, trainingReportUnitCode = '', trainingReportContextUnitCode = '', embeddedInProfile = false }) => {
    const reportTemplate = useMemo(() => {
        const template = normaliseTrainingReportTemplate(trainingReportTemplate, trainingReportTerminology);
        const terminologyName = String(trainingReportTerminology?.name || '').trim();
        if (terminologyName && terminologyName !== DEFAULT_TRAINING_REPORT_TERMINOLOGY.name && terminologyName !== template.displayName) {
            return { ...template, displayName: terminologyName };
        }
        return template;
    }, [trainingReportTemplate, trainingReportTerminology]);
    const trainingReportName = reportTemplate.displayName;
    const overviewFields = reportTemplate.modules.overview.fields;
    const overallFields = reportTemplate.modules.overallAssessment.fields;
    const commentFieldsConfig = reportTemplate.modules.comments.fields;
    const enabledCompletionResults = reportTemplate.completionResults.filter((option) => option.enabled !== false);
    const missionStatusOptions = enabledCompletionResults.length > 0
        ? enabledCompletionResults
        : [{ code: 'Complete', label: 'Complete', enabled: true }];
    const gradeOptions = useMemo(() => (
        reportTemplate.grades.options.filter((option) => option.enabled !== false && String(option.label || '').trim())
    ), [reportTemplate.grades.options]);
    const assessmentGradeOptions = useMemo<(Pt051Grade | 'DEMO')[]>(() => [
        ...(reportTemplate.grades.includeDemo ? ['DEMO' as const] : []),
        ...gradeOptions.map((option) => option.value as Pt051Grade),
    ], [gradeOptions, reportTemplate.grades.includeDemo]);
    const overallGradeOptions = useMemo<Pt051OverallGrade[]>(() => [
        'No Grade',
        ...gradeOptions.map((option) => option.value as Pt051OverallGrade),
    ], [gradeOptions]);
    const gradeLabelMap = useMemo(() => (
        new Map(gradeOptions.map((option) => [option.value, option.label]))
    ), [gradeOptions]);
    const isLongGradeScale = gradeOptions.length > 6;
    const formatGradeOption = (grade: Pt051OverallGrade | Pt051Grade | 'DEMO') => {
        if (grade === 'No Grade' || grade === 'DEMO' || grade === 'MIN') return String(grade);
        const label = gradeLabelMap.get(Number(grade)) || `Grade ${grade}`;
        return reportTemplate.grades.showNumbers ? `${grade} - ${label}` : label;
    };
    const formatGradeValue = (grade: Pt051OverallGrade | Pt051Grade | 'DEMO') => (
        grade === 'No Grade' ? 'None' : String(grade)
    );
    const formatGradeText = (grade: Pt051OverallGrade | Pt051Grade | 'DEMO') => {
        if (grade === 'No Grade') return 'No Grade';
        if (grade === 'DEMO' || grade === 'MIN') return String(grade);
        return gradeLabelMap.get(Number(grade)) || `Grade ${grade}`;
    };
    const formatOverallGradeTileText = (grade: Pt051OverallGrade) => (
        grade === 'No Grade' ? 'No Grade' : formatGradeText(grade)
    );
    const formatGradeHeaderText = (grade: Pt051OverallGrade | Pt051Grade | 'DEMO') => {
        const label = formatGradeText(grade);
        const compactLabels: Record<string, string> = {
            Unsatisfactory: 'Un-sat',
            Marginal: 'Marginal',
            'Low Satisfactory': 'Low Sat',
            Satisfactory: 'Sat',
            'High Satisfactory': 'High Sat',
            Excellent: 'Excel',
            'High Excellent': 'High Excel',
            Outstanding: 'Outstand',
            Exceptional: 'Except',
        };
        return compactLabels[label] || label;
    };
    const formatGradeNumber = (grade: Pt051OverallGrade | Pt051Grade | 'DEMO') => {
        if (grade === 'No Grade') return 'None';
        if (grade === 'DEMO' || grade === 'MIN') return String(grade);
        return String(grade);
    };
    const stopEditableKeyPropagation = (event: React.KeyboardEvent<HTMLElement>) => {
        const target = event.target as HTMLElement | null;
        if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement ||
            target?.isContentEditable
        ) {
            event.stopPropagation();
        }
    };
    const [showDoubleMarginalWarning, setShowDoubleMarginalWarning] = useState(false);
    const { checkAndWarn } = useSystemFreeze();
    const [isDirty, setIsDirty] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving...' | 'Unsaved'>('Saved');
    const isFirstRender = useRef(true);
    const isInitialCommentHydration = useRef(true);

    // --- Phrase Picker State ---
    const [showPhraseModal, setShowPhraseModal] = useState(false);
    const [currentPhraseElement, setCurrentPhraseElement] = useState<string | null>(null);

    const getRadioAccentColor = (grade: Pt051Grade | 'MIN' | 'DEMO') => {
        if (grade === 0) {
            return 'accent-red-500';
        }
        if (grade === 1) {
            return 'accent-amber-500';
        }
        return 'accent-sky-500';
    };

    const getOverallRadioAccentColor = (grade: Pt051OverallGrade) => {
        if (grade === 0) return 'accent-red-500';
        if (grade === 1) return 'accent-amber-500';
        return 'accent-sky-500';
    };

    const qfi = useMemo(() => {
        if (!event.instructor) return null;
        return instructors.find(i => i.name === event.instructor) || null;
    }, [event.instructor, instructors]);
    
    const [currentEvent, setCurrentEvent] = useState(() => {
        // If we have timing data in the initial assessment, use it
        if (initialAssessment && (initialAssessment.startTime !== undefined || initialAssessment.duration !== undefined)) {
            return {
                ...event,
                startTime: initialAssessment.startTime || event.startTime,
                duration: initialAssessment.duration || event.duration
            };
        }
        return event;
    });
    const syllabusEvent = useMemo(() => {
        const eventCodes = [
            event.eventCode,
            event.flightNumber,
            currentEvent?.eventCode,
            currentEvent?.flightNumber,
            initialAssessment?.flightNumber,
        ]
            .map(code => String(code || '').trim())
            .filter(Boolean);
        return syllabusDetails.find(item => (
            eventCodes.some(code => (
                String(item.code || '').trim() === code ||
                String(item.id || '').trim() === code
            ))
        ));
    }, [event.eventCode, event.flightNumber, currentEvent?.eventCode, currentEvent?.flightNumber, initialAssessment?.flightNumber, syllabusDetails]);
    const assessmentStructure = useMemo(
        () => buildAssessmentStructure(syllabusEvent?.assessedElements, phraseBank),
        [syllabusEvent?.assessedElements, phraseBank]
    );
    const assessmentElements = useMemo(
        () => assessmentStructure.flatMap(category => category.elements),
        [assessmentStructure]
    );
    const isSimEvent = useMemo(() => {
        const values = [
            currentEvent?.type,
            currentEvent?.eventType,
            syllabusEvent?.type,
            syllabusEvent?.resourceType,
            event.type,
            event.eventType,
        ];
        return values.some(value => /sim/i.test(String(value || '')));
    }, [currentEvent?.eventType, currentEvent?.type, event.eventType, event.type, syllabusEvent?.resourceType, syllabusEvent?.type]);
    const [assessment, setAssessment] = useState(() => {
        if (initialAssessment) {
            return initialAssessment;
        }
        return {
            id: uuidv4(),
            traineeFullName: trainee.fullName,
            eventId: event.id,
            flightNumber: event.flightNumber,
            date: event.date,
            instructorName: event.instructor || '',
            scores: assessmentElements.map(element => ({
                element,
                grade: null,
                comment: ''
            })),
            overallGrade: null,
            overallResult: null,
            groundSchoolAssessment: { isAssessment: false, result: undefined },
        } as Pt051Assessment;
    });

    useEffect(() => {
        setAssessment(prev => {
            const existingElements = new Set(prev.scores.map(score => score.element));
            const missingScores = assessmentElements
                .filter(element => !existingElements.has(element))
                .map(element => ({ element, grade: null, comment: '' }));
            if (missingScores.length === 0) return prev;
            return { ...prev, scores: [...prev.scores, ...missingScores] };
        });
    }, [assessmentElements]);

    const handleEventUpdate = (updates: Partial<ScheduleEvent>) => {
        const updatedEvent = { ...currentEvent, ...updates };
        setCurrentEvent(updatedEvent);
        if (onEventUpdate) {
            onEventUpdate(updatedEvent);
        }
    };

    const [commentFields, setCommentFields] = useState(() => {
        const parsed = parseComments((initialAssessment as any)?.comments || initialAssessment?.overallComments);
        if (!parsed.QFI && event.instructor) {
            parsed.QFI = event.instructor;
        }
        parsed.Notes = stripGeneratedFollowUpNotes(parsed.Notes || '');
        return parsed;
    });
    const forwardedPreFlightNotes = extractPreFlightNotes(event);
    useEffect(() => {
        pushTrainingReportNotesDiag('pt051:hydrate-notes', {
            traineeFullName: trainee.fullName,
            eventId: event.id,
            eventCode: event.flightNumber || (event as any).eventCode || '',
            initialAssessmentId: initialAssessment?.id || null,
            initialPassNotesToNextEvent: initialAssessment?.passNotesToNextEvent === true,
            initialTrainingReportNotesLength: String(initialAssessment?.trainingReportNotes || '').trim().length,
            eventPreFlightNotesLength: String((event as any).preFlightNotes || '').trim().length,
            forwardedPreFlightNotesLength: forwardedPreFlightNotes.length,
            forwardedPreFlightNotesPreview: forwardedPreFlightNotes.slice(0, 160),
            forwardedKeys: Object.keys(((event as any).trainingReportForwardedNotes || {}) as Record<string, any>),
            eventNotesPreview: String(event.notes || '').slice(0, 160),
        });
    }, [event.id, event.flightNumber, event.notes, forwardedPreFlightNotes, initialAssessment?.id, initialAssessment?.passNotesToNextEvent, initialAssessment?.trainingReportNotes, trainee.fullName]);
    
    const [overallGrade, setOverallGrade] = useState<Pt051OverallGrade | null>(initialAssessment?.overallGrade ?? null);
    const [overallResult, setOverallResult] = useState<'P' | 'F' | null>(initialAssessment?.overallResult || null);
    const [groundSchoolAssessment, setGroundSchoolAssessment] = useState(
        initialAssessment?.groundSchoolAssessment || { isAssessment: false, result: undefined }
    );
    const [dcoResult, setDcoResult] = useState<string>(
        initialAssessment?.dcoResult || (enabledCompletionResults.length === 0 ? 'Complete' : '')
    );
    const [dpcoFollowUp, setDpcoFollowUp] = useState<{ action: DpcoFollowUpAction; extraEventHours?: number; extraHours?: number }>(() => ({
        action: (initialAssessment?.dpcoFollowUp?.action || '') as DpcoFollowUpAction,
        extraEventHours: initialAssessment?.dpcoFollowUp?.extraEventHours ?? undefined,
        extraHours: initialAssessment?.dpcoFollowUp?.extraHours ?? undefined,
    }));
    const [dncoFollowUp, setDncoFollowUp] = useState<{ requestExtraFlight: boolean }>(() => ({
        requestExtraFlight: initialAssessment?.dncoFollowUp?.requestExtraFlight === true,
    }));
    const [passNotesToNextEvent, setPassNotesToNextEvent] = useState(initialAssessment?.passNotesToNextEvent === true);
    
    const recentPerformanceHistory = useMemo(() => {
        const history: { name: string; score: number | string; date: string; timestamp: number }[] = [];
        const isFlightOrFtd = (eventName: string) => {
            const detail = syllabusDetails.find(d => d.id === eventName || d.code === eventName);
            if (detail) {
                return detail.type === 'Flight' || detail.type === 'FTD';
            }
            const name = eventName.toUpperCase();
            if (name.includes('FTD') || name.startsWith('BGF') || name.startsWith('BIF') || name.startsWith('BNF') || name.startsWith('BNAV') || name.startsWith('SCT')) {
                 if (!name.includes('MB') && !name.includes('TUT') && !name.includes('CPT')) {
                     return true;
                 }
            }
            return false;
        };
        lmpScores.forEach(s => {
             if (isFlightOrFtd(s.event)) {
                 history.push({
                     name: s.event,
                     score: s.score,
                     date: s.date,
                     timestamp: new Date(s.date).getTime()
                 });
             }
        });
        pt051Assessments.forEach(a => {
            if (a.traineeFullName === trainee.fullName && a.eventId !== event.id && a.overallGrade !== null && a.overallGrade !== 'No Grade') {
                 if (isFlightOrFtd(a.flightNumber)) {
                      history.push({
                         name: a.flightNumber,
                         score: a.overallGrade,
                         date: a.date,
                         timestamp: new Date(a.date).getTime()
                     });
                 }
            }
        });
        history.sort((a, b) => b.timestamp - a.timestamp);
        const currentEventTime = new Date(event.date).getTime();
        return history.filter(h => h.timestamp < currentEventTime);
    }, [lmpScores, pt051Assessments, trainee.fullName, syllabusDetails, event.date, event.id]);

    const previousPerformance = recentPerformanceHistory.length > 0 ? recentPerformanceHistory[0] : null;

    const gradeRequiresRepeatEvent = (grade: Pt051OverallGrade | null) => {
        return typeof grade === 'number' && reportTemplate.repeatRules.gradesRequiringRepeat.includes(grade);
    };

    const shouldTriggerRepeatedLowPerformance = (grade: Pt051OverallGrade | null) => {
        if (typeof grade !== 'number') return false;
        if (reportTemplate.repeatRules.consecutive.enabled && reportTemplate.repeatRules.consecutive.grades.includes(grade)) {
            const previousScores = recentPerformanceHistory
                .slice(0, Math.max(0, reportTemplate.repeatRules.consecutive.count - 1))
                .map((entry) => Number(entry.score));
            if (previousScores.length >= reportTemplate.repeatRules.consecutive.count - 1 && previousScores.every((score) => reportTemplate.repeatRules.consecutive.grades.includes(score))) {
                return true;
            }
        }
        if (reportTemplate.repeatRules.rollingWindow.enabled && reportTemplate.repeatRules.rollingWindow.grades.includes(grade)) {
            const previousScores = recentPerformanceHistory
                .slice(0, Math.max(0, reportTemplate.repeatRules.rollingWindow.window - 1))
                .map((entry) => Number(entry.score));
            const matchingCount = previousScores.filter((score) => reportTemplate.repeatRules.rollingWindow.grades.includes(score)).length + 1;
            if (matchingCount >= reportTemplate.repeatRules.rollingWindow.count) {
                return true;
            }
        }
        return false;
    };

    useEffect(() => {
        if (shouldTriggerRepeatedLowPerformance(overallGrade)) {
            setShowDoubleMarginalWarning(true);
            setOverallResult('F');
        } else {
            setShowDoubleMarginalWarning(false);
        }
    }, [overallGrade, recentPerformanceHistory, reportTemplate]);

    useEffect(() => {
        if (overallGrade === 'No Grade' || overallGrade === null) {
            setOverallResult(null);
        } else if (shouldTriggerRepeatedLowPerformance(overallGrade) || gradeRequiresRepeatEvent(overallGrade)) {
            setOverallResult('F');
        } else if (typeof overallGrade === 'number') {
            setOverallResult('P');
        }
    }, [overallGrade, recentPerformanceHistory, reportTemplate]);

    const handleGradeChange = (element: string, grade: Pt051Grade | 'MIN' | 'DEMO') => {
        setAssessment(prev => ({
            ...prev,
            scores: prev.scores.some(s => s.element === element)
                ? prev.scores.map(s => s.element === element ? { ...s, grade } : s)
                : [...prev.scores, { element, grade, comment: '' }]
        }));
    };

    const handleCommentChange = (element: string, comment: string) => {
        setAssessment(prev => ({
            ...prev,
            scores: prev.scores.some(s => s.element === element)
                ? prev.scores.map(s => s.element === element ? { ...s, comment } : s)
                : [...prev.scores, { element, grade: null, comment }]
        }));
    };

    const handleCommentFieldChange = (key: typeof COMMENT_SECTIONS[number], value: string) => {
        setCommentFields(prev => ({ ...prev, [key]: key === 'Notes' ? stripGeneratedFollowUpNotes(value, getFollowUpNotesPrefix()) : value }));
        
        // Mirror QFI field to instructorName field
        if (key === 'QFI') {
            setAssessment(prev => ({ ...prev, instructorName: value }));
        }
    };

    const isSimulatorReportEvent = useMemo(() => {
        const detail = syllabusDetails.find(item => (
            String(item.code || '').trim().toUpperCase() === String(event.flightNumber || '').trim().toUpperCase() ||
            String(item.id || '').trim() === String(event.id || '').trim()
        ));
        return event.type === 'ftd' || /sim|ftd/i.test(String(detail?.type || event.type || ''));
    }, [event.flightNumber, event.id, event.type, syllabusDetails]);

    const getNextReportEventCode = (): string => {
        const detailIndex = syllabusDetails.findIndex(item => (
            String(item.code || '').trim().toUpperCase() === String(event.flightNumber || '').trim().toUpperCase() ||
            String(item.id || '').trim() === String(event.id || '').trim()
        ));
        if (detailIndex === -1) return '';
        const sourceType = String(syllabusDetails[detailIndex]?.type || '').trim();
        const next = syllabusDetails.slice(detailIndex + 1).find(item => (
            !sourceType || String(item.type || '').trim() === sourceType
        ));
        return String(next?.code || '').trim();
    };

    const getFollowUpNotesPrefix = (): string => {
        if (dcoResult === 'DPCO' && dpcoFollowUp.action === 'extra-hours-next-event') {
            const hours = formatFollowUpHours(dpcoFollowUp.extraHours);
            if (!hours) return '';
            return `${hours} hrs added to ${getNextReportEventCode() || 'next event'}.`;
        }
        if (dcoResult === 'DPCO' && dpcoFollowUp.action === 'extra-event') {
            const hours = formatFollowUpHours(dpcoFollowUp.extraEventHours);
            return hours
                ? `${hours} hrs added to ${event.flightNumber || 're-fly event'}.`
                : `Re-fly requested: ${event.flightNumber || 'event'}.`;
        }
        if (dcoResult === 'DNCO' && dncoFollowUp.requestExtraFlight) {
            return `Re-fly requested: ${event.flightNumber || 'event'}.`;
        }
        return '';
    };

    const buildTrainingReportNotes = (): string => {
        const followUpPrefix = getFollowUpNotesPrefix();
        const freeText = stripGeneratedFollowUpNotes(commentFields.Notes || '', followUpPrefix);
        return [followUpPrefix, freeText].filter(Boolean).join('\n\n');
    };

    // Filter instructors by trainee's unit
    const unitInstructors = useMemo(() => {
        return instructors.filter(instructor => instructor.unit === trainee.unit);
    }, [instructors, trainee.unit]);

    // Handle instructor name change (mirror to QFI)
    const handleInstructorNameChange = (value: string) => {
        setAssessment(prev => ({ ...prev, instructorName: value }));
        // Mirror to QFI field
        setCommentFields(prev => ({ ...prev, QFI: value }));
    };

    // Time handling functions for simplified hhmm input
    const formatTimeToHHMM = (timeInHours: number | null | undefined): string => {
        if (timeInHours === null || timeInHours === undefined) return '';
        
        let time = timeInHours;
        if (time >= 24) time -= 24; // Handle next day times
        
        const hours = Math.floor(time);
        const minutes = Math.round((time - hours) * 60);
        
        return `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;
    };

    const handleTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'startTime' | 'endTime') => {
        let value = e.currentTarget.value;
        
        // Remove any non-digit characters
        value = value.replace(/\D/g, '');
        
        // Auto-format as user types
        if (value.length > 4) {
            value = value.substring(0, 4);
        }
        
        // Update the input value display
        e.currentTarget.value = value;
    };

    const handleTimeInputBlur = (field: 'startTime' | 'endTime') => {
        const input = event?.target as HTMLInputElement;
        if (!input) return;
        
        let value = input.value;
        
        if (value.length > 0) {
            // Pad with leading zeros if needed
            const paddedValue = value.padStart(4, '0');
            const num = parseInt(paddedValue);

            if (!isNaN(num) && num >= 0 && num <= 2359 && num % 100 < 60) {
                const hours = Math.floor(num / 100);
                const minutes = num % 100;
                const timeInHours = hours + (minutes / 60);
                
                input.value = paddedValue; // Update display with formatted value
                
                if (field === 'startTime') {
                    const updatedEvent = { ...currentEvent, startTime: timeInHours };
                    setCurrentEvent(updatedEvent);
                    handleEventUpdate(updatedEvent);
                } else {
                    // For end time, calculate duration
                    const currentStartTime = currentEvent.startTime || 0;
                    const newDuration = timeInHours - currentStartTime;
                    if (newDuration > 0) {
                        const updatedEvent = { ...currentEvent, duration: newDuration };
                        setCurrentEvent(updatedEvent);
                        handleEventUpdate(updatedEvent);
                    }
                }
            } else {
                // Invalid format, clear the field
                input.value = '';
                if (field === 'startTime') {
                    const updatedEvent = { ...currentEvent, startTime: null };
                    setCurrentEvent(updatedEvent);
                    handleEventUpdate(updatedEvent);
                }
            }
        }
    };

    const handleTimeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: 'startTime' | 'endTime') => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleTimeInputBlur(field);
            // Move focus to the next field if it's start time
            if (field === 'startTime') {
                const endTimeInput = document.querySelector('input[placeholder="hhmm"]:last-of-type') as HTMLInputElement;
                endTimeInput?.focus();
            }
        }
    };

    const handleOpenPhraseSelector = (element: string) => {
        setCurrentPhraseElement(element);
        setShowPhraseModal(true);
    };

    const handleInsertPhrases = (text: string) => {
        if (currentPhraseElement) {
            setAssessment(prev => ({
                ...prev,
                scores: prev.scores.map(s => s.element === currentPhraseElement ? { ...s, comment: (s.comment ? s.comment + ' ' : '') + text } : s)
            }));
        }
        setShowPhraseModal(false);
        setCurrentPhraseElement(null);
    };

    useEffect(() => {
        if (isInitialCommentHydration.current) {
            isInitialCommentHydration.current = false;
            return;
        }
        const combined = COMMENT_SECTIONS.map(key => `${key}:\n${key === 'Notes' ? buildTrainingReportNotes() : commentFields[key]}`).join('\n\n');
        setAssessment(prev => ({
            ...prev,
            overallComments: combined,
            trainingReportNotes: buildTrainingReportNotes(),
            passNotesToNextEvent,
        }));
    }, [commentFields, dcoResult, dncoFollowUp, dpcoFollowUp, passNotesToNextEvent]);

    const handleSave = async (isAutoSave = false): Promise<boolean> => {
        if (!canEditPt051) {
            if (!isAutoSave) {
                await showDarkAlert(`Your permission profile allows you to view this ${trainingReportName}, but not edit or save it.`, 'Access Denied', 'error');
            }
            return false;
        }
        // System freeze check - read directly from localStorage to avoid stale closure
        const _freezeRaw = localStorage.getItem('systemFreezeState');
        if (_freezeRaw) {
            const _freeze = JSON.parse(_freezeRaw);
            if (_freeze.isFrozen && !_freeze.allowedActions?.pt051Entries) {
                await showDarkAlert(`System is currently frozen. ${trainingReportName} entries are not permitted during a system freeze.`, 'System Frozen', 'error');
                return false;
            }
        }
        // Include timing data from currentEvent in the assessment
        const finalAssessment: Pt051Assessment = {
            ...assessment,
            overallGrade,
            overallResult,
            dcoResult,
            dpcoFollowUp: dcoResult === 'DPCO' ? dpcoFollowUp : undefined,
            dncoFollowUp: dcoResult === 'DNCO' ? dncoFollowUp : undefined,
            passNotesToNextEvent,
            trainingReportNotes: buildTrainingReportNotes(),
            overallComments: COMMENT_SECTIONS.map(key => `${key}:\n${key === 'Notes' ? buildTrainingReportNotes() : commentFields[key]}`).join('\n\n'),
            groundSchoolAssessment,
            // Preserve timing data
            startTime: currentEvent?.startTime,
            duration: currentEvent?.duration,
            endTime: currentEvent ? (currentEvent.startTime || 0) + (currentEvent.duration || 0) : undefined
        };
        pushTrainingReportNotesDiag('pt051:save-payload', {
            traineeFullName: trainee.fullName,
            eventId: finalAssessment.eventId,
            flightNumber: finalAssessment.flightNumber,
            dcoResult: finalAssessment.dcoResult,
            dpcoFollowUp: finalAssessment.dpcoFollowUp || null,
            passNotesToNextEvent: finalAssessment.passNotesToNextEvent === true,
            trainingReportNotesLength: String(finalAssessment.trainingReportNotes || '').trim().length,
            trainingReportNotesPreview: String(finalAssessment.trainingReportNotes || '').trim().slice(0, 160),
            commentNotesLength: String(commentFields.Notes || '').trim().length,
            followUpPrefix: getFollowUpNotesPrefix(),
        });
        
        // Also save the event timing data by calling onEventUpdate
        if (onEventUpdate && currentEvent) {
            onEventUpdate(currentEvent);
        }
        
        try {
            await onSave(finalAssessment, isAutoSave);
            setIsDirty(false);
            setSaveStatus('Saved');
            return true;
        } catch (error) {
            console.error('[PT051] Save failed:', error);
            setSaveStatus('Unsaved');
            return false;
        }
    };

    const handleManualSaveAndExit = async () => {
        const saved = await handleSave(false);
        if (saved) {
            onBack();
        }
    };

    const getEventDescription = () => {
        const eventNum = (event.flightNumber || assessment.flightNumber || '').trim();
        const normaliseCode = (value?: string) => (value || '').replace(/\s+/g, '').toLowerCase();
        const syllabusDetail = syllabusDetails.find(d => {
            const id = (d.id || '').trim();
            const code = (d.code || '').trim();
            return (
                id.toLowerCase() === eventNum.toLowerCase() ||
                code.toLowerCase() === eventNum.toLowerCase() ||
                normaliseCode(id) === normaliseCode(eventNum) ||
                normaliseCode(code) === normaliseCode(eventNum)
            );
        });
        const detail = syllabusDetail as (Partial<SyllabusItemDetail> & { title?: string; description?: string }) | undefined;
        return detail?.eventDescription || detail?.title || detail?.description || 'N/A';
    };

    const handlePrint = async () => {
        try {
            const resolvePrintReportTemplate = async () => {
                const latestConfig = await loadPlatformConfigFromDB();
                if (!latestConfig) return reportTemplate;
                const unitCodes = [
                    trainingReportUnitCode,
                    trainee.unit,
                    trainingReportContextUnitCode,
                ]
                    .flatMap((value) => String(value || '').split('+'))
                    .map((value) => value.trim())
                    .filter(Boolean);
                const uniqueUnitCodes = Array.from(new Set(unitCodes.map((value) => value.toUpperCase())));
                const templates = uniqueUnitCodes.map((unitCode) => getUnitTrainingReportTemplate(latestConfig, unitCode));
                const customTemplate = templates.find((template) => template.displayName !== DEFAULT_TRAINING_REPORT_TEMPLATE.displayName);
                return customTemplate || templates[0] || reportTemplate;
            };
            const printReportTemplate = await resolvePrintReportTemplate();
            const printReportName = printReportTemplate.displayName;
            const printOverviewFields = printReportTemplate.modules.overview.fields;
            const printOverallFields = printReportTemplate.modules.overallAssessment.fields;
            const printCommentFieldsConfig = printReportTemplate.modules.comments.fields;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 14;
            const contentWidth = pageWidth - margin * 2;
            let y = 16;

            const ensureSpace = (requiredHeight: number) => {
                if (y + requiredHeight <= pageHeight - 16) return;
                doc.addPage();
                y = 16;
            };

            const addFooter = () => {
                const pageCount = doc.getNumberOfPages();
                for (let page = 1; page <= pageCount; page += 1) {
                    doc.setPage(page);
                    doc.setFontSize(8);
                    doc.setTextColor(120);
                    doc.text(`Generated ${new Date().toLocaleString()} - Page ${page} of ${pageCount}`, margin, pageHeight - 8);
                }
                doc.setPage(pageCount);
            };

            const addSectionTitle = (title: string) => {
                ensureSpace(12);
                y += 4;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(20, 35, 55);
                doc.text(title, margin, y);
                y += 2;
                doc.setDrawColor(180, 190, 200);
                doc.line(margin, y, pageWidth - margin, y);
                y += 6;
            };

            const addKeyValueRows = (rows: Array<[string, string]>) => {
                doc.setFontSize(9);
                rows.forEach(([label, value]) => {
                    const text = value || 'N/A';
                    const valueLines = doc.splitTextToSize(text, contentWidth - 48);
                    const rowHeight = Math.max(7, valueLines.length * 4 + 2);
                    ensureSpace(rowHeight);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(80);
                    doc.text(label, margin, y);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(20);
                    doc.text(valueLines, margin + 48, y);
                    y += rowHeight;
                });
            };

            const addWrappedText = (label: string, value: string) => {
                const lines = doc.splitTextToSize(value || 'N/A', contentWidth);
                ensureSpace(9 + lines.length * 4);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(80);
                doc.text(label, margin, y);
                y += 5;
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(20);
                doc.text(lines, margin, y);
                y += lines.length * 4 + 4;
            };

            const completionLabel = printReportTemplate.completionResults.find(option => option.code === dcoResult)?.label || dcoResult || 'None';
            const overallResultLabel = overallResult === 'P'
                ? printReportTemplate.overallResults.passLabel
                : overallResult === 'F'
                    ? (showDoubleMarginalWarning ? printReportTemplate.overallResults.doubleRepeatLabel : printReportTemplate.overallResults.failLabel)
                    : 'Not selected';
            const reportDate = assessment.date || currentEvent.date || event.date || '';
            const startTime = currentEvent.startTime ?? event.startTime ?? 0;
            const duration = currentEvent.duration ?? event.duration ?? 0;
            const endTime = startTime + duration;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(17);
            doc.setTextColor(10, 25, 45);
            doc.text(`${printReportName} Training Report`, margin, y);
            y += 8;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(80);
            doc.text(`${assessment.flightNumber || event.flightNumber || 'Event'} - ${trainee.rank || ''} ${trainee.name || trainee.fullName || ''} - ${reportDate}`, margin, y);
            y += 8;

            addSectionTitle(printReportTemplate.modules.overview.title || 'Event Details');
            addKeyValueRows([
                [printOverviewFields.event, assessment.flightNumber || event.flightNumber || 'N/A'],
                [printOverviewFields.type, getEventDescription()],
                ['Trainee', `${trainee.rank || ''} ${trainee.name || trainee.fullName || ''}`.trim()],
                ['Course', trainee.course || 'N/A'],
                [printOverviewFields.date, reportDate || 'N/A'],
                [printOverviewFields.timing, `${formatTime(startTime)} - ${formatTime(endTime)}`],
                [printOverviewFields.assessor, assessment.instructorName || event.instructor || 'N/A'],
                [printOverviewFields.resource, currentEvent.resourceId || event.resourceId || 'N/A'],
                [printOverviewFields.callsign, currentEvent.callsign || event.callsign || 'N/A'],
                [printOverviewFields.unit, trainee.unit || 'N/A'],
            ]);

            addSectionTitle(printReportTemplate.modules.overallAssessment.title || 'Overall Assessment');
            addKeyValueRows([
                [printOverallFields.result, completionLabel],
                [printOverallFields.overallGrade, overallGrade ? formatGradeOption(overallGrade) : 'None'],
                [printOverallFields.overallResult, overallResultLabel],
                [printOverallFields.groundSchoolAssessment, groundSchoolAssessment.isAssessment ? `${groundSchoolAssessment.result ?? 0}%` : 'Not assessed'],
            ]);

            addSectionTitle(printReportTemplate.modules.comments.title || 'Comments');
            addWrappedText(printCommentFieldsConfig.assessor || instructorLabel, commentFields.QFI || 'N/A');
            addWrappedText(printCommentFieldsConfig.weather, commentFields.Weather || 'N/A');
            addWrappedText(printCommentFieldsConfig.profile, commentFields.Profile || 'N/A');
            addWrappedText(printCommentFieldsConfig.overall, commentFields.Overall || 'N/A');
            addWrappedText(printCommentFieldsConfig.nest, commentFields.NEST || 'N/A');

            addSectionTitle('Assessment Matrix');
            assessmentStructure.forEach(category => {
                ensureSpace(12);
                doc.setFillColor(235, 240, 245);
                doc.rect(margin, y - 4, contentWidth, 7, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(25, 40, 60);
                doc.text(category.category, margin + 2, y + 1);
                y += 8;

                category.elements.forEach(element => {
                    const score = assessment.scores.find(item => item.element === element);
                    const gradeText = score?.grade !== null && score?.grade !== undefined ? formatGradeOption(score.grade) : 'Not assessed';
                    const commentText = score?.comment || 'N/A';
                    doc.setFontSize(8.5);
                    doc.setFont('helvetica', 'normal');
                    const gradeLines = doc.splitTextToSize(gradeText, 22);
                    const commentLines = doc.splitTextToSize(commentText, contentWidth - 84);
                    const rowHeight = Math.max(8, gradeLines.length * 4 + 3, commentLines.length * 4 + 3);
                    ensureSpace(rowHeight);

                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(20);
                    doc.text(element, margin + 2, y);
                    doc.setFont('helvetica', 'normal');
                    doc.text(gradeLines, margin + 50, y);
                    doc.text(commentLines, margin + 84, y);
                    y += rowHeight;
                });
                y += 2;
            });

            addFooter();
            const safeName = [
                printReportName,
                assessment.flightNumber || event.flightNumber || 'Training-Report',
                trainee.name || trainee.fullName || 'Person',
                reportDate || new Date().toISOString().slice(0, 10),
            ]
                .join('-')
                .replace(/[^a-z0-9_-]+/gi, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            doc.save(`${safeName}.pdf`);
        } catch (error) {
            console.error('[PT051] PDF export failed:', error);
            await showDarkAlert('The training report PDF could not be created. Please try again or check the console for details.', 'PDF Export Failed', 'error');
        }
    };

    const handleDeleteAssessment = async () => {
        if (!canEditPt051) {
            await showDarkAlert(`Your permission profile does not allow ${trainingReportName} deletion.`, 'Access Denied', 'error');
            return;
        }
        await confirmDeleteAssessment();
    };

    const confirmDeleteAssessment = async () => {
        // Simple confirmation - no PIN required
        const confirmMessage = `Are you sure you want to delete this ${trainingReportName} assessment?\n\nTrainee: ${assessment.traineeFullName}\nDate: ${assessment.date}\nGrade: ${assessment.overallGrade || 'N/A'}\n\nThis action cannot be undone.`;
        
        console.log('🗑️ PT051View: Delete button clicked');
        // Use custom dark confirm modal instead of browser default
        if (await showDarkConfirm(confirmMessage)) {
            console.log('✅ PT051View: User confirmed deletion');
            if (onDeleteAssessment && assessment.id) {
                console.log('🗑️ PT051View: Calling onDeleteAssessment with ID:', assessment.id);
                await onDeleteAssessment(assessment.id);
                onBack();
            } else {
                console.log('❌ PT051View: onDeleteAssessment or assessment.id is missing');
            }
        } else {
            console.log('❌ PT051View: User cancelled deletion');
        }
    };

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (!canEditPt051) return;
        setIsDirty(true);
        setSaveStatus('Saving...');
        const timerId: ReturnType<typeof setTimeout> = setTimeout(() => {
            handleSave(true);
        }, 1000); 
        return () => clearTimeout(timerId);
    }, [assessment, overallGrade, overallResult, dcoResult, dpcoFollowUp, dncoFollowUp, passNotesToNextEvent, commentFields, groundSchoolAssessment, canEditPt051]);

    useEffect(() => {
        registerDirtyCheck(
            () => isDirty,
            () => handleSave(false), 
            () => { setIsDirty(false); } 
        );
    }, [registerDirtyCheck, isDirty, assessment, overallGrade, overallResult, dcoResult, dpcoFollowUp, dncoFollowUp, passNotesToNextEvent, commentFields, groundSchoolAssessment]);

    const gradeHeaderColors: { [key: string]: string } = {
        'MIN': 'bg-red-800/50',
        'DEMO': 'bg-red-950/35 border-red-500/20',
        '0': 'bg-red-950/35 border-red-500/20',
        '1': 'bg-orange-950/35 border-orange-500/20',
        '2': 'bg-amber-950/35 border-amber-500/20',
        '3': 'bg-yellow-950/30 border-yellow-500/20',
        '4': 'bg-lime-950/25 border-lime-500/20',
        '5': 'bg-emerald-950/25 border-emerald-500/20',
    };

    return (
        <div
            className="flex-1 flex flex-col bg-gray-900 overflow-y-auto"
            onKeyDownCapture={stopEditableKeyPropagation}
            style={embeddedInProfile ? ({ zoom: 0.88, width: '100%' } as React.CSSProperties) : undefined}
        >
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={assessment.flightNumber || ''}
                            onChange={(e) => setAssessment(prev => ({ ...prev, flightNumber: e.target.value }))}
                            className="text-2xl font-bold text-white bg-transparent border-b-2 border-gray-600 focus:border-sky-500 outline-none mb-2 w-full"
                            placeholder="Assessment Title"
                        />
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <input
                                type="date"
                                value={assessment.date || currentEvent.date}
                                onChange={(e) => {
                                    const newDate = e.target.value;
                                    setAssessment(prev => ({ ...prev, date: newDate }));
                                    handleEventUpdate({ date: newDate });
                                }}
                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white focus:ring-1 focus:ring-sky-500"
                            />
                            <span>at</span>
                            <input
                                type="text"
                                placeholder="hhmm"
                                value={formatTimeToHHMM(currentEvent.startTime)}
                                onChange={(e) => handleTimeInputChange(e, 'startTime')}
                                onBlur={() => handleTimeInputBlur('startTime')}
                                onKeyDown={(e) => handleTimeInputKeyDown(e, 'startTime')}
                                className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white focus:ring-1 focus:ring-sky-500 text-center font-mono"
                                maxLength="4"
                            />
                            <span>-</span>
                            <input
                                type="text"
                                placeholder="hhmm"
                                value={formatTimeToHHMM((currentEvent.startTime || 0) + (currentEvent.duration || 0))}
                                onChange={(e) => handleTimeInputChange(e, 'endTime')}
                                onBlur={() => handleTimeInputBlur('endTime')}
                                onKeyDown={(e) => handleTimeInputKeyDown(e, 'endTime')}
                                className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white focus:ring-1 focus:ring-sky-500 text-center font-mono"
                                maxLength="4"
                            />
                        </div>
                    </div>
                    <div className="flex items-center px-3 py-1 rounded-full bg-gray-900/50 border border-gray-700">
                        <div className={`w-2 h-2 rounded-full mr-2 ${saveStatus === 'Saved' ? 'bg-green-500' : saveStatus === 'Saving...' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="text-xs text-gray-300 font-mono uppercase">{saveStatus === 'Saved' ? 'All changes saved' : saveStatus}</span>
                    </div>
                </div>
                <div className="flex items-center gap-[1px]">
                    <button onClick={handlePrint} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed">
                        Print
                    </button>
                    {/* Show Edit button if this is a saved assessment */}
                    {initialAssessment && initialAssessment.id && (
                        <button onClick={() => {
                            // Enable editing mode - you could add state to track this
                            console.log('Editing mode enabled for PT-051:', initialAssessment.id);
                        }} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed">
                            Edit
                        </button>
                    )}
                    <button onClick={handleManualSaveAndExit} disabled={!canEditPt051} title={canEditPt051 ? undefined : `Your permission profile does not allow ${trainingReportName} editing`} className={`w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed ${!canEditPt051 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        Save
                    </button>
                    {assessment.id && onDeleteAssessment && canEditPt051 && (
                        <button 
                            onClick={handleDeleteAssessment} 
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed"
                        >
                            Delete
                        </button>
                    )}
                    <button onClick={onBack} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed">
                        Back
                    </button>
                    <AuditButton pageName={`${trainingReportName} Assessment`} />
                </div>
            </div>

            {/* Content */}
            <div className="p-4 md:p-6 w-full max-w-full mx-auto">
                {/* TOP SECTION: Details & Overall Assessment */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <dl className="lg:col-span-1 lg:w-[calc(100%-25px)] space-y-2 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                        <div>
                            <dt className="text-sm font-medium text-gray-400">{overviewFields.event}</dt>
                            <dd className="mt-1 text-sm text-white font-semibold">{event.flightNumber || 'N/A'}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-400">{overviewFields.type}</dt>
                            <dd className="mt-1 text-sm text-white">
                                {(() => {
                                    const eventNum = (event.flightNumber || '').trim();
                                    console.log('🔍 Event Description Debug - Event Number:', eventNum);
                                    console.log('🔍 Event Description Debug - syllabusDetails count:', syllabusDetails.length);
                                    console.log('🔍 Event Description Debug - First 5 syllabus items:', syllabusDetails.slice(0, 5).map(d => ({ id: d.id, code: d.code, title: d.title })));
                                    
                                    // Try multiple matching strategies
                                    let syllabusDetail = syllabusDetails.find(d => {
                                        const id = (d.id || '').trim();
                                        const code = (d.code || '').trim();
                                        // Exact match (case-insensitive)
                                        if (id.toLowerCase() === eventNum.toLowerCase() || code.toLowerCase() === eventNum.toLowerCase()) {
                                            console.log('🔍 Found exact match:', d);
                                            return true;
                                        }
                                        // Match without spaces
                                        if (id.replace(/\s+/g, '').toLowerCase() === eventNum.replace(/\s+/g, '').toLowerCase() ||
                                            code.replace(/\s+/g, '').toLowerCase() === eventNum.replace(/\s+/g, '').toLowerCase()) {
                                            console.log('🔍 Found match without spaces:', d);
                                            return true;
                                        }
                                        return false;
                                    });
                                    
                                    console.log('🔍 Event Description Debug - Found detail:', syllabusDetail);
                                    return syllabusDetail?.eventDescription || syllabusDetail?.title || syllabusDetail?.description || 'N/A';
                                })()}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-400">Trainee</dt>
                            <dd className="mt-1 text-sm text-white font-semibold">{`${trainee.rank} ${trainee.name}`}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-400">Course</dt>
                            <dd className="mt-1 text-sm text-white font-semibold">{trainee.course}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-400">{overviewFields.date}</dt>
                            <dd className="mt-1">
                                <input
                                    type="date"
                                    value={assessment.date || currentEvent.date}
                                    onChange={(e) => {
                                        const newDate = e.target.value;
                                        setAssessment(prev => ({ ...prev, date: newDate }));
                                        handleEventUpdate({ date: newDate });
                                    }}
                                    className="text-sm text-white font-semibold bg-gray-700 border border-gray-600 rounded px-2 py-1 focus:ring-1 focus:ring-sky-500"
                                />
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-400">{overviewFields.timing}</dt>
                            <dd className="mt-1 flex items-center gap-1">
                                <input
                                    type="number"
                                    min="0"
                                    max="23"
                                    step="1"
                                    value={Math.floor(currentEvent.startTime || 0)}
                                    onChange={(e) => {
                                        const newStartTime = parseFloat(e.target.value);
                                        const updatedEvent = { ...currentEvent, startTime: newStartTime + (currentEvent.startTime % 1) };
                                        handleEventUpdate(updatedEvent);
                                    }}
                                    className="w-12 text-sm text-white font-semibold bg-gray-700 border border-gray-600 rounded px-1 py-1 focus:ring-1 focus:ring-sky-500"
                                />
                                <span className="text-white">:</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    step="15"
                                    value={Math.round((currentEvent.startTime % 1) * 60)}
                                    onChange={(e) => {
                                        const minutes = parseInt(e.target.value);
                                        const hours = Math.floor(currentEvent.startTime || 0);
                                        const newStartTime = hours + (minutes / 60);
                                        const updatedEvent = { ...currentEvent, startTime: newStartTime };
                                        handleEventUpdate(updatedEvent);
                                    }}
                                    className="w-12 text-sm text-white font-semibold bg-gray-700 border border-gray-600 rounded px-1 py-1 focus:ring-1 focus:ring-sky-500"
                                />
                                <span className="text-white">-</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="23"
                                    step="1"
                                    value={Math.floor((currentEvent.startTime || 0) + (currentEvent.duration || 0))}
                                    onChange={(e) => {
                                        const endTime = parseFloat(e.target.value);
                                        const currentEndTime = (currentEvent.startTime || 0) + (currentEvent.duration || 0);
                                        const newDuration = currentEvent.duration + (endTime - currentEndTime);
                                        const updatedEvent = { ...currentEvent, duration: newDuration };
                                        handleEventUpdate(updatedEvent);
                                    }}
                                    className="w-12 text-sm text-white font-semibold bg-gray-700 border border-gray-600 rounded px-1 py-1 focus:ring-1 focus:ring-sky-500"
                                />
                                <span className="text-white">:</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    step="15"
                                    value={Math.round(((currentEvent.startTime || 0) + (currentEvent.duration || 0)) % 1 * 60)}
                                    onChange={(e) => {
                                        const minutes = parseInt(e.target.value);
                                        const hours = Math.floor((currentEvent.startTime || 0) + (currentEvent.duration || 0));
                                        const endTime = hours + (minutes / 60);
                                        const newDuration = endTime - (currentEvent.startTime || 0);
                                        const updatedEvent = { ...currentEvent, duration: newDuration };
                                        handleEventUpdate(updatedEvent);
                                    }}
                                    className="w-12 text-sm text-white font-semibold bg-gray-700 border border-gray-600 rounded px-1 py-1 focus:ring-1 focus:ring-sky-500"
                                />
                            </dd>
                        </div>
                         <div className="col-span-2 max-w-[calc(100%-25px)]">
                             <dt className="text-sm font-medium text-gray-400">{overviewFields.assessor}</dt>
                             <dd className="mt-1">
                                 {/* Dropdown for unit instructors only */}
                                 <select
                                     value={assessment.instructorName || ''}
                                     onChange={(e) => handleInstructorNameChange(e.target.value)}
                                     className="text-sm text-white font-semibold bg-gray-700 border border-gray-600 rounded px-2 py-1 w-[calc(100%-25px)] focus:ring-1 focus:ring-sky-500"
                                 >
                                     <option value="">Select instructor...</option>
                                     {unitInstructors.map(instructor => (
                                         <option key={instructor.idNumber} value={instructor.name}>
                                             {instructor.rank} {instructor.name}
                                         </option>
                                     ))}
                                 </select>
                             </dd>
                         </div>
                    </dl>
                    
                    <div className="lg:col-span-2 space-y-4">
                        <div className="relative p-4 border border-gray-600 rounded-lg lg:-ml-[44px] lg:w-[calc(100%+44px)]">
                            <div className="absolute -top-3 left-6 bg-gray-900 px-2 text-sm font-semibold text-gray-300">{reportTemplate.modules.overallAssessment.title}</div>
                            {/* DCO/DPCO/DNCO Radio Buttons - Always available for PT-051 assessments */}
                            <div className="mt-2 mb-4">
                                <div className="grid items-start gap-3 md:grid-cols-[minmax(180px,220px)_minmax(360px,1fr)]">
                                    <div className="min-h-[168px]">
                                        <label className="block text-sm font-medium text-gray-400 mb-2">{overallFields.result}</label>
                                        <div className="flex flex-col space-y-2">
                                        {missionStatusOptions.map((option) => (
                                            <label key={option.code} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700/30 p-1 rounded">
                                                <input
                                                    type="radio"
                                                    name="dco-result"
                                                    value={option.code}
                                                    checked={dcoResult === option.code}
                                                    onChange={(e) => setDcoResult(e.target.value)}
                                                    className="h-4 w-4 accent-sky-500 bg-gray-600 border-gray-500"
                                                />
                                                <span className="text-white font-medium">{option.label}</span>
                                            </label>
                                        ))}
                                        </div>
                                    </div>
                                    {dcoResult === 'DPCO' && (
                                        <div className="-mt-3 rounded-lg border border-sky-500/45 bg-gray-950/60 p-3">
                                            <div className="text-xs font-bold uppercase tracking-wide text-sky-200">DPCO action</div>
                                            <div className="mt-3 space-y-2 text-sm font-semibold text-white">
                                                <label className={`grid cursor-pointer grid-cols-[20px_1fr_78px_36px] items-center gap-2 rounded-md border px-2 py-1.5 transition ${dpcoFollowUp.action === 'extra-event' ? 'border-sky-400/80 bg-sky-500/15' : 'border-gray-700 bg-gray-900/70 hover:border-gray-500'}`}>
                                                    <input
                                                        type="radio"
                                                        name="dpco-follow-up"
                                                        value="extra-event"
                                                        checked={dpcoFollowUp.action === 'extra-event'}
                                                        onChange={() => setDpcoFollowUp(prev => ({ ...prev, action: 'extra-event' }))}
                                                        className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-400"
                                                    />
                                                    <span>Extra {isSimEvent ? 'Sim' : 'Flight'}</span>
                                                    <div className="relative h-8 rounded border border-gray-600 bg-gray-950 focus-within:border-sky-300 focus-within:ring-1 focus-within:ring-sky-300">
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={dpcoFollowUp.extraEventHours ?? ''}
                                                            placeholder="0.0"
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
                                                                setDpcoFollowUp({
                                                                    ...dpcoFollowUp,
                                                                    action: 'extra-event',
                                                                    extraEventHours: value === '' ? undefined : Number(value),
                                                                });
                                                            }}
                                                            onKeyDown={stopEditableKeyPropagation}
                                                            className="h-full w-full rounded bg-transparent py-1 pl-2 pr-6 text-center text-sm font-semibold text-white focus:outline-none"
                                                        />
                                                        <div className="absolute inset-y-0 right-0 flex w-5 flex-col border-l border-gray-700/70 text-[8px] leading-none text-gray-400">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setDpcoFollowUp(prev => ({ ...prev, action: 'extra-event', extraEventHours: Number((Number(prev.extraEventHours || 0) + 0.1).toFixed(1)) }));
                                                                }}
                                                                className="flex flex-1 items-center justify-center rounded-tr hover:bg-gray-800 hover:text-gray-200"
                                                            >
                                                                ▲
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setDpcoFollowUp(prev => ({ ...prev, action: 'extra-event', extraEventHours: Number(Math.max(0, Number(prev.extraEventHours || 0) - 0.1).toFixed(1)) }));
                                                                }}
                                                                className="flex flex-1 items-center justify-center rounded-br hover:bg-gray-800 hover:text-gray-200"
                                                            >
                                                                ▼
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-bold uppercase text-gray-400">hrs</span>
                                                </label>
                                                <label className={`grid cursor-pointer grid-cols-[20px_1fr_78px_36px] items-center gap-2 rounded-md border px-2 py-1.5 transition ${dpcoFollowUp.action === 'extra-hours-next-event' ? 'border-sky-400/80 bg-sky-500/15' : 'border-gray-700 bg-gray-900/70 hover:border-gray-500'}`}>
                                                    <input
                                                        type="radio"
                                                        name="dpco-follow-up"
                                                        value="extra-hours-next-event"
                                                        checked={dpcoFollowUp.action === 'extra-hours-next-event'}
                                                        onChange={() => setDpcoFollowUp(prev => ({ ...prev, action: 'extra-hours-next-event' }))}
                                                        className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-400"
                                                    />
                                                    <span>Extend next event</span>
                                                    <div className="relative h-8 rounded border border-gray-600 bg-gray-950 focus-within:border-sky-300 focus-within:ring-1 focus-within:ring-sky-300">
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={dpcoFollowUp.extraHours ?? ''}
                                                            placeholder="0.0"
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
                                                                setDpcoFollowUp({
                                                                    ...dpcoFollowUp,
                                                                    action: 'extra-hours-next-event',
                                                                    extraHours: value === '' ? undefined : Number(value),
                                                                });
                                                            }}
                                                            onKeyDown={stopEditableKeyPropagation}
                                                            className="h-full w-full rounded bg-transparent py-1 pl-2 pr-6 text-center text-sm font-semibold text-white focus:outline-none"
                                                        />
                                                        <div className="absolute inset-y-0 right-0 flex w-5 flex-col border-l border-gray-700/70 text-[8px] leading-none text-gray-400">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setDpcoFollowUp(prev => ({ ...prev, action: 'extra-hours-next-event', extraHours: Number((Number(prev.extraHours || 0) + 0.1).toFixed(1)) }));
                                                                }}
                                                                className="flex flex-1 items-center justify-center rounded-tr hover:bg-gray-800 hover:text-gray-200"
                                                            >
                                                                ▲
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setDpcoFollowUp(prev => ({ ...prev, action: 'extra-hours-next-event', extraHours: Number(Math.max(0, Number(prev.extraHours || 0) - 0.1).toFixed(1)) }));
                                                                }}
                                                                className="flex flex-1 items-center justify-center rounded-br hover:bg-gray-800 hover:text-gray-200"
                                                            >
                                                                ▼
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-bold uppercase text-gray-400">hrs</span>
                                                </label>
                                                <label className={`grid cursor-pointer grid-cols-[20px_1fr] items-center gap-2 rounded-md border px-2 py-1.5 transition ${dpcoFollowUp.action === 'continue-no-additions' ? 'border-sky-400/80 bg-sky-500/15' : 'border-gray-700 bg-gray-900/70 hover:border-gray-500'}`}>
                                                    <input
                                                        type="radio"
                                                        name="dpco-follow-up"
                                                        value="continue-no-additions"
                                                        checked={dpcoFollowUp.action === 'continue-no-additions'}
                                                        onChange={() => setDpcoFollowUp(prev => ({ ...prev, action: 'continue-no-additions' }))}
                                                        className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-400"
                                                    />
                                                    <span>Continue - no additions</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                    {dcoResult === 'DNCO' && (
                                        <div className="-mt-3 rounded-lg border border-sky-500/45 bg-gray-950/60 p-3">
                                            <div className="text-xs font-bold uppercase tracking-wide text-sky-200">DNCO action</div>
                                            <div className="mt-3 space-y-2 text-sm font-semibold text-white">
                                                <label className={`grid cursor-pointer grid-cols-[20px_1fr] items-center gap-2 rounded-md border px-2 py-1.5 transition ${dncoFollowUp.requestExtraFlight ? 'border-sky-400/80 bg-sky-500/15' : 'border-gray-700 bg-gray-900/70 hover:border-gray-500'}`}>
                                                    <input
                                                        type="radio"
                                                        name="dnco-follow-up"
                                                        value="request-extra-flight"
                                                        checked={dncoFollowUp.requestExtraFlight}
                                                        onChange={() => setDncoFollowUp({ requestExtraFlight: true })}
                                                        className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-400"
                                                    />
                                                    <span>Request extra flight</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                             <div className="mt-2 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400">{overallFields.overallGrade}</label>
                                    <div className="mt-1 flex flex-wrap gap-2 rounded bg-gray-950/45 p-2">
                                        {overallGradeOptions.map(grade => (
                                            <label
                                                key={grade}
                                                title={formatGradeOption(grade)}
                                                className={`relative flex ${reportTemplate.grades.showNumbers ? 'justify-between py-2' : 'justify-start pb-2 pt-[15px]'} h-[75px] w-[82px] cursor-pointer flex-col items-center rounded border px-1 text-center transition ${
                                                    overallGrade === grade
                                                        ? 'border-sky-400 bg-sky-500/15 text-white'
                                                        : 'border-gray-700 bg-gray-900/80 text-gray-300 hover:border-gray-500'
                                                }`}
                                            >
                                                {reportTemplate.grades.showNumbers && (
                                                    grade !== 'No Grade' ? (
                                                        <span className="text-[11px] font-black uppercase leading-none text-white">{formatGradeValue(grade)}</span>
                                                    ) : (
                                                        <span aria-hidden="true" className="text-[11px] font-black uppercase leading-none text-white opacity-0">0</span>
                                                    )
                                                )}
                                                <span className={`flex max-w-full flex-col items-center whitespace-nowrap text-[8px] font-semibold uppercase leading-[0.95] text-gray-300 ${grade === 'No Grade' && reportTemplate.grades.showNumbers ? '-translate-y-2' : ''}`}>
                                                    {formatOverallGradeTileText(grade).split(/\s+/).map((word, index) => (
                                                        <span key={`${word}-${index}`}>{word}</span>
                                                    ))}
                                                </span>
                                                <input type="radio" name="overall-grade" value={grade} checked={overallGrade === grade} onChange={() => setOverallGrade(grade)} className={`h-4 w-4 ${!reportTemplate.grades.showNumbers ? 'absolute bottom-[15px]' : ''} ${getOverallRadioAccentColor(grade)} bg-gray-600`} />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">{overallFields.overallResult}</label>
                                    <div className="mt-1 flex space-x-4">
                                        <label className={`cursor-pointer rounded-lg p-4 w-1/2 text-center transition-all duration-200 ${
                                            overallResult === 'P'
                                                ? 'bg-green-600 text-white ring-2 ring-white scale-105 shadow-lg'
                                                : 'bg-green-800/50 text-green-200 hover:bg-green-700/50'
                                        } ${overallResult === null ? '!bg-gray-700 !text-gray-500 hover:!bg-gray-600' : ''}`}>
                                            <input type="radio" name="overall-result" value="P" checked={overallResult === 'P'} onChange={() => setOverallResult('P')} className="sr-only" />
                                            <span className="text-2xl font-bold">{reportTemplate.overallResults.passLabel}</span>
                                        </label>
                                        <label className={`cursor-pointer rounded-lg p-4 w-1/2 text-center transition-all duration-200 ${
                                            overallResult === 'F' || showDoubleMarginalWarning
                                                ? 'bg-red-600 text-white ring-2 ring-white scale-105 shadow-lg'
                                                : 'bg-red-800/50 text-red-200 hover:bg-red-700/50'
                                        } ${overallResult === null && !showDoubleMarginalWarning ? '!bg-gray-700 !text-gray-500 hover:!bg-gray-600' : ''}`}>
                                            <input type="radio" name="overall-result" value="F" checked={overallResult === 'F'} onChange={() => setOverallResult('F')} className="sr-only" />
                                            <span className="text-2xl font-bold">{showDoubleMarginalWarning ? reportTemplate.overallResults.doubleRepeatLabel : reportTemplate.overallResults.failLabel}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            {/* Ground School Assessment */}
                            <div className="mt-4 pt-4 border-t border-gray-600">
                                <label className="block text-sm font-medium text-gray-400 mb-2">{overallFields.groundSchoolAssessment}</label>
                                <div className="flex items-center space-x-3">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={groundSchoolAssessment.isAssessment}
                                            onChange={(e) => setGroundSchoolAssessment({
                                                ...groundSchoolAssessment,
                                                isAssessment: e.target.checked,
                                                result: e.target.checked ? groundSchoolAssessment.result || 0 : undefined
                                            })}
                                            className="h-4 w-4 accent-sky-500 bg-gray-600 border-gray-500 rounded"
                                        />
                                        <span className="text-xs font-medium text-gray-300">Assessment</span>
                                    </label>
                                    <div className="flex items-center space-x-1">
                                        <label className="text-xs font-medium text-gray-400">{overallFields.result}:</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={groundSchoolAssessment.isAssessment ? (groundSchoolAssessment.result ?? '') : ''}
                                                onChange={(e) => {
                                                    const value = parseInt(e.target.value) || 0;
                                                    setGroundSchoolAssessment({
                                                        ...groundSchoolAssessment,
                                                        result: Math.min(100, Math.max(0, value))
                                                    });
                                                }}
                                                disabled={!groundSchoolAssessment.isAssessment}
                                                className={`w-16 px-2 py-1 rounded-md text-center font-semibold text-xs
                                                    ${groundSchoolAssessment.isAssessment
                                                        ? 'bg-gray-700 text-white border-gray-600 focus:ring-2 focus:ring-sky-500'
                                                        : 'bg-gray-600/50 text-gray-500 cursor-not-allowed border-gray-600'
                                                    } border`}
                                                placeholder="%"
                                            />
                                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {showDoubleMarginalWarning && (
                            <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-sm text-red-300">
                                <strong>Warning:</strong> This grade matches the configured repeat rule for this training report. A review may be required.
                            </div>
                        )}
                    </div>
                </div>

                {/* MIDDLE SECTION: Comment Fields */}
                <div className="space-y-6 mb-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(180px,0.85fr)_minmax(360px,1.7fr)_120px]">
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-400">{commentFieldsConfig.assessor || instructorLabel}</label>
                            <div className="mt-1">
                                {/* Dropdown for unit instructors only */}
                                <select
                                    value={commentFields['QFI'] || ''}
                                    onChange={(e) => handleCommentFieldChange('QFI', e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                                >
                                    <option value="">Select instructor...</option>
                                    {unitInstructors.map(instructor => (
                                        <option key={instructor.idNumber} value={instructor.name}>
                                            {instructor.rank} {instructor.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-400">{commentFieldsConfig.weather}</label>
                            <textarea
                                value={commentFields['Weather']}
                                onChange={(e) => handleCommentFieldChange('Weather', e.target.value)}
                                rows={1}
                                className="mt-1 w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 resize-none overflow-hidden"
                                style={{ minHeight: '42px' }}
                                onInput={(e) => {
                                    e.currentTarget.style.height = 'auto';
                                    e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                }}
                                ref={(el) => {
                                    if (el) {
                                        el.style.height = 'auto';
                                        el.style.height = el.scrollHeight + 'px';
                                    }
                                }}
                            />
                        </div>
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-400">{commentFieldsConfig.nest}</label>
                             <input
                                type="text"
                                value={commentFields['NEST']}
                                onChange={(e) => handleCommentFieldChange('NEST', e.target.value)}
                                maxLength={8}
                                className="mt-1 w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div key={'Profile'} className="relative">
                            <label className="block text-sm font-medium text-gray-400">{commentFieldsConfig.profile}</label>
                            <textarea
                                value={commentFields['Profile']}
                                onChange={(e) => handleCommentFieldChange('Profile', e.target.value)}
                                rows={4}
                                className="mt-1 w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 resize-none overflow-hidden"
                                style={{ minHeight: '100px' }}
                                onInput={(e) => {
                                    e.currentTarget.style.height = 'auto';
                                    e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                }}
                                ref={(el) => {
                                    if (el) {
                                        el.style.height = 'auto';
                                        el.style.height = el.scrollHeight + 'px';
                                    }
                                }}
                            />
                        </div>
                         <div key={'Overall'} className="relative">
                            <label className="block text-sm font-medium text-gray-400">{commentFieldsConfig.overall}</label>
                            <textarea
                                value={commentFields['Overall']}
                                onChange={(e) => handleCommentFieldChange('Overall', e.target.value)}
                                rows={6}
                                className="mt-1 w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 resize-none overflow-hidden"
                                style={{ minHeight: '150px' }}
                                onInput={(e) => {
                                    e.currentTarget.style.height = 'auto';
                                    e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                }}
                                ref={(el) => {
                                    if (el) {
                                        el.style.height = 'auto';
                                        el.style.height = el.scrollHeight + 'px';
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
                
                {/* BOTTOM SECTION - GRADING */}
                <div className="space-y-4">
                    {assessmentStructure.map(category => {
                        const isGroundEvent = event.type === 'ground';
                        return (
                        <fieldset key={category.category} className={`p-4 border rounded-lg ${isGroundEvent ? 'border-gray-800 bg-gray-800/30 opacity-50' : 'border-gray-700'}`}>
                            <legend className={`px-2 text-sm font-semibold ${isGroundEvent ? 'text-gray-500' : 'text-gray-300'}`}>{category.category}</legend>
                            <div className="mt-2 overflow-x-auto rounded-md border border-gray-800/80">
                            <table className="min-w-[1200px] w-full table-fixed border-collapse">
                                <colgroup>
                                    <col className="w-[190px]" />
                                    {assessmentGradeOptions.map(g => <col key={String(g)} className="w-[40px]" />)}
                                    <col className="w-[480px]" />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th className="px-2 pb-2 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">Element</th>
                                        {assessmentGradeOptions.map(g => (
                                            <th
                                                key={String(g)}
                                                title={formatGradeOption(g)}
                                                className="relative h-[98px] px-0 pb-2 text-center align-bottom text-[9px] font-black uppercase leading-[0.95] text-gray-400"
                                            >
                                                <span className="absolute bottom-2 left-1/2 flex w-[76px] origin-bottom-left -rotate-90 flex-row items-center justify-start gap-1 whitespace-nowrap">
                                                    {formatGradeHeaderText(g).split(/\s+/).map((word, index) => (
                                                        <span key={`${word}-${index}`}>{word}</span>
                                                    ))}
                                                </span>
                                            </th>
                                        ))}
                                        <th className="h-[98px] px-2 pb-2 text-left align-bottom text-[10px] font-bold uppercase tracking-wide text-gray-500">Comments</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {category.elements.map(element => {
                                        const score = assessment.scores.find(s => s.element === element);
                                        const commentCell = () => (
                                            <td className="relative py-3 pl-3 pr-2 align-middle">
                                                <textarea
                                                    value={score?.comment || ''}
                                                    onChange={(e) => handleCommentChange(element, e.target.value)}
                                                    rows={1}
                                                    placeholder="Comments..."
                                                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 pr-8 text-sm text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 resize-none overflow-hidden"
                                                    style={{ minHeight: '42px' }}
                                                    onInput={(e) => {
                                                        e.currentTarget.style.height = 'auto';
                                                        e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                                    }}
                                                    ref={(el) => {
                                                        if (el) {
                                                            el.style.height = 'auto';
                                                            el.style.height = el.scrollHeight + 'px';
                                                        }
                                                    }}
                                                />
                                                <button
                                                  onClick={() => handleOpenPhraseSelector(element)}
                                                  className="absolute top-4 right-2 text-gray-400 hover:text-sky-400 p-1"
                                                  title="Insert from Phrase Bank"
                                                >
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h.01a1 1 0 100-2H10zm3 0a1 1 0 000 2h.01a1 1 0 100-2H13z" clipRule="evenodd" />
                                                  </svg>
                                                </button>
                                            </td>
                                        );
                                        return (
                                            <tr key={element} className="border-t border-gray-700">
                                                <td className="py-3 pr-3 align-middle font-semibold text-white">{element}</td>
                                                {assessmentGradeOptions.map(grade => (
                                                    <td key={String(grade)} title={formatGradeOption(grade)} className={`border-l border-gray-800 px-0.5 py-3 text-center align-middle ${gradeHeaderColors[String(grade)] || 'border-gray-800'}`}>
                                                        <label className={`flex min-h-[36px] items-center justify-center rounded ${isGroundEvent ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-white/5'}`}>
                                                            <span className="flex flex-col items-center justify-center gap-1">
                                                                <input
                                                                    type="radio"
                                                                    name={element}
                                                                    value={String(grade)}
                                                                    checked={score?.grade === grade}
                                                                    onChange={() => handleGradeChange(element, grade as Pt051Grade)}
                                                                    disabled={isGroundEvent}
                                                                    className={`h-4 w-4 ${getRadioAccentColor(grade)} bg-gray-700 border-gray-600 focus:ring-sky-500 focus:ring-2 ${isGroundEvent ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                />
                                                                {reportTemplate.grades.showNumbers && (
                                                                    <span className="text-[9px] font-bold leading-none text-gray-500">{formatGradeNumber(grade)}</span>
                                                                )}
                                                            </span>
                                                        </label>
                                                    </td>
                                                ))}
                                                {commentCell()}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            </div>
                        </fieldset>
                        );
                    })}
                    <fieldset className="p-4 border border-gray-700 rounded-lg">
                        <legend className="px-2 text-sm font-semibold text-gray-300">{commentFieldsConfig.notes || 'Notes'}</legend>
                        <div className="space-y-3">
                            {forwardedPreFlightNotes && (
                                <div className="rounded border border-gray-700 bg-gray-950/45 p-3">
                                    <div className="text-xs font-semibold text-red-300 underline decoration-red-300 underline-offset-4">Pre-flight Notes</div>
                                    <div className="mt-2 whitespace-pre-wrap text-sm text-gray-100">{forwardedPreFlightNotes}</div>
                                </div>
                            )}
                            <textarea
                                value={buildTrainingReportNotes()}
                                onChange={(e) => handleCommentFieldChange('Notes', e.target.value)}
                                onKeyDownCapture={stopEditableKeyPropagation}
                                onKeyDown={stopEditableKeyPropagation}
                                rows={5}
                                className="w-full resize-y rounded border border-gray-600 bg-gray-800 p-3 text-sm text-gray-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                placeholder="Record what was missed, not completed, or should be carried into the next event."
                            />
                            <div className="flex flex-wrap gap-3 text-sm font-semibold">
                                <label className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 ${passNotesToNextEvent ? 'border-sky-400/80 bg-sky-500/15 text-white' : 'border-gray-700 bg-gray-900/70 text-gray-300 hover:border-gray-500'}`}>
                                    <input
                                        type="radio"
                                        name="pt051-pass-notes"
                                        checked={passNotesToNextEvent}
                                        onChange={() => setPassNotesToNextEvent(true)}
                                        className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-400"
                                    />
                                    <span>Pass notes to next {isSimulatorReportEvent ? 'simulator' : 'flight'} event</span>
                                </label>
                                <label className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 ${!passNotesToNextEvent ? 'border-sky-400/80 bg-sky-500/15 text-white' : 'border-gray-700 bg-gray-900/70 text-gray-300 hover:border-gray-500'}`}>
                                    <input
                                        type="radio"
                                        name="pt051-pass-notes"
                                        checked={!passNotesToNextEvent}
                                        onChange={() => setPassNotesToNextEvent(false)}
                                        className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-400"
                                    />
                                    <span>Keep notes on this report only</span>
                                </label>
                            </div>
                        </div>
                    </fieldset>
                </div>
            </div>
            {showPhraseModal && currentPhraseElement && (
                <PhraseSelector 
                    element={currentPhraseElement}
                    onClose={() => setShowPhraseModal(false)}
                    onInsert={handleInsertPhrases}
                    phraseBank={phraseBank}
                />
            )}

        </div>
    );
};

export default PT051View;
