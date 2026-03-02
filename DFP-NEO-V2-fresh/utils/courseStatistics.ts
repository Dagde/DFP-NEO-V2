import { Trainee, Score, SyllabusItemDetail, Course } from '../types';

export interface CourseStatistics {
    eventsPerWeek: number;
    totalEvents: number;
    totalWeeks: number;
    completionRate: number;
}

export interface CourseStatisticsResult {
    frontRunnerStats: CourseStatistics;
    backMarkerStats: CourseStatistics;
    courseAverageStats: CourseStatistics;
}

interface TraineeProgressData {
    name: string;
    completedEvents: number;
    totalRequired: number;
    completionRate: number;
    eventsPerWeek: number;
    weeksElapsed: number;
    weeksRemaining: number;
}

export function calculateCourseStatistics(
    trainees: Trainee[],
    scores: Map<string, Score[]>,
    traineeLMPs: Map<string, SyllabusItemDetail[]>,
    courses: Course[]
): CourseStatisticsResult {
    console.log('[CourseStatistics] Input data:', {
        traineesCount: trainees.length,
        scoresMapSize: scores.size,
        traineeLMPsMapSize: traineeLMPs.size,
        coursesCount: courses.length
    });

    if (trainees.length === 0) {
        console.log('[CourseStatistics] No trainees provided');
        return {
            frontRunnerStats: { eventsPerWeek: 0, totalEvents: 0, totalWeeks: 0, completionRate: 0 },
            backMarkerStats: { eventsPerWeek: 0, totalEvents: 0, totalWeeks: 0, completionRate: 0 },
            courseAverageStats: { eventsPerWeek: 0, totalEvents: 0, totalWeeks: 0, completionRate: 0 }
        };
    }

    const traineeStats: TraineeProgressData[] = [];

    for (const trainee of trainees) {
        const course = courses.find(c => c.name === trainee.course);
        if (!course) {
            console.log(`[CourseStatistics] No course found for trainee ${trainee.fullName}, course: ${trainee.course}`);
            continue;
        }

        const traineeScores = scores.get(trainee.fullName) || [];
        const traineeLMP = traineeLMPs.get(trainee.fullName) || [];

        console.log(`[CourseStatistics] Processing trainee: ${trainee.fullName}`, {
            scoresCount: traineeScores.length,
            lmpCount: traineeLMP.length,
            courseName: course.name,
            courseStart: course.startDate,
            courseGrad: course.gradDate
        });

        // Count completed Flight and FTD events (excluding remedial)
        let completedEvents = 0;
        for (const score of traineeScores) {
            // Skip non-progress events
            if (score.event.includes('MB') || score.event.includes('-REM-') || score.event.includes('-RF')) {
                continue;
            }
            
            const syllabusItem = traineeLMP.find(item => item.id === score.event);
            if (syllabusItem && (syllabusItem.type === 'Flight' || syllabusItem.type === 'FTD') && !syllabusItem.isRemedial) {
                completedEvents++;
            }
        }

        // Count total required events (Flight and FTD, excluding remedial)
        const totalRequired = traineeLMP.filter(
            item => (item.type === 'Flight' || item.type === 'FTD') && !item.isRemedial
        ).length;

        console.log(`[CourseStatistics] ${trainee.fullName}: completed=${completedEvents}, total=${totalRequired}`);

        if (totalRequired === 0) {
            console.log(`[CourseStatistics] Skipping ${trainee.fullName} - no required events`);
            continue;
        }

        const completionRate = completedEvents / totalRequired;

        // Calculate weeks elapsed since course start
        const courseStartDate = new Date(course.startDate + 'T00:00:00Z');
        const today = new Date();
        const weeksElapsed = Math.max(0, (today.getTime() - courseStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7));

        // Calculate weeks remaining until graduation
        const courseEndDate = new Date(course.gradDate + 'T00:00:00Z');
        const weeksRemaining = Math.max(0, (courseEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 7));

        // Calculate events remaining
        const eventsRemaining = totalRequired - completedEvents;

        // Calculate events per week required to graduate on time
        const eventsPerWeek = weeksRemaining > 0 ? eventsRemaining / weeksRemaining : 0;

        console.log(`[CourseStatistics] ${trainee.fullName}: weeksRemaining=${weeksRemaining.toFixed(1)}, eventsRemaining=${eventsRemaining}, eventsPerWeek=${eventsPerWeek.toFixed(1)}`);

        traineeStats.push({
            name: trainee.fullName,
            completedEvents,
            totalRequired,
            completionRate,
            eventsPerWeek,
            weeksElapsed,
            weeksRemaining
        });
    }

    if (traineeStats.length === 0) {
        console.log('[CourseStatistics] No trainee stats calculated - returning zeros');
        return {
            frontRunnerStats: { eventsPerWeek: 0, totalEvents: 0, totalWeeks: 0, completionRate: 0 },
            backMarkerStats: { eventsPerWeek: 0, totalEvents: 0, totalWeeks: 0, completionRate: 0 },
            courseAverageStats: { eventsPerWeek: 0, totalEvents: 0, totalWeeks: 0, completionRate: 0 }
        };
    }

    console.log(`[CourseStatistics] Calculated stats for ${traineeStats.length} trainees`);

    // Sort by completion rate to find front runner and back marker
    traineeStats.sort((a, b) => b.completionRate - a.completionRate);

    const frontRunner = traineeStats[0];
    const backMarker = traineeStats[traineeStats.length - 1];

    // Calculate course averages
    const averageCompletionRate = traineeStats.reduce((sum, t) => sum + t.completionRate, 0) / traineeStats.length;
    const averageEventsPerWeek = traineeStats.reduce((sum, t) => sum + t.eventsPerWeek, 0) / traineeStats.length;
    const averageTotalEvents = traineeStats.reduce((sum, t) => sum + t.completedEvents, 0) / traineeStats.length;
    const averageWeeksRemaining = traineeStats.reduce((sum, t) => sum + t.weeksRemaining, 0) / traineeStats.length;

    const result = {
        frontRunnerStats: {
            eventsPerWeek: frontRunner.eventsPerWeek,
            totalEvents: frontRunner.completedEvents,
            totalWeeks: frontRunner.weeksRemaining,
            completionRate: frontRunner.completionRate
        },
        backMarkerStats: {
            eventsPerWeek: backMarker.eventsPerWeek,
            totalEvents: backMarker.completedEvents,
            totalWeeks: backMarker.weeksRemaining,
            completionRate: backMarker.completionRate
        },
        courseAverageStats: {
            eventsPerWeek: averageEventsPerWeek,
            totalEvents: averageTotalEvents,
            totalWeeks: averageWeeksRemaining,
            completionRate: averageCompletionRate
        }
    };

    console.log('[CourseStatistics] Final result:', {
        frontRunner: `${frontRunner.name}: ${frontRunner.eventsPerWeek.toFixed(1)}/wk`,
        backMarker: `${backMarker.name}: ${backMarker.eventsPerWeek.toFixed(1)}/wk`,
        average: `${averageEventsPerWeek.toFixed(1)}/wk`
    });

    return result;
}