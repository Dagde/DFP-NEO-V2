import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TrashIcon } from '@heroicons/react/24/outline';
import { PrioritiesView } from './PrioritiesView';
import AuditButton from './AuditButton';
import { Instructor, Trainee, ScheduleEvent, SctRequest, SyllabusItemDetail, Score, RemedialRequest, FlyingWindowExclusionPeriod, StandardMissionProfile } from '../types';
import { InstructorPriorityConfig } from '../App';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import type { AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import type { AirCombatSchedulingWeights } from '../utils/airCombatTraining';
import type { FixedCrewTrainingStreamPriority } from '../utils/fixedCrewTraining';
import type { AircraftCrewComposition } from '../utils/aircraftCrewComposition';
import type { CrewPositionTerminology } from '../utils/crewPositionTerminology';
import type { CrewCompositionSettings } from '../utils/crewCompositionProfiles';
import type { UnitCallsignSettings } from '../utils/unitCallsigns';
import type { StaffQualificationCatalogue } from '../utils/staffQualifications';
import { stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import { isFixedCrewLikeOperationalModel } from '../utils/platformConfigService';

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
  scheduledBuildEvents?: ScheduleEvent[];
  publishedScheduleEvents?: ScheduleEvent[];
  onSelectEvent: (event: ScheduleEvent) => void;
  onAddPriorityEvents: (events: ScheduleEvent[]) => void;
  onAddBuildEvents?: (events: ScheduleEvent[]) => void;
  onRemoveBuildDeploymentEvents?: (eventIds: string[]) => void;
  onUpdatePriorityEvent: (eventId: string, updates: Partial<ScheduleEvent>) => void;
  instructorPriority: InstructorPriorityConfig;
  onUpdateInstructorPriority: (value: InstructorPriorityConfig) => void;
  sctFlights: SctRequest[];
  sctFtds: SctRequest[];
  sctEvents?: any[];
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
  standardMissionProfiles?: StandardMissionProfile[];
  onSaveStandardMissionProfile?: (profileId: string, changes: Partial<StandardMissionProfile>) => void;
  unitCallsignSettings?: UnitCallsignSettings;
  staffQualificationCatalogue?: StaffQualificationCatalogue;
}

type PrioritiesSection = 'build-timeline' | 'people-rules' | 'course-demand' | 'directed-events' | 'deployments';
type FixedCrewPlannerTab = 'events-builder' | 'deployments' | 'build-priorities';

export const PrioritiesViewWithMenu: React.FC<PrioritiesViewWithMenuProps> = (props) => {
    const [activeSection, setActiveSection] = useState<PrioritiesSection>('build-timeline');
    const [activeFixedCrewTab, setActiveFixedCrewTab] = useState<FixedCrewPlannerTab>('events-builder');
    const [expandedFixedCrewTab, setExpandedFixedCrewTab] = useState<FixedCrewPlannerTab | null>(null);
    const [deploymentStartDate, setDeploymentStartDate] = useState(props.buildDfpDate);
    const [deploymentEndDate, setDeploymentEndDate] = useState(props.buildDfpDate);
    const [deploymentStartTime, setDeploymentStartTime] = useState(props.flyingStartTime);
    const [deploymentEndTime, setDeploymentEndTime] = useState(Math.min(23.75, props.flyingStartTime + 4));
    const [deploymentAircraftCount, setDeploymentAircraftCount] = useState(1);
    const [deploymentAddMessage, setDeploymentAddMessage] = useState('');
    const mainScrollRef = useRef<HTMLElement | null>(null);
    const resourceLabels = props.resourceDisplayNames ?? DEFAULT_RESOURCE_DISPLAY_NAMES;
    const locationDisplayName = String(props.school || '').trim() || 'Selected location';
    const isFixedCrewModel = isFixedCrewLikeOperationalModel(props.operationalModel);
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
            label: 'Mission Requests',
            shortLabel: 'Exceptions',
            description: 'Manage currency requests and high-priority events.',
        },
    ].filter(item => !item.hidden);

    const fixedCrewTabs = [
        { id: 'events-builder' as const, label: 'Events Builder' },
        { id: 'deployments' as const, label: 'Deployments' },
        { id: 'build-priorities' as const, label: 'Build Priorities' },
    ];

    const fixedCrewPlannerSections = {
        'events-builder': [
            { label: 'Highest Priority Table', target: '.highest-priority-events-card' },
            { label: 'Mission Requests', target: '.tasking-events-card' },
            { label: 'Continuation / Currency Requests', target: '.specific-currency-card' },
            { label: 'Saved Special Events', target: '.saved-special-events-card' },
        ],
        'deployments': [
            { label: 'Deployment Builder', target: '.deployment-builder-card' },
        ],
        'build-priorities': [
            { label: 'Flying Windows & Capacity', target: '.section-build-timeline' },
            { label: 'Flying Windows', target: '.flying-windows-card' },
            { label: 'Resource Capacity', target: '.resource-capacity-card' },
            { label: 'Course Priority', target: '.course-priority-card' },
        ],
    };

    const fixedCrewTabItems = activeFixedCrewTab === 'events-builder'
        ? [
            {
                id: 'directed-events' as const,
                step: '01',
                label: 'Events Builder',
                shortLabel: 'Events',
                description: 'Manage priority events, mission requests and currency requests.',
            },
        ]
        : activeFixedCrewTab === 'deployments'
        ? [
            {
                id: 'deployments' as const,
                step: '02',
                label: 'Deployments',
                shortLabel: 'Deploy',
                description: 'Build deployment tiles for the Fixed Crew plan using deployment dates and times.',
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
        if (activeFixedCrewTab === 'deployments') {
            setActiveSection('deployments');
            return;
        }
        setActiveSection(current => current === 'course-demand' ? current : 'build-timeline');
    }, [activeFixedCrewTab, isFixedCrewModel]);

    useEffect(() => {
        setDeploymentStartDate(props.buildDfpDate);
        setDeploymentEndDate(props.buildDfpDate);
    }, [props.buildDfpDate]);

    useEffect(() => {
        setDeploymentStartTime(props.flyingStartTime);
        setDeploymentEndTime(Math.min(23.75, props.flyingStartTime + 4));
    }, [props.flyingStartTime]);

    const activeWorkflowItem = visibleWorkflowItems.find((item) => item.id === activeSection) ?? visibleWorkflowItems[0] ?? workflowItems[0];
    const fixedCrewPlannerMode = isFixedCrewModel ? activeFixedCrewTab : null;
    const scrollPlannerToTop = () => {
        window.requestAnimationFrame(() => {
            mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        });
    };
    const handleFixedCrewTabClick = (tabId: FixedCrewPlannerTab) => {
        if (expandedFixedCrewTab === tabId) {
            setExpandedFixedCrewTab(null);
            return;
        }
        setActiveFixedCrewTab(tabId);
        setExpandedFixedCrewTab(tabId);
        setActiveSection(tabId === 'events-builder' ? 'directed-events' : tabId === 'deployments' ? 'deployments' : 'build-timeline');
        scrollPlannerToTop();
    };
    const handleFixedCrewSectionClick = (target: string) => {
        const targetSection: PrioritiesSection = activeFixedCrewTab === 'events-builder'
            ? 'directed-events'
            : activeFixedCrewTab === 'deployments'
                ? 'deployments'
                : (target.includes('course') ? 'course-demand' : 'build-timeline');
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

    const parsePlannerTimeInput = (value: string): number => {
        const [hours, minutes] = String(value || '').split(':').map(Number);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
        return Math.max(0, Math.min(23.75, hours + minutes / 60));
    };

    const formatPlannerClock = (value: number): string => {
        const totalMinutes = Math.round(Math.max(0, value) * 60);
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
    };

    const formatPlannerDateLabel = (isoDate: string): string => {
        const [year, month, day] = String(isoDate || '').split('-').map(Number);
        if (!year || !month || !day) return isoDate;
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).replace(',', '');
    };

    const getDeploymentDateRange = (startDate: string, endDate: string): string[] => {
        const startParts = String(startDate || '').split('-').map(Number);
        const endParts = String(endDate || '').split('-').map(Number);
        if (
            startParts.length !== 3 ||
            endParts.length !== 3 ||
            startParts.some(part => !Number.isFinite(part)) ||
            endParts.some(part => !Number.isFinite(part))
        ) return [startDate].filter(Boolean);
        const cursor = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2]));
        const end = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2]));
        if (cursor.getTime() > end.getTime()) return [startDate].filter(Boolean);
        const dates: string[] = [];
        while (cursor.getTime() <= end.getTime()) {
            dates.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        return dates.length > 0 ? dates : [startDate].filter(Boolean);
    };

    const plannerTimeOptions = Array.from({ length: 96 }, (_, index) => {
        const hours = Math.floor(index / 4);
        const minutes = (index % 4) * 15;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    });

    const deploymentPreviewText = `DEPLOYMENT ${formatPlannerClock(deploymentStartTime)} ${formatPlannerDateLabel(deploymentStartDate)} - ${formatPlannerClock(deploymentEndTime)} ${formatPlannerDateLabel(deploymentEndDate)}`;
    const hasInvalidDeploymentDateRange = Boolean(deploymentStartDate && deploymentEndDate && deploymentStartDate > deploymentEndDate);
    const hasInvalidSameDayTimes = deploymentStartDate === deploymentEndDate && deploymentEndTime <= deploymentStartTime;
    const deploymentPlannerEvents = Array.from(
        (props.activeScheduleEvents || [])
            .filter(event => event.type === 'deployment' && event.deploymentSource === 'build-planner')
            .reduce<Map<string, ScheduleEvent>>((eventsById, event) => {
            eventsById.set(event.id, event);
            return eventsById;
        }, new Map()).values()
    );

    const deploymentGroups = Array.from(
        deploymentPlannerEvents
            .reduce<Map<string, ScheduleEvent[]>>((groups, event) => {
                const key = event.deploymentSeriesId || [
                    event.deploymentStartDate || event.date || '',
                    event.deploymentStartTime || '',
                    event.deploymentEndDate || event.date || '',
                    event.deploymentEndTime || '',
                    event.resourceId || '',
                    event.deploymentAircraftCount || 1,
                ].join('|');
                groups.set(key, [...(groups.get(key) || []), event]);
                return groups;
            }, new Map())
            .entries()
    ).map(([key, events]) => ({
        key,
        events: [...events].sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))),
    }));

    const handleAddDeployment = () => {
        if (!props.onAddBuildEvents || hasInvalidDeploymentDateRange || hasInvalidSameDayTimes) return;
        const deploymentDates = getDeploymentDateRange(deploymentStartDate, deploymentEndDate);
        const deployedResourceNumbers = (props.activeScheduleEvents || [])
            .map(event => /^Deployed\s+(\d+)$/i.exec(String(event.resourceId || '').trim()))
            .filter((match): match is RegExpExecArray => Boolean(match))
            .map(match => Number(match[1]))
            .filter(number => Number.isFinite(number));
        const nextDeploymentNumber = Math.max(0, ...deployedResourceNumbers) + 1;
        const deploymentStartClock = formatPlannerClock(deploymentStartTime);
        const deploymentEndClock = formatPlannerClock(deploymentEndTime);
        const deploymentSeriesId = uuidv4();
        const aircraftCount = Math.max(1, Math.floor(Number(deploymentAircraftCount) || 1));
        const events = deploymentDates.flatMap(currentDate => {
            const isFirstDate = currentDate === deploymentStartDate;
            const isLastDate = currentDate === deploymentEndDate;
            const segmentStartTime = isFirstDate ? deploymentStartTime : 0;
            const segmentEndTime = isLastDate ? deploymentEndTime : 24;
            const segmentDuration = Math.max(0.1, segmentEndTime - segmentStartTime);
            return Array.from({ length: aircraftCount }, (_, aircraftIndex) => ({
                id: uuidv4(),
                date: currentDate,
                type: 'deployment' as const,
                instructor: '',
                student: '',
                pilot: '',
                crew: '',
                group: undefined,
                flightNumber: 'DEPLOYMENT',
                duration: segmentDuration,
                startTime: segmentStartTime,
                resourceId: `Deployed ${nextDeploymentNumber + aircraftIndex}`,
                color: 'bg-gray-600/30',
                flightType: 'Dual' as const,
                soloOrDual: 'Dual' as const,
                locationType: 'Land Away' as const,
                origin: 'DEPLOY',
                destination: 'DEPLOY',
                callsign: '',
                aircraftNumber: undefined,
                isDeploy: true,
                deploymentStartDate,
                deploymentStartTime: deploymentStartClock,
                deploymentEndDate,
                deploymentEndTime: deploymentEndClock,
                deploymentAircraftCount: aircraftCount,
                deploymentSeriesId,
                deploymentSource: 'build-planner',
            }));
        }).filter(event => event.duration > 0);
        props.onAddBuildEvents(events);
        setDeploymentAddMessage(`Added deployment to the Build Planner for ${deploymentDates.length} day${deploymentDates.length === 1 ? '' : 's'}.`);
    };

    const handleRemoveDeploymentGroup = (eventIds: string[]) => {
        if (eventIds.length === 0) return;
        props.onRemoveBuildDeploymentEvents?.(eventIds);
        setDeploymentAddMessage('Deployment removed from the Build Planner.');
    };

    const renderDeploymentPlanner = () => (
        <div className="section-deployments">
            <section className="deployment-builder-card rounded-lg border border-violet-400/70 bg-slate-900/78 p-5 shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_14px_30px_rgba(15,23,42,0.28)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h3 className="text-2xl font-bold text-cyan-300">Deployment Builder</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                            Create deployment tiles for the Fixed Crew build plan. Multi-day deployments are split into daily deployment segments with the same deployment period retained on each tile.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddDeployment}
                        disabled={!props.onAddBuildEvents || hasInvalidDeploymentDateRange || hasInvalidSameDayTimes}
                        className="h-[57px] w-[72px] rounded-md border border-slate-300/80 bg-gradient-to-r from-slate-100 via-white to-slate-300 px-2 text-center text-[12px] font-bold leading-tight text-slate-800 shadow transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        Add<br />Deploy
                    </button>
                </div>

                <div className="mt-5 rounded-md border border-slate-700/70 bg-slate-950/70 p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Begin Date</span>
                                <input
                                    type="date"
                                    value={deploymentStartDate}
                                    onChange={(event) => setDeploymentStartDate(event.target.value)}
                                    className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-300"
                                />
                            </label>
                            <label className="block">
                                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Begin Time</span>
                                <select
                                    value={`${String(Math.floor(deploymentStartTime)).padStart(2, '0')}:${String(Math.round((deploymentStartTime % 1) * 60)).padStart(2, '0')}`}
                                    onChange={(event) => setDeploymentStartTime(parsePlannerTimeInput(event.target.value))}
                                    className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-300"
                                >
                                    {plannerTimeOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">End Date</span>
                                <input
                                    type="date"
                                    value={deploymentEndDate}
                                    onChange={(event) => setDeploymentEndDate(event.target.value)}
                                    className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-300"
                                />
                            </label>
                            <label className="block">
                                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">End Time</span>
                                <select
                                    value={`${String(Math.floor(deploymentEndTime)).padStart(2, '0')}:${String(Math.round((deploymentEndTime % 1) * 60)).padStart(2, '0')}`}
                                    onChange={(event) => setDeploymentEndTime(parsePlannerTimeInput(event.target.value))}
                                    className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-300"
                                >
                                    {plannerTimeOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block md:col-span-2">
                                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Aircraft</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={99}
                                    value={deploymentAircraftCount}
                                    onChange={(event) => setDeploymentAircraftCount(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                                    className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-300"
                                />
                            </label>
                        </div>

                        <div className="rounded-md border border-slate-700 bg-slate-900/80 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Preview</p>
                            <div className="mt-4 flex h-14 items-center justify-center border-y border-slate-300/70 bg-slate-500/20 text-center text-sm font-bold uppercase tracking-wide text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                                {deploymentPreviewText}
                            </div>
                            <p className="mt-3 text-xs leading-5 text-slate-500">
                                Deployment row: {deploymentAircraftCount} x aircraft. Tile will use the Deployed resource row in the build plan.
                            </p>
                            {(hasInvalidDeploymentDateRange || hasInvalidSameDayTimes) && (
                                <p className="mt-3 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">
                                    End date/time must be after begin date/time before the deployment can be added.
                                </p>
                            )}
                            {deploymentAddMessage && !(hasInvalidDeploymentDateRange || hasInvalidSameDayTimes) && (
                                <p className="mt-3 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                                    {deploymentAddMessage}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="mt-5 rounded-md border border-slate-700/70 bg-slate-950/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-300">Built Deployments</h4>
                            <p className="mt-1 text-xs text-slate-500">Deployments added here are build-planner deployment tiles.</p>
                        </div>
                    </div>
                    {deploymentGroups.length === 0 ? (
                        <p className="mt-4 rounded-md border border-slate-700/70 bg-slate-900/70 px-3 py-3 text-sm text-slate-500">
                            No deployments built.
                        </p>
                    ) : (
                        <div className="mt-4 space-y-2">
                            {deploymentGroups.map(group => {
                                const first = group.events[0];
                                const uniqueDates = new Set(group.events.map(event => event.date).filter(Boolean));
                                const uniqueResources = new Set(group.events.map(event => event.resourceId).filter(Boolean));
                                const deployedCount = Number(first.deploymentAircraftCount) || Math.max(1, uniqueResources.size);
                                const label = `DEPLOYMENT ${String(first.deploymentStartTime || '').replace(':', '') || formatPlannerClock(first.startTime)} ${formatPlannerDateLabel(first.deploymentStartDate || first.date)} - ${String(first.deploymentEndTime || '').replace(':', '') || formatPlannerClock(first.startTime + first.duration)} ${formatPlannerDateLabel(first.deploymentEndDate || first.date)}`;
                                return (
                                    <div key={group.key} className="flex items-center justify-between gap-3 rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-slate-100">{label}</p>
                                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                {uniqueDates.size || group.events.length} day{uniqueDates.size === 1 ? '' : 's'} · deployed {deployedCount}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveDeploymentGroup(group.events.map(event => event.id).filter(Boolean))}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-rose-400/35 bg-rose-500/10 text-rose-200 transition hover:border-rose-300 hover:bg-rose-500/20"
                                            aria-label="Remove deployment"
                                            title="Remove deployment"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );

    return (
        <div data-priorities-view="true" className="flex-1 flex overflow-hidden bg-slate-950 text-slate-100">
            <aside className={`${isFixedCrewModel ? 'w-[220px]' : 'w-80'} bg-slate-950/95 border-r border-slate-700/60 flex flex-col flex-shrink-0`}>
                <div className={`${isFixedCrewModel ? 'p-4' : 'p-5'} border-b border-slate-700/60`}>
                    <div className={`rounded-lg border border-cyan-500/20 bg-cyan-500/10 ${isFixedCrewModel ? 'p-3' : 'p-4'}`}>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">NEO Build</p>
                        <h1 className={`${isFixedCrewModel ? 'mt-1 text-xl' : 'mt-1 text-2xl'} font-bold text-white`}>{isFixedCrewModel ? 'Build Planner' : 'Build Priorities'}</h1>
                        <p className={`${isFixedCrewModel ? 'mt-1 text-xs leading-5' : 'mt-2 text-sm'} text-slate-300`}>
                            {isFixedCrewModel
                                ? 'Plan mission requests and build weighting for the Fixed Crew model.'
                                : 'Configure the build in the same order a supervisor would plan the DFP by hand.'}
                        </p>
                    </div>
                </div>
                <nav className={`flex-1 overflow-y-auto ${isFixedCrewModel ? 'p-0' : 'p-4 space-y-3'}`}>
                    {isFixedCrewModel && (
                        <div className="space-y-2 border-b border-slate-700/60 p-3">
                            {fixedCrewTabs.map(tab => {
                                const isActive = activeFixedCrewTab === tab.id;
                                const isExpanded = expandedFixedCrewTab === tab.id;
                                return (
                                    <div key={tab.id}>
                                        <button
                                            type="button"
                                            onClick={() => handleFixedCrewTabClick(tab.id)}
                                            className={`relative flex h-[41px] w-full items-center justify-between rounded-md border px-3 text-left text-sm font-bold leading-tight transition ${
                                                isActive
                                                    ? 'border-cyan-300/80 border-r-cyan-300/40 bg-cyan-700/55 text-cyan-50 shadow-[inset_-8px_0_18px_rgba(8,145,178,0.18),0_8px_20px_rgba(8,145,178,0.16)]'
                                                    : 'border-slate-600/80 bg-slate-700/70 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-cyan-500/50 hover:bg-slate-600/75'
                                            }`}
                                        >
                                            <span>{tab.label}</span>
                                            <span className={`text-base transition ${isExpanded ? 'rotate-180 text-cyan-200' : 'text-slate-500'}`}>v</span>
                                        </button>
                                        {isExpanded && (
                                            <div
                                                key={`${tab.id}-sections`}
                                                className="mt-2 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900/55 animate-[fixedCrewPlannerDrop_240ms_ease-out]"
                                            >
                                                <div className="border-b border-slate-700/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                    {tab.label}
                                                </div>
                                                <div className="space-y-1 p-2">
                                                    {fixedCrewPlannerSections[tab.id].map((section) => (
                                                        section.heading ? (
                                                            <div
                                                                key={`${tab.id}-${section.label}`}
                                                                className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/70"
                                                            >
                                                                {section.label}
                                                            </div>
                                                        ) : (
                                                            <button
                                                                key={`${tab.id}-${section.label}`}
                                                                type="button"
                                                                onClick={() => section.target && handleFixedCrewSectionClick(section.target)}
                                                                className="block w-full rounded-md px-2 py-1.5 text-left text-[11px] font-semibold leading-snug text-slate-300 transition hover:bg-cyan-500/10 hover:text-cyan-100"
                                                            >
                                                                {section.label}
                                                            </button>
                                                        )
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
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
                    .priorities-content .saved-special-events-card,
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
                    .section-directed-events > .saved-special-events-card { order: 5; }
                    .section-directed-events > .bulk-currency-card { order: 6; }
                    .section-directed-events > .optional-currency-card { order: 7; }
                    .section-directed-events > .remedial-priority-card { order: 8; }
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
                        {isFixedCrewModel && activeFixedCrewTab === 'deployments'
                            ? renderDeploymentPlanner()
                            : <PrioritiesView {...props} instructorPriority={effectiveInstructorPriority} activeSection={activeSection} />}
                    </div>
                </div>
            </main>
        </div>
    );
};
