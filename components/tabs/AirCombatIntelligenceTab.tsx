import React, { useMemo } from 'react';
import type { Instructor, ScheduleEvent } from '../../types';
import type { ResourceDisplayNames } from '../../utils/resourceDisplayNames';
import {
  getOperationalModelLabel,
  isFixedCrewLikeOperationalModel,
  normaliseOperationalModel,
} from '../../utils/platformConfigService';

interface AirCombatOperationalContext {
  locationCode?: string;
  unitCode?: string;
  unitName?: string;
  unitCodes?: string[];
  isSharedFleetContext?: boolean;
}

interface AirCombatIntelligenceTabProps {
  date: string;
  events: ScheduleEvent[];
  instructorsData: Instructor[];
  currentAircraftAvailable?: number;
  totalAircraft?: number;
  resourceDisplayNames: ResourceDisplayNames;
  operationalContext?: AirCombatOperationalContext;
  operationalModel?: unknown;
}

interface CrewRoleCount {
  role: string;
  count: number;
}

const numberLabel = (value: number, digits = 0): string => (
  value.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })
);

const timeLabel = (value: number | undefined): string => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'N/A';
  const hours = Math.floor(numeric);
  const minutes = Math.round((numeric - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const dateLabel = (value: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
};

const normaliseRole = (value: unknown): string => String(value || 'Unassigned').trim() || 'Unassigned';
const normaliseName = (value: unknown): string => String(value || '').trim().toLowerCase();
const isPlaceholderCrewValue = (value: unknown): boolean => {
  const text = String(value || '').trim();
  return !text || /^TBA$/i.test(text) || /^Pooled Crew$/i.test(text) || /^Solo$/i.test(text);
};

const eventStaffNames = (event: ScheduleEvent): string[] => {
  const names = [
    event.instructor,
    event.pilot,
    event.crew,
    event.student,
    ...((event.attendees || []) as string[]),
  ]
    .map(name => String(name || '').trim())
    .filter(name => !isPlaceholderCrewValue(name) && !/^CREW\s*\d+/i.test(name));
  return [...new Set(names)];
};

const eventPicName = (event: ScheduleEvent): string => (
  String(event.fixedCrewPic || event.pilot || event.instructor || '').trim()
);

const eventPartnerNames = (event: ScheduleEvent): string[] => {
  const picKey = normaliseName(eventPicName(event));
  return eventStaffNames(event).filter(name => normaliseName(name) !== picKey);
};

const eventCode = (event: ScheduleEvent): string => (
  String(event.eventCode || event.flightNumber || event.taskingDisplayLabel || event.taskingName || '').trim().toUpperCase()
);

const isTaskingEvent = (event: ScheduleEvent): boolean => (
  Boolean(event.isTaskingRequest || event.taskingRequestId || event.taskingName)
);

const isCurrencyEvent = (event: ScheduleEvent): boolean => (
  Boolean(event.currency || event.currencyDraftId || event.eventCategory === 'currency' || event.eventCategory === 'lmp_currency')
);

const trainingFamily = (event: ScheduleEvent): 'course' | 'package' | 'other' => {
  const code = eventCode(event);
  if (/^(AA|ATA|ATC|BFM|ACM|AWI|TAC|FTR)/.test(code)) return 'course';
  if (/^(IC|ICO|FORM|PKG|TP)/.test(code)) return 'package';
  if (event.eventCategory === 'lmp_event') return 'course';
  return 'other';
};

const StatCard: React.FC<{ label: string; value: string; subtext?: string; accent?: string }> = ({ label, value, subtext, accent = 'text-white' }) => (
  <div className="rounded-lg border border-slate-700/80 bg-slate-950/45 p-4">
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
    <div className={`mt-2 text-2xl font-bold ${accent}`}>{value}</div>
    {subtext && <div className="mt-1 text-xs text-slate-400">{subtext}</div>}
  </div>
);

const AirCombatIntelligenceTab: React.FC<AirCombatIntelligenceTabProps> = ({
  date,
  events,
  instructorsData,
  currentAircraftAvailable,
  totalAircraft,
  resourceDisplayNames,
  operationalContext,
  operationalModel,
}) => {
  const model = normaliseOperationalModel(operationalModel);
  const isFixedCrewLike = isFixedCrewLikeOperationalModel(model);
  const modelLabel = getOperationalModelLabel(model);

  const analysis = useMemo(() => {
    const roleCounts = new Map<string, number>();
    const scheduledRoleCounts = new Map<string, number>();
    const staffByName = new Map<string, Instructor>();
    instructorsData.forEach(person => {
      staffByName.set(normaliseName(person.name), person);
      const role = normaliseRole(person.role);
      roleCounts.set(role, Number(roleCounts.get(role) || 0) + 1);
    });
    const crewRoles: CrewRoleCount[] = [...roleCounts.entries()]
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count || a.role.localeCompare(b.role));

    const activeEvents = events.filter(event => !event.isCancelled);
    const flightEvents = activeEvents.filter(event => event.type === 'flight');
    const simulatorEvents = activeEvents.filter(event => event.type === 'ftd' || event.type === 'cpt');
    const groundEvents = activeEvents.filter(event => event.type === 'ground');
    const nightEvents = activeEvents.filter(event => event.dayNight === 'Night');
    const formationEvents = activeEvents.filter(event => Number(event.formationSize || 0) > 1 || Boolean(event.formationId));
    const taskingEvents = activeEvents.filter(isTaskingEvent);
    const currencyEvents = activeEvents.filter(isCurrencyEvent);
    const courseEvents = activeEvents.filter(event => trainingFamily(event) === 'course');
    const packageEvents = activeEvents.filter(event => trainingFamily(event) === 'package');
    const assessmentEvents = activeEvents.filter(event => Boolean((event as any).assessmentRequired));

    const flightHours = flightEvents.reduce((sum, event) => sum + (Number(event.duration) || 0), 0);
    const simulatorHours = simulatorEvents.reduce((sum, event) => sum + (Number(event.duration) || 0), 0);
    const crewedFlights = flightEvents.filter(event => event.flightType === 'Dual' || Boolean(event.crewRequirement));
    const missingPilot = flightEvents.filter(event => !eventPicName(event));
    const missingCrew = crewedFlights.filter(event => eventPartnerNames(event).length === 0);
    const soloAnomalies = isFixedCrewLike
      ? flightEvents.filter(event => (
          event.flightType === 'Solo'
          || event.soloOrDual === 'Solo'
          || /^Solo$/i.test(String(event.crew || '').trim())
          || eventPartnerNames(event).length === 0
        ))
      : [];
    const uniqueCrew = new Set(activeEvents.flatMap(eventStaffNames));
    uniqueCrew.forEach(name => {
      const staff = staffByName.get(normaliseName(name));
      if (!staff) return;
      const role = normaliseRole(staff.role);
      scheduledRoleCounts.set(role, Number(scheduledRoleCounts.get(role) || 0) + 1);
    });
    const crewGroupValues = new Set(
      flightEvents
        .map(event => String(event.fixedCrewGroup || event.crew || '').trim())
        .filter(value => value && !isPlaceholderCrewValue(value))
    );
    const aircraftUsed = new Set(
      flightEvents
        .map(event => String(event.resourceId || '').trim())
        .filter(resourceId => resourceId && !resourceId.startsWith('STBY') && !resourceId.startsWith('BNF-STBY'))
    );
    const firstFlight = flightEvents.reduce<ScheduleEvent | null>((first, event) => (
      !first || Number(event.startTime) < Number(first.startTime) ? event : first
    ), null);
    const lastFlight = flightEvents.reduce<ScheduleEvent | null>((last, event) => {
      const end = Number(event.startTime || 0) + Number(event.duration || 0);
      const lastEnd = last ? Number(last.startTime || 0) + Number(last.duration || 0) : -1;
      return end > lastEnd ? event : last;
    }, null);

    return {
      crewRoles,
      activeEvents,
      flightEvents,
      simulatorEvents,
      groundEvents,
      nightEvents,
      formationEvents,
      taskingEvents,
      currencyEvents,
      courseEvents,
      packageEvents,
      assessmentEvents,
      flightHours,
      simulatorHours,
      missingPilot,
      missingCrew,
      soloAnomalies,
      uniqueCrew,
      crewGroupValues,
      scheduledRoleCounts,
      aircraftUsed,
      firstFlight,
      lastFlight,
    };
  }, [events, instructorsData, isFixedCrewLike]);

  const unitLabel = [
    operationalContext?.locationCode,
    operationalContext?.unitCode || operationalContext?.unitName,
  ].filter(Boolean).join(' - ') || 'Current unit';
  const lastFlightEnd = analysis.lastFlight
    ? Number(analysis.lastFlight.startTime || 0) + Number(analysis.lastFlight.duration || 0)
    : undefined;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-cyan-500/25 bg-slate-900/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">{modelLabel}</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Operational Build Intelligence</h2>
            <p className="mt-1 text-sm text-slate-400">
              Current DFP signal for {unitLabel} on {dateLabel(date)}. Data is scoped to this unit or combined-unit operating context.
            </p>
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-950/60 px-4 py-3 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Aircraft context</div>
            <div className="mt-1 text-lg font-bold text-cyan-100">
              {numberLabel(Number(currentAircraftAvailable ?? 0))} / {numberLabel(Number(totalAircraft ?? 0))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Flight events" value={numberLabel(analysis.flightEvents.length)} subtext={`${numberLabel(analysis.flightHours, 1)} scheduled flight hours`} accent="text-sky-200" />
        <StatCard label="Simulator / CPT" value={numberLabel(analysis.simulatorEvents.length)} subtext={`${numberLabel(analysis.simulatorHours, 1)} scheduled simulator hours`} accent="text-teal-200" />
        <StatCard label="Crew scheduled" value={numberLabel(analysis.uniqueCrew.size)} subtext={`${numberLabel(analysis.aircraftUsed.size)} aircraft rows used`} accent="text-emerald-200" />
        <StatCard label="Training mix" value={`${numberLabel(analysis.courseEvents.length)} / ${numberLabel(analysis.packageEvents.length)}`} subtext="Course / package coded events" accent="text-amber-200" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-slate-700/80 bg-slate-900/80 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Crew And Resource Health</h3>
              <p className="mt-1 text-sm text-slate-400">Shows whether the current DFP has the required operational crew, resources and training mix loaded.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatCard
              label="Missing PIC"
              value={numberLabel(analysis.missingPilot.length)}
              subtext="Flight tiles without a primary pilot/PIC"
              accent={analysis.missingPilot.length > 0 ? 'text-rose-200' : 'text-emerald-200'}
            />
            <StatCard
              label={isFixedCrewLike ? 'Missing crew partner' : 'Missing second crew'}
              value={numberLabel(analysis.missingCrew.length)}
              subtext="Crewed flight tiles without another assigned person"
              accent={analysis.missingCrew.length > 0 ? 'text-rose-200' : 'text-emerald-200'}
            />
            <StatCard
              label={isFixedCrewLike ? 'Solo anomalies' : 'Formation events'}
              value={numberLabel(isFixedCrewLike ? analysis.soloAnomalies.length : analysis.formationEvents.length)}
              subtext={isFixedCrewLike ? 'Crew model flights that look under-crewed' : 'Events with formation id or size above one'}
              accent={isFixedCrewLike && analysis.soloAnomalies.length > 0 ? 'text-rose-200' : 'text-violet-200'}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatCard label="Taskings" value={numberLabel(analysis.taskingEvents.length)} subtext="Marked tasking requests" accent="text-orange-200" />
            <StatCard label="Currency" value={numberLabel(analysis.currencyEvents.length)} subtext="Currency marked events" accent="text-fuchsia-200" />
            <StatCard label={isFixedCrewLike ? 'Assessment events' : 'Night'} value={numberLabel(isFixedCrewLike ? analysis.assessmentEvents.length : analysis.nightEvents.length)} subtext={isFixedCrewLike ? 'Events requiring a training report/assessment' : 'Night-coded events on this DFP'} accent="text-indigo-200" />
          </div>
        </section>

        <section className="rounded-lg border border-slate-700/80 bg-slate-900/80 p-4">
          <h3 className="text-lg font-semibold text-white">Staff Role Mix</h3>
          <p className="mt-1 text-sm text-slate-400">Roles loaded and used for this unit context. These roles should drive crew selection and seat eligibility.</p>
          <div className="mt-4 space-y-2">
            {analysis.crewRoles.map(role => (
              <div key={role.role} className="flex items-center justify-between rounded-md border border-slate-700/70 bg-slate-950/50 px-3 py-2">
                <div>
                  <span className="text-sm font-semibold text-slate-200">{role.role}</span>
                  <span className="ml-2 text-xs text-slate-500">{numberLabel(analysis.scheduledRoleCounts.get(role.role) || 0)} scheduled</span>
                </div>
                <span className="text-sm font-bold text-cyan-200">{role.count}</span>
              </div>
            ))}
            {analysis.crewRoles.length === 0 && (
              <div className="rounded-md border border-slate-700/70 bg-slate-950/50 px-3 py-4 text-sm text-slate-400">
                No staff roles are loaded for this context.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-700/80 bg-slate-900/80 p-4">
        <h3 className="text-lg font-semibold text-white">Flying Window Use</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <StatCard label="First flight" value={timeLabel(analysis.firstFlight?.startTime)} subtext={analysis.firstFlight ? eventCode(analysis.firstFlight) || 'Flight event' : 'No flight events'} />
          <StatCard label="Last landing" value={timeLabel(lastFlightEnd)} subtext={analysis.lastFlight ? eventCode(analysis.lastFlight) || 'Flight event' : 'No flight events'} />
          <StatCard label={resourceDisplayNames.aircraft || 'Aircraft'} value={numberLabel(analysis.aircraftUsed.size)} subtext="Distinct aircraft/resource rows used" />
          <StatCard label={isFixedCrewLike ? 'Crew groups' : 'Ground events'} value={numberLabel(isFixedCrewLike ? analysis.crewGroupValues.size : analysis.groundEvents.length)} subtext={isFixedCrewLike ? 'Distinct crew groups/crew labels on flight events' : 'Non-flying scheduled events'} />
        </div>
      </section>
    </div>
  );
};

export default AirCombatIntelligenceTab;
