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

export const AirCombatTrainingReportModal: React.FC<AirCombatTrainingReportModalProps> = ({
  staff,
  assignment,
  item,
  sourceEvent,
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
  const eventCode = item?.code || sourceEvent?.flightNumber || '';
  const eventDescription = item?.eventDescription || sourceEvent?.notes || item?.module || '';
  const eventType = item?.type || sourceEvent?.type || '';
  const defaultDate = sourceEvent?.date || new Date().toISOString().slice(0, 10);
  const defaultStart = Number(sourceEvent?.startTime ?? 8);
  const defaultDuration = Number(sourceEvent?.duration ?? item?.totalEventHours ?? item?.duration ?? item?.flightOrSimHours ?? 1);

  const [date, setDate] = useState(defaultDate);
  const [instructorName, setInstructorName] = useState(sourceEvent?.instructor || currentUserName || '');
  const [overallGrade, setOverallGrade] = useState('');
  const [overallResult, setOverallResult] = useState<'' | 'P' | 'F'>('');
  const [dcoResult, setDcoResult] = useState<'' | 'DCO' | 'DPCO' | 'DNCO'>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const reportId = useMemo(() => (
    `air-combat-report-${staff.idNumber}-${sourceEvent?.id || item?.id || eventCode}-${Date.now()}`
  ), [eventCode, item?.id, sourceEvent?.id, staff.idNumber]);

  const detailCell = (label: string, value?: React.ReactNode) => (
    <div className="rounded border border-gray-700 bg-gray-950/70 p-3">
      <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value || '-'}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-gray-600 bg-gray-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-700 px-5 py-4">
          <div>
            <h3 className="text-xl font-bold text-white">{reportTemplate.displayName} {reportTemplate.genericName}</h3>
            <p className="mt-1 text-sm text-gray-400">{staff.rank} {staff.name} - {staff.unit || unitCode || 'Air Combat'}</p>
          </div>
          <button type="button" onClick={onCancel} className="text-2xl text-gray-400 hover:text-white">x</button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {detailCell(overviewFields.event, eventCode)}
            {detailCell(overviewFields.training, assignment?.code || item?.phase || '-')}
            {detailCell(overviewFields.type, eventType)}
            {detailCell(overviewFields.timing, `${formatDecimalTime(defaultStart)} / ${defaultDuration}h`)}
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-950/55 p-4">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-gray-400">{reportTemplate.modules.overview.title}</div>
            <div className="text-lg font-bold text-white">{eventCode}</div>
            <div className="mt-1 text-sm text-gray-300">{eventDescription || 'No event description recorded.'}</div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
              {detailCell(overviewFields.resource, sourceEvent?.resourceId || '-')}
              {detailCell(overviewFields.callsign, sourceEvent?.callsign || staff.callsign || '-')}
              {detailCell(overviewFields.unit, unitCode || staff.unit || '-')}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">{overviewFields.date}</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">{overviewFields.assessor}</label>
              <input
                value={instructorName}
                onChange={(event) => setInstructorName(event.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">{overallFields.overallGrade}</label>
              <select value={overallGrade} onChange={(event) => setOverallGrade(event.target.value)} className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none">
                <option value="">No Grade</option>
                {reportTemplate.grades.options.map((option) => (
                  <option key={option.value} value={String(option.value)}>{formatGradeOption(option.value)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">{overallFields.overallResult}</label>
              <select value={overallResult} onChange={(event) => setOverallResult(event.target.value as '' | 'P' | 'F')} className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none">
                <option value="">Not Set</option>
                <option value="P">{reportTemplate.overallResults.passLabel}</option>
                <option value="F">{reportTemplate.overallResults.failLabel}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">{overallFields.result}</label>
              <select value={dcoResult} onChange={(event) => setDcoResult(event.target.value as '' | 'DCO' | 'DPCO' | 'DNCO')} className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none">
                <option value="">Not Set</option>
                {reportTemplate.completionResults.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Status</label>
              <div className="rounded border border-gray-700 bg-gray-950/70 px-3 py-2 text-sm font-semibold text-amber-300">Draft</div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">{commentFields.notes}</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
              placeholder="Record training observations, debrief points, or follow-up actions."
            />
          </div>
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
                  resourceId: sourceEvent?.resourceId,
                  callsign: sourceEvent?.callsign || staff.callsign,
                  instructorName,
                  overallGrade,
                  overallResult,
                  dcoResult,
                  notes,
                  status: 'Draft',
                  createdAt: now,
                  createdBy: currentUserName,
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
