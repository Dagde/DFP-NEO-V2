import React, { useMemo, useState } from 'react';
import type { Instructor, SyllabusItemDetail } from '../../types';
import {
  normaliseAirCombatTrainingAssignments,
  normaliseAirCombatTrainingReports,
  type AirCombatTrainingKind,
} from '../../utils/airCombatTraining';

interface AirCombatOperationalContext {
  locationCode?: string;
  unitCode?: string;
  unitName?: string;
  unitCodes?: string[];
}

interface AirCombatTrainingAnalyticsTabProps {
  instructorsData: Instructor[];
  syllabusDetails: SyllabusItemDetail[];
  operationalContext?: AirCombatOperationalContext;
}

interface AirCombatTrainingStreamSummary {
  key: string;
  kind: AirCombatTrainingKind;
  code: string;
  title: string;
  assignedStaff: Set<string>;
  lmpEvents: SyllabusItemDetail[];
  completedReports: number;
}

const normaliseCode = (value?: string | null): string => String(value || '').trim().toUpperCase();

const getTrainingCodeFromItem = (item: SyllabusItemDetail): string => (
  (item.courses || []).find(Boolean) || item.code || ''
);

const getTrainingTitleFromItem = (item: SyllabusItemDetail, fallback: string): string => (
  item.module && item.module !== fallback ? item.module : (item.eventDescription || fallback)
);

const matchesTrainingAssignment = (
  item: SyllabusItemDetail,
  kind: AirCombatTrainingKind,
  code: string,
  unitCode?: string,
): boolean => {
  const itemKind: AirCombatTrainingKind = item.lmpType === 'Staff CAT' ? 'training_package' : 'course';
  if (itemKind !== kind) return false;
  const itemCode = normaliseCode(getTrainingCodeFromItem(item));
  const assignmentCode = normaliseCode(code);
  if (itemCode !== assignmentCode && !normaliseCode(item.code).startsWith(assignmentCode)) return false;
  const itemUnit = normaliseCode(item.unit);
  const assignmentUnit = normaliseCode(unitCode);
  return !assignmentUnit || !itemUnit || itemUnit === assignmentUnit;
};

const AirCombatTrainingAnalyticsTab: React.FC<AirCombatTrainingAnalyticsTabProps> = ({
  instructorsData,
  syllabusDetails,
  operationalContext,
}) => {
  const activeUnitCodes = useMemo(() => {
    const rawCodes = operationalContext?.unitCodes && operationalContext.unitCodes.length > 0
      ? operationalContext.unitCodes
      : String(operationalContext?.unitCode || '').split('+');
    return new Set(rawCodes.map(normaliseCode).filter(Boolean));
  }, [operationalContext?.unitCode, operationalContext?.unitCodes]);

  const streams = useMemo(() => {
    const streamMap = new Map<string, AirCombatTrainingStreamSummary>();
    const ensureStream = (kind: AirCombatTrainingKind, code: string, title?: string) => {
      const normalisedCode = normaliseCode(code);
      const key = `${kind}:${normalisedCode}`;
      if (!streamMap.has(key)) {
        streamMap.set(key, {
          key,
          kind,
          code: normalisedCode,
          title: title || normalisedCode,
          assignedStaff: new Set<string>(),
          lmpEvents: [],
          completedReports: 0,
        });
      }
      return streamMap.get(key)!;
    };

    instructorsData.forEach(staff => {
      const staffUnit = normaliseCode(staff.unit);
      if (activeUnitCodes.size > 0 && staffUnit && !activeUnitCodes.has(staffUnit)) return;
      const assignments = normaliseAirCombatTrainingAssignments(staff.preferences);
      [...assignments.courses, ...assignments.trainingPackages].forEach(assignment => {
        const assignmentUnit = normaliseCode(assignment.unitCode || staffUnit);
        if (activeUnitCodes.size > 0 && assignmentUnit && !activeUnitCodes.has(assignmentUnit)) return;
        const stream = ensureStream(assignment.kind, assignment.code, assignment.title);
        stream.assignedStaff.add(staff.name);
      });
      normaliseAirCombatTrainingReports(staff.preferences).forEach(report => {
        if (report.status && report.status !== 'Complete') return;
        if (!report.trainingKind || !report.trainingCode) return;
        const reportUnit = normaliseCode(report.unitCode || staffUnit);
        if (activeUnitCodes.size > 0 && reportUnit && !activeUnitCodes.has(reportUnit)) return;
        const stream = ensureStream(report.trainingKind, report.trainingCode, report.trainingTitle || report.trainingCode);
        stream.completedReports += 1;
      });
    });

    syllabusDetails.forEach(item => {
      streamMap.forEach(stream => {
        if (!matchesTrainingAssignment(item, stream.kind, stream.code)) return;
        stream.lmpEvents.push(item);
        stream.title = getTrainingTitleFromItem(item, stream.title);
      });
    });

    return Array.from(streamMap.values()).sort((left, right) =>
      left.kind.localeCompare(right.kind) ||
      left.code.localeCompare(right.code)
    );
  }, [activeUnitCodes, instructorsData, syllabusDetails]);

  const [selectedStreamKey, setSelectedStreamKey] = useState('');
  const selectedStream = streams.find(stream => stream.key === selectedStreamKey) || streams[0] || null;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
        <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Air Combat Training Analytics</h2>
          <p className="mt-1 text-sm text-slate-400">
            Showing only courses and training packages assigned to staff in the selected unit.
          </p>
        </div>
        <div className="space-y-5 p-5">
          {streams.length > 0 ? (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Current Unit Course / Package
                  </span>
                  <select
                    value={selectedStream?.key || ''}
                    onChange={event => setSelectedStreamKey(event.target.value)}
                    className="min-w-[260px] rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-400"
                  >
                    {streams.map(stream => (
                      <option key={stream.key} value={stream.key}>
                        {stream.kind === 'course' ? 'Course' : 'Package'} {stream.code} - {stream.title}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedStream && (
                  <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-700 bg-slate-950/45 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Assigned Staff</div>
                      <div className="mt-1 text-xl font-bold text-white">{selectedStream.assignedStaff.size}</div>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-950/45 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">LMP Events</div>
                      <div className="mt-1 text-xl font-bold text-cyan-200">{selectedStream.lmpEvents.length}</div>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-950/45 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Completed Reports</div>
                      <div className="mt-1 text-xl font-bold text-emerald-300">{selectedStream.completedReports}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-700/80">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/80 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Assigned Staff</th>
                      <th className="px-4 py-3">LMP Events</th>
                      <th className="px-4 py-3">Completed Reports</th>
                    </tr>
                  </thead>
                  <tbody>
                    {streams.map(stream => (
                      <tr key={stream.key} className="border-t border-slate-800">
                        <td className="px-4 py-3 text-slate-300">{stream.kind === 'course' ? 'Course' : 'Package'}</td>
                        <td className="px-4 py-3 font-semibold text-white">{stream.code}</td>
                        <td className="px-4 py-3 text-slate-300">{stream.title}</td>
                        <td className="px-4 py-3 text-cyan-200">{stream.assignedStaff.size}</td>
                        <td className="px-4 py-3 text-slate-200">{stream.lmpEvents.length}</td>
                        <td className="px-4 py-3 text-emerald-300">{stream.completedReports}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-slate-700 bg-slate-950/45 p-8 text-center text-slate-400">
              No Air Combat courses or training packages are assigned to staff in this unit.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AirCombatTrainingAnalyticsTab;
