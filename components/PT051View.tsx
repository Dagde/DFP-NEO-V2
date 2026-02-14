import React, { useState, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Trainee, ScheduleEvent, Pt051Assessment, Pt051Grade, Instructor, Pt051OverallGrade, Score, SyllabusItemDetail, PhraseBank } from '../types';
import AuditButton from './AuditButton';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { showDarkConfirm } from './DarkMessageModal';

interface PT051ViewProps {
    trainee: Trainee;
    event: ScheduleEvent;
    onBack: () => void;
    onSave: (assessment: Pt051Assessment, isAutoSave?: boolean) => void;
    onDeleteAssessment?: (assessmentId: string) => void;
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
const GRADES: (Pt051Grade | 'MIN' | 'DEMO')[] = ['DEMO', 0, 1, 2, 3, 4, 5];
const OVERALL_GRADES: (Pt051OverallGrade)[] = ['No Grade', 0, 1, 2, 3, 4, 5];
const COMMENT_SECTIONS = ['QFI', 'Weather', 'Profile', 'Overall', 'NEST'] as const;

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
    const defaults = { QFI: '', Weather: '', Profile: '', Overall: '', NEST: '' };
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

// Base64 encoder for AudioBuffer
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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

// FIX: Moved GoogleGenAI instance creation outside the component to prevent re-initialization on re-renders.
// Only initialize if API key is available
const ai = import.meta.env.VITE_GEMINI_API_KEY 
  ? new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY }) 
  : null;

const PT051View: React.FC<PT051ViewProps> = ({ trainee, event, onBack, onSave, onDeleteAssessment, onEventUpdate, initialAssessment, instructors, pt051Assessments, events, lmpScores, syllabusDetails, registerDirtyCheck, phraseBank, currentUserPin }) => {
    const [showDoubleMarginalWarning, setShowDoubleMarginalWarning] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving...' | 'Unsaved'>('Saved');
    const isFirstRender = useRef(true);

    // --- Speech to Text State & Refs ---
    const [listeningField, setListeningField] = useState<string | null>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

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
            scores: ALL_ELEMENTS.map(element => ({
                element,
                grade: null,
                comment: ''
            })),
            overallGrade: null,
            overallResult: null,
            groundSchoolAssessment: { isAssessment: false, result: undefined },
        } as Pt051Assessment;
    });

    const handleEventUpdate = (updates: Partial<ScheduleEvent>) => {
        const updatedEvent = { ...currentEvent, ...updates };
        setCurrentEvent(updatedEvent);
        if (onEventUpdate) {
            onEventUpdate(updatedEvent);
        }
    };

    const [commentFields, setCommentFields] = useState(() => {
        const parsed = parseComments(initialAssessment?.overallComments);
        if (!parsed.QFI && event.instructor) {
            parsed.QFI = event.instructor;
        }
        return parsed;
    });
    
    const [overallGrade, setOverallGrade] = useState<Pt051OverallGrade | null>(initialAssessment?.overallGrade || null);
    const [overallResult, setOverallResult] = useState<'P' | 'F' | null>(initialAssessment?.overallResult || null);
    const [groundSchoolAssessment, setGroundSchoolAssessment] = useState(
        initialAssessment?.groundSchoolAssessment || { isAssessment: false, result: undefined }
    );
    const [dcoResult, setDcoResult] = useState<'DCO' | 'DPCO' | 'DNCO' | ''>(initialAssessment?.dcoResult || '');
    
    const previousPerformance = useMemo(() => {
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
        const past = history.filter(h => h.timestamp < currentEventTime);
        return past.length > 0 ? past[0] : null;
    }, [lmpScores, pt051Assessments, trainee.fullName, syllabusDetails, event.date, event.id]);

    useEffect(() => {
        if (overallGrade === 1 && previousPerformance && Number(previousPerformance.score) === 1) {
            setShowDoubleMarginalWarning(true);
            // Automatically set overall result to FAIL (F) on double marginal
            setOverallResult('F');
        } else {
            setShowDoubleMarginalWarning(false);
            // Don't automatically reset the result when double marginal is cleared
            // Let the user decide or keep the current automatic logic
        }
    }, [overallGrade, previousPerformance]);

    useEffect(() => {
        if (overallGrade === 'No Grade' || overallGrade === null) {
            setOverallResult(null);
        } else if (overallGrade === 0) {
            setOverallResult('F');
        } else if (overallGrade >= 1 && overallGrade <= 5) {
            setOverallResult('P');
        }
    }, [overallGrade]);

    const handleGradeChange = (element: string, grade: Pt051Grade | 'MIN' | 'DEMO') => {
        setAssessment(prev => ({
            ...prev,
            scores: prev.scores.map(s => s.element === element ? { ...s, grade } : s)
        }));
    };

    const handleCommentChange = (element: string, comment: string) => {
        setAssessment(prev => ({
            ...prev,
            scores: prev.scores.map(s => s.element === element ? { ...s, comment } : s)
        }));
    };

    const handleCommentFieldChange = (key: typeof COMMENT_SECTIONS[number], value: string) => {
        setCommentFields(prev => ({ ...prev, [key]: value }));
        
        // Mirror QFI field to instructorName field
        if (key === 'QFI') {
            setAssessment(prev => ({ ...prev, instructorName: value }));
        }
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

    const stopVoiceInput = () => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setListeningField(null);
    };

    const handleVoiceInput = async (target: string, type: 'section' | 'element') => {
        if (listeningField === target) {
            stopVoiceInput();
            return;
        }
        if (listeningField) {
            stopVoiceInput();
        }
        setListeningField(target);

        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = audioCtx;

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const source = audioCtx.createMediaStreamSource(stream);
            sourceRef.current = source;

            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            if (!ai) {
                console.error('Gemini API key not configured');
                setIsRecording(false);
                return;
            }

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO], 
                    inputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => console.log('Gemini Live Connected'),
                    onmessage: (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            if (text) {
                                if (type === 'section') {
                                    const sectionKey = target as typeof COMMENT_SECTIONS[number];
                                    setCommentFields(prev => ({
                                        ...prev,
                                        [sectionKey]: (prev[sectionKey] || '') + text
                                    }));
                                } else {
                                    handleCommentChange(target, (assessment.scores.find(s => s.element === target)?.comment || '') + text);
                                }
                            }
                        }
                    },
                    onclose: () => { if (listeningField === target) stopVoiceInput(); },
                    onerror: () => stopVoiceInput()
                }
            });
            sessionPromiseRef.current = sessionPromise;

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                // FIX: Use sessionPromise.then() within the audio process callback to ensure the session is ready and to prevent stale closures.
                if (sessionPromiseRef.current) {
                    sessionPromiseRef.current.then(session => {
                        if (session) {
                             session.sendRealtimeInput({ media: pcmBlob });
                        }
                    });
                }
            };

            source.connect(processor);
            processor.connect(audioCtx.destination);

        } catch (error) {
            console.error("Failed to start voice input:", error);
            stopVoiceInput();
        }
    };

    function createBlob(data: Float32Array) {
        const l = data.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            int16[i] = data[i] * 32768;
        }
        return {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
        };
    }

    useEffect(() => {
        return () => {
            stopVoiceInput();
        };
    }, []);

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
        const combined = COMMENT_SECTIONS.map(key => `${key}:\n${commentFields[key]}`).join('\n\n');
        setAssessment(prev => ({
            ...prev,
            overallComments: combined
        }));
    }, [commentFields]);

    const handleSave = (isAutoSave = false) => {
        // Include timing data from currentEvent in the assessment
        const finalAssessment: Pt051Assessment = {
            ...assessment,
            overallGrade,
            overallResult,
            dcoResult,
            groundSchoolAssessment,
            // Preserve timing data
            startTime: currentEvent?.startTime,
            duration: currentEvent?.duration,
            endTime: currentEvent ? (currentEvent.startTime || 0) + (currentEvent.duration || 0) : undefined
        };
        
        // Also save the event timing data by calling onEventUpdate
        if (onEventUpdate && currentEvent) {
            onEventUpdate(currentEvent);
        }
        
        onSave(finalAssessment, isAutoSave);
        setIsDirty(false);
        setSaveStatus('Saved');
    };

    const handleManualSaveAndExit = () => {
        handleSave(false);
        onBack();
    };

    const handleDeleteAssessment = async () => {
        await confirmDeleteAssessment();
    };

    const confirmDeleteAssessment = async () => {
        // Simple confirmation - no PIN required
        const confirmMessage = `Are you sure you want to delete this PT-051 assessment?\n\nTrainee: ${assessment.traineeFullName}\nDate: ${assessment.date}\nGrade: ${assessment.overallGrade || 'N/A'}\n\nThis action cannot be undone.`;
        
        console.log('🗑️ PT051View: Delete button clicked');
        // Use custom dark confirm modal instead of browser default
        if (await showDarkConfirm(confirmMessage)) {
            console.log('✅ PT051View: User confirmed deletion');
            if (onDeleteAssessment && assessment.id) {
                console.log('🗑️ PT051View: Calling onDeleteAssessment with ID:', assessment.id);
                onDeleteAssessment(assessment.id);
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
        setIsDirty(true);
        setSaveStatus('Saving...');
        const timerId: ReturnType<typeof setTimeout> = setTimeout(() => {
            handleSave(true); 
        }, 1000); 
        return () => clearTimeout(timerId);
    }, [assessment, overallGrade, overallResult, dcoResult, groundSchoolAssessment]);

    useEffect(() => {
        registerDirtyCheck(
            () => isDirty,
            () => handleSave(false), 
            () => { setIsDirty(false); } 
        );
    }, [registerDirtyCheck, isDirty, assessment, overallGrade, overallResult, dcoResult, groundSchoolAssessment]);

    const gradeHeaderColors: { [key: string]: string } = {
        'MIN': 'bg-red-800/50',
        'DEMO': 'bg-red-700/50',
        '0': 'bg-orange-800/50',
        '1': 'bg-orange-700/50',
        '2': 'bg-yellow-800/50',
        '3': 'bg-yellow-700/50',
        '4': 'bg-green-800/50',
        '5': 'bg-green-700/50',
    };

    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-y-auto">
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
                <div className="flex items-center gap-4">
                    {/* Show Edit button if this is a saved assessment */}
                    {initialAssessment && initialAssessment.id && (
                        <button onClick={() => {
                            // Enable editing mode - you could add state to track this
                            console.log('Editing mode enabled for PT-051:', initialAssessment.id);
                        }} className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-sm font-semibold shadow-md">
                            ✏️ Edit Assessment
                        </button>
                    )}
                    <button onClick={handleManualSaveAndExit} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold shadow-md">
                        Save & Exit
                    </button>
                    {assessment.id && onDeleteAssessment && (
                        <button 
                            onClick={handleDeleteAssessment} 
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-semibold shadow-md"
                        >
                            🗑️ Delete Assessment
                        </button>
                    )}
                    <button onClick={onBack} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md">
                        &larr; Back to Summary
                       <AuditButton pageName="PT-051 Assessment" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 md:p-6 w-full max-w-full mx-auto">
                {/* TOP SECTION: Details & Overall Assessment */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <dl className="lg:col-span-1 space-y-2 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                        <div>
                            <dt className="text-sm font-medium text-gray-400">Event Number</dt>
                            <dd className="mt-1 text-sm text-white font-semibold">{event.flightNumber || 'N/A'}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-400">Event Description</dt>
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
                            <dt className="text-sm font-medium text-gray-400">Date</dt>
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
                            <dt className="text-sm font-medium text-gray-400">Time</dt>
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
                         <div className="col-span-2">
                             <dt className="text-sm font-medium text-gray-400">Instructor</dt>
                             <dd className="mt-1">
                                 {/* Dropdown for unit instructors only */}
                                 <select
                                     value={assessment.instructorName || ''}
                                     onChange={(e) => handleInstructorNameChange(e.target.value)}
                                     className="text-sm text-white font-semibold bg-gray-700 border border-gray-600 rounded px-2 py-1 w-full focus:ring-1 focus:ring-sky-500"
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
                        <fieldset className="p-4 border border-gray-600 rounded-lg">
                            <legend className="px-2 text-sm font-semibold text-gray-300">Overall Assessment</legend>
                            {/* DCO/DPCO/DNCO Radio Buttons - Always available for PT-051 assessments */}
                            <div className="mt-2 mb-4">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Result</label>
                                <div className="flex flex-col space-y-2">
                                    {['DCO', 'DPCO', 'DNCO'].map((value) => (
                                        <label key={value} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700/30 p-1 rounded">
                                            <input
                                                type="radio"
                                                name="dco-result"
                                                value={value}
                                                checked={dcoResult === value}
                                                onChange={(e) => setDcoResult(e.target.value as any)}
                                                className="h-4 w-4 accent-sky-500 bg-gray-600 border-gray-500"
                                            />
                                            <span className="text-white font-medium">{value}</span>
                                        </label>
                                    ))}
                                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700/30 p-1 rounded">
                                        <input
                                            type="radio"
                                            name="dco-result"
                                            value=""
                                            checked={dcoResult === ''}
                                            onChange={(e) => setDcoResult(e.target.value as any)}
                                            className="h-4 w-4 accent-sky-500 bg-gray-600 border-gray-500"
                                        />
                                        <span className="text-gray-400 font-medium">None</span>
                                    </label>
                                </div>
                            </div>
                             <div className="mt-2 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400">Overall Grade</label>
                                    <div className="mt-1 flex justify-around p-2 bg-gray-700/50 rounded">
                                        {OVERALL_GRADES.map(grade => (
                                            <label key={grade} className="flex flex-col items-center space-y-1 text-xs text-gray-300 cursor-pointer">
                                                <span>{grade}</span>
                                                <input type="radio" name="overall-grade" value={grade} checked={overallGrade === grade} onChange={() => setOverallGrade(grade)} className={`h-4 w-4 ${getOverallRadioAccentColor(grade)} bg-gray-600`} />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Overall Result</label>
                                    <div className="mt-1 flex space-x-4">
                                        <label className={`cursor-pointer rounded-lg p-4 w-1/2 text-center transition-all duration-200 ${
                                            overallResult === 'P'
                                                ? 'bg-green-600 text-white ring-2 ring-white scale-105 shadow-lg'
                                                : 'bg-green-800/50 text-green-200 hover:bg-green-700/50'
                                        } ${overallResult === null ? '!bg-gray-700 !text-gray-500 hover:!bg-gray-600' : ''}`}>
                                            <input type="radio" name="overall-result" value="P" checked={overallResult === 'P'} onChange={() => setOverallResult('P')} className="sr-only" />
                                            <span className="text-2xl font-bold">PASS</span>
                                        </label>
                                        <label className={`cursor-pointer rounded-lg p-4 w-1/2 text-center transition-all duration-200 ${
                                            overallResult === 'F' || showDoubleMarginalWarning
                                                ? 'bg-red-600 text-white ring-2 ring-white scale-105 shadow-lg'
                                                : 'bg-red-800/50 text-red-200 hover:bg-red-700/50'
                                        } ${overallResult === null && !showDoubleMarginalWarning ? '!bg-gray-700 !text-gray-500 hover:!bg-gray-600' : ''}`}>
                                            <input type="radio" name="overall-result" value="F" checked={overallResult === 'F'} onChange={() => setOverallResult('F')} className="sr-only" />
                                            <span className="text-2xl font-bold">{showDoubleMarginalWarning ? 'Double Marg' : 'FAIL'}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            {/* Ground School Assessment */}
                            <div className="mt-4 pt-4 border-t border-gray-600">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Ground School Assessment</label>
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
                                        <label className="text-xs font-medium text-gray-400">Result:</label>
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
                        </fieldset>
                        {showDoubleMarginalWarning && (
                            <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-sm text-red-300">
                                <strong>Warning:</strong> This is the second consecutive marginal (1) grade. A review may be required.
                            </div>
                        )}
                    </div>
                </div>

                {/* MIDDLE SECTION: Comment Fields */}
                <div className="space-y-6 mb-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-400">QFI</label>
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
                            <button
                                onClick={() => handleVoiceInput('QFI', 'section')}
                                className={`absolute top-10 right-2 p-1 rounded-full transition-colors ${listeningField === 'QFI' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-600'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" /><path d="M5.5 13a.5.5 0 01.5.5v1a4 4 0 004 4h1a4 4 0 004-4v-1a.5.5 0 011 0v1a5 5 0 01-5 5h-1a5 5 0 01-5-5v-1a.5.5 0 01.5-.5z" /></svg>
                            </button>
                        </div>
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-400">Weather</label>
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
                            <button
                                onClick={() => handleVoiceInput('Weather', 'section')}
                                className={`absolute top-8 right-2 p-1 rounded-full transition-colors ${listeningField === 'Weather' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-600'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" /><path d="M5.5 13a.5.5 0 01.5.5v1a4 4 0 004 4h1a4 4 0 004-4v-1a.5.5 0 011 0v1a5 5 0 01-5 5h-1a5 5 0 01-5-5v-1a.5.5 0 01.5-.5z" /></svg>
                            </button>
                        </div>
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-400">NEST</label>
                             <input
                                type="text"
                                value={commentFields['NEST']}
                                onChange={(e) => handleCommentFieldChange('NEST', e.target.value)}
                                maxLength={8}
                                className="mt-1 w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                            />
                            <button
                                onClick={() => handleVoiceInput('NEST', 'section')}
                                className={`absolute top-8 right-2 p-1 rounded-full transition-colors ${listeningField === 'NEST' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-600'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" /><path d="M5.5 13a.5.5 0 01.5.5v1a4 4 0 004 4h1a4 4 0 004-4v-1a.5.5 0 011 0v1a5 5 0 01-5 5h-1a5 5 0 01-5-5v-1a.5.5 0 01.5-.5z" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div key={'Profile'} className="relative">
                            <label className="block text-sm font-medium text-gray-400">Profile</label>
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
                             <button
                                onClick={() => handleVoiceInput('Profile', 'section')}
                                className={`absolute top-8 right-2 p-1 rounded-full transition-colors ${listeningField === 'Profile' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-600'}`}
                            >
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                     <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
                                     <path d="M5.5 13a.5.5 0 01.5.5v1a4 4 0 004 4h1a4 4 0 004-4v-1a.5.5 0 011 0v1a5 5 0 01-5 5h-1a5 5 0 01-5-5v-1a.5.5 0 01.5-.5z" />
                                 </svg>
                             </button>
                        </div>
                         <div key={'Overall'} className="relative">
                            <label className="block text-sm font-medium text-gray-400">Overall</label>
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
                             <button
                                onClick={() => handleVoiceInput('Overall', 'section')}
                                className={`absolute top-8 right-2 p-1 rounded-full transition-colors ${listeningField === 'Overall' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-600'}`}
                            >
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                     <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
                                     <path d="M5.5 13a.5.5 0 01.5.5v1a4 4 0 004 4h1a4 4 0 004-4v-1a.5.5 0 011 0v1a5 5 0 01-5 5h-1a5 5 0 01-5-5v-1a.5.5 0 01.5-.5z" />
                                 </svg>
                             </button>
                        </div>
                    </div>
                </div>
                
                {/* BOTTOM SECTION - GRADING */}
                <div className="space-y-4">
                     {PT051_STRUCTURE.map(category => {
                        const isGroundEvent = event.type === 'ground';
                        return (
                        <fieldset key={category.category} className={`p-4 border rounded-lg ${isGroundEvent ? 'border-gray-800 bg-gray-800/30 opacity-50' : 'border-gray-700'}`}>
                            <legend className={`px-2 text-sm font-semibold ${isGroundEvent ? 'text-gray-500' : 'text-gray-300'}`}>{category.category}</legend>
                            <table className="w-full mt-2 border-collapse">
                                <thead className="sr-only">
                                    <tr>
                                        <th>Element</th>
                                        {GRADES.map(g => <th key={String(g)}>{g}</th>)}
                                        <th>Comments</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {category.elements.map(element => {
                                        const score = assessment.scores.find(s => s.element === element);
                                        return (
                                            <tr key={element} className="border-t border-gray-700">
                                                <td className="py-3 pr-2 font-semibold text-white w-48">{element}</td>
                                                {GRADES.map(grade => {
                                                    const getGradeLabelText = (g: Pt051Grade | 'MIN' | 'DEMO') => {
                                                        if (g === 'DEMO') return 'Demo';
                                                        return String(g);
                                                    };

                                                    return (
                                                        <td key={String(grade)} className={`py-3 text-center w-12 ${gradeHeaderColors[String(grade)] || ''}`}>
                                                            <label className={`flex flex-col items-center justify-center ${isGroundEvent ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                                                <input 
                                                                    type="radio"
                                                                    name={element}
                                                                    value={String(grade)}
                                                                    checked={score?.grade === grade}
                                                                    onChange={() => handleGradeChange(element, grade as Pt051Grade)}
                                                                    disabled={isGroundEvent}
                                                                    className={`h-4 w-4 ${getRadioAccentColor(grade)} bg-gray-700 border-gray-600 focus:ring-sky-500 focus:ring-2 ${isGroundEvent ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                />
                                                                <span className="text-xs text-gray-500 mt-1">{getGradeLabelText(grade)}</span>
                                                            </label>
                                                        </td>
                                                    );
                                                })}
                                                <td className="py-3 pl-2 relative">
                                                    <textarea
                                                        value={score?.comment || ''}
                                                        onChange={(e) => handleCommentChange(element, e.target.value)}
                                                        rows={1}
                                                        placeholder="Comments..."
                                                        className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 resize-none overflow-hidden"
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
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </fieldset>
                        );
                    })}
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