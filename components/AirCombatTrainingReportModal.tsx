import React, { useMemo, useState } from 'react';
import { AirCombatTrainingAssignment, AirCombatTrainingReport, Instructor, ScheduleEvent, SyllabusItemDetail } from '../types';
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
  onCancel: () => void;
  onSave: (report: AirCombatTrainingReport) => Promise<void> | void;
}

const formatDecimalTime = (time?: number): string => {
  if (!Number.isFinite(Number(time))) return '-';
  const hours = Math.floor(Number(time));
  const minutes = Math.round((Number(time) - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

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
  const formatGradeOption = (value: number) => {
    const label = gradeLabelMap.get(value) || `Grade ${value}`;
    return reportTemplate.grades.showNumbers ? `${value} - ${label}` : label;
  };
  const eventCode = item?.code || sourceEvent?.flightNumber || initialReport?.eventCode || '';
  const eventDescription = item?.eventDescription || sourceEvent?.notes || initialReport?.eventDescription || item?.module || '';
  const eventType = item?.type || sourceEvent?.type || initialReport?.eventType || '';
  const defaultDate = sourceEvent?.date || initialReport?.date || new Date().toISOString().slice(0, 10);
  const defaultStart = Number(sourceEvent?.startTime ?? initialReport?.startTime ?? 8);
  const defaultDuration = Number(sourceEvent?.duration ?? initialReport?.duration ?? item?.totalEventHours ?? item?.duration ?? item?.flightOrSimHours ?? 1);

  const [date, setDate] = useState(initialReport?.date || defaultDate);
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
  const updateCommentSection = (key: CommentSectionKey, value: string) => {
    setCommentSections(prev => ({ ...prev, [key]: value }));
    if (key === 'assessor') {
      setInstructorName(value);
    }
  };
  const gradeOptions = reportTemplate.grades.options.map(option => String(option.value));
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

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4" onKeyDownCapture={stopEditableKeyPropagation}>
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-gray-600 bg-gray-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-700 bg-gray-800 px-5 py-4">
          <div>
            <h3 className="text-xl font-bold text-white">{reportTemplate.displayName} {reportTemplate.genericName}</h3>
            <p className="mt-1 text-sm text-gray-400">{staff.rank} {staff.name} - {staff.unit || unitCode || 'Air Combat'}</p>
          </div>
          <button type="button" onClick={onCancel} className="text-2xl text-gray-400 hover:text-white">x</button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(420px,1.6fr)]">
            <dl className="space-y-3 rounded-lg border border-gray-700 bg-gray-800/75 p-4">
              {detailCell(overviewFields.event, eventCode)}
              {detailCell(overviewFields.training, assignment?.code || item?.phase || '-')}
              {detailCell(overviewFields.type, eventType)}
              {detailCell('Staff', `${staff.rank} ${staff.name}`)}
              <div>
                <dt className="text-sm font-medium text-gray-400">{overviewFields.date}</dt>
                <dd className="mt-1">
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm font-semibold text-white focus:border-sky-400 focus:outline-none"
                  />
                </dd>
              </div>
              {detailCell(overviewFields.timing, `${formatDecimalTime(defaultStart)} - ${formatDecimalTime(defaultStart + defaultDuration)} (${defaultDuration}h)`)}
              {detailCell(overviewFields.resource, sourceEvent?.resourceId || '-')}
              {detailCell(overviewFields.callsign, sourceEvent?.callsign || staff.callsign || '-')}
              {detailCell(overviewFields.unit, unitCode || staff.unit || '-')}
              <div>
                <dt className="text-sm font-medium text-gray-400">{overviewFields.assessor}</dt>
                <dd className="mt-1">
                  <input
                    value={instructorName}
                    onChange={(event) => {
                      setInstructorName(event.target.value);
                      updateCommentSection('assessor', event.target.value);
                    }}
                    className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm font-semibold text-white focus:border-sky-400 focus:outline-none"
                  />
                </dd>
              </div>
            </dl>

            <div className="space-y-4">
              <div className="rounded-lg border border-gray-700 bg-gray-950/55 p-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">{reportTemplate.modules.overview.title}</div>
                <div className="text-xl font-bold text-white">{eventCode || 'Training Event'}</div>
                <div className="mt-1 text-sm text-gray-300">{eventDescription || 'No event description recorded.'}</div>
              </div>

              <fieldset className="rounded-lg border border-gray-600 p-4">
                <legend className="px-2 text-sm font-semibold text-gray-300">{reportTemplate.modules.overallAssessment.title}</legend>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-400">{overallFields.result}</label>
                    <div className="mt-2 grid gap-2">
                      {reportTemplate.completionResults.map((option) => (
                        <label key={option.code} className="flex items-center gap-2 rounded p-1 text-sm hover:bg-gray-700/40">
                          <input
                            type="radio"
                            name="training-report-dco-result"
                            value={option.code}
                            checked={dcoResult === option.code}
                            onChange={(event) => setDcoResult(event.target.value as 'DCO' | 'DPCO' | 'DNCO')}
                            className="h-4 w-4 accent-sky-500"
                          />
                          <span className="font-medium text-white">{option.label}</span>
                        </label>
                      ))}
                      <label className="flex items-center gap-2 rounded p-1 text-sm hover:bg-gray-700/40">
                        <input
                          type="radio"
                          name="training-report-dco-result"
                          value=""
                          checked={dcoResult === ''}
                          onChange={() => setDcoResult('')}
                          className="h-4 w-4 accent-sky-500"
                        />
                        <span className="font-medium text-gray-400">None</span>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400">{overallFields.overallGrade}</label>
                      <div className="mt-2 grid grid-cols-4 gap-2 rounded bg-gray-950/45 p-2 sm:grid-cols-6">
                        <label className="flex min-h-[44px] cursor-pointer items-center justify-center rounded border border-gray-700 px-2 text-xs font-bold text-gray-300 hover:bg-white/5">
                          <input type="radio" name="training-report-overall-grade" checked={overallGrade === ''} onChange={() => setOverallGrade('')} className="sr-only" />
                          None
                        </label>
                        {gradeOptions.map((grade) => (
                          <label key={grade} title={formatGradeOption(Number(grade))} className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded border px-2 text-sm font-black hover:bg-white/5 ${overallGrade === grade ? 'border-sky-400 bg-sky-500/20 text-sky-100' : 'border-gray-700 text-white'}`}>
                            <input type="radio" name="training-report-overall-grade" value={grade} checked={overallGrade === grade} onChange={() => setOverallGrade(grade)} className="sr-only" />
                            {reportTemplate.grades.showNumbers ? grade : formatGradeOption(Number(grade))}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400">{overallFields.overallResult}</label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setOverallResult('P')} className={`rounded border px-3 py-3 text-lg font-black ${overallResult === 'P' ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-gray-700 bg-gray-950/50 text-gray-400'}`}>{reportTemplate.overallResults.passLabel}</button>
                        <button type="button" onClick={() => setOverallResult('F')} className={`rounded border px-3 py-3 text-lg font-black ${overallResult === 'F' ? 'border-red-400 bg-red-500/20 text-red-200' : 'border-gray-700 bg-gray-950/50 text-gray-400'}`}>{reportTemplate.overallResults.failLabel}</button>
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(180px,0.85fr)_minmax(360px,1.7fr)_120px]">
              <div>
                <label className="block text-sm font-medium text-gray-400">{commentFields.assessor}</label>
                <input
                  value={commentSections.assessor}
                  onChange={(event) => updateCommentSection('assessor', event.target.value)}
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-700 p-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">{commentFields.weather}</label>
                <textarea
                  value={commentSections.weather}
                  onChange={(event) => updateCommentSection('weather', event.target.value)}
                  rows={1}
                  className="mt-1 w-full resize-none rounded border border-gray-600 bg-gray-700 p-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">{commentFields.nest}</label>
                <input
                  value={commentSections.nest}
                  onChange={(event) => updateCommentSection('nest', event.target.value)}
                  maxLength={8}
                  className="mt-1 w-full rounded border border-gray-600 bg-gray-700 p-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400">{commentFields.profile}</label>
              <textarea
                value={commentSections.profile}
                onChange={(event) => updateCommentSection('profile', event.target.value)}
                rows={4}
                className="mt-1 w-full resize-none rounded border border-gray-600 bg-gray-700 p-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">{commentFields.overall}</label>
              <textarea
                value={commentSections.overall}
                onChange={(event) => updateCommentSection('overall', event.target.value)}
                rows={5}
                className="mt-1 w-full resize-none rounded border border-gray-600 bg-gray-700 p-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
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

          <fieldset className="rounded-lg border border-gray-700 p-4">
            <legend className="px-2 text-sm font-semibold text-gray-300">{reportTemplate.modules.assessmentMatrix.title}</legend>
            <div className="mt-2 overflow-x-auto rounded-md border border-gray-800/80">
              <table className="min-w-[760px] w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-[220px]" />
                  {gradeOptions.map(grade => <col key={grade} className="w-[56px]" />)}
                  <col className="w-[260px]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="px-2 pb-2 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">Element</th>
                    {gradeOptions.map(grade => (
                      <th key={grade} title={formatGradeOption(Number(grade))} className="px-1 pb-2 text-center text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        {reportTemplate.grades.showNumbers ? grade : formatGradeOption(Number(grade))}
                      </th>
                    ))}
                    <th className="px-2 pb-2 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {assessmentElements.map(element => (
                    <tr key={element} className="border-t border-gray-700">
                      <td className="py-3 pr-3 align-middle font-semibold text-white">{element}</td>
                      {gradeOptions.map(grade => (
                        <td key={grade} className="border-l border-gray-800 px-1 py-3 text-center align-middle">
                          <span className="inline-flex h-4 w-4 rounded-full border border-gray-600 bg-gray-900" aria-hidden="true" />
                        </td>
                      ))}
                      <td className="py-3 pl-3 pr-2 align-middle text-sm text-gray-500">Use comment fields above.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-500">Assessed elements are drawn from the selected course/package settings.</p>
          </fieldset>
          {saveError && (
            <div className="rounded border border-red-500/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {saveError}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-700 px-5 py-4">
          <button type="button" onClick={onCancel} className="h-10 min-w-[96px] rounded-md btn-aluminium-brushed text-sm font-semibold">Cancel</button>
          <button
            type="button"
            disabled={isSaving || !eventCode}
            onClick={async () => {
              setIsSaving(true);
              setSaveError('');
              try {
                const now = new Date().toISOString();
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
                  startTime: defaultStart,
                  duration: defaultDuration,
                  resourceId: sourceEvent?.resourceId || initialReport?.resourceId,
                  callsign: sourceEvent?.callsign || initialReport?.callsign || staff.callsign,
                  instructorName,
                  overallGrade,
                  overallResult,
                  dcoResult,
                  notes: buildReportComments(commentSections),
                  status: 'Draft',
                  dashboardAcknowledgedAt: now,
                  createdAt: initialReport?.createdAt || now,
                  createdBy: initialReport?.createdBy || currentUserName,
                  updatedAt: now,
                  updatedBy: currentUserName,
                });
              } catch (error) {
                setSaveError(error instanceof Error ? error.message : String(error));
              } finally {
                setIsSaving(false);
              }
            }}
            className="h-10 min-w-[128px] rounded-md btn-aluminium-brushed text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default AirCombatTrainingReportModal;
