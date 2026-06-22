import React, { useEffect, useRef, useState } from 'react';
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
    const mainScrollRef = useRef<HTMLElement | null>(null);
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

    const fixedCrewPlannerSections = {
        'events-builder': [
            { label: 'Highest Priority', target: '.highest-priority-events-card' },
            { label: 'Tasking', target: '.tasking-events-card' },
            { label: 'Consolidated Currency Event Build', target: '.consolidated-currency-card' },
            { label: 'Specific Currency Requests', target: '.specific-currency-card' },
            { label: 'Flights', target: '.specific-currency-card' },
            { label: `${resourceLabels.ftd} / FTD`, target: '.specific-currency-card' },
            { label: 'Bulk Currency Builder', target: '.bulk-currency-card' },
            { label: 'Optional Currency Events', target: '.optional-currency-card' },
            { label: 'Currency Flights', target: '.optional-currency-card' },
            { label: `Currency ${resourceLabels.ftd} / FTDs`, target: '.optional-currency-card' },
            { label: 'Remedial Priority Queue', target: '.remedial-priority-card' },
        ],
        'build-priorities': [
            { label: 'Flying Windows & Capacity', target: '.section-build-timeline' },
            { label: 'Flying Windows', target: '.flying-windows-card' },
            { label: 'Resource Capacity', target: '.resource-capacity-card' },
            { label: 'Course Demand', target: '.section-course-demand' },
            { label: 'Course Priority', target: '.course-priority-card' },
            { label: 'Fixed Crew Course & Package Priority', target: '.fixed-crew-course-package-priority-card' },
        ],
    };

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
    const scrollPlannerToTop = () => {
        window.requestAnimationFrame(() => {
            mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        });
    };
    const handleFixedCrewTabClick = (tabId: FixedCrewPlannerTab) => {
        setActiveFixedCrewTab(tabId);
        setActiveSection(tabId === 'events-builder' ? 'directed-events' : 'build-timeline');
        scrollPlannerToTop();
    };
    const handleFixedCrewSectionClick = (target: string) => {
        const targetSection: PrioritiesSection = activeFixedCrewTab === 'events-builder' ? 'directed-events' : (target.includes('course') ? 'course-demand' : 'build-timeline');
        setActiveSection(targetSection);
        window.setTimeout(() => {
            const scrollRoot = mainScrollRef.current;
            const element = scrollRoot?.querySelector<HTMLElement>(target);
            if (!scrollRoot || !element) {
                scrollPlannerToTop();
                return;
            }
            const rootTop = scrollRoot.getBoundingClientRect().top;
            const elementTop = element.getBoundingClientRect().top;
            scrollRoot.scrollTo({
                top: scrollRoot.scrollTop + elementTop - rootTop - 16,
                behavior: 'smooth',
            });
        }, 80);
    };

    return (
        <div data-priorities-view="true" className="flex-1 flex overflow-hidden bg-slate-950 text-slate-100">
            <aside className={`${isFixedCrewModel ? 'w-[220px]' : 'w-80'} bg-slate-950/95 border-r border-slate-700/60 flex flex-col flex-shrink-0`}>
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
                <nav className={`flex-1 overflow-y-auto ${isFixedCrewModel ? 'p-0' : 'p-4 space-y-3'}`}>
                    {isFixedCrewModel && (
                        <div className="flex w-[220px] border-b border-slate-700/60">
                            {fixedCrewTabs.map(tab => {
                                const isActive = activeFixedCrewTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => handleFixedCrewTabClick(tab.id)}
                                        className={`flex h-[41px] w-[110px] items-center justify-center border-b px-2 text-center text-[11px] font-bold leading-tight transition ${
                                            isActive
                                                ? 'border-cyan-300 bg-cyan-500/15 text-cyan-50 shadow shadow-cyan-950/30'
                                                : 'border-transparent bg-slate-900/70 text-slate-300 hover:bg-slate-800/80'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {isFixedCrewModel && (
                        <div
                            key={activeFixedCrewTab}
                            className="mx-3 mt-3 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900/55 animate-[fixedCrewPlannerDrop_220ms_ease-out]"
                        >
                            <div className="border-b border-slate-700/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Sections
                            </div>
                            <div className="space-y-1 p-2">
                                {fixedCrewPlannerSections[activeFixedCrewTab].map((section) => (
                                    <button
                                        key={`${activeFixedCrewTab}-${section.label}`}
                                        type="button"
                                        onClick={() => handleFixedCrewSectionClick(section.target)}
                                        className="block w-full rounded-md px-2 py-1.5 text-left text-[11px] font-semibold leading-snug text-slate-300 transition hover:bg-cyan-500/10 hover:text-cyan-100"
                                    >
                                        {section.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {!isFixedCrewModel && <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Build Flow</p>}
                    {!isFixedCrewModel && visibleWorkflowItems.map((item) => {
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

            <main ref={mainScrollRef} className="flex-1 overflow-y-auto bg-slate-950">
                <style>{`
                    @keyframes fixedCrewPlannerDrop {
                        from { max-height: 0; opacity: 0; transform: translateY(-6px); }
                        to { max-height: 520px; opacity: 1; transform: translateY(0); }
                    }
                    .priorities-content .section-build-timeline,
                    .priorities-content .section-course-demand,
                    .priorities-content .section-directed-events,
                    .priorities-content .flying-windows-card,
                    .priorities-content .resource-capacity-card,
                    .priorities-content .course-priority-card,
                    .priorities-content .fixed-crew-course-package-priority-card,
                    .priorities-content .tasking-events-card,
                    .priorities-content .specific-currency-card,
                    .priorities-content .bulk-currency-card,
                    .priorities-content .consolidated-currency-card,
                    .priorities-content .highest-priority-events-card,
                    .priorities-content .optional-currency-card,
                    .priorities-content .remedial-priority-card {
                        scroll-margin-top: 16px;
                    }
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
                                {!isFixedCrewModel && <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-cyan-300/60 bg-cyan-300/10 text-sm font-bold text-cyan-100">
                                    {activeWorkflowItem.step}
                                </div>}
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
