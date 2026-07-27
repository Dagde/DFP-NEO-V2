

import React, { useMemo, useEffect, useState } from 'react';
import { Trainee, Score, SyllabusItemDetail, Course, Pt051Assessment } from '../types';
import AuditButton from './AuditButton';
import CourseDataWindow from './CourseDataWindow';
import FullPageProgressGraph from './FullPageProgressGraph';
import { logAudit } from '../utils/auditLogger';
import { CourseRiskThresholds } from '../utils/courseProgressMetrics';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';

const REMEDIAL_EVENT_CODE_REGEX = /-(?:REM-[A-Z]+\d+|RFTD\d+|RRF\d+|RT\d+|RF\d+|FTD\d+|F\d+|T\d+)$/i;
const isRemedialEventCode = (value?: string): boolean =>
    !!value && REMEDIAL_EVENT_CODE_REGEX.test(value);

interface CourseProgressViewProps {
    traineesData: Trainee[];
    courseColors: { [key: string]: string };
    scores: Map<string, Score[]>;
    pt051Assessments: Map<string, Pt051Assessment>;
    traineeLMPs: Map<string, SyllabusItemDetail[]>;
    courses: Course[];
    onUpdateGradDate: (courseName: string, newGradDate: string) => void;
    onUpdateStartDate: (courseName: string, newStartDate: string) => void;
    trainingReportName?: string;
    resourceDisplayNames?: ResourceDisplayNames;
}

type CourseScoreEventTypeKey =
    | 'flight'
    | 'simulator'
    | 'proceduralTrainer'
    | 'tutorial'
    | 'massBrief'
    | 'groundSchoolAssessment'
    | 'groundSchool'
    | 'academics'
    | 'other';

type AwardCriterion = {
    id: string;
    event: string;
    weight: number;
    enabled: boolean;
};

type CourseAward = {
    id: string;
    name: string;
    course: string;
    lmpType: string;
    eventTypes: CourseScoreEventTypeKey[] | null;
    scoreMethod: 'latest' | 'best' | 'average';
    includeRemedial: boolean;
    includeAllScoredEvents: boolean;
    minimumScoredEvents: number;
    criteria: AwardCriterion[];
};

const COURSE_AWARD_SETTINGS_STORAGE_KEY = 'dfpNeo.courseProgress.awards.v1';
const COURSE_SCORE_EVENT_TYPE_KEYS: CourseScoreEventTypeKey[] = [
    'flight',
    'simulator',
    'proceduralTrainer',
    'tutorial',
    'massBrief',
    'groundSchoolAssessment',
    'groundSchool',
    'academics',
    'other',
];

const createDefaultCourseAwards = (): CourseAward[] => [
    {
        id: 'dux',
        name: 'Dux',
        course: '',
        lmpType: '',
        eventTypes: null,
        scoreMethod: 'latest',
        includeRemedial: false,
        includeAllScoredEvents: true,
        minimumScoredEvents: 1,
        criteria: [
            { id: 'BGF21', event: 'BGF21', weight: 2, enabled: true },
            { id: 'BIF3', event: 'BIF3', weight: 2, enabled: true },
            { id: 'BNAV4', event: 'BNAV4', weight: 2, enabled: true },
        ],
    },
];

const normaliseCourseAward = (award: Partial<CourseAward>, index: number): CourseAward | null => {
    const id = String(award.id || `award-${index}`).trim();
    const name = String(award.name || '').trim();
    if (!id || !name) return null;

    const scoreMethod = ['latest', 'best', 'average'].includes(String(award.scoreMethod))
        ? award.scoreMethod as CourseAward['scoreMethod']
        : 'latest';
    const eventTypes = Array.isArray(award.eventTypes)
        ? award.eventTypes.filter((key): key is CourseScoreEventTypeKey => COURSE_SCORE_EVENT_TYPE_KEYS.includes(key as CourseScoreEventTypeKey))
        : null;
    const criteria = Array.isArray(award.criteria)
        ? award.criteria
            .map((criterion, criterionIndex) => ({
                id: String(criterion.id || `criterion-${index}-${criterionIndex}`),
                event: String(criterion.event || '').trim(),
                weight: Number.isFinite(Number(criterion.weight)) && Number(criterion.weight) > 0 ? Number(criterion.weight) : 1,
                enabled: criterion.enabled !== false,
            }))
            .filter(criterion => criterion.event)
        : [];

    return {
        id,
        name,
        course: String(award.course || ''),
        lmpType: String(award.lmpType || ''),
        eventTypes: eventTypes && eventTypes.length > 0 ? eventTypes : null,
        scoreMethod,
        includeRemedial: Boolean(award.includeRemedial),
        includeAllScoredEvents: award.includeAllScoredEvents !== false,
        minimumScoredEvents: Number.isFinite(Number(award.minimumScoredEvents)) && Number(award.minimumScoredEvents) > 0
            ? Math.max(1, Math.floor(Number(award.minimumScoredEvents)))
            : 1,
        criteria,
    };
};

const loadStoredCourseAwards = (): CourseAward[] => {
    if (typeof window === 'undefined') return createDefaultCourseAwards();
    try {
        const raw = window.localStorage.getItem(COURSE_AWARD_SETTINGS_STORAGE_KEY);
        if (!raw) return createDefaultCourseAwards();
        const parsed = JSON.parse(raw);
        const awards = Array.isArray(parsed)
            ? parsed
                .map((award, index) => normaliseCourseAward(award, index))
                .filter((award): award is CourseAward => Boolean(award))
            : [];
        return awards.length > 0 ? awards : createDefaultCourseAwards();
    } catch {
        return createDefaultCourseAwards();
    }
};

const CourseProgressView: React.FC<CourseProgressViewProps> = ({
    traineesData,
    courseColors,
    scores,
    pt051Assessments,
    traineeLMPs,
    courses,
    onUpdateGradDate,
    onUpdateStartDate,
    trainingReportName = 'Training Report',
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES
}) => {
    const [showFullGraph, setShowFullGraph] = useState(false);
    const [selectedGraphCourse, setSelectedGraphCourse] = useState<string | null>(null);
    const [scoreCourse, setScoreCourse] = useState<string>('');
    const [activeAwardId, setActiveAwardId] = useState('dux');
    const [isEditingAward, setIsEditingAward] = useState(false);
    const [showDeleteAwardConfirm, setShowDeleteAwardConfirm] = useState(false);
    const [showRiskSettings, setShowRiskSettings] = useState(false);
    const [showCourseScoreSettings, setShowCourseScoreSettings] = useState(false);
    const [courseScoreEventTypeSelection, setCourseScoreEventTypeSelection] = useState<CourseScoreEventTypeKey[] | null>(null);
    const [riskThresholds, setRiskThresholds] = useState<CourseRiskThresholds>({
        onTrackMax: 3.5,
        watchMax: 4.0,
        atRiskMax: 4.5,
    });
    const [awards, setAwards] = useState<CourseAward[]>(loadStoredCourseAwards);
    
    // Log view on component mount
    useEffect(() => {
        logAudit({
            action: 'View',
            description: 'Viewed Course Progress page',
            changes: `Viewing ${courses.filter(c => courseColors[c.name]).length} active courses`,
            page: 'Course Progress'
        });
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(COURSE_AWARD_SETTINGS_STORAGE_KEY, JSON.stringify(awards));
        } catch {
            // Course rankings should continue to work even if browser storage is unavailable.
        }
    }, [awards]);

    const activeCourses = useMemo(() => {
        const representedCourseNames = new Set(
            traineesData
                .filter(trainee => !trainee.isPaused)
                .map(trainee => String(trainee.course || '').trim())
                .filter(Boolean)
        );

        // Filter to courses represented by the already-scoped active trainee list.
        return courses
            .filter(course => courseColors[course.name] && representedCourseNames.has(course.name))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [courses, courseColors, traineesData]);

    const activeCourseNames = useMemo(() => new Set(activeCourses.map(course => course.name)), [activeCourses]);

    const activeTrainees = useMemo(() => {
        return traineesData
            .filter(trainee => !trainee.isPaused && activeCourseNames.has(trainee.course))
            .sort((a, b) => (a.fullName || a.name).localeCompare(b.fullName || b.name));
    }, [traineesData, activeCourseNames]);

    const defaultCourseByProgress = useMemo(() => {
        if (activeCourses.length === 0) return '';

        const completedByCourse = new Map(activeCourses.map(course => [course.name, 0]));
        activeTrainees.forEach(trainee => {
            const traineeName = trainee.fullName || trainee.name;
            const completedEvents = (scores.get(traineeName) || [])
                .filter(score => !score.event.includes('MB') && !isRemedialEventCode(score.event)).length;
            completedByCourse.set(trainee.course, (completedByCourse.get(trainee.course) || 0) + completedEvents);
        });

        return activeCourses
            .slice()
            .sort((a, b) => (completedByCourse.get(b.name) || 0) - (completedByCourse.get(a.name) || 0) || a.name.localeCompare(b.name))[0]?.name || '';
    }, [activeCourses, activeTrainees, scores]);

    useEffect(() => {
        if (!scoreCourse && defaultCourseByProgress) {
            setScoreCourse(defaultCourseByProgress);
            return;
        }

        if (scoreCourse && !activeCourses.some(course => course.name === scoreCourse)) {
            setScoreCourse(defaultCourseByProgress || activeCourses[0]?.name || '');
        }
    }, [activeCourses, defaultCourseByProgress, scoreCourse]);

    const activeAward = awards.find(award => award.id === activeAwardId) || awards[0];
    const getCourseMasterLmp = (courseName: string): string => (
        activeCourses.find(course => course.name === courseName)?.lmpType || ''
    );

    const getAwardDisplayName = (award: CourseAward) => {
        return award.lmpType ? `${award.name} - ${award.lmpType}` : award.name;
    };

    useEffect(() => {
        setIsEditingAward(false);
    }, [activeAwardId]);

    useEffect(() => {
        if (!activeAward) return;
        if ((!activeAward.course || activeAward.course === 'all') && defaultCourseByProgress) {
            setAwards(prev => prev.map(award => award.id === activeAward.id ? { ...award, course: defaultCourseByProgress } : award));
            return;
        }

        if (activeAward.course !== 'all' && !activeCourses.some(course => course.name === activeAward.course)) {
            setAwards(prev => prev.map(award => award.id === activeAward.id ? { ...award, course: defaultCourseByProgress || 'all' } : award));
        }
    }, [activeAward, activeCourses, defaultCourseByProgress]);

    const availableAwardLmpTypes = useMemo(() => {
        const lmpTypes = new Set<string>();
        const selectedCourseName = activeAward?.course || '';
        const courseIsSelected = (courseName: string) => (
            !selectedCourseName || selectedCourseName === 'all' || courseName === selectedCourseName
        );

        activeCourses.forEach(course => {
            if (courseIsSelected(course.name) && course.lmpType) lmpTypes.add(course.lmpType);
        });

        const selectedTraineeNames = new Set(
            activeTrainees
                .filter(trainee => courseIsSelected(trainee.course))
                .flatMap(trainee => [trainee.fullName, trainee.name].filter(Boolean))
        );

        traineeLMPs.forEach((lmp, traineeName) => {
            if (selectedTraineeNames.size > 0 && !selectedTraineeNames.has(traineeName)) return;
            lmp.forEach(item => {
                if (item.type === 'Academics') return;
                const itemLmpType = item.lmpType ? String(item.lmpType) : '';
                if (itemLmpType && itemLmpType !== 'Staff CAT' && itemLmpType !== 'Master LMP') {
                    lmpTypes.add(itemLmpType);
                }
            });
        });

        return Array.from(lmpTypes).sort();
    }, [activeAward, activeCourses, activeTrainees, traineeLMPs]);

    useEffect(() => {
        if (!activeAward || activeAward.lmpType) return;
        const courseMasterLmp = getCourseMasterLmp(activeAward.course);
        const nextLmpType = courseMasterLmp || availableAwardLmpTypes[0] || '';
        if (!nextLmpType) return;
        setAwards(prev => prev.map(award => award.id === activeAward.id ? { ...award, lmpType: nextLmpType } : award));
    }, [activeAward, activeCourses, availableAwardLmpTypes]);

    const eventOrder = useMemo(() => {
        const order = new Map<string, number>();
        let index = 0;
        traineeLMPs.forEach(lmp => {
            lmp.forEach(item => {
                if (!order.has(item.id)) order.set(item.id, index++);
                if (!order.has(item.code)) order.set(item.code, index++);
            });
        });
        return order;
    }, [traineeLMPs]);

    const itemMatchesLmpType = (item: SyllabusItemDetail, lmpType: string) => {
        if (!lmpType || lmpType === 'all') return true;
        const itemLmpType = item.lmpType ? String(item.lmpType) : '';
        if (itemLmpType && itemLmpType !== 'Staff CAT' && itemLmpType !== 'Master LMP') {
            return itemLmpType === lmpType;
        }
        if (item.courses?.some(course => course === lmpType || course.includes(lmpType))) {
            return true;
        }
        const courseMasterLmp = activeAward?.course && activeAward.course !== 'all'
            ? getCourseMasterLmp(activeAward.course)
            : '';
        return Boolean(courseMasterLmp && lmpType === courseMasterLmp && !itemLmpType && item.type !== 'Academics');
    };

    const isUuidLike = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());

    const getValidEventCode = (item: SyllabusItemDetail) => {
        const code = (item.code || '').trim();
        if (code && !isUuidLike(code)) return code;

        const id = (item.id || '').trim();
        if (id && !isUuidLike(id)) return id;

        return '';
    };

    const eventDetailByCode = useMemo(() => {
        const details = new Map<string, SyllabusItemDetail>();
        traineeLMPs.forEach(lmp => {
            lmp.forEach(item => {
                [getValidEventCode(item), item.code, item.id]
                    .map(value => String(value || '').trim().toUpperCase())
                    .filter(Boolean)
                    .forEach(key => {
                        if (!isUuidLike(key) && !details.has(key)) details.set(key, item);
                    });
            });
        });
        return details;
    }, [traineeLMPs]);

    const courseScoreEventTypeLabels = useMemo<Record<CourseScoreEventTypeKey, string>>(() => ({
        flight: 'Flight',
        simulator: resourceDisplayNames.ftd || 'FTD',
        proceduralTrainer: resourceDisplayNames.cpt || 'CPT',
        tutorial: 'Tutorial',
        massBrief: 'Mass Brief',
        groundSchoolAssessment: 'Ground School Assessment',
        groundSchool: 'Ground School',
        academics: 'Academics',
        other: 'Other',
    }), [resourceDisplayNames]);

    const getCourseScoreEventType = (eventCode: string): CourseScoreEventTypeKey => {
        const code = String(eventCode || '').trim().toUpperCase();
        const item = eventDetailByCode.get(code);
        const methodText = [
            ...(item?.methodOfDelivery || []),
            ...(item?.methodOfAssessment || []),
            item?.type,
            item?.module,
            item?.eventDescription,
        ].join(' ').toUpperCase();

        if (/\bMB\d*\b|MASS\s*BRIEF/.test(code) || /MASS\s*BRIEF/.test(methodText)) return 'massBrief';
        if (/\bTUT\d*\b|TUTORIAL/.test(code) || /TUTORIAL/.test(methodText)) return 'tutorial';
        if (/\bCPT\b|PROCEDURAL/.test(code) || /\bCPT\b|PROCEDURAL/.test(methodText)) return 'proceduralTrainer';
        if (item?.type === 'Flight') return 'flight';
        if (item?.type === 'FTD') return 'simulator';
        if (item?.type === 'Academics') return 'academics';
        if (item?.type === 'Ground School' && (item.assessmentRequired || methodText.includes('ASSESS'))) return 'groundSchoolAssessment';
        if (item?.type === 'Ground School') return 'groundSchool';
        return 'other';
    };

    const awardEventOptions = useMemo(() => {
        if (!activeAward) return [];

        const eligibleTrainees = activeTrainees.filter(trainee => activeAward.course === 'all' || trainee.course === activeAward.course);
        const eligibleNames = new Set(eligibleTrainees.map(trainee => trainee.fullName || trainee.name));
        const optionMap = new Map<string, { value: string; label: string; order: number; eventType: CourseScoreEventTypeKey; isRemedial: boolean }>();

        eligibleTrainees.forEach(trainee => {
            const lmp = traineeLMPs.get(trainee.fullName) || traineeLMPs.get(trainee.name) || [];
            lmp.forEach(item => {
                if (!itemMatchesLmpType(item, activeAward.lmpType)) return;
                const value = getValidEventCode(item);
                if (!value || optionMap.has(value)) return;
                optionMap.set(value, {
                    value,
                    label: value,
                    order: eventOrder.get(value) ?? eventOrder.get(item.id) ?? Number.MAX_SAFE_INTEGER,
                    eventType: getCourseScoreEventType(value),
                    isRemedial: Boolean(item.isRemedial || isRemedialEventCode(value)),
                });
            });
        });

        pt051Assessments.forEach(assessment => {
            const flightNumber = (assessment.flightNumber || '').trim();
            if (!eligibleNames.has(assessment.traineeFullName) || !flightNumber || isUuidLike(flightNumber) || optionMap.has(flightNumber)) return;
            optionMap.set(flightNumber, {
                value: flightNumber,
                label: flightNumber,
                order: eventOrder.get(flightNumber) ?? Number.MAX_SAFE_INTEGER,
                eventType: getCourseScoreEventType(flightNumber),
                isRemedial: isRemedialEventCode(flightNumber),
            });
        });

        return Array.from(optionMap.values()).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    }, [activeAward, activeTrainees, traineeLMPs, pt051Assessments, eventOrder, eventDetailByCode]);

    const pt051ScoreRecords = useMemo(() => {
        return Array.from(pt051Assessments.values())
            .filter(assessment => typeof assessment.overallGrade === 'number')
            .map(assessment => ({
                traineeName: assessment.traineeFullName,
                event: assessment.flightNumber,
                score: assessment.overallGrade as number,
                date: assessment.date || '',
            }));
    }, [pt051Assessments]);

    const scoreCourseTrainees = useMemo(() => {
        return activeTrainees.filter(trainee => trainee.course === scoreCourse);
    }, [activeTrainees, scoreCourse]);

    const allScoredEvents = useMemo(() => {
        const eventSet = new Set<string>();
        const traineeNames = new Set(scoreCourseTrainees.map(trainee => trainee.fullName || trainee.name));

        pt051ScoreRecords.forEach(record => {
            if (traineeNames.has(record.traineeName)) eventSet.add(record.event);
        });

        return Array.from(eventSet).sort((a, b) => {
            const aOrder = eventOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
            const bOrder = eventOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.localeCompare(b);
        });
    }, [scoreCourseTrainees, pt051ScoreRecords, eventOrder]);

    const courseScoreEventTypeOptions = useMemo(() => {
        const typeCounts = new Map<CourseScoreEventTypeKey, number>();
        allScoredEvents.forEach(eventCode => {
            const key = getCourseScoreEventType(eventCode);
            typeCounts.set(key, (typeCounts.get(key) || 0) + 1);
        });

        const order: CourseScoreEventTypeKey[] = [
            'flight',
            'simulator',
            'proceduralTrainer',
            'tutorial',
            'massBrief',
            'groundSchoolAssessment',
            'groundSchool',
            'academics',
            'other',
        ];

        return order
            .filter(key => typeCounts.has(key))
            .map(key => ({
                key,
                label: courseScoreEventTypeLabels[key],
                count: typeCounts.get(key) || 0,
            }));
    }, [allScoredEvents, courseScoreEventTypeLabels, eventDetailByCode]);

    const selectedCourseScoreEventTypes = useMemo(() => (
        courseScoreEventTypeSelection === null
            ? courseScoreEventTypeOptions.map(option => option.key)
            : courseScoreEventTypeSelection
    ), [courseScoreEventTypeOptions, courseScoreEventTypeSelection]);

    const scoredEvents = useMemo(() => {
        const selectedTypes = new Set(selectedCourseScoreEventTypes);
        return allScoredEvents.filter(eventCode => selectedTypes.has(getCourseScoreEventType(eventCode)));
    }, [allScoredEvents, selectedCourseScoreEventTypes, eventDetailByCode]);

    const selectedCourseScoreEventTypeSummary = useMemo(() => {
        if (courseScoreEventTypeOptions.length === 0) return 'No scored event types';
        if (selectedCourseScoreEventTypes.length === courseScoreEventTypeOptions.length) return 'All event types';
        if (selectedCourseScoreEventTypes.length === 0) return 'No event types';
        return courseScoreEventTypeOptions
            .filter(option => selectedCourseScoreEventTypes.includes(option.key))
            .map(option => option.label)
            .join(', ');
    }, [courseScoreEventTypeOptions, selectedCourseScoreEventTypes]);

    const getLatestScoreForEvent = (trainee: Trainee, eventCode: string): { score: number; date: string } | undefined => {
        const traineeName = trainee.fullName || trainee.name;
        return pt051ScoreRecords
            .filter(record => record.traineeName === traineeName && record.event === eventCode)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    };

    const awardEventTypeOptions = useMemo(() => {
        const typeCounts = new Map<CourseScoreEventTypeKey, number>();
        awardEventOptions.forEach(option => {
            typeCounts.set(option.eventType, (typeCounts.get(option.eventType) || 0) + 1);
        });
        const order: CourseScoreEventTypeKey[] = [
            'flight',
            'simulator',
            'proceduralTrainer',
            'tutorial',
            'massBrief',
            'groundSchoolAssessment',
            'groundSchool',
            'academics',
            'other',
        ];
        return order
            .filter(key => typeCounts.has(key))
            .map(key => ({ key, label: courseScoreEventTypeLabels[key], count: typeCounts.get(key) || 0 }));
    }, [awardEventOptions, courseScoreEventTypeLabels]);

    const selectedAwardEventTypes = useMemo(() => (
        activeAward?.eventTypes === null || activeAward?.eventTypes === undefined
            ? awardEventTypeOptions.map(option => option.key)
            : activeAward.eventTypes
    ), [activeAward, awardEventTypeOptions]);

    const filteredAwardEventOptions = useMemo(() => {
        const selectedTypes = new Set(selectedAwardEventTypes);
        return awardEventOptions.filter(option => (
            selectedTypes.has(option.eventType) &&
            (Boolean(activeAward?.includeRemedial) || !option.isRemedial)
        ));
    }, [activeAward, awardEventOptions, selectedAwardEventTypes]);

    const activeAwardScoreMethod = activeAward?.scoreMethod || 'latest';
    const activeAwardScoreMethodLabel = activeAwardScoreMethod === 'best'
        ? 'Best attempt'
        : activeAwardScoreMethod === 'average'
            ? 'Average attempts'
            : 'Latest attempt';

    const getAwardScoreForEvent = (
        records: { traineeName: string; event: string; score: number; date: string }[],
    ): number | null => {
        if (records.length === 0) return null;
        if (activeAwardScoreMethod === 'best') {
            return records.reduce((best, record) => Math.max(best, record.score), records[0].score);
        }
        if (activeAwardScoreMethod === 'average') {
            return records.reduce((total, record) => total + record.score, 0) / records.length;
        }
        return records.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0].score;
    };

    const awardRankings = useMemo(() => {
        if (!activeAward) return [];

        const selectedTrainees = activeTrainees.filter(trainee => activeAward.course === 'all' || trainee.course === activeAward.course);
        const selectedAwardEvents = new Set(filteredAwardEventOptions.map(option => option.value.toUpperCase()));
        const criteriaWeights = new Map(
            activeAward.criteria
                .filter(criterion => criterion.enabled && criterion.event.trim() && Number.isFinite(criterion.weight) && criterion.weight > 0)
                .map(criterion => [criterion.event.trim().toUpperCase(), criterion.weight])
        );

        return selectedTrainees
            .map(trainee => {
                const traineeName = trainee.fullName || trainee.name;
                const scoredRecords = pt051ScoreRecords.filter(record => record.traineeName === traineeName);
                const selectedEvents = activeAward.includeAllScoredEvents
                    ? selectedAwardEvents
                    : new Set(Array.from(criteriaWeights.keys()).filter(eventCode => selectedAwardEvents.has(eventCode)));
                const includedEventScores = Array.from(selectedEvents)
                    .map(eventCode => {
                        const eventRecords = scoredRecords.filter(record => record.event.toUpperCase() === eventCode);
                        const score = getAwardScoreForEvent(eventRecords);
                        return score === null ? null : { event: eventCode, score };
                    })
                    .filter((entry): entry is { event: string; score: number } => Boolean(entry));

                const totals = includedEventScores.reduce((acc, record) => {
                    const weight = criteriaWeights.get(record.event) ?? 1;
                    return {
                        weightedScore: acc.weightedScore + (record.score * weight),
                        weight: acc.weight + weight,
                        weightedEvents: acc.weightedEvents + (weight !== 1 ? 1 : 0),
                    };
                }, { weightedScore: 0, weight: 0, weightedEvents: 0 });

                return {
                    trainee,
                    scoredCount: includedEventScores.length,
                    weightedEvents: totals.weightedEvents,
                    rankingScore: totals.weight > 0 ? totals.weightedScore / totals.weight : 0,
                };
            })
            .filter(row => row.scoredCount >= activeAward.minimumScoredEvents)
            .sort((a, b) => b.rankingScore - a.rankingScore || (a.trainee.fullName || a.trainee.name).localeCompare(b.trainee.fullName || b.trainee.name));
    }, [activeTrainees, activeAward, pt051ScoreRecords, filteredAwardEventOptions, activeAwardScoreMethod]);

    const updateActiveAward = (updates: Partial<CourseAward>) => {
        setAwards(prev => prev.map(award => award.id === activeAward.id ? { ...award, ...updates } : award));
    };

    const updateActiveAwardCourse = (courseName: string) => {
        const nextCourseLmp = activeCourses.find(course => course.name === courseName)?.lmpType;
        updateActiveAward({
            course: courseName,
            lmpType: nextCourseLmp || activeAward.lmpType || availableAwardLmpTypes[0] || '',
            includeAllScoredEvents: true,
        });
    };

    const updateAwardCriterion = (id: string, updates: Partial<{ event: string; weight: number; enabled: boolean }>) => {
        setAwards(prev => prev.map(award => {
            if (award.id !== activeAward.id) return award;
            return {
                ...award,
                criteria: award.criteria.map(criterion => criterion.id === id ? { ...criterion, ...updates } : criterion),
            };
        }));
    };

    const addAwardCriterion = () => {
        const id = `criterion-${Date.now()}`;
        setAwards(prev => prev.map(award => award.id === activeAward.id
            ? { ...award, criteria: [...award.criteria, { id, event: '', weight: 2, enabled: true }] }
            : award
        ));
    };

    const removeAwardCriterion = (id: string) => {
        setAwards(prev => prev.map(award => award.id === activeAward.id
            ? { ...award, criteria: award.criteria.filter(criterion => criterion.id !== id) }
            : award
        ));
    };

    const getCriterionForEvent = (eventCode: string) => {
        return activeAward.criteria.find(criterion => criterion.event.toUpperCase() === eventCode.toUpperCase());
    };

    const isAwardEventSelected = (eventCode: string) => {
        return activeAward.includeAllScoredEvents || !!getCriterionForEvent(eventCode)?.enabled;
    };

    const selectedAwardEventRows = useMemo(() => {
        const selectedRows = activeAward.includeAllScoredEvents
            ? filteredAwardEventOptions
            : filteredAwardEventOptions.filter(option => !!getCriterionForEvent(option.value)?.enabled);

        return selectedRows.map(option => ({
            ...option,
            weight: getCriterionForEvent(option.value)?.weight ?? 1,
        }));
    }, [activeAward, filteredAwardEventOptions]);

    const toggleAwardEvent = (eventCode: string, selected: boolean) => {
        setAwards(prev => prev.map(award => {
            if (award.id !== activeAward.id) return award;
            const currentCriteria = award.includeAllScoredEvents
                ? filteredAwardEventOptions
                    .filter(option => option.value.toUpperCase() !== eventCode.toUpperCase())
                    .map(option => {
                        const existingCriterion = award.criteria.find(criterion => criterion.event.toUpperCase() === option.value.toUpperCase());
                        return existingCriterion ? { ...existingCriterion, event: option.value, enabled: true } : { id: `criterion-${option.value}`, event: option.value, weight: 1, enabled: true };
                    })
                : award.criteria.filter(criterion => criterion.event.toUpperCase() !== eventCode.toUpperCase());

            if (selected) {
                const existingCriterion = award.criteria.find(criterion => criterion.event.toUpperCase() === eventCode.toUpperCase());
                return {
                    ...award,
                    includeAllScoredEvents: false,
                    criteria: [
                        ...currentCriteria,
                        existingCriterion ? { ...existingCriterion, enabled: true } : { id: `criterion-${eventCode}-${Date.now()}`, event: eventCode, weight: 1, enabled: true },
                    ],
                };
            }

            return {
                ...award,
                includeAllScoredEvents: false,
                criteria: currentCriteria,
            };
        }));
    };

    const setAwardEventWeight = (eventCode: string, weight: number) => {
        setAwards(prev => prev.map(award => {
            if (award.id !== activeAward.id) return award;
            const existingCriterion = award.criteria.find(criterion => criterion.event.toUpperCase() === eventCode.toUpperCase());
            if (existingCriterion) {
                return {
                    ...award,
                    criteria: award.criteria.map(criterion => criterion.id === existingCriterion.id ? { ...criterion, weight } : criterion),
                };
            }
            return {
                ...award,
                criteria: [...award.criteria, { id: `criterion-${eventCode}-${Date.now()}`, event: eventCode, weight, enabled: true }],
            };
        }));
    };

    const toggleAllAwardEvents = (selected: boolean) => {
        setAwards(prev => prev.map(award => award.id === activeAward.id
            ? { ...award, includeAllScoredEvents: selected, criteria: selected ? award.criteria : award.criteria.map(criterion => ({ ...criterion, enabled: false })) }
            : award
        ));
    };

    const toggleAwardEventType = (key: CourseScoreEventTypeKey, selected: boolean) => {
        setAwards(prev => prev.map(award => {
            if (award.id !== activeAward.id) return award;
            const current = award.eventTypes === null || award.eventTypes === undefined
                ? awardEventTypeOptions.map(option => option.key)
                : award.eventTypes;
            const next = selected
                ? Array.from(new Set([...current, key]))
                : current.filter(optionKey => optionKey !== key);
            return {
                ...award,
                eventTypes: next.length === awardEventTypeOptions.length ? null : next,
                includeAllScoredEvents: true,
            };
        }));
    };

    const setAllCourseScoreEventTypes = (selected: boolean) => {
        setCourseScoreEventTypeSelection(selected ? null : []);
    };

    const toggleCourseScoreEventType = (key: CourseScoreEventTypeKey, selected: boolean) => {
        setCourseScoreEventTypeSelection(prev => {
            const current = prev === null ? courseScoreEventTypeOptions.map(option => option.key) : prev;
            const next = selected
                ? Array.from(new Set([...current, key]))
                : current.filter(optionKey => optionKey !== key);
            return next.length === courseScoreEventTypeOptions.length ? null : next;
        });
    };

    const getCourseColor = (courseName: string) => {
        return activeCourses.find(course => course.name === courseName)?.color || courseColors[courseName] || '';
    };

    const isCssColor = (color: string) => color.startsWith('#') || color.startsWith('rgb');

    const darkenHexColor = (color: string) => {
        if (!color.startsWith('#') || color.length < 7) return color;
        const strength = 0.62;
        const r = Math.round(parseInt(color.slice(1, 3), 16) * strength);
        const g = Math.round(parseInt(color.slice(3, 5), 16) * strength);
        const b = Math.round(parseInt(color.slice(5, 7), 16) * strength);
        return `rgb(${r}, ${g}, ${b})`;
    };

    const getCourseHeaderClass = (courseName: string) => {
        const color = getCourseColor(courseName);
        return color && !isCssColor(color) ? color : 'bg-gray-800';
    };

    const getCourseHeaderStyle = (courseName: string): React.CSSProperties => {
        const color = getCourseColor(courseName);
        return color && isCssColor(color) ? { backgroundColor: darkenHexColor(color) } : {};
    };

    const getCourseBorderStyle = (courseName: string): React.CSSProperties => {
        const color = getCourseColor(courseName);
        return color && isCssColor(color) ? { borderColor: color } : {};
    };

    const getCourseBorderClass = (courseName: string) => {
        const color = courseColors[courseName] || '';
        return color && !isCssColor(color) ? color.replace(/^bg-/, 'border-').replace(/\/\d+$/, '') : 'border-gray-700';
    };

    const addAward = () => {
        const id = `award-${Date.now()}`;
        const defaultCourse = scoreCourse || activeCourses[0]?.name || 'all';
        const defaultLmpType = activeCourses.find(course => course.name === defaultCourse)?.lmpType || availableAwardLmpTypes[0] || '';
        setAwards(prev => [...prev, {
            id,
            name: 'New Award',
            course: defaultCourse,
            lmpType: defaultLmpType,
            eventTypes: null,
            scoreMethod: 'latest',
            includeRemedial: false,
            includeAllScoredEvents: true,
            minimumScoredEvents: 1,
            criteria: [],
        }]);
        setActiveAwardId(id);
        setIsEditingAward(true);
    };

    const removeAward = () => {
        if (awards.length <= 1) return;
        setShowDeleteAwardConfirm(true);
    };

    const confirmRemoveAward = () => {
        const nextAwards = awards.filter(award => award.id !== activeAward.id);
        setAwards(nextAwards);
        setActiveAwardId(nextAwards[0].id);
        setIsEditingAward(false);
        setShowDeleteAwardConfirm(false);
    };

    const getDisplayName = (name: string) => {
        const activeCoursePattern = activeCourses
            .map(course => course.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');
        if (!activeCoursePattern) return name;
        return name.replace(new RegExp(`\\s+[–-]\\s+(?:${activeCoursePattern})$`), '').trim();
    };

    const scoreMatrixRows = useMemo(() => {
        return scoreCourseTrainees.map(trainee => ({
            traineeName: getDisplayName(trainee.fullName || trainee.name),
            scores: scoredEvents.map(eventCode => getLatestScoreForEvent(trainee, eventCode)?.score ?? ''),
        }));
    }, [scoreCourseTrainees, scoredEvents, pt051ScoreRecords, activeCourses]);

    const escapeCsvValue = (value: string | number): string => {
        const raw = String(value);
        return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
    };

    const escapeHtmlValue = (value: string | number): string => {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const exportCourseScoresCsv = () => {
        const header = ['Trainee', ...scoredEvents];
        const rows = scoreMatrixRows.map(row => [row.traineeName, ...row.scores]);
        const csv = [header, ...rows]
            .map(row => row.map(escapeCsvValue).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeCourseName = (scoreCourse || 'course').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
        link.href = url;
        link.download = `${safeCourseName}-scores.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const printCourseScores = () => {
        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) return;

        const headerCells = scoredEvents.map(eventCode => `<th>${escapeHtmlValue(eventCode)}</th>`).join('');
        const bodyRows = scoreMatrixRows.map(row => `
            <tr>
                <td class="name">${escapeHtmlValue(row.traineeName)}</td>
                ${row.scores.map(score => `<td>${escapeHtmlValue(score)}</td>`).join('')}
            </tr>
        `).join('');
        const escapedCourseName = escapeHtmlValue(scoreCourse);

        printWindow.document.write(`
            <!doctype html>
            <html>
                <head>
                    <title>${escapedCourseName} Course Scores</title>
                    <style>
                        body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
                        h1 { font-size: 20px; margin: 0 0 4px; }
                        p { color: #4b5563; margin: 0 0 16px; }
                        table { border-collapse: collapse; width: 100%; font-size: 11px; }
                        th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: center; }
                        th { background: #f3f4f6; font-weight: 700; }
                        td.name, th.name { text-align: left; white-space: nowrap; }
                        @media print { body { margin: 12mm; } }
                    </style>
                </head>
                <body>
                    <h1>${escapedCourseName} Course Scores</h1>
                    <p>${escapeHtmlValue(trainingReportName)} overall grades</p>
                    <table>
                        <thead><tr><th class="name">Trainee</th>${headerCells}</tr></thead>
                        <tbody>${bodyRows || '<tr><td>No scores available.</td></tr>'}</tbody>
                    </table>
                    <script>
                        window.onload = function () {
                            window.print();
                            window.onafterprint = function () { window.close(); };
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const updateRiskThreshold = (key: keyof CourseRiskThresholds, value: number) => {
        setRiskThresholds(prev => ({ ...prev, [key]: value }));
    };

    return (
        <>
            {showFullGraph ? (
                <FullPageProgressGraph
                    courses={activeCourses}
                    allTrainees={traineesData}
                    pt051Assessments={pt051Assessments}
                    traineeLMPs={traineeLMPs}
                    riskThresholds={riskThresholds}
                    courseColors={courseColors}
                    initialSelectedCourse={selectedGraphCourse}
                    onClose={() => {
                        setShowFullGraph(false);
                        setSelectedGraphCourse(null);
                    }}
                />
            ) : (
                <div className="flex-1 flex flex-col bg-gray-900 overflow-y-auto">
                    <div className="p-6 space-y-6 max-w-full mx-auto w-full">
                        <header>
                            <h1 className="text-3xl font-bold text-white">Course Progress</h1>
                            <p className="text-lg text-gray-400">High-level overview of trainee progression through the syllabus.</p>
                            <div className="flex justify-end gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRiskSettings(true)}
                                    className="w-[75px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                                >
                                    Risk<br />Settings
                                </button>
                                <AuditButton pageName="Course Progress" />
                            </div>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                            {activeCourses.map(course => (
                                <CourseDataWindow
                                    key={course.name}
                                    course={course}
                                    allTrainees={traineesData}
                                    pt051Assessments={pt051Assessments}
                                    traineeLMPs={traineeLMPs}
                                    riskThresholds={riskThresholds}
                                    onUpdateGradDate={onUpdateGradDate}
                                    onUpdateStartDate={onUpdateStartDate}
                                    onShowFullGraph={() => {
                                        setSelectedGraphCourse(course.name);
                                        setShowFullGraph(true);
                                    }}
                                />
                            ))}
                        </div>

                        <section className="space-y-4">
                            <div>
                                <h2 className="text-2xl font-bold text-white">Course Scores & Rankings</h2>
                                <p className="text-sm text-gray-400">{trainingReportName} overall grades and editable award ranking criteria for active course trainees.</p>
                            </div>

                            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.55fr)] gap-6">
                                <div
                                    className={`bg-gray-800 rounded-lg border overflow-hidden ${getCourseBorderClass(scoreCourse)}`}
                                    style={getCourseBorderStyle(scoreCourse)}
                                >
                                    <div
                                        data-course-color="true"
                                        className={`px-4 py-3 border-b border-gray-700 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 ${getCourseHeaderClass(scoreCourse)}`}
                                        style={getCourseHeaderStyle(scoreCourse)}
                                    >
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">Course Scores</h3>
                                            <p className="text-xs text-white/75">Only events with saved {trainingReportName} overall grades are shown.</p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                                            <label className="text-sm text-gray-300 min-w-60">
                                                Course
                                                <select
                                                    value={scoreCourse}
                                                    onChange={event => setScoreCourse(event.target.value)}
                                                    className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                >
                                                    {activeCourses.map(course => <option key={course.name} value={course.name}>{course.name}</option>)}
                                                </select>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={printCourseScores}
                                                className="px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-gray-700/60 hover:bg-gray-700 rounded-md border border-gray-600/70"
                                            >
                                                Print
                                            </button>
                                            <button
                                                type="button"
                                                onClick={exportCourseScoresCsv}
                                                className="px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-gray-700/60 hover:bg-gray-700 rounded-md border border-gray-600/70"
                                            >
                                                Export CSV
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowCourseScoreSettings(true)}
                                                className="px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-gray-700/60 hover:bg-gray-700 rounded-md border border-gray-600/70"
                                            >
                                                Settings
                                            </button>
                                        </div>
                                    </div>
                                    <div className="border-b border-gray-700 bg-gray-900/35 px-4 py-2 text-[11px] text-gray-400">
                                        Included event types: <span className="font-semibold text-gray-200">{selectedCourseScoreEventTypeSummary}</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-900/80">
                                                <tr>
                                                    <th className="sticky left-0 z-10 bg-gray-900/95 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-300 min-w-56">Trainee</th>
                                                    {scoredEvents.map(eventCode => (
                                                        <th key={eventCode} className="px-3 py-3 text-center text-xs font-semibold uppercase text-gray-300 min-w-24 whitespace-nowrap">{eventCode}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-700">
                                                {scoreCourseTrainees.map(trainee => (
                                                    <tr key={trainee.idNumber || trainee.fullName} className="hover:bg-gray-700/30">
                                                        <td className="sticky left-0 z-10 bg-gray-800 px-4 py-3 text-gray-100 min-w-56">
                                                            <div className="font-medium">{getDisplayName(trainee.fullName || trainee.name)}</div>
                                                        </td>
                                                        {scoredEvents.map(eventCode => {
                                                            const score = getLatestScoreForEvent(trainee, eventCode);
                                                            return (
                                                                <td key={`${trainee.idNumber}-${eventCode}`} className="px-3 py-3 text-center font-mono text-gray-200">
                                                                    {score ? score.score : ''}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                                {scoreCourseTrainees.length === 0 && (
                                                    <tr>
                                                        <td className="px-4 py-8 text-center text-gray-400" colSpan={Math.max(1, scoredEvents.length + 1)}>No active trainees available for this course.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div
                                    className={`bg-gray-800 rounded-lg border overflow-hidden ${getCourseBorderClass(activeAward.course)}`}
                                    style={getCourseBorderStyle(activeAward.course)}
                                >
                                    <div
                                        data-course-color="true"
                                        className={`px-4 py-3 border-b border-gray-700 ${getCourseHeaderClass(activeAward.course)}`}
                                        style={getCourseHeaderStyle(activeAward.course)}
                                    >
                                        <h3 className="text-lg font-semibold text-white">Course Rankings</h3>
                                        <p className="text-xs text-white/75">Create named awards and define how each ranking is calculated.</p>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                                            <div className="space-y-3">
                                                <label className="block text-sm text-gray-300">
                                                    Course
                                                    <select
                                                        value={activeAward.course}
                                                        onChange={event => updateActiveAwardCourse(event.target.value)}
                                                        className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                    >
                                                        {activeCourses.map(course => <option key={course.name} value={course.name}>{course.name}</option>)}
                                                    </select>
                                                </label>
                                                <label className="block text-sm text-gray-300">
                                                    Award
                                                    <select
                                                        value={activeAward.id}
                                                        onChange={event => setActiveAwardId(event.target.value)}
                                                        className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                    >
                                                        {awards.map(award => <option key={award.id} value={award.id}>{getAwardDisplayName(award)}</option>)}
                                                    </select>
                                                </label>
                                            </div>
                                            <div className="flex flex-col gap-1 justify-start sm:justify-end self-end">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditingAward(prev => !prev)}
                                                    className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                                                >
                                                    {isEditingAward ? 'Done' : 'Edit'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={addAward}
                                                    className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                                                >
                                                    <span className="leading-tight">Add<br />Award</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={removeAward}
                                                    disabled={awards.length <= 1}
                                                    className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>

                                        {!isEditingAward && (
                                            <div className="rounded-md border border-gray-700 bg-gray-900/35 px-3 py-3">
                                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
                                                    <span className="rounded bg-gray-800 px-2 py-1">Course: {activeAward.course === 'all' ? 'All active courses' : activeAward.course}</span>
                                                    <span className="rounded bg-gray-800 px-2 py-1">LMP: {activeAward.lmpType || 'Not configured'}</span>
                                                    <span className="rounded bg-gray-800 px-2 py-1">Events: {selectedAwardEventRows.length}</span>
                                                    <span className="rounded bg-gray-800 px-2 py-1">Score method: {activeAwardScoreMethodLabel}</span>
                                                    <span className="rounded bg-gray-800 px-2 py-1">Minimum scores: {activeAward.minimumScoredEvents}</span>
                                                </div>
                                            </div>
                                        )}

                                        {isEditingAward && (
                                        <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <label className="text-sm text-gray-300">
                                                Award Name
                                                <input
                                                    value={activeAward.name}
                                                    onChange={event => updateActiveAward({ name: event.target.value })}
                                                    className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                />
                                            </label>
                                            <label className="text-sm text-gray-300">
                                                Award LMP
                                                <select
                                                    value={activeAward.lmpType}
                                                    onChange={event => updateActiveAward({ lmpType: event.target.value, includeAllScoredEvents: true })}
                                                    className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                >
                                                    {availableAwardLmpTypes.length === 0 && <option value="">No Master LMP configured</option>}
                                                    {availableAwardLmpTypes.map(lmpType => <option key={lmpType} value={lmpType}>{lmpType}</option>)}
                                                </select>
                                            </label>
                                            <label className="text-sm text-gray-300">
                                                Score Method
                                                <select
                                                    value={activeAwardScoreMethod}
                                                    onChange={event => updateActiveAward({ scoreMethod: event.target.value as CourseAward['scoreMethod'] })}
                                                    className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                >
                                                    <option value="latest">Latest attempt</option>
                                                    <option value="best">Best attempt</option>
                                                    <option value="average">Average all attempts</option>
                                                </select>
                                            </label>
                                            <label className="text-sm text-gray-300">
                                                Minimum scored events
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={activeAward.minimumScoredEvents}
                                                    onChange={event => updateActiveAward({ minimumScoredEvents: Math.max(1, parseInt(event.target.value, 10) || 1) })}
                                                    className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                />
                                            </label>
                                        </div>

                                        <div className="rounded-md border border-gray-700 bg-gray-900/35 p-3">
                                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-200">Award Filters</h4>
                                                    <p className="text-xs text-gray-500">Choose the event families that count toward this award.</p>
                                                </div>
                                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(activeAward.includeRemedial)}
                                                        onChange={event => updateActiveAward({ includeRemedial: event.target.checked, includeAllScoredEvents: true })}
                                                        className="h-4 w-4 rounded border-gray-500 bg-gray-900 text-sky-500 focus:ring-sky-500"
                                                    />
                                                    Include remedial/repeat events
                                                </label>
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {awardEventTypeOptions.map(option => {
                                                    const checked = selectedAwardEventTypes.includes(option.key);
                                                    return (
                                                        <label key={option.key} className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs font-semibold ${checked ? 'border-sky-400/45 bg-sky-500/15 text-sky-50' : 'border-gray-700 bg-gray-950/60 text-gray-400'}`}>
                                                            <span>{option.label}</span>
                                                            <span className="flex items-center gap-2">
                                                                <span className="text-[10px] text-gray-500">{option.count}</span>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={event => toggleAwardEventType(option.key, event.target.checked)}
                                                                    className="h-4 w-4 rounded border-gray-500 bg-gray-900 text-sky-500 focus:ring-sky-500"
                                                                />
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                                {awardEventTypeOptions.length === 0 && (
                                                    <div className="rounded border border-gray-700 bg-gray-950/60 px-3 py-2 text-xs text-gray-400 sm:col-span-2">
                                                        No event types are available for this course and LMP selection.
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-200">Scoring Events</h4>
                                                    <p className="text-xs text-gray-500">Tick the events used for this award. A weight above 1 makes the event count more strongly in the average.</p>
                                                </div>
                                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                                                    <input
                                                        type="checkbox"
                                                        checked={activeAward.includeAllScoredEvents}
                                                        onChange={event => toggleAllAwardEvents(event.target.checked)}
                                                        className="h-4 w-4 rounded border-gray-500 bg-gray-900 text-sky-500 focus:ring-sky-500"
                                                    />
                                                    Select all
                                                </label>
                                            </div>
                                            <div className="max-h-72 overflow-y-auto rounded-md border border-gray-700 divide-y divide-gray-700">
                                                {filteredAwardEventOptions.map(option => {
                                                    const criterion = getCriterionForEvent(option.value);
                                                    const selected = isAwardEventSelected(option.value);
                                                    return (
                                                        <div key={option.value} className="grid grid-cols-[auto_minmax(0,1fr)_90px] gap-2 items-center px-3 py-2 bg-gray-900/35">
                                                            <input
                                                                type="checkbox"
                                                                checked={selected}
                                                                onChange={event => toggleAwardEvent(option.value, event.target.checked)}
                                                                className="h-4 w-4 rounded border-gray-500 bg-gray-900 text-sky-500 focus:ring-sky-500"
                                                            />
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-medium text-gray-100 truncate">{option.label}</div>
                                                                <div className="text-[10px] uppercase tracking-wide text-gray-500">{courseScoreEventTypeLabels[option.eventType]}</div>
                                                            </div>
                                                            <input
                                                                type="number"
                                                                min={0.1}
                                                                step={0.1}
                                                                value={criterion?.weight ?? 1}
                                                                onChange={event => setAwardEventWeight(option.value, parseFloat(event.target.value) || 1)}
                                                                disabled={!selected}
                                                                className="bg-gray-900 border border-gray-600 rounded-md px-2 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-40"
                                                                aria-label={`${option.label} weight`}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                                {filteredAwardEventOptions.length === 0 && (
                                                    <div className="px-3 py-6 text-center text-sm text-gray-400">No events match this award setup.</div>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                {getAwardDisplayName(activeAward)} ranking includes {selectedAwardEventRows.length} selected event{selectedAwardEventRows.length === 1 ? '' : 's'} using {activeAwardScoreMethodLabel.toLowerCase()} scoring.
                                            </p>
                                        </div>
                                        </>
                                        )}

                                        <div className="overflow-x-auto border border-gray-700 rounded-md">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-gray-900/80">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-300">Rank</th>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-300">Trainee</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-300">Average</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-300">Scores</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-700">
                                                    {awardRankings.map((row, index) => (
                                                        <tr key={row.trainee.idNumber || row.trainee.fullName} className="hover:bg-gray-700/30">
                                                            <td className="px-3 py-2 text-gray-300">{index + 1}</td>
                                                            <td className="px-3 py-2">
                                                                <div className="font-medium text-white">{getDisplayName(row.trainee.fullName || row.trainee.name)}</div>
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono text-sky-300">{row.rankingScore.toFixed(2)}</td>
                                                            <td className="px-3 py-2 text-right text-gray-300">{row.scoredCount}</td>
                                                        </tr>
                                                    ))}
                                                    {awardRankings.length === 0 && (
                                                        <tr>
                                                            <td className="px-3 py-6 text-center text-gray-400" colSpan={4}>No ranking data available for the selected criteria.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                    {showRiskSettings && (
                        <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center animate-fade-in" onClick={() => setShowRiskSettings(false)}>
                            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-sky-500/50" onClick={event => event.stopPropagation()}>
                                <div className="p-4 border-b border-gray-700 bg-sky-900/20">
                                    <h2 className="text-xl font-bold text-sky-400">Course Risk Settings</h2>
                                    <p className="text-xs text-gray-400 mt-1">Thresholds apply to every course card and progress graph.</p>
                                </div>
                                <div className="p-5 space-y-4">
                                    <label className="block text-sm text-gray-300">
                                        On Track maximum events/week
                                        <input
                                            type="number"
                                            min={0}
                                            step={0.1}
                                            value={riskThresholds.onTrackMax}
                                            onChange={event => updateRiskThreshold('onTrackMax', parseFloat(event.target.value) || 0)}
                                            className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                    </label>
                                    <label className="block text-sm text-gray-300">
                                        Watch maximum events/week
                                        <input
                                            type="number"
                                            min={riskThresholds.onTrackMax}
                                            step={0.1}
                                            value={riskThresholds.watchMax}
                                            onChange={event => updateRiskThreshold('watchMax', parseFloat(event.target.value) || riskThresholds.onTrackMax)}
                                            className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                    </label>
                                    <label className="block text-sm text-gray-300">
                                        At Risk maximum events/week
                                        <input
                                            type="number"
                                            min={riskThresholds.watchMax}
                                            step={0.1}
                                            value={riskThresholds.atRiskMax}
                                            onChange={event => updateRiskThreshold('atRiskMax', parseFloat(event.target.value) || riskThresholds.watchMax)}
                                            className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                    </label>
                                    <div className="rounded-md border border-gray-700 bg-gray-900/40 p-3 text-xs text-gray-300 space-y-1">
                                        <p>&le; {riskThresholds.onTrackMax.toFixed(1)}/wk: On Track</p>
                                        <p>{(riskThresholds.onTrackMax + 0.1).toFixed(1)}-{riskThresholds.watchMax.toFixed(1)}/wk: Watch</p>
                                        <p>{(riskThresholds.watchMax + 0.1).toFixed(1)}-{riskThresholds.atRiskMax.toFixed(1)}/wk: At Risk</p>
                                        <p>&gt; {riskThresholds.atRiskMax.toFixed(1)}/wk: Critical</p>
                                    </div>
                                </div>
                                <div className="px-5 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowRiskSettings(false)}
                                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {showCourseScoreSettings && (
                        <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center animate-fade-in" onClick={() => setShowCourseScoreSettings(false)}>
                            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-sky-500/50" onClick={event => event.stopPropagation()}>
                                <div className="p-4 border-b border-gray-700 bg-sky-900/20">
                                    <h2 className="text-xl font-bold text-sky-400">Course Score Event Types</h2>
                                    <p className="text-xs text-gray-400 mt-1">Choose which scored event types are included for {scoreCourse || 'this course'}.</p>
                                </div>
                                <div className="p-5 space-y-4">
                                    {courseScoreEventTypeOptions.length > 0 ? (
                                        <div className="space-y-2">
                                            {courseScoreEventTypeOptions.map(option => {
                                                const checked = selectedCourseScoreEventTypes.includes(option.key);
                                                return (
                                                    <label
                                                        key={option.key}
                                                        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition ${
                                                            checked
                                                                ? 'border-sky-400/50 bg-sky-500/15 text-sky-50'
                                                                : 'border-gray-700 bg-gray-900/45 text-gray-300'
                                                        }`}
                                                    >
                                                        <span className="font-semibold">{option.label}</span>
                                                        <span className="flex items-center gap-3">
                                                            <span className="text-xs text-gray-400">{option.count} event{option.count === 1 ? '' : 's'}</span>
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={event => toggleCourseScoreEventType(option.key, event.target.checked)}
                                                                className="h-4 w-4 rounded border-gray-500 bg-gray-900 accent-sky-500"
                                                            />
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="rounded-md border border-gray-700 bg-gray-900/45 px-3 py-6 text-center text-sm text-gray-400">
                                            No saved scored events are available for this course.
                                        </div>
                                    )}
                                    <div className="rounded-md border border-gray-700 bg-gray-900/40 px-3 py-2 text-xs text-gray-300">
                                        Current selection: <span className="font-semibold text-gray-100">{selectedCourseScoreEventTypeSummary}</span>
                                    </div>
                                </div>
                                <div className="px-5 py-4 bg-gray-900/50 border-t border-gray-700 flex flex-wrap justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAllCourseScoreEventTypes(true)}
                                        className="w-[72px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                                    >
                                        Select<br />All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAllCourseScoreEventTypes(false)}
                                        className="w-[72px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowCourseScoreSettings(false)}
                                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {showDeleteAwardConfirm && (
                        <div className="fixed inset-0 bg-black/75 z-[90] flex items-center justify-center animate-fade-in" onClick={() => setShowDeleteAwardConfirm(false)}>
                            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-red-500/50 overflow-hidden" onClick={event => event.stopPropagation()}>
                                <div className="p-4 border-b border-gray-700 bg-red-950/35">
                                    <h2 className="text-xl font-bold text-red-300">Delete Award</h2>
                                    <p className="text-xs text-gray-400 mt-1">
                                        This removes the award setup from Course Rankings.
                                    </p>
                                </div>
                                <div className="p-5 space-y-3">
                                    <div className="rounded-md border border-gray-700 bg-gray-900/50 px-3 py-3">
                                        <div className="text-xs uppercase tracking-wide text-gray-500">Award</div>
                                        <div className="mt-1 text-lg font-semibold text-white">{getAwardDisplayName(activeAward)}</div>
                                    </div>
                                    <p className="text-sm text-gray-300">
                                        Delete this award configuration? Ranking results can still be rebuilt later by creating a new award and choosing the scoring events again.
                                    </p>
                                </div>
                                <div className="px-5 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteAwardConfirm(false)}
                                        className="w-[64px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirmRemoveAward}
                                        className="w-[64px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md bg-red-600 text-white hover:bg-red-500 border border-red-400/60 shadow"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default CourseProgressView;
