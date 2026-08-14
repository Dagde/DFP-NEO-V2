import { Course, SyllabusItemDetail, Trainee, TrainingReportAssessment } from '../types';

export interface CourseRiskThresholds {
    onTrackMax: number;
    watchMax: number;
    atRiskMax: number;
}

export interface TraineeProgressMetric {
    trainee: Trainee;
    completedCount: number;
    totalEvents: number;
    percentage: number;
    nextEvent: string;
    latestCompletedEvent: string;
}

export interface WeeklyCourseProgress {
    weekDate: Date;
    highest: number;
    lowest: number;
    average: number;
    highestTrainee: string;
    lowestTrainee: string;
}

export interface CourseProgressMetric {
    course: Course;
    totalEvents: number;
    trainees: TraineeProgressMetric[];
    frontRunnerEvent: string;
    medianEvent: string;
    backMarkerEvent: string;
    medianProgressPercentage: number;
    averageCompletedEvents: number;
    requiredPace: number;
    riskLabel: 'On Track' | 'Watch' | 'At Risk' | 'Critical';
    riskColorClass: string;
    weeklyProgress: WeeklyCourseProgress[];
}

const isProgressEvent = (item: SyllabusItemDetail) => {
    return (item.type === 'Flight' || item.type === 'FTD') &&
        !item.isRemedial &&
        !item.id.includes(' MB') &&
        !item.code.includes(' MB');
};

const getEventCode = (item: SyllabusItemDetail) => (item.code || item.id || '').trim();

const normaliseName = (name: string) => name.replace(/\s+[–-]\s+[A-Z]{2,}\d+$/i, '').trim();

const getAssessmentDate = (assessment: TrainingReportAssessment) => {
    if (!assessment.date) return null;
    const date = new Date(`${assessment.date}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
};

const getAssessmentEventCode = (assessment: TrainingReportAssessment) => (assessment.flightNumber || assessment.eventId || '').trim();

const isCompletedTrainingReport = (assessment: TrainingReportAssessment) => {
    return assessment.isCompleted !== false && typeof assessment.overallGrade === 'number';
};

const getCompletedEventDates = (
    trainee: Trainee,
    validEventCodes: Set<string>,
    eventIdToCode: Map<string, string>,
    pt051Assessments: Map<string, TrainingReportAssessment>
) => {
    const traineeNames = new Set([trainee.fullName, trainee.name, normaliseName(trainee.fullName), normaliseName(trainee.name)].filter(Boolean));
    const completed = new Map<string, Date>();

    pt051Assessments.forEach(assessment => {
        if (!isCompletedTrainingReport(assessment)) return;
        if (!traineeNames.has(assessment.traineeFullName) && !traineeNames.has(normaliseName(assessment.traineeFullName))) return;

        const rawEventCode = getAssessmentEventCode(assessment);
        const eventCode = eventIdToCode.get(rawEventCode) || rawEventCode;
        if (!validEventCodes.has(eventCode)) return;

        const date = getAssessmentDate(assessment);
        if (!date) return;

        const existingDate = completed.get(eventCode);
        if (!existingDate || date > existingDate) {
            completed.set(eventCode, date);
        }
    });

    return completed;
};

const getEventAtCount = (events: SyllabusItemDetail[], count: number) => {
    if (count <= 0) return 'Not Started';
    return events[Math.min(count - 1, events.length - 1)]?.code || 'N/A';
};

export const getRiskLabel = (requiredPace: number, thresholds: CourseRiskThresholds): CourseProgressMetric['riskLabel'] => {
    if (requiredPace <= thresholds.onTrackMax) return 'On Track';
    if (requiredPace <= thresholds.watchMax) return 'Watch';
    if (requiredPace <= thresholds.atRiskMax) return 'At Risk';
    return 'Critical';
};

export const getRiskColorClass = (riskLabel: CourseProgressMetric['riskLabel']) => {
    if (riskLabel === 'On Track') return 'text-emerald-200 bg-emerald-500/20 border-emerald-300/40';
    if (riskLabel === 'Watch') return 'text-amber-100 bg-amber-400/20 border-amber-300/40';
    if (riskLabel === 'At Risk') return 'text-orange-100 bg-orange-500/20 border-orange-300/40';
    return 'text-red-100 bg-red-500/25 border-red-300/50';
};

export const calculateCourseProgressMetric = (
    course: Course,
    allTrainees: Trainee[],
    traineeLMPs: Map<string, SyllabusItemDetail[]>,
    pt051Assessments: Map<string, TrainingReportAssessment>,
    thresholds: CourseRiskThresholds
): CourseProgressMetric => {
    const courseTrainees = allTrainees.filter(trainee => trainee.course === course.name && !trainee.isPaused);
    const representativeLMP = courseTrainees
        .map(trainee => traineeLMPs.get(trainee.fullName) || traineeLMPs.get(trainee.name) || [])
        .find(lmp => lmp.length > 0) || [];
    const progressEvents = representativeLMP.filter(isProgressEvent);
    const validEventCodes = new Set(progressEvents.map(getEventCode).filter(Boolean));
    const eventIdToCode = new Map<string, string>();

    progressEvents.forEach(item => {
        const eventCode = getEventCode(item);
        if (!eventCode) return;
        eventIdToCode.set(item.id, eventCode);
        eventIdToCode.set(item.code, eventCode);
    });

    const totalEvents = progressEvents.length;

    const trainees = courseTrainees.map(trainee => {
        const individualLMP = traineeLMPs.get(trainee.fullName) || traineeLMPs.get(trainee.name) || representativeLMP;
        const traineeProgressEvents = individualLMP.filter(isProgressEvent);
        const traineeValidCodes = new Set(traineeProgressEvents.map(getEventCode).filter(Boolean));
        const traineeEventIdToCode = new Map(eventIdToCode);
        traineeProgressEvents.forEach(item => {
            const eventCode = getEventCode(item);
            if (!eventCode) return;
            traineeEventIdToCode.set(item.id, eventCode);
            traineeEventIdToCode.set(item.code, eventCode);
        });

        const completedEventDates = getCompletedEventDates(trainee, traineeValidCodes, traineeEventIdToCode, pt051Assessments);
        const completedCount = completedEventDates.size;
        let nextEvent = 'Finished';

        if (completedCount < traineeProgressEvents.length) {
            nextEvent = 'N/A';
            for (const item of traineeProgressEvents) {
                const eventCode = getEventCode(item);
                if (!eventCode || completedEventDates.has(eventCode)) continue;
                const prerequisitesMet = item.prerequisites.every(prereq => {
                    const prereqCode = traineeEventIdToCode.get(prereq) || prereq;
                    return !traineeValidCodes.has(prereqCode) || completedEventDates.has(prereqCode);
                });
                if (prerequisitesMet) {
                    nextEvent = item.code || eventCode;
                    break;
                }
            }
        }

        return {
            trainee,
            completedCount,
            totalEvents: traineeProgressEvents.length,
            percentage: traineeProgressEvents.length > 0 ? (completedCount / traineeProgressEvents.length) * 100 : 0,
            nextEvent,
            latestCompletedEvent: getEventAtCount(traineeProgressEvents, completedCount),
        };
    }).sort((a, b) => b.completedCount - a.completedCount);

    const progressCounts = trainees.map(trainee => trainee.completedCount).sort((a, b) => a - b);
    const frontRunnerCount = progressCounts[progressCounts.length - 1] || 0;
    const backMarkerCount = progressCounts[0] || 0;
    const medianCount = progressCounts.length === 0
        ? 0
        : progressCounts.length % 2 === 1
            ? progressCounts[Math.floor(progressCounts.length / 2)]
            : (progressCounts[(progressCounts.length / 2) - 1] + progressCounts[progressCounts.length / 2]) / 2;
    const averageCompletedEvents = trainees.length > 0 ? trainees.reduce((sum, trainee) => sum + trainee.completedCount, 0) / trainees.length : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const gradDate = new Date(`${course.gradDate}T00:00:00`);
    const weeksRemaining = Math.max(0, (gradDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const eventsRemaining = Math.max(0, totalEvents - averageCompletedEvents);
    const requiredPace = eventsRemaining === 0 ? 0 : weeksRemaining > 0 ? eventsRemaining / weeksRemaining : Number.POSITIVE_INFINITY;
    const riskLabel = getRiskLabel(requiredPace, thresholds);

    const weeklyProgress: WeeklyCourseProgress[] = [];
    const courseStartDate = new Date(`${course.startDate}T00:00:00`);
    courseStartDate.setHours(0, 0, 0, 0);
    let weekDate = new Date(courseStartDate);

    while (weekDate <= today) {
        const weekEnd = new Date(weekDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const traineeWeeklyCounts = trainees.map(metric => {
            const individualLMP = traineeLMPs.get(metric.trainee.fullName) || traineeLMPs.get(metric.trainee.name) || representativeLMP;
            const traineeProgressEvents = individualLMP.filter(isProgressEvent);
            const traineeValidCodes = new Set(traineeProgressEvents.map(getEventCode).filter(Boolean));
            const traineeEventIdToCode = new Map(eventIdToCode);
            traineeProgressEvents.forEach(item => {
                const eventCode = getEventCode(item);
                if (!eventCode) return;
                traineeEventIdToCode.set(item.id, eventCode);
                traineeEventIdToCode.set(item.code, eventCode);
            });
            const completedEventDates = getCompletedEventDates(metric.trainee, traineeValidCodes, traineeEventIdToCode, pt051Assessments);
            const count = Array.from(completedEventDates.values()).filter(date => date <= weekEnd).length;
            return { name: metric.trainee.fullName || metric.trainee.name, count };
        });

        if (traineeWeeklyCounts.length > 0) {
            traineeWeeklyCounts.sort((a, b) => b.count - a.count);
            weeklyProgress.push({
                weekDate: new Date(weekDate),
                highest: traineeWeeklyCounts[0].count,
                lowest: traineeWeeklyCounts[traineeWeeklyCounts.length - 1].count,
                average: traineeWeeklyCounts.reduce((sum, trainee) => sum + trainee.count, 0) / traineeWeeklyCounts.length,
                highestTrainee: traineeWeeklyCounts[0].name,
                lowestTrainee: traineeWeeklyCounts[traineeWeeklyCounts.length - 1].name,
            });
        }

        weekDate.setDate(weekDate.getDate() + 7);
    }

    return {
        course,
        totalEvents,
        trainees,
        frontRunnerEvent: getEventAtCount(progressEvents, frontRunnerCount),
        medianEvent: getEventAtCount(progressEvents, Math.floor(medianCount)),
        backMarkerEvent: getEventAtCount(progressEvents, backMarkerCount),
        medianProgressPercentage: totalEvents > 0 ? (medianCount / totalEvents) * 100 : 0,
        averageCompletedEvents,
        requiredPace,
        riskLabel,
        riskColorClass: getRiskColorClass(riskLabel),
        weeklyProgress,
    };
};
