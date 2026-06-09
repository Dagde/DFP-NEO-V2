import React, { useState } from 'react';
import { PrioritiesView } from './PrioritiesView';
import AuditButton from './AuditButton';
import { Instructor, Trainee, ScheduleEvent, SctRequest, SyllabusItemDetail, Score, RemedialRequest, FlyingWindowExclusionPeriod } from '../types';
import { InstructorPriorityConfig } from '../App';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import type { AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import type { AirCombatSchedulingWeights } from '../utils/airCombatTraining';
import { stopEditableKeyPropagation } from '../utils/editableKeyEvents';

interface PrioritiesViewWithMenuProps {
  school: string;
  coursePriorities: string[];
  onUpdatePriorities: (newOrder: string[]) => void;
  coursePercentages: Map<string, number>;
  onUpdatePercentages: (newPercentages: Map<string, number>) => void;
  availableAircraftCount: number;
  onUpdateAircraftCount: (count: number) => void;
  aircraftConfigurationDefinitions?: AircraftConfigurationDefinition[];
  aircraftConfigCapacities?: Record<string, string>;
  onUpdateAircraftConfigCapacities?: (capacities: Record<string, string>) => void;
  availableFtdCount: number;
  onUpdateFtdCount: (count: number) => void;
  availableCptCount: number;
  onUpdateCptCount: (count: number) => void;
  flyingStartTime: number;
  onUpdateFlyingStartTime: (time: number) => void;
  flyingEndTime: number;
  onUpdateFlyingEndTime: (time: number) => void;
  ftdStartTime: number;
  onUpdateFtdStartTime: (time: number) => void;
  ftdEndTime: number;
  onUpdateFtdEndTime: (time: number) => void;
  allowNightFlying: boolean;
  onUpdateAllowNightFlying: (value: boolean) => void;
  commenceNightFlying: number;
  onUpdateCommenceNightFlying: (time: number) => void;
  ceaseNightFlying: number;
  onUpdateCeaseNightFlying: (time: number) => void;
  flyingWindowExclusions: FlyingWindowExclusionPeriod[];
  onUpdateFlyingWindowExclusions: (periods: FlyingWindowExclusionPeriod[]) => void;
  instructorsData: Instructor[];
  traineesData: Trainee[];
  buildDfpDate: string;
  highestPriorityEvents: ScheduleEvent[];
  activeScheduleEvents?: ScheduleEvent[];
  onSelectEvent: (event: ScheduleEvent) => void;
  onAddPriorityEvents: (events: ScheduleEvent[]) => void;
  onUpdatePriorityEvent: (eventId: string, updates: Partial<ScheduleEvent>) => void;
  instructorPriority: InstructorPriorityConfig;
  onUpdateInstructorPriority: (value: InstructorPriorityConfig) => void;
  sctFlights: SctRequest[];
  sctFtds: SctRequest[];
  onAddSctRequest: (type: 'flight' | 'ftd') => void;
  onRemoveSctRequest: (id: string, type: 'flight' | 'ftd') => void;
  onUpdateSctRequest: (id: string, field: keyof SctRequest, value: string, type: 'flight' | 'ftd') => void;
  onSubmitSctRequest: (id: string, type: 'flight' | 'ftd') => void;
  onToggleSctInclude: (id: string, type: 'flight' | 'ftd') => void;
  syllabusDetails: SyllabusItemDetail[];
  scores?: Map<string, Score[]>;
  traineeLMPs?: Map<string, SyllabusItemDetail[]>;
  remedialRequests?: RemedialRequest[];
  onToggleRemedialRequest?: (traineeId: number, eventCode: string) => void;
  onUpdateRemedialAircraftConfig?: (traineeId: number, eventCode: string, aircraftConfigId: string) => void;
  currencyNames: string[];
  resourceDisplayNames?: ResourceDisplayNames;
  taskProfiles?: string[];
  taskProfileAbbreviations?: Record<string, string>;
  operationalModel?: string;
  operationalModelLabel?: string;
  airCombatSchedulingWeights?: AirCombatSchedulingWeights;
  onUpdateAirCombatSchedulingWeights?: (weights: AirCombatSchedulingWeights) => void;
}

type PrioritiesSection = 'build-timeline' | 'people-rules' | 'course-demand' | 'directed-events';

export const PrioritiesViewWithMenu: React.FC<PrioritiesViewWithMenuProps> = (props) => {
    const [activeSection, setActiveSection] = useState<PrioritiesSection>('build-timeline');
    const resourceLabels = props.resourceDisplayNames ?? DEFAULT_RESOURCE_DISPLAY_NAMES;
    const locationDisplayName = props.school === 'ESL' ? 'East Sale' : props.school === 'PEA' ? 'Pearce' : props.school;

    const workflowItems = [
        {
            id: 'build-timeline' as const,
            step: '01',
            label: 'Flying Windows & Capacity',
            shortLabel: 'Time & Resources',
            description: `Set the day, ${resourceLabels.ftd} and night windows, then declare ${resourceLabels.aircraft}, ${resourceLabels.ftd} and ${resourceLabels.cpt} capacity before anything else.`,
        },
        {
            id: 'people-rules' as const,
            step: '02',
            label: 'Instructor Rules',
            shortLabel: 'People',
            description: 'Control how instructor preference or restriction should influence placement.',
        },
        {
            id: 'course-demand' as const,
            step: '03',
            label: 'Course Demand',
            shortLabel: 'Courses',
            description: 'Weight the competing course demand after time and resources are known.',
        },
        {
            id: 'directed-events' as const,
            step: '04',
            label: 'Directed Events',
            shortLabel: 'Exceptions',
            description: 'Manage SCT requests, high-priority events, optional SCT and remedial queues.',
        },
    ];

    const activeWorkflowItem = workflowItems.find((item) => item.id === activeSection) ?? workflowItems[0];

    return (
        <div data-priorities-view="true" className="flex-1 flex overflow-hidden bg-slate-950 text-slate-100">
            <aside className="w-80 bg-slate-950/95 border-r border-slate-700/60 flex flex-col flex-shrink-0">
                <div className="p-5 border-b border-slate-700/60">
                    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/70">NEO Build</p>
                        <h1 className="mt-1 text-2xl font-bold text-white">Build Priorities</h1>
                        <p className="mt-2 text-sm text-slate-300">
                            Configure the build in the same order a supervisor would plan the DFP by hand.
                        </p>
                    </div>
                </div>
                <nav className="flex-1 overflow-y-auto p-4 space-y-3">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Build Flow</p>
                    {workflowItems.map((item) => {
                        const isActive = activeSection === item.id;
                        return (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                            className={`w-full rounded-lg border p-4 text-left transition-all ${
                                isActive
                                    ? 'border-cyan-400/70 bg-cyan-500/15 text-white shadow-lg shadow-cyan-950/30'
                                    : 'border-slate-700/60 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800/80'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${
                                    isActive ? 'border-cyan-300/70 bg-cyan-300/15 text-cyan-100' : 'border-slate-600 bg-slate-800 text-slate-400'
                                }`}>
                                    {item.step}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-base font-semibold">{item.label}</span>
                                    <span className="mt-1 block text-xs leading-5 text-slate-400">{item.description}</span>
                                </span>
                            </div>
                        </button>
                    )})}
                </nav>
                <div className="border-t border-slate-700/60 p-4">
                    <AuditButton pageName="Priorities" />
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto bg-slate-950">
                <style>{`
                    .priorities-content > div:not(.section-${activeSection}) {
                        display: none !important;
                    }
                    .priorities-content > div.section-${activeSection} {
                        display: block !important;
                    }
                `}</style>
                <div className="p-6">
                    <div className="mb-6 rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-cyan-300/60 bg-cyan-300/10 text-sm font-bold text-cyan-100">
                                    {activeWorkflowItem.step}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">{activeWorkflowItem.shortLabel}</p>
                                    <h2 className="mt-1 text-3xl font-bold text-white">{activeWorkflowItem.label}</h2>
                                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{activeWorkflowItem.description}</p>
                                </div>
                            </div>
                            <span className="rounded-md border border-slate-600/70 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-300">
                                {locationDisplayName} build setup
                            </span>
                        </div>
                    </div>
                    <div className="priorities-content" onKeyDownCapture={stopEditableKeyPropagation}>
                        <PrioritiesView {...props} activeSection={activeSection} />
                    </div>
                </div>
            </main>
        </div>
    );
};
