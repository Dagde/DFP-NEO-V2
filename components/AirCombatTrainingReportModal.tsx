import React, { useEffect, useMemo, useState } from 'react';
import { AirCombatTrainingAssignment, AirCombatTrainingReport, Instructor, ScheduleEvent, SyllabusItemDetail } from '../types';
import AuditButton from './AuditButton';
import {
  DEFAULT_TRAINING_REPORT_TEMPLATE,
  normaliseTrainingReportTemplate,
  type TrainingReportTemplate,
} from '../utils/trainingReportTerminology';
import { appendTrainingReportFollowUpDiag, getAirCombatAssignmentFromItem } from '../utils/airCombatTraining';

interface AirCombatTrainingReportModalProps {
  staff: Instructor;
  assignment?: AirCombatTrainingAssignment;
  item?: SyllabusItemDetail;
  sourceEvent?: ScheduleEvent;
  recentEvents?: ScheduleEvent[];
  syllabusDetails?: SyllabusItemDetail[];
  initialReport?: AirCombatTrainingReport;
  startInEditMode?: boolean;
  reportName?: string;
  trainingReportTemplate?: Partial<TrainingReportTemplate> | null;
  currentUserName?: string;
  locationCode?: string;
  unitCode?: string;
  formatResourceLabel?: (resourceId: string) => string;
  onCancel: () => void;
  onSave: (report: AirCombatTrainingReport) => Promise<void> | void;
}

const formatDecimalTime = (time?: number): string => {
  if (!Number.isFinite(Number(time))) return '-';
  const hours = Math.floor(Number(time));
  const minutes = Math.round((Number(time) - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatTimeToHHMM = (time?: number): string => {
  if (!Number.isFinite(Number(time))) return '';
  const hours = Math.floor(Number(time));
  const minutes = Math.round((Number(time) - hours) * 60);
  return `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
};

const stripResourceLineNumber = (resourceLabel: string): string => (
  String(resourceLabel || '').replace(/\s+\d+$/, '').trim()
);

const formatTrainingReportDate = (dateString?: string): string => {
  if (!dateString) return '-';
  const [year, month, day] = String(dateString).split('-').map(Number);
  if (!year || !month || !day) return dateString;
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
};

const COMMENT_SECTION_KEYS = ['assessor', 'weather', 'profile', 'overall', 'nest', 'notes'] as const;
type CommentSectionKey = typeof COMMENT_SECTION_KEYS[number];
type DpcoFollowUpAction = 'extra-event' | 'extra-hours-next-event' | 'continue-no-additions' | '';

const parseReportComments = (raw?: string): Record<CommentSectionKey, string> => {
  const defaults: Record<CommentSectionKey, string> = {
    assessor: '',
    weather: '',
    profile: '',
    overall: '',
    nest: '',
    notes: '',
  };
  if (!raw) return defaults;
  const markers: Array<{ key: CommentSectionKey; label: string }> = [
    { key: 'assessor', label: 'Assessor' },
    { key: 'weather', label: 'Weather' },
    { key: 'profile', label: 'Profile' },
    { key: 'overall', label: 'Overall' },
    { key: 'nest', label: 'NEST' },
    { key: 'notes', label: 'Notes' },
  ];
  const hasMarkers = markers.some(marker => raw.includes(`${marker.label}:`));
  if (!hasMarkers) return { ...defaults, overall: raw };
  const parsed = { ...defaults };
  markers.forEach((marker, index) => {
    const startMarker = `${marker.label}:`;
    const startIndex = raw.indexOf(startMarker);
    if (startIndex < 0) return;
    const nextIndexes = markers
      .slice(index + 1)
      .map(next => raw.indexOf(`${next.label}:`, startIndex + startMarker.length))
      .filter(value => value >= 0);
    const endIndex = nextIndexes.length > 0 ? Math.min(...nextIndexes) : raw.length;
    parsed[marker.key] = raw.slice(startIndex + startMarker.length, endIndex).trim();
  });
  return parsed;
};

const buildReportComments = (sections: Record<CommentSectionKey, string>): string => (
  [
    ['Assessor', sections.assessor],
    ['Weather', sections.weather],
    ['Profile', sections.profile],
    ['Overall', sections.overall],
    ['NEST', sections.nest],
    ['Notes', sections.notes],
  ]
    .filter(([, value]) => String(value || '').trim())
    .map(([label, value]) => `${label}: ${String(value).trim()}`)
    .join('\n\n')
);

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

const formatHours = (value?: number): string => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue.toFixed(1) : '';
};

export const AirCombatTrainingReportModal: React.FC<AirCombatTrainingReportModalProps> = ({
  staff,
  assignment,
  item,
  sourceEvent,
  recentEvents = [],
  syllabusDetails = [],
  initialReport,
  startInEditMode = false,
  reportName = 'PT-051',
  trainingReportTemplate = null,
  currentUserName = '',
  locationCode = '',
  unitCode = '',
  formatResourceLabel,
  onCancel,
  onSave,
}) => {
  const reportTemplate = useMemo(
    () => normaliseTrainingReportTemplate(trainingReportTemplate || { displayName: reportName }),
    [trainingReportTemplate, reportName],
  );
  const overviewFields = reportTemplate.modules.overview.fields;
  const overallFields = reportTemplate.modules.overallAssessment.fields;
  const commentFields = reportTemplate.modules.comments.fields;
  const enabledCompletionResults = reportTemplate.completionResults.filter((option) => option.enabled !== false);
  const missionStatusOptions = enabledCompletionResults.length > 0
    ? enabledCompletionResults
    : [{ code: 'Complete', label: 'Complete', enabled: true }];
  const gradeLabelMap = useMemo(() => (
    new Map(reportTemplate.grades.options.map((option) => [option.value, option.label]))
  ), [reportTemplate.grades.options]);
  const formatGradeOption = (value: number | string) => {
    if (String(value).toUpperCase() === 'DEMO') return 'DEMO';
    const numericValue = Number(value);
    const label = gradeLabelMap.get(numericValue) || `Grade ${value}`;
    return reportTemplate.grades.showNumbers ? `${value} - ${label}` : label;
  };
  const formatGradeHeaderText = (value: number | string): string => {
    if (String(value).toUpperCase() === 'DEMO') return 'DEMO';
    const label = gradeLabelMap.get(Number(value)) || String(value);
    return reportTemplate.grades.showNumbers ? label : formatGradeOption(value);
  };
  const formatOverallGradeTileText = (value: string): string => (
    value ? (gradeLabelMap.get(Number(value)) || String(value)) : 'No Grade'
  );
  const formatGradeNumber = (value: number | string): string => (
    String(value).toUpperCase() === 'DEMO' ? 'DEMO' : String(value)
  );
  const [isEditMode, setIsEditMode] = useState(startInEditMode);
  const [showRecentEventPicker, setShowRecentEventPicker] = useState(false);
  const [selectedSourceEvent, setSelectedSourceEvent] = useState<ScheduleEvent | undefined>(sourceEvent);
  const activeSourceEvent = selectedSourceEvent || sourceEvent;
  const [eventCodeField, setEventCodeField] = useState(initialReport?.eventCode || item?.code || sourceEvent?.flightNumber || sourceEvent?.eventCode || '');
  const selectedEventCode = String(eventCodeField || activeSourceEvent?.flightNumber || activeSourceEvent?.eventCode || initialReport?.eventCode || '').trim();
  const matchedItem = useMemo(() => (
    item || syllabusDetails.find(candidate => (
      String(candidate.code || '').trim().toUpperCase() === selectedEventCode.toUpperCase()
    ))
  ), [item, selectedEventCode, syllabusDetails]);
  const effectiveAssignment = useMemo(() => (
    assignment || (matchedItem
      ? getAirCombatAssignmentFromItem(matchedItem, locationCode, unitCode || staff.unit, currentUserName)
      : undefined)
  ), [assignment, currentUserName, locationCode, matchedItem, staff.unit, unitCode]);
  const [eventDescriptionField, setEventDescriptionField] = useState(initialReport?.eventDescription || item?.eventDescription || sourceEvent?.notes || item?.module || '');
  const [eventTypeField, setEventTypeField] = useState(initialReport?.eventType || item?.type || sourceEvent?.type || '');
  const [trainingCodeField, setTrainingCodeField] = useState(initialReport?.trainingCode || assignment?.code || item?.phase || '');
  const [resourceIdField, setResourceIdField] = useState(initialReport?.resourceId || sourceEvent?.resourceId || '');
  const [callsignField, setCallsignField] = useState(initialReport?.callsign || sourceEvent?.callsign || staff.callsign || '');
  const eventCode = eventCodeField || matchedItem?.code || selectedEventCode || '';
  const eventDescription = eventDescriptionField || matchedItem?.eventDescription || activeSourceEvent?.notes || initialReport?.eventDescription || matchedItem?.module || '';
  const eventType = eventTypeField || matchedItem?.type || activeSourceEvent?.type || initialReport?.eventType || '';
  const isSimEvent = useMemo(() => {
    const values = [eventType, eventTypeField, matchedItem?.type, activeSourceEvent?.type, initialReport?.eventType];
    return values.some(value => /sim/i.test(String(value || '')));
  }, [activeSourceEvent?.type, eventType, eventTypeField, initialReport?.eventType, matchedItem?.type]);
  const trainingCode = trainingCodeField || effectiveAssignment?.code || matchedItem?.phase || '';
  const defaultDate = activeSourceEvent?.date || initialReport?.date || new Date().toISOString().slice(0, 10);
  const defaultStart = Number(activeSourceEvent?.startTime ?? initialReport?.startTime ?? 8);
  const defaultDuration = Number(activeSourceEvent?.duration ?? initialReport?.duration ?? matchedItem?.totalEventHours ?? matchedItem?.duration ?? matchedItem?.flightOrSimHours ?? 1);
  const rawResourceId = resourceIdField || activeSourceEvent?.resourceId || initialReport?.resourceId || '';
  const displayResourceId = rawResourceId
    ? stripResourceLineNumber(formatResourceLabel?.(rawResourceId) || rawResourceId)
    : '-';

  const [date, setDate] = useState(initialReport?.date || defaultDate);
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultStart + defaultDuration);
  const [instructorName, setInstructorName] = useState(initialReport?.instructorName || activeSourceEvent?.instructor || currentUserName || '');
  const [overallGrade, setOverallGrade] = useState(initialReport?.overallGrade || '');
  const [overallResult, setOverallResult] = useState<'' | 'P' | 'F'>(initialReport?.overallResult || '');
  const [dcoResult, setDcoResult] = useState<string>(
    initialReport?.dcoResult || (enabledCompletionResults.length === 0 ? 'Complete' : '')
  );
  const [dpcoFollowUp, setDpcoFollowUp] = useState<{ action: DpcoFollowUpAction; extraEventHours?: number; extraHours?: number }>(() => ({
    action: (initialReport?.dpcoFollowUp?.action || '') as DpcoFollowUpAction,
    extraEventHours: initialReport?.dpcoFollowUp?.extraEventHours ?? undefined,
    extraHours: initialReport?.dpcoFollowUp?.extraHours ?? undefined,
  }));
  const [dncoFollowUp, setDncoFollowUp] = useState<{ requestExtraFlight: boolean }>(() => ({
    requestExtraFlight: initialReport?.dncoFollowUp?.requestExtraFlight === true,
  }));
  const [passNotesToNextEvent, setPassNotesToNextEvent] = useState(initialReport?.passNotesToNextEvent === true);
  useEffect(() => {
    appendTrainingReportFollowUpDiag('modal:hydrate', {
      reportId: initialReport?.id,
      staffName: staff.name,
      staffIdNumber: staff.idNumber,
      eventCode: initialReport?.eventCode || eventCode,
      dcoResult: initialReport?.dcoResult,
      initialDpcoFollowUp: initialReport?.dpcoFollowUp,
      initialDncoFollowUp: initialReport?.dncoFollowUp,
      stateDpcoFollowUp: dpcoFollowUp,
      stateDncoFollowUp: dncoFollowUp,
    });
  }, [dncoFollowUp, dpcoFollowUp, eventCode, initialReport?.dcoResult, initialReport?.dncoFollowUp, initialReport?.dpcoFollowUp, initialReport?.eventCode, initialReport?.id, staff.idNumber, staff.name]);
  const [commentSections, setCommentSections] = useState<Record<CommentSectionKey, string>>(() => {
    const parsed = parseReportComments(initialReport?.notes || '');
    return {
      ...parsed,
      assessor: parsed.assessor || initialReport?.instructorName || activeSourceEvent?.instructor || currentUserName || '',
      notes: stripGeneratedFollowUpNotes(parsed.notes || ''),
    };
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving...' | 'Unsaved'>('Saved');

  const reportId = useMemo(() => (
    initialReport?.id || `air-combat-report-${staff.idNumber}-${sourceEvent?.id || item?.id || eventCode}-${Date.now()}`
  ), [eventCode, initialReport?.id, item?.id, sourceEvent?.id, staff.idNumber]);

  const detailCell = (label: string, value?: React.ReactNode) => (
    <div className="rounded border border-gray-700 bg-gray-950/70 p-3">
      <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value || '-'}</div>
    </div>
  );
  const editInputClass = 'mt-1 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm font-semibold text-white focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-500';
  const getRecentEventPic = (event: ScheduleEvent): string => (
    String((event as any).fixedCrewPic || event.pilot || event.instructor || '').trim() || '-'
  );
  const getRecentEventCoPilot = (event: ScheduleEvent): string => (
    String(event.crew || (Array.isArray(event.crewSelectionOrder) ? event.crewSelectionOrder.find(name => name !== getRecentEventPic(event)) : '') || '').trim() || '-'
  );
  const getRecentEventShortCode = (event: ScheduleEvent): string => (
    String(event.flightNumber || (event as any).eventCode || '').trim() || 'Event'
  );
  const renderEventDataField = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    fallback = '-',
  ) => (
    <div>
      <dt className="text-sm font-medium text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-white">
        {isEditMode ? (
          <input
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setSaveStatus('Unsaved');
            }}
            className={editInputClass}
          />
        ) : (
          value || fallback
        )}
      </dd>
    </div>
  );
  const renderEventSelectorField = () => (
    <div className="relative">
      <dt className="text-sm font-medium text-gray-400">{overviewFields.event}</dt>
      <dd className="mt-1 text-sm font-semibold text-white">
        {isEditMode ? (
          <>
            <input
              value={eventCode}
              onFocus={() => setShowRecentEventPicker(true)}
              onClick={() => setShowRecentEventPicker(true)}
              onBlur={() => window.setTimeout(() => setShowRecentEventPicker(false), 120)}
              onChange={(event) => {
                setEventCodeField(event.target.value);
                setSaveStatus('Unsaved');
              }}
              className={editInputClass}
            />
            {showRecentEventPicker && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-sky-500/40 bg-gray-950 shadow-xl">
                {recentEvents.length > 0 ? (
                  recentEvents.slice(0, 5).map(event => (
                    <button
                      key={event.id}
                      type="button"
                      onMouseDown={(clickEvent) => {
                        clickEvent.preventDefault();
                        selectRecentEvent(event);
                      }}
                      className="grid w-full grid-cols-[74px_minmax(0,1fr)_minmax(0,1fr)_64px] gap-x-1 border-b border-gray-800 px-2 py-2 text-left text-[11px] last:border-b-0 hover:bg-sky-950/40"
                    >
                      <span className="font-mono text-gray-300">{formatTrainingReportDate(event.date)}</span>
                      <span className="truncate text-white">{getRecentEventPic(event)}</span>
                      <span className="truncate text-gray-300">{getRecentEventCoPilot(event)}</span>
                      <span className="truncate font-semibold text-sky-200">{getRecentEventShortCode(event)}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-3 text-xs text-gray-400">No recent flown events found for this staff member.</div>
                )}
              </div>
            )}
          </>
        ) : (
          eventCode || 'N/A'
        )}
      </dd>
    </div>
  );
  const assessmentElements = useMemo(() => {
    const source = Array.isArray(matchedItem?.assessedElements) && matchedItem.assessedElements.length > 0
      ? matchedItem.assessedElements
      : ['Airmanship', 'Preparation', 'Technique'];
    return Array.from(new Set(source.map(element => String(element || '').trim()).filter(Boolean)));
  }, [matchedItem?.assessedElements]);
  const selectRecentEvent = (event: ScheduleEvent) => {
    const nextDuration = Number(event.duration || matchedItem?.duration || 1);
    const nextEventCode = String(event.flightNumber || event.eventCode || '').trim();
    const nextItem = syllabusDetails.find(candidate => (
      String(candidate.code || '').trim().toUpperCase() === nextEventCode.toUpperCase()
    ));
    setSelectedSourceEvent(event);
    setEventCodeField(nextEventCode);
    setEventDescriptionField(nextItem?.eventDescription || event.notes || nextItem?.module || '');
    setEventTypeField(nextItem?.type || event.type || '');
    setTrainingCodeField(nextItem?.phase || nextItem?.courses?.find(Boolean) || '');
    setResourceIdField(event.resourceId || '');
    setCallsignField(event.callsign || '');
    setDate(event.date || new Date().toISOString().slice(0, 10));
    setStartTime(Number(event.startTime || 8));
    setEndTime(Number(event.startTime || 8) + Math.max(0.25, nextDuration));
    const selectedAssessor = initialReport?.instructorName || initialReport?.dashboardAssigneeName || event.instructor || currentUserName || '';
    setInstructorName(selectedAssessor);
    setCommentSections(prev => ({ ...prev, assessor: selectedAssessor || prev.assessor }));
    setSaveStatus('Unsaved');
    setShowRecentEventPicker(false);
  };
  const [elementScores, setElementScores] = useState<Array<{ element: string; grade: string; comment: string }>>(() => {
    const existingScores = Array.isArray(initialReport?.assessedElementScores) ? initialReport.assessedElementScores : [];
    return assessmentElements.map((element) => {
      const match = existingScores.find(score => String(score.element || '').trim().toLowerCase() === element.toLowerCase());
      return {
        element,
        grade: String(match?.grade || ''),
        comment: String(match?.comment || ''),
      };
    });
  });
  const [groundSchoolAssessment, setGroundSchoolAssessment] = useState<{ isAssessment: boolean; result: string }>(() => ({
    isAssessment: initialReport?.groundSchoolAssessment?.isAssessment === true,
    result: String(initialReport?.groundSchoolAssessment?.result || ''),
  }));
  const updateCommentSection = (key: CommentSectionKey, value: string) => {
    setCommentSections(prev => ({ ...prev, [key]: value }));
    if (key === 'assessor') {
      setInstructorName(value);
    }
  };
  const getNextEventCode = (): string => {
    const selectedCode = String(eventCode || '').trim().toUpperCase();
    const selectedIndex = syllabusDetails.findIndex(candidate => (
      String(candidate.code || '').trim().toUpperCase() === selectedCode
    ));
    if (selectedIndex === -1) return '';
    const selectedType = String(matchedItem?.type || eventType || '').trim();
    const next = syllabusDetails.slice(selectedIndex + 1).find(candidate => (
      !selectedType || String(candidate.type || '').trim() === selectedType
    ));
    return String(next?.code || '').trim();
  };
  const getFollowUpNotesPrefix = (): string => {
    if (dcoResult === 'DPCO' && dpcoFollowUp.action === 'extra-hours-next-event') {
      const hours = formatHours(dpcoFollowUp.extraHours);
      if (!hours) return '';
      return `${hours} hrs added to ${getNextEventCode() || 'next event'}.`;
    }
    if (dcoResult === 'DPCO' && dpcoFollowUp.action === 'extra-event') {
      const hours = formatHours(dpcoFollowUp.extraEventHours);
      return hours
        ? `${hours} hrs added to ${eventCode || 're-fly event'}.`
        : `Re-fly requested: ${eventCode || 'event'}.`;
    }
    if (dcoResult === 'DNCO' && dncoFollowUp.requestExtraFlight) {
      return `Re-fly requested: ${eventCode || 'event'}.`;
    }
    return '';
  };
  const buildNotesWithFollowUp = (): string => {
    const followUpPrefix = getFollowUpNotesPrefix();
    const freeText = stripGeneratedFollowUpNotes(commentSections.notes || '', followUpPrefix);
    return [followUpPrefix, freeText].filter(Boolean).join('\n\n');
  };
  const updateElementScore = (element: string, patch: Partial<{ grade: string; comment: string }>) => {
    setElementScores(prev => {
      const next = prev.some(score => score.element === element)
        ? prev.map(score => (score.element === element ? { ...score, ...patch } : score))
        : [...prev, { element, grade: '', comment: '', ...patch }];
      return next;
    });
  };
  const getElementScore = (element: string) => (
    elementScores.find(score => score.element === element) || { element, grade: '', comment: '' }
  );
  const gradeOptions = reportTemplate.grades.options.map(option => String(option.value));
  const overallGradeOptions = ['', ...gradeOptions];
  const assessmentGradeOptions = ['DEMO', ...gradeOptions];
  const awardedOverallGrade = String(overallGrade || '').trim();
  const gradeDrivenOverallResult: '' | 'P' | 'F' = awardedOverallGrade
    ? awardedOverallGrade === '0' ? 'F' : 'P'
    : '';
  const gradeHeaderColors: Record<string, string> = {
    DEMO: 'bg-red-950/35 border-red-500/20',
    '0': 'bg-red-950/35 border-red-500/20',
    '1': 'bg-orange-950/35 border-orange-500/20',
    '2': 'bg-amber-950/35 border-amber-500/20',
    '3': 'bg-yellow-950/30 border-yellow-500/20',
    '4': 'bg-lime-950/25 border-lime-500/20',
    '5': 'bg-emerald-950/25 border-emerald-500/20',
  };
  const getRadioAccentColor = (grade: string) => {
    if (grade === 'DEMO' || grade === '0') return 'accent-red-500';
    if (grade === '1') return 'accent-orange-500';
    if (grade === '2') return 'accent-amber-500';
    if (grade === '3') return 'accent-yellow-400';
    if (grade === '4') return 'accent-lime-400';
    return 'accent-emerald-500';
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
  const saveReport = async () => {
    setIsSaving(true);
    setSaveStatus('Saving...');
    setSaveError('');
    try {
      const now = new Date().toISOString();
      const duration = Math.max(0.25, endTime - startTime);
      const payload: AirCombatTrainingReport = {
        id: reportId,
        reportName: reportTemplate.displayName || DEFAULT_TRAINING_REPORT_TEMPLATE.displayName,
        staffIdNumber: staff.idNumber,
        staffName: staff.name,
        locationCode,
        unitCode: unitCode || staff.unit,
        trainingKey: effectiveAssignment?.trainingKey,
        trainingKind: effectiveAssignment?.kind,
        trainingCode,
        trainingTitle: effectiveAssignment?.title || matchedItem?.module,
        eventId: activeSourceEvent?.id || matchedItem?.id,
        eventCode,
        eventDescription,
        eventType,
        date,
        startTime,
        duration,
        resourceId: resourceIdField || activeSourceEvent?.resourceId || initialReport?.resourceId,
        callsign: callsignField || activeSourceEvent?.callsign || initialReport?.callsign || staff.callsign,
        instructorName,
        dashboardAssigneeName: initialReport?.dashboardAssigneeName || currentUserName || instructorName,
        overallGrade,
        overallResult,
        dcoResult,
        dpcoFollowUp: dcoResult === 'DPCO' ? dpcoFollowUp : undefined,
        dncoFollowUp: dcoResult === 'DNCO' ? dncoFollowUp : undefined,
        passNotesToNextEvent,
        assessedElementScores: elementScores,
        groundSchoolAssessment,
        notes: buildReportComments({ ...commentSections, notes: buildNotesWithFollowUp() }),
        status: 'Draft',
        dashboardAcknowledgedAt: now,
        createdAt: initialReport?.createdAt || now,
        createdBy: initialReport?.createdBy || currentUserName,
        updatedAt: now,
        updatedBy: currentUserName,
      };
      appendTrainingReportFollowUpDiag('modal:save-payload', {
        reportId: payload.id,
        staffName: payload.staffName,
        staffIdNumber: payload.staffIdNumber,
        eventCode: payload.eventCode,
        dcoResult: payload.dcoResult,
        dpcoFollowUp: payload.dpcoFollowUp,
        dncoFollowUp: payload.dncoFollowUp,
      });
      await onSave(payload);
      setSaveStatus('Saved');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
      setSaveStatus('Unsaved');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4" onKeyDownCapture={stopEditableKeyPropagation}>
      <div className="flex max-h-[92vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-lg border border-gray-600 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-5 py-4">
          <h3 className="text-xl font-bold text-white">Staff Profile</h3>
          <button type="button" onClick={onCancel} className="text-3xl leading-none text-gray-400 hover:text-white">x</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-4">
            <div className="flex items-center gap-4">
              <div>
                <input
                  type="text"
                  value={eventCode}
                  readOnly={!isEditMode}
                  onChange={(event) => {
                    setEventCodeField(event.target.value);
                    setSaveStatus('Unsaved');
                  }}
                  className={`mb-2 w-full border-b-2 bg-transparent text-2xl font-bold text-white outline-none ${isEditMode ? 'border-sky-500' : 'border-gray-600'}`}
                />
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      setSaveStatus('Unsaved');
                    }}
                    className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-white focus:ring-1 focus:ring-sky-500"
                  />
                  <span>at</span>
                  <input
                    type="text"
                    value={formatTimeToHHMM(startTime)}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/\D/g, '').slice(0, 4);
                      if (raw.length < 3) return;
                      const hours = Number(raw.slice(0, 2));
                      const minutes = Number(raw.slice(2, 4));
                      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                        setStartTime(hours + minutes / 60);
                        setSaveStatus('Unsaved');
                      }
                    }}
                    className="w-20 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-center font-mono text-white focus:ring-1 focus:ring-sky-500"
                    maxLength={4}
                  />
                  <span>-</span>
                  <input
                    type="text"
                    value={formatTimeToHHMM(endTime)}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/\D/g, '').slice(0, 4);
                      if (raw.length < 3) return;
                      const hours = Number(raw.slice(0, 2));
                      const minutes = Number(raw.slice(2, 4));
                      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                        setEndTime(hours + minutes / 60);
                        setSaveStatus('Unsaved');
                      }
                    }}
                    className="w-20 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-center font-mono text-white focus:ring-1 focus:ring-sky-500"
                    maxLength={4}
                  />
                </div>
              </div>
              <div className="flex items-center rounded-full border border-gray-700 bg-gray-900/50 px-3 py-1">
                <div className={`mr-2 h-2 w-2 rounded-full ${saveStatus === 'Saved' ? 'bg-green-500' : saveStatus === 'Saving...' ? 'animate-pulse bg-amber-500' : 'bg-red-500'}`}></div>
                <span className="font-mono text-xs uppercase text-gray-300">{saveStatus === 'Saved' ? 'All changes saved' : saveStatus}</span>
              </div>
            </div>
            <div className="flex items-center gap-[1px]">
              <button type="button" onClick={() => window.print()} className="flex h-[41px] w-[56px] items-center justify-center rounded-md btn-aluminium-brushed px-1 py-1 text-center text-[10px] font-semibold">Print</button>
              <button
                type="button"
                onClick={() => {
                  setIsEditMode(prev => {
                    const next = !prev;
                    if (!next) setShowRecentEventPicker(false);
                    return next;
                  });
                }}
                className={`flex h-[41px] w-[56px] items-center justify-center rounded-md btn-aluminium-brushed px-1 py-1 text-center text-[10px] font-semibold ${isEditMode ? 'active text-sky-900' : ''}`}
              >
                Edit
              </button>
              <button type="button" onClick={saveReport} disabled={isSaving || !eventCode} className="flex h-[41px] w-[56px] items-center justify-center rounded-md btn-aluminium-brushed px-1 py-1 text-center text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-40">Save</button>
              <button type="button" className="flex h-[41px] w-[56px] items-center justify-center rounded-md btn-aluminium-brushed px-1 py-1 text-center text-[10px] font-semibold">Delete</button>
              <button type="button" onClick={onCancel} className="flex h-[41px] w-[56px] items-center justify-center rounded-md btn-aluminium-brushed px-1 py-1 text-center text-[10px] font-semibold">Back</button>
              <AuditButton pageName={`${reportTemplate.displayName} Assessment`} />
            </div>
          </div>

          <div className="p-4 md:p-6">
            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <dl
                className={`space-y-2 rounded-lg border bg-gray-800 p-4 lg:col-span-1 lg:w-[calc(100%-25px)] ${isEditMode ? 'border-sky-500/60' : 'border-gray-700'}`}
              >
                {renderEventSelectorField()}
                {renderEventDataField(overviewFields.type, eventDescription, setEventDescriptionField, eventType || 'N/A')}
                <div><dt className="text-sm font-medium text-gray-400">Staff</dt><dd className="mt-1 text-sm font-semibold text-white">{staff.rank} {staff.name}</dd></div>
                {renderEventDataField(overviewFields.training, trainingCode, setTrainingCodeField)}
                <div><dt className="text-sm font-medium text-gray-400">{overviewFields.date}</dt><dd className="mt-1"><input type="date" value={date} onChange={(event) => { setDate(event.target.value); setSaveStatus('Unsaved'); }} className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm font-semibold text-white focus:ring-1 focus:ring-sky-500" /></dd></div>
                <div><dt className="text-sm font-medium text-gray-400">{overviewFields.timing}</dt><dd className="mt-1 text-sm font-semibold text-white">{formatDecimalTime(startTime)} - {formatDecimalTime(endTime)}</dd></div>
                {renderEventDataField(overviewFields.resource, isEditMode ? resourceIdField : displayResourceId, setResourceIdField)}
                {renderEventDataField(overviewFields.callsign, callsignField || activeSourceEvent?.callsign || staff.callsign || '', setCallsignField)}
                <div><dt className="text-sm font-medium text-gray-400">{overviewFields.assessor}</dt><dd className="mt-1"><input value={instructorName} onChange={(event) => { setInstructorName(event.target.value); updateCommentSection('assessor', event.target.value); setSaveStatus('Unsaved'); }} className="w-[calc(100%-25px)] rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm font-semibold text-white focus:ring-1 focus:ring-sky-500" /></dd></div>
              </dl>

              <div className="relative rounded-lg border border-gray-600 p-4 lg:col-span-2 lg:-ml-[44px] lg:w-[calc(100%+44px)]">
                <div className="absolute -top-3 left-6 bg-gray-900 px-2 text-sm font-semibold text-gray-300">{reportTemplate.modules.overallAssessment.title}</div>
                <div className="mb-4 mt-2">
                  <div className="grid items-start gap-3 md:grid-cols-[minmax(180px,220px)_minmax(360px,1fr)]">
                    <div className="min-h-[168px]">
                      <label className="mb-2 block text-sm font-medium text-gray-400">{overallFields.result}</label>
                      <div className="flex flex-col space-y-2">
                      {missionStatusOptions.map((option) => (
                        <label key={option.code} className="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-gray-700/30">
                          <input type="radio" name="training-report-dco-result" value={option.code} checked={dcoResult === option.code} onChange={(event) => { setDcoResult(event.target.value); setSaveStatus('Unsaved'); }} className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-500" />
                          <span className="font-medium text-white">{option.label}</span>
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
                              name="training-report-dpco-follow-up"
                              value="extra-event"
                              checked={dpcoFollowUp.action === 'extra-event'}
                              onChange={() => { setDpcoFollowUp(prev => ({ ...prev, action: 'extra-event' })); setSaveStatus('Unsaved'); }}
                              className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-400"
                            />
                            <span>Extra {isSimEvent ? 'Sim' : 'Flight'}</span>
                            <div className="relative h-8 rounded border border-gray-600 bg-gray-950 focus-within:border-sky-300 focus-within:ring-1 focus-within:ring-sky-300">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={dpcoFollowUp.extraEventHours ?? ''}
                                placeholder="0.0"
                                onChange={(event) => {
                                  const value = event.target.value;
                                  if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
                                  setDpcoFollowUp({
                                    ...dpcoFollowUp,
                                    action: 'extra-event',
                                    extraEventHours: value === '' ? undefined : Number(value),
                                  });
                                  setSaveStatus('Unsaved');
                                }}
                                onKeyDown={stopEditableKeyPropagation}
                                className="h-full w-full rounded bg-transparent py-1 pl-2 pr-6 text-center text-sm font-semibold text-white focus:outline-none"
                              />
                              <div className="absolute inset-y-0 right-0 flex w-5 flex-col border-l border-gray-700/70 text-[8px] leading-none text-gray-400">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setDpcoFollowUp(prev => ({ ...prev, action: 'extra-event', extraEventHours: Number((Number(prev.extraEventHours || 0) + 0.1).toFixed(1)) }));
                                    setSaveStatus('Unsaved');
                                  }}
                                  className="flex flex-1 items-center justify-center rounded-tr hover:bg-gray-800 hover:text-gray-200"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setDpcoFollowUp(prev => ({ ...prev, action: 'extra-event', extraEventHours: Number(Math.max(0, Number(prev.extraEventHours || 0) - 0.1).toFixed(1)) }));
                                    setSaveStatus('Unsaved');
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
                              name="training-report-dpco-follow-up"
                              value="extra-hours-next-event"
                              checked={dpcoFollowUp.action === 'extra-hours-next-event'}
                              onChange={() => { setDpcoFollowUp(prev => ({ ...prev, action: 'extra-hours-next-event' })); setSaveStatus('Unsaved'); }}
                              className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-400"
                            />
                            <span>Extend next event</span>
                            <div className="relative h-8 rounded border border-gray-600 bg-gray-950 focus-within:border-sky-300 focus-within:ring-1 focus-within:ring-sky-300">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={dpcoFollowUp.extraHours ?? ''}
                                placeholder="0.0"
                                onChange={(event) => {
                                  const value = event.target.value;
                                  if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
                                  setDpcoFollowUp({
                                    ...dpcoFollowUp,
                                    action: 'extra-hours-next-event',
                                    extraHours: value === '' ? undefined : Number(value),
                                  });
                                  setSaveStatus('Unsaved');
                                }}
                                onKeyDown={stopEditableKeyPropagation}
                                className="h-full w-full rounded bg-transparent py-1 pl-2 pr-6 text-center text-sm font-semibold text-white focus:outline-none"
                              />
                              <div className="absolute inset-y-0 right-0 flex w-5 flex-col border-l border-gray-700/70 text-[8px] leading-none text-gray-400">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setDpcoFollowUp(prev => ({ ...prev, action: 'extra-hours-next-event', extraHours: Number((Number(prev.extraHours || 0) + 0.1).toFixed(1)) }));
                                    setSaveStatus('Unsaved');
                                  }}
                                  className="flex flex-1 items-center justify-center rounded-tr hover:bg-gray-800 hover:text-gray-200"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setDpcoFollowUp(prev => ({ ...prev, action: 'extra-hours-next-event', extraHours: Number(Math.max(0, Number(prev.extraHours || 0) - 0.1).toFixed(1)) }));
                                    setSaveStatus('Unsaved');
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
                              name="training-report-dpco-follow-up"
                              value="continue-no-additions"
                              checked={dpcoFollowUp.action === 'continue-no-additions'}
                              onChange={() => { setDpcoFollowUp(prev => ({ ...prev, action: 'continue-no-additions' })); setSaveStatus('Unsaved'); }}
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
                              name="training-report-dnco-follow-up"
                              value="request-extra-flight"
                              checked={dncoFollowUp.requestExtraFlight}
                              onChange={() => { setDncoFollowUp({ requestExtraFlight: true }); setSaveStatus('Unsaved'); }}
                              className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-400"
                            />
                            <span>Request extra flight</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400">{overallFields.overallGrade}</label>
                    <div className="mt-1 flex flex-wrap gap-2 rounded bg-gray-950/45 p-2">
                      {overallGradeOptions.map(grade => (
                        <label key={grade || 'No Grade'} title={grade ? formatGradeOption(grade) : 'No Grade'} className={`flex h-[75px] w-[82px] cursor-pointer flex-col items-center justify-between rounded border px-1 py-2 text-center transition ${overallGrade === grade ? 'border-sky-400 bg-sky-500/15 text-white' : 'border-gray-700 bg-gray-900/80 text-gray-300 hover:border-gray-500'}`}>
                          {reportTemplate.grades.showNumbers && (
                            grade
                              ? <span className="text-[11px] font-black uppercase leading-none text-white">{formatGradeNumber(grade)}</span>
                              : <span aria-hidden="true" className="text-[11px] font-black uppercase leading-none text-white opacity-0">0</span>
                          )}
                          <span className={`flex max-w-full flex-col items-center whitespace-nowrap text-[8px] font-semibold uppercase leading-[0.95] text-gray-300 ${!grade ? '-translate-y-2' : ''}`}>
                            {formatOverallGradeTileText(grade).split(/\s+/).map((word, index) => <span key={`${word}-${index}`}>{word}</span>)}
                          </span>
                          <input
                            type="radio"
                            name="training-report-overall-grade"
                            value={grade}
                            checked={overallGrade === grade}
                            onChange={() => {
                              setOverallGrade(grade);
                              setOverallResult(grade ? grade === '0' ? 'F' : 'P' : '');
                              setSaveStatus('Unsaved');
                            }}
                            className={`h-4 w-4 ${grade ? getRadioAccentColor(grade) : 'accent-gray-400'} bg-gray-600`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-400">{overallFields.overallResult}</label>
                    <div className="mt-1 flex space-x-4">
                      <label className={`w-1/2 cursor-pointer rounded-lg p-4 text-center transition-all duration-200 ${gradeDrivenOverallResult === 'P' ? 'scale-105 bg-green-600 text-white shadow-lg ring-2 ring-white' : 'bg-green-950/20 text-green-300/35 hover:bg-green-900/25 hover:text-green-300/45'}`}>
                        <input type="radio" name="training-report-overall-result" value="P" checked={overallResult === 'P'} onChange={() => { setOverallResult('P'); setSaveStatus('Unsaved'); }} className="sr-only" />
                        <span className="text-2xl font-bold">{reportTemplate.overallResults.passLabel}</span>
                      </label>
                      <label className={`w-1/2 cursor-pointer rounded-lg p-4 text-center transition-all duration-200 ${gradeDrivenOverallResult === 'F' ? 'scale-105 bg-red-600 text-white shadow-lg ring-2 ring-white' : 'bg-red-950/20 text-red-300/35 hover:bg-red-900/25 hover:text-red-300/45'}`}>
                        <input type="radio" name="training-report-overall-result" value="F" checked={overallResult === 'F'} onChange={() => { setOverallResult('F'); setSaveStatus('Unsaved'); }} className="sr-only" />
                        <span className="text-2xl font-bold">{reportTemplate.overallResults.failLabel}</span>
                      </label>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-gray-600 pt-4">
                    <label className="mb-2 block text-sm font-medium text-gray-400">{overallFields.groundSchoolAssessment}</label>
                    <div className="flex items-center space-x-3">
                      <label className="flex cursor-pointer items-center space-x-2">
                        <input type="checkbox" checked={groundSchoolAssessment.isAssessment} onChange={(event) => { setGroundSchoolAssessment(prev => ({ ...prev, isAssessment: event.target.checked, result: event.target.checked ? prev.result : '' })); setSaveStatus('Unsaved'); }} className="h-4 w-4 rounded border-gray-500 bg-gray-600 accent-sky-500" />
                        <span className="text-xs font-medium text-gray-300">Assessment</span>
                      </label>
                      <div className="flex items-center space-x-1">
                        <label className="text-xs font-medium text-gray-400">{overallFields.result}:</label>
                        <div className="relative">
                          <input type="number" min="0" max="100" value={groundSchoolAssessment.isAssessment ? groundSchoolAssessment.result : ''} onChange={(event) => { setGroundSchoolAssessment(prev => ({ ...prev, result: String(Math.min(100, Math.max(0, Number(event.target.value) || 0))) })); setSaveStatus('Unsaved'); }} disabled={!groundSchoolAssessment.isAssessment} className={`w-16 rounded-md border px-2 py-1 text-center text-xs font-semibold ${groundSchoolAssessment.isAssessment ? 'border-gray-600 bg-gray-700 text-white focus:ring-2 focus:ring-sky-500' : 'cursor-not-allowed border-gray-600 bg-gray-600/50 text-gray-500'}`} placeholder="%" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6 space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(180px,0.85fr)_minmax(360px,1.7fr)_120px]">
              <div>
                <label className="block text-sm font-medium text-gray-400">{commentFields.assessor}</label>
                <input
                  value={commentSections.assessor}
                  onChange={(event) => { updateCommentSection('assessor', event.target.value); setSaveStatus('Unsaved'); }}
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-700 p-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">{commentFields.weather}</label>
                <textarea
                  value={commentSections.weather}
                  onChange={(event) => { updateCommentSection('weather', event.target.value); setSaveStatus('Unsaved'); }}
                  rows={1}
                  className="mt-1 w-full resize-none rounded border border-gray-600 bg-gray-700 p-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">{commentFields.nest}</label>
                <input
                  value={commentSections.nest}
                  onChange={(event) => { updateCommentSection('nest', event.target.value); setSaveStatus('Unsaved'); }}
                  maxLength={8}
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-700 p-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400">{commentFields.profile}</label>
              <textarea
                value={commentSections.profile}
                onChange={(event) => { updateCommentSection('profile', event.target.value); setSaveStatus('Unsaved'); }}
                rows={4}
                className="mt-1 w-full resize-none rounded border border-gray-600 bg-gray-700 p-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">{commentFields.overall}</label>
              <textarea
                value={commentSections.overall}
                onChange={(event) => { updateCommentSection('overall', event.target.value); setSaveStatus('Unsaved'); }}
                rows={5}
                className="mt-1 w-full resize-none rounded border border-gray-600 bg-gray-700 p-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

            <div className="space-y-4">
          <fieldset className="rounded-lg border border-gray-700 p-4">
            <legend className="px-2 text-sm font-semibold text-gray-300">Core Dimensions</legend>
            <div className="mt-2 overflow-x-auto rounded-md border border-gray-800/80">
              <table className="min-w-[1200px] w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-[190px]" />
                  {assessmentGradeOptions.map(grade => <col key={grade} className="w-[40px]" />)}
                  <col className="w-[480px]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="px-2 pb-2 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">Element</th>
                    {assessmentGradeOptions.map(grade => (
                      <th key={grade} title={formatGradeOption(grade)} className="relative h-[98px] px-0 pb-2 text-center align-bottom text-[9px] font-black uppercase leading-[0.95] text-gray-400">
                        <span className="absolute bottom-2 left-1/2 flex w-[76px] origin-bottom-left -rotate-90 flex-row items-center justify-start gap-1 whitespace-nowrap">
                          {formatGradeHeaderText(grade).split(/\s+/).map((word, index) => <span key={`${word}-${index}`}>{word}</span>)}
                        </span>
                      </th>
                    ))}
                    <th className="h-[98px] px-2 pb-2 text-left align-bottom text-[10px] font-bold uppercase tracking-wide text-gray-500">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {assessmentElements.map(element => (
                    <tr key={element} className="border-t border-gray-700">
                      <td className="py-3 pr-3 align-middle font-semibold text-white">{element}</td>
                      {assessmentGradeOptions.map(grade => (
                        <td key={grade} title={formatGradeOption(grade)} className={`border-l border-gray-800 px-0.5 py-3 text-center align-middle ${gradeHeaderColors[grade] || 'border-gray-800'}`}>
                          <label className="flex min-h-[36px] cursor-pointer items-center justify-center rounded hover:bg-white/5">
                            <span className="flex flex-col items-center justify-center gap-1">
                              <input type="radio" name={`training-report-element-${element}`} value={grade} checked={getElementScore(element).grade === grade} onChange={() => { updateElementScore(element, { grade }); setSaveStatus('Unsaved'); }} className={`h-4 w-4 ${getRadioAccentColor(grade)} border-gray-600 bg-gray-700 focus:ring-2 focus:ring-sky-500`} />
                              {reportTemplate.grades.showNumbers && <span className="text-[9px] font-bold leading-none text-gray-500">{formatGradeNumber(grade)}</span>}
                            </span>
                          </label>
                        </td>
                      ))}
                      <td className="relative py-3 pl-3 pr-2 align-middle">
                        <textarea
                          value={getElementScore(element).comment}
                          onChange={(event) => { updateElementScore(element, { comment: event.target.value }); setSaveStatus('Unsaved'); }}
                          rows={1}
                          className="w-full resize-none overflow-hidden rounded border border-gray-600 bg-gray-800 p-2 text-sm text-gray-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                          placeholder="Comments..."
                          style={{ minHeight: '42px' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </fieldset>
          <fieldset className="rounded-lg border border-gray-700 p-4">
            <legend className="px-2 text-sm font-semibold text-gray-300">{commentFields.notes}</legend>
            <div className="space-y-3">
              <textarea
                value={buildNotesWithFollowUp()}
                onChange={(event) => { updateCommentSection('notes', stripGeneratedFollowUpNotes(event.target.value, getFollowUpNotesPrefix())); setSaveStatus('Unsaved'); }}
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
                    name="training-report-pass-notes"
                    checked={passNotesToNextEvent}
                    onChange={() => { setPassNotesToNextEvent(true); setSaveStatus('Unsaved'); }}
                    className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-400"
                  />
                  <span>Pass notes to next {isSimEvent ? 'simulator' : 'flight'} event</span>
                </label>
                <label className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 ${!passNotesToNextEvent ? 'border-sky-400/80 bg-sky-500/15 text-white' : 'border-gray-700 bg-gray-900/70 text-gray-300 hover:border-gray-500'}`}>
                  <input
                    type="radio"
                    name="training-report-pass-notes"
                    checked={!passNotesToNextEvent}
                    onChange={() => { setPassNotesToNextEvent(false); setSaveStatus('Unsaved'); }}
                    className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-400"
                  />
                  <span>Keep notes on this report only</span>
                </label>
              </div>
            </div>
          </fieldset>
            </div>
          {saveError && (
            <div className="rounded border border-red-500/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {saveError}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AirCombatTrainingReportModal;
