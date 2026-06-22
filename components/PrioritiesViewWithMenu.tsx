import React, { useEffect, useState } from 'react';
import { PrioritiesView } from './PrioritiesView';
import AuditButton from './AuditButton';
import { Instructor, Trainee, ScheduleEvent, SctRequest, SyllabusItemDetail, Score, RemedialRequest, FlyingWindowExclusionPeriod } from '../types';
import { InstructorPriorityConfig } from '../App';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import type { AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import type { AirCombatSchedulingWeights } from '../utils/airCombatTraining';
import type { FixedCrewTrainingStreamPriority } from '../utils/fixedCrewTraining';
import type { AircraftCrewComposition } from '../utils/aircraftCrewComposition';
import type { CrewPositionTerminology } from '../utils/crewPositionTerminology';
import type { CrewCompositionSettings } from '../utils/crewCompositionProfiles';
import type { UnitCallsignSettings } from '../utils/unitCallsigns';
import { stopEditableKeyPropagation } from '../utils/editableKeyEvents';

interface PrioritiesViewWithMenuProps {
  school: string;
  coursePriorities: string[];
  onUpdatePriorities: (newOrder: string[]) => void;
  coursePercentages: Map<string, number>;
  onUpdatePercentages: (newPercentages: Map<string, number>) => void;
  availableAircraftCount: number;
  onUpdateAircraftCount: (count: number) => void;
  maxAircraftCount?: number;
  aircraftConfigurationDefinitions?: AircraftConfigurationDefinition[];
  aircraftConfigCapacities?: Record<string, string>;
  onUpdateAircraftConfigCapacities?: (capacities: Record<string, string>) => void;
  availableFtdCount: number;
  onUpdateFtdCount: (count: number) => void;
  maxFtdCount?: number;
  availableCptCount: number;
  onUpdateCptCount: (count: number) => void;
  maxCptCount?: number;
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
  activeUnitCode?: string;
  activeUnitCodes?: string[];
  airCombatSchedulingWeights?: AirCombatSchedulingWeights;
  onUpdateAirCombatSchedulingWeights?: (weights: AirCombatSchedulingWeights) => void;
  fixedCrewTrainingPriorities?: FixedCrewTrainingStreamPriority[];
  onUpdateFixedCrewTrainingPriorities?: (priorities: FixedCrewTrainingStreamPriority[]) => void;
  isSingleSeatAircraft?: boolean;
  aircraftCrewComposition?: AircraftCrewComposition;
  aircraftTypeCode?: string | null;
  crewPositionTerminology?: CrewPositionTerminology;
  crewCompositionSettings?: CrewCompositionSettings;
  standardMissionCrewOptions?: string[];
  unitCallsignSettings?: UnitCallsignSettings;
}

type PrioritiesSection = 'build-timeline' | 'people-rules' | 'course-demand' | 'directed-events';
type FixedCrewPlannerTab = 'events-builder' | 'build-priorities';

export const PrioritiesViewWithMenu: React.FC<PrioritiesViewWithMenuProps> = (props) => {
    const [activeSection, setActiveSection] = useState<PrioritiesSection>('build-timeline');
    const [activeFixedCrewTab, setActiveFixedCrewTab] = useState<FixedCrewPlannerTab>('events-builder');
    const resourceLabels = props.resourceDisplayNames ?? DEFAULT_RESOURCE_DISPLAY_NAMES;
    const locationDisplayName = props.school === 'ESL' ? 'East Sale' : props.school === 'PEA' ? 'Pearce' : props.school;
    const isFixedCrewModel = String(props.operationalModel || '').trim().toLowerCase() === 'fixed_crew';
    const effectiveInstructorPriority = isFixedCrewModel
        ? { ...props.instructorPriority, enabled: false }
        : props.instructorPriority;

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
            hidden: isFixedCrewModel,
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
            description: 'Manage currency requests, high-priority events and optional currency queues.',
        },
    ].filter(item => !item.hidden);

    const fixedCrewTabs = [
        { id: 'events-builder' as const, label: 'Events Builder' },
        { id: 'build-priorities' as const, label: 'Build Priorities' },
    ];

    const fixedCrewTabItems = activeFixedCrewTab === 'events-builder'
        ? [
            {
                id: 'directed-events' as const,
                step: '01',
                label: 'Events Builder',
                shortLabel: 'Events',
                description: 'Manage priority events, tasking, currency requests and optional queues.',
            },
        ]
        : [
            workflowItems.find(item => item.id === 'build-timeline'),
            workflowItems.find(item => item.id === 'course-demand'),
        ].filter(Boolean) as typeof workflowItems;

    const visibleWorkflowItems = isFixedCrewModel ? fixedCrewTabItems : workflowItems;

    useEffect(() => {
        if (isFixedCrewModel && activeSection === 'people-rules') {
            setActiveSection('build-timeline');
        }
    }, [activeSection, isFixedCrewModel]);

    useEffect(() => {
        if (!isFixedCrewModel) return;
        if (activeFixedCrewTab === 'events-builder') {
            setActiveSection('directed-events');
            return;
        }
        setActiveSection(current => current === 'course-demand' ? current : 'build-timeline');
    }, [activeFixedCrewTab, isFixedCrewModel]);

    const activeWorkflowItem = visibleWorkflowItems.find((item) => item.id === activeSection) ?? visibleWorkflowItems[0] ?? workflowItems[0];
    const fixedCrewPlannerMode = isFixedCrewModel ? activeFixedCrewTab : null;

    return (
        <div data-priorities-view="true" className="flex-1 flex overflow-hidden bg-slate-950 text-slate-100">
            <aside className={`${isFixedCrewModel ? 'w-64' : 'w-80'} bg-slate-950/95 border-r border-slate-700/60 flex flex-col flex-shrink-0`}>
                <div className={`${isFixedCrewModel ? 'p-4' : 'p-5'} border-b border-slate-700/60`}>
                    <div className={`rounded-lg border border-cyan-500/20 bg-cyan-500/10 ${isFixedCrewModel ? 'p-3' : 'p-4'}`}>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">NEO Build</p>
                        <h1 className={`${isFixedCrewModel ? 'mt-1 text-xl' : 'mt-1 text-2xl'} font-bold text-white`}>{isFixedCrewModel ? 'Build Planner' : 'Build Priorities'}</h1>
                        <p className={`${isFixedCrewModel ? 'mt-1 text-xs leading-5' : 'mt-2 text-sm'} text-slate-300`}>
                            {isFixedCrewModel
                                ? 'Plan directed events and build weighting for the Fixed Crew model.'
                                : 'Configure the build in the same order a supervisor would plan the DFP by hand.'}
                        </p>
                    </div>
                </div>
                <nav className={`flex-1 overflow-y-auto ${isFixedCrewModel ? 'p-3 space-y-2' : 'p-4 space-y-3'}`}>
                    {isFixedCrewModel && (
                        <div className="grid grid-cols-1 gap-2">
                            {fixedCrewTabs.map(tab => {
                                const isActive = activeFixedCrewTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveFixedCrewTab(tab.id)}
                                        className={`rounded-md border px-3 py-2 text-left text-xs font-bold transition ${
                                            isActive
                                                ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-50 shadow shadow-cyan-950/30'
                                                : 'border-slate-700/60 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:bg-slate-800/80'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{isFixedCrewModel ? 'Page Order' : 'Build Flow'}</p>
                    {visibleWorkflowItems.map((item) => {
                        const isActive = activeSection === item.id;
                        return (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                            disabled={isFixedCrewModel && activeFixedCrewTab === 'events-builder'}
                            className={`w-full rounded-lg border text-left transition-all ${isFixedCrewModel ? 'p-3' : 'p-4'} ${
                                isActive
                                    ? 'border-cyan-400/70 bg-cyan-500/15 text-white shadow-lg shadow-cyan-950/30'
                                    : 'border-slate-700/60 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800/80'
                            }`}
                        >
                            <div className={`flex items-start ${isFixedCrewModel ? 'gap-2' : 'gap-3'}`}>
                                <span className={`mt-0.5 flex shrink-0 items-center justify-center rounded-md border text-xs font-bold ${isFixedCrewModel ? 'h-7 w-7' : 'h-8 w-8'} ${
                                    isActive ? 'border-cyan-300/70 bg-cyan-300/15 text-cyan-100' : 'border-slate-600 bg-slate-800 text-slate-400'
                                }`}>
                                    {item.step}
                                </span>
                                <span className="min-w-0">
                                    <span className={`${isFixedCrewModel ? 'text-sm' : 'text-base'} block font-semibold`}>{item.label}</span>
                                    <span className={`${isFixedCrewModel ? 'mt-0.5 text-[11px] leading-4' : 'mt-1 text-xs leading-5'} block text-slate-400`}>{item.description}</span>
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
                    ${isFixedCrewModel && fixedCrewPlannerMode === 'events-builder' ? `
                    .priorities-content > div {
                        display: none !important;
                    }
                    .priorities-content > div.section-directed-events {
                        display: flex !important;
                        flex-direction: column;
                    }
                    .section-directed-events > .directed-events-intro-card { display: none !important; }
                    .section-directed-events > .highest-priority-events-card { order: 1; }
                    .section-directed-events > .tasking-events-card { order: 2; }
                    .section-directed-events > .consolidated-currency-card { order: 3; }
                    .section-directed-events > .specific-currency-card { order: 4; }
                    .section-directed-events > .bulk-currency-card { order: 5; }
                    .section-directed-events > .optional-currency-card { order: 6; }
                    .section-directed-events > .remedial-priority-card { order: 7; }
                    ` : isFixedCrewModel && fixedCrewPlannerMode === 'build-priorities' ? `
                    .priorities-content {
                        display: flex;
                        flex-direction: column;
                    }
                    .priorities-content > div {
                        display: none !important;
                    }
                    .priorities-content > div.section-build-timeline,
                    .priorities-content > div.section-course-demand {
                        display: block !important;
                    }
                    .priorities-content > div.section-build-timeline { order: 1; }
                    .priorities-content > div.section-course-demand { order: 2; }
                    ` : `
                    .priorities-content > div:not(.section-${activeSection}) {
                        display: none !important;
                    }
                    .priorities-content > div.section-${activeSection} {
                        display: block !important;
                    }
                    `}
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
                        <PrioritiesView {...props} instructorPriority={effectiveInstructorPriority} activeSection={activeSection} />
                    </div>
                </div>
            </main>
        </div>
    );
};
