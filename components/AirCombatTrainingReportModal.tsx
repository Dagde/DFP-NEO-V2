import React, { useMemo, useState } from 'react';
import { AirCombatTrainingAssignment, AirCombatTrainingReport, Instructor, ScheduleEvent, SyllabusItemDetail } from '../types';
import AuditButton from './AuditButton';
import {
  DEFAULT_TRAINING_REPORT_TEMPLATE,
  normaliseTrainingReportTemplate,
  type TrainingReportTemplate,
} from '../utils/trainingReportTerminology';

interface AirCombatTrainingReportModalProps {
  staff: Instructor;
  assignment?: AirCombatTrainingAssignment;
  item?: SyllabusItemDetail;
  sourceEvent?: ScheduleEvent;
  initialReport?: AirCombatTrainingReport;
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

const COMMENT_SECTION_KEYS = ['assessor', 'weather', 'profile', 'overall', 'nest', 'notes'] as const;
type CommentSectionKey = typeof COMMENT_SECTION_KEYS[number];

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

export const AirCombatTrainingReportModal: React.FC<AirCombatTrainingReportModalProps> = ({
  staff,
  assignment,
  item,
  sourceEvent,
  initialReport,
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
  const formatGradeNumber = (value: number | string): string => (
    String(value).toUpperCase() === 'DEMO' ? 'DEMO' : String(value)
  );
  const eventCode = item?.code || sourceEvent?.flightNumber || initialReport?.eventCode || '';
  const eventDescription = item?.eventDescription || sourceEvent?.notes || initialReport?.eventDescription || item?.module || '';
  const eventType = item?.type || sourceEvent?.type || initialReport?.eventType || '';
  const defaultDate = sourceEvent?.date || initialReport?.date || new Date().toISOString().slice(0, 10);
  const defaultStart = Number(sourceEvent?.startTime ?? initialReport?.startTime ?? 8);
  const defaultDuration = Number(sourceEvent?.duration ?? initialReport?.duration ?? item?.totalEventHours ?? item?.duration ?? item?.flightOrSimHours ?? 1);
  const rawResourceId = sourceEvent?.resourceId || initialReport?.resourceId || '';
  const displayResourceId = rawResourceId
    ? stripResourceLineNumber(formatResourceLabel?.(rawResourceId) || rawResourceId)
    : '-';

  const [date, setDate] = useState(initialReport?.date || defaultDate);
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultStart + defaultDuration);
  const [instructorName, setInstructorName] = useState(initialReport?.instructorName || sourceEvent?.instructor || currentUserName || '');
  const [overallGrade, setOverallGrade] = useState(initialReport?.overallGrade || '');
  const [overallResult, setOverallResult] = useState<'' | 'P' | 'F'>(initialReport?.overallResult || '');
  const [dcoResult, setDcoResult] = useState<'' | 'DCO' | 'DPCO' | 'DNCO'>(initialReport?.dcoResult || '');
  const [commentSections, setCommentSections] = useState<Record<CommentSectionKey, string>>(() => {
    const parsed = parseReportComments(initialReport?.notes || '');
    return {
      ...parsed,
      assessor: parsed.assessor || initialReport?.instructorName || sourceEvent?.instructor || currentUserName || '',
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
  const assessmentElements = useMemo(() => {
    const source = Array.isArray(item?.assessedElements) && item.assessedElements.length > 0
      ? item.assessedElements
      : ['Airmanship', 'Preparation', 'Technique'];
    return Array.from(new Set(source.map(element => String(element || '').trim()).filter(Boolean)));
  }, [item?.assessedElements]);
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
      await onSave({
        id: reportId,
        reportName: reportTemplate.displayName || DEFAULT_TRAINING_REPORT_TEMPLATE.displayName,
        staffIdNumber: staff.idNumber,
        staffName: staff.name,
        locationCode,
        unitCode: unitCode || staff.unit,
        trainingKey: assignment?.trainingKey,
        trainingKind: assignment?.kind,
        trainingCode: assignment?.code || item?.phase,
        trainingTitle: assignment?.title || item?.module,
        eventId: sourceEvent?.id || item?.id,
        eventCode,
        eventDescription,
        eventType,
        date,
        startTime,
        duration,
        resourceId: sourceEvent?.resourceId || initialReport?.resourceId,
        callsign: sourceEvent?.callsign || initialReport?.callsign || staff.callsign,
        instructorName,
        overallGrade,
        overallResult,
        dcoResult,
        assessedElementScores: elementScores,
        groundSchoolAssessment,
        notes: buildReportComments(commentSections),
        status: 'Draft',
        dashboardAcknowledgedAt: now,
        createdAt: initialReport?.createdAt || now,
        createdBy: initialReport?.createdBy || currentUserName,
        updatedAt: now,
        updatedBy: currentUserName,
      });
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
                  readOnly
                  className="mb-2 w-full border-b-2 border-gray-600 bg-transparent text-2xl font-bold text-white outline-none"
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
              <button type="button" className="flex h-[41px] w-[56px] items-center justify-center rounded-md btn-aluminium-brushed px-1 py-1 text-center text-[10px] font-semibold">Edit</button>
              <button type="button" onClick={saveReport} disabled={isSaving || !eventCode} className="flex h-[41px] w-[56px] items-center justify-center rounded-md btn-aluminium-brushed px-1 py-1 text-center text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-40">Save</button>
              <button type="button" className="flex h-[41px] w-[56px] items-center justify-center rounded-md btn-aluminium-brushed px-1 py-1 text-center text-[10px] font-semibold">Delete</button>
              <button type="button" onClick={onCancel} className="flex h-[41px] w-[56px] items-center justify-center rounded-md btn-aluminium-brushed px-1 py-1 text-center text-[10px] font-semibold">Back</button>
              <AuditButton pageName={`${reportTemplate.displayName} Assessment`} />
            </div>
          </div>

          <div className="p-4 md:p-6">
            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <dl className="space-y-2 rounded-lg border border-gray-700 bg-gray-800 p-4 lg:col-span-1">
                <div><dt className="text-sm font-medium text-gray-400">{overviewFields.event}</dt><dd className="mt-1 text-sm font-semibold text-white">{eventCode || 'N/A'}</dd></div>
                <div><dt className="text-sm font-medium text-gray-400">{overviewFields.type}</dt><dd className="mt-1 text-sm text-white">{eventDescription || eventType || 'N/A'}</dd></div>
                <div><dt className="text-sm font-medium text-gray-400">Staff</dt><dd className="mt-1 text-sm font-semibold text-white">{staff.rank} {staff.name}</dd></div>
                <div><dt className="text-sm font-medium text-gray-400">{overviewFields.training}</dt><dd className="mt-1 text-sm font-semibold text-white">{assignment?.code || item?.phase || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-gray-400">{overviewFields.date}</dt><dd className="mt-1"><input type="date" value={date} onChange={(event) => { setDate(event.target.value); setSaveStatus('Unsaved'); }} className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm font-semibold text-white focus:ring-1 focus:ring-sky-500" /></dd></div>
                <div><dt className="text-sm font-medium text-gray-400">{overviewFields.timing}</dt><dd className="mt-1 text-sm font-semibold text-white">{formatDecimalTime(startTime)} - {formatDecimalTime(endTime)}</dd></div>
                <div><dt className="text-sm font-medium text-gray-400">{overviewFields.resource}</dt><dd className="mt-1 text-sm font-semibold text-white">{displayResourceId}</dd></div>
                <div><dt className="text-sm font-medium text-gray-400">{overviewFields.callsign}</dt><dd className="mt-1 text-sm font-semibold text-white">{sourceEvent?.callsign || staff.callsign || '-'}</dd></div>
                <div><dt className="text-sm font-medium text-gray-400">{overviewFields.assessor}</dt><dd className="mt-1"><input value={instructorName} onChange={(event) => { setInstructorName(event.target.value); updateCommentSection('assessor', event.target.value); setSaveStatus('Unsaved'); }} className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm font-semibold text-white focus:ring-1 focus:ring-sky-500" /></dd></div>
              </dl>

              <fieldset className="rounded-lg border border-gray-600 p-4 lg:col-span-2">
                <legend className="px-2 text-sm font-semibold text-gray-300">{reportTemplate.modules.overallAssessment.title}</legend>
                <div className="mb-4 mt-2">
                  <label className="mb-2 block text-sm font-medium text-gray-400">{overallFields.result}</label>
                  <div className="flex flex-col space-y-2">
                    {reportTemplate.completionResults.map((option) => (
                      <label key={option.code} className="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-gray-700/30">
                        <input type="radio" name="training-report-dco-result" value={option.code} checked={dcoResult === option.code} onChange={(event) => { setDcoResult(event.target.value as 'DCO' | 'DPCO' | 'DNCO'); setSaveStatus('Unsaved'); }} className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-500" />
                        <span className="font-medium text-white">{option.label}</span>
                      </label>
                    ))}
                    <label className="flex cursor-pointer items-center space-x-2 rounded p-1 hover:bg-gray-700/30">
                      <input type="radio" name="training-report-dco-result" value="" checked={dcoResult === ''} onChange={() => { setDcoResult(''); setSaveStatus('Unsaved'); }} className="h-4 w-4 border-gray-500 bg-gray-600 accent-sky-500" />
                      <span className="font-medium text-gray-400">None</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400">{overallFields.overallGrade}</label>
                    <div className="mt-1 grid grid-cols-4 gap-2 rounded bg-gray-950/45 p-2 sm:grid-cols-6 xl:grid-cols-12">
                      {overallGradeOptions.map(grade => (
                        <label key={grade || 'No Grade'} title={grade ? formatGradeOption(grade) : 'No Grade'} className={`flex min-h-[64px] cursor-pointer flex-col items-center justify-between rounded border px-1.5 py-2 text-center transition ${overallGrade === grade ? 'border-sky-400 bg-sky-500/15 text-white' : 'border-gray-700 bg-gray-900/80 text-gray-300 hover:border-gray-500'}`}>
                          {grade && reportTemplate.grades.showNumbers && <span className="text-[11px] font-black uppercase leading-none text-white">{formatGradeNumber(grade)}</span>}
                          <span className="flex max-w-full flex-col items-center whitespace-nowrap text-[8px] font-semibold uppercase leading-[0.95] text-gray-300">
                            {(grade ? formatGradeHeaderText(grade) : 'No Grade').split(/\s+/).map((word, index) => <span key={`${word}-${index}`}>{word}</span>)}
                          </span>
                          <input type="radio" name="training-report-overall-grade" value={grade} checked={overallGrade === grade} onChange={() => { setOverallGrade(grade); setSaveStatus('Unsaved'); }} className={`h-4 w-4 ${grade ? getRadioAccentColor(grade) : 'accent-gray-400'} bg-gray-600`} />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-400">{overallFields.overallResult}</label>
                    <div className="mt-1 flex space-x-4">
                      <label className={`w-1/2 cursor-pointer rounded-lg p-4 text-center transition-all duration-200 ${overallResult === 'P' ? 'scale-105 bg-green-600 text-white shadow-lg ring-2 ring-white' : 'bg-green-800/50 text-green-200 hover:bg-green-700/50'}`}>
                        <input type="radio" name="training-report-overall-result" value="P" checked={overallResult === 'P'} onChange={() => { setOverallResult('P'); setSaveStatus('Unsaved'); }} className="sr-only" />
                        <span className="text-2xl font-bold">{reportTemplate.overallResults.passLabel}</span>
                      </label>
                      <label className={`w-1/2 cursor-pointer rounded-lg p-4 text-center transition-all duration-200 ${overallResult === 'F' ? 'scale-105 bg-red-600 text-white shadow-lg ring-2 ring-white' : 'bg-red-800/50 text-red-200 hover:bg-red-700/50'}`}>
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
              </fieldset>
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
            <div className="hidden">
              <label className="block text-sm font-medium text-gray-400">{commentFields.notes}</label>
              <textarea
                value={commentSections.notes}
                onChange={(event) => updateCommentSection('notes', event.target.value)}
                rows={3}
                className="mt-1 w-full resize-none rounded border border-gray-600 bg-gray-700 p-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="Record additional training observations, debrief points, or follow-up actions."
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
