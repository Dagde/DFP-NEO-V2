import React, { useState } from 'react';
import { Trainee, Score, Pt051Assessment, SyllabusItemDetail } from '../types';
import AuditButton from './AuditButton';
import { logAudit } from '../utils/auditLogger';
import { showDarkAlert, showDarkConfirm } from './DarkMessageModal';
import { useSystemFreeze } from '../hooks/useSystemFreeze';
import {
    DEFAULT_TRAINING_REPORT_TERMINOLOGY,
    getTrainingReportCompletionResultOptions,
    normaliseTrainingReportTemplate,
    normaliseTrainingReportTerminology,
    type TrainingReportTemplate,
    type TrainingReportTerminology,
} from '../utils/trainingReportTerminology';

// Define ALL_ELEMENTS to match TrainingReportView
const PT051_STRUCTURE = [
    { category: 'Core Dimensions', elements: ['Airmanship', 'Preparation', 'Technique'] },
    { category: 'Procedural Framework', elements: ['Pre-Post Flight', 'Walk Around', 'Strap-in', 'Ground Checks', 'Airborne Checks'] },
    { category: 'Takeoff', elements: ['Stationary'] },
    { category: 'Departure', elements: ['Visual'] },
    { category: 'Core Handling Skills', elements: ['Effects of Control', 'Trimming', 'Straight and Level'] },
    { category: 'Turns', elements: ['Level medium Turn', 'Level Steep turn'] },
    { category: 'Recovery', elements: ['Visual - Initial & Pitch'] },
    { category: 'Landing', elements: ['Landing', 'Crosswind'] },
    { category: 'Domestics', elements: ['Radio Comms', 'Situational Awareness', 'Lookout', 'Knowledge'] },
];

const ALL_ELEMENTS = PT051_STRUCTURE.flatMap(cat => cat.elements);

interface HateSheetViewProps {
    trainee: Trainee;
    lmpScores: Score[];
    assessments: Pt051Assessment[];
    pt051Events: any[];
    traineeLmp?: SyllabusItemDetail[];
    userProfile: any;
    refreshEvents?: () => void;
    onSelectLmpScore: (score: Score) => void;
    onSelectPt051: (assessment: Pt051Assessment) => void;
    onBackToRoster: () => void;
    onInsertPt051: (insertIndex: number, targetDate: string) => void;
    canEditPt051?: boolean;
    onAccessDenied?: (actionLabel: string) => void;
    isLoading?: boolean;
    trainingReportTerminology?: Partial<TrainingReportTerminology> | null;
    trainingReportTemplate?: Partial<TrainingReportTemplate> | null;
}

const HateSheetView: React.FC<HateSheetViewProps> = ({ trainee, lmpScores, assessments, pt051Events, traineeLmp = [], userProfile, refreshEvents, onSelectLmpScore, onSelectPt051, onBackToRoster, onInsertPt051, canEditPt051 = true, onAccessDenied, isLoading = false, trainingReportTerminology = DEFAULT_TRAINING_REPORT_TERMINOLOGY, trainingReportTemplate = null }) => {
    const { isFrozen } = useSystemFreeze();
    const [localPt051Events, setLocalPt051Events] = useState(pt051Events);
    const reportTerminology = normaliseTrainingReportTerminology(trainingReportTerminology);
    const trainingReportName = reportTerminology.name;
    const reportTemplate = React.useMemo(
        () => normaliseTrainingReportTemplate(trainingReportTemplate, trainingReportTerminology),
        [trainingReportTemplate, trainingReportTerminology]
    );
    const reportAssessorLabel = reportTemplate.modules.comments.fields.assessor || 'Instructor';
    const missionStatusLabelMap = React.useMemo(() => {
        const options = getTrainingReportCompletionResultOptions(reportTemplate);
        return new Map(options.map(option => [option.code, option.label]));
    }, [reportTemplate]);
    const getMissionStatusDisplayLabel = (statusCode: string) => (
        missionStatusLabelMap.get(statusCode as any) || statusCode
    );

    // Helper function to format date
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp * 3600000); // Convert hours to milliseconds
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
       const combinedHistory = React.useMemo(() => {
           // FIX: Add 'as const' to create a discriminated union for type-safe property access.
           // Filter out placeholder/empty report records - only show records with actual assessment data OR date+instructor
              // NOTE: isCompleted alone is NOT sufficient - historical seed records have isCompleted=true with no actual data
              // Events like mass briefs, CUT, TUT have no grade but DO have date+instructor - these should be shown
              const completedAssessments = assessments.filter(assessment => {
                  const hasGrade = assessment.overallGrade !== null && assessment.overallGrade !== undefined;
                  const hasResult = assessment.overallResult !== null && assessment.overallResult !== undefined;
                  const hasScoredElements = assessment.scores && assessment.scores.length > 0 && assessment.scores.some(s => s.grade !== null);
                  const hasDateAndInstructor = (assessment.date && assessment.date.trim() !== '') && (assessment.instructorName && assessment.instructorName.trim() !== '');
                  return hasGrade || hasResult || hasScoredElements || hasDateAndInstructor;
              });

              // DISPLAY DEDUP: keep one report row per trainee/event/date. Older
              // builds could create synthetic score/mock report records when the
              // user clicked a blue LMP score row; those should not surface as a
              // second report when a real assessment row exists.
              const canonicalAssessments = new Map<string, typeof completedAssessments[0]>();
              completedAssessments.forEach(assessment => {
                  const key = `${assessment.traineeFullName}|||${assessment.flightNumber}|||${assessment.date || ''}`;
                  const existing = canonicalAssessments.get(key);
                  if (!existing) {
                      canonicalAssessments.set(key, assessment);
                      return;
                  }

                  const currentEventId = String(assessment.eventId || assessment.id || '');
                  const existingEventId = String(existing.eventId || existing.id || '');
                  const currentIsSynthetic = currentEventId.startsWith('mock-') || currentEventId.startsWith('mock-event-') || currentEventId.startsWith('score-');
                  const existingIsSynthetic = existingEventId.startsWith('mock-') || existingEventId.startsWith('mock-event-') || existingEventId.startsWith('score-');
                  const currentHasResult = assessment.overallGrade !== null && assessment.overallGrade !== undefined && assessment.overallGrade !== 'No Grade';
                  const existingHasResult = existing.overallGrade !== null && existing.overallGrade !== undefined && existing.overallGrade !== 'No Grade';

                  if (
                      (existingIsSynthetic && !currentIsSynthetic) ||
                      (!existingHasResult && currentHasResult) ||
                      ((assessment.date || '') > (existing.date || '') && currentIsSynthetic === existingIsSynthetic)
                  ) {
                      canonicalAssessments.set(key, assessment);
                  }
              });
              const dedupedAssessments = Array.from(canonicalAssessments.values());

              // DISPLAY DEDUP: For unassessed reports with no mission status checked,
              // keep only the most recently dated one per flightNumber+trainee combination.
              // This handles existing duplicates from rescheduled events already in the DB.
              const seenUnassessed = new Map<string, typeof completedAssessments[0]>();
              dedupedAssessments.forEach(assessment => {
                  const isUnassessed = assessment.overallResult === null || assessment.overallResult === undefined || assessment.overallResult === '';
                  if (!isUnassessed) return;
                  const key = `${assessment.flightNumber}|||${assessment.traineeFullName}`;
                  const existing = seenUnassessed.get(key);
                  if (!existing || (assessment.date || '') > (existing.date || '')) {
                      seenUnassessed.set(key, assessment);
                  }
              });
              const mostRecentKeys = new Set(Array.from(seenUnassessed.values()).map(a => a.id));
              const finalAssessments = dedupedAssessments.filter(assessment => {
                  const isUnassessed = assessment.overallResult === null || assessment.overallResult === undefined || assessment.overallResult === '';
                  if (!isUnassessed) return true;
                  return mostRecentKeys.has(assessment.id);
              });

           const pt051Items = finalAssessments.map(assessment => ({ ...assessment, type: 'PT-051' as const }));
           const visiblePt051Keys = new Set(finalAssessments.map(assessment =>
               `${assessment.traineeFullName}|||${assessment.flightNumber}|||${assessment.date || ''}`
           ));
           const visiblePt051EventKeys = new Set(finalAssessments.map(assessment =>
               `${assessment.traineeFullName}|||${assessment.flightNumber}`
           ));
           // Filter out LMP Score placeholder records when a report row exists for
           // the same trainee/event. The score record is still used by the app,
           // but the empty duplicate does not need to be shown in Performance History.
           const lmpItems = lmpScores
               .filter(score => (score.date && score.date.trim() !== '') || (score.instructor && score.instructor.trim() !== ''))
               .filter(score => {
                   const exactKey = `${trainee.fullName}|||${score.event}|||${score.date || ''}`;
                   const eventKey = `${trainee.fullName}|||${score.event}`;
                   return !visiblePt051Keys.has(exactKey) && !visiblePt051EventKeys.has(eventKey);
               })
               .map(score => ({ ...score, type: 'LMP Score' as const }));
           
           
           const normaliseEventCode = (value?: string | null) => String(value || '').replace(/\s+/g, '').toUpperCase();
           const lmpOrder = new Map<string, number>();
           traineeLmp.forEach((item, index) => {
               const key = normaliseEventCode(item.code);
               if (key && !lmpOrder.has(key)) lmpOrder.set(key, index);
           });
           const getLmpOrder = (item: (typeof lmpItems[number]) | (typeof pt051Items[number])) => {
               const eventCode = item.type === 'LMP Score' ? item.event : item.flightNumber;
               return lmpOrder.get(normaliseEventCode(eventCode));
           };

           // Combine and sort by Individual LMP order when available. Records that
           // are not in the current Individual LMP are kept behind the LMP timeline
           // as a legacy fallback, but cleanup should remove those report rows.
           const combined = [...lmpItems, ...pt051Items].sort((a, b) => {
               const aOrder = getLmpOrder(a);
               const bOrder = getLmpOrder(b);
               const aHasOrder = aOrder !== undefined;
               const bHasOrder = bOrder !== undefined;

               if (aHasOrder && bHasOrder) {
                   if (aOrder !== bOrder) return aOrder - bOrder;
                   const aTypeOrder = a.type === 'PT-051' ? 0 : 1;
                   const bTypeOrder = b.type === 'PT-051' ? 0 : 1;
                   if (aTypeOrder !== bTypeOrder) return aTypeOrder - bTypeOrder;
               }

               if (aHasOrder !== bHasOrder) {
                   return aHasOrder ? -1 : 1;
               }

               const aDate = new Date(a.date || '').getTime();
               const bDate = new Date(b.date || '').getTime();
               const safeADate = Number.isNaN(aDate) ? 0 : aDate;
               const safeBDate = Number.isNaN(bDate) ? 0 : bDate;
               if (safeADate !== safeBDate) return safeBDate - safeADate;

               const aCode = normaliseEventCode(a.type === 'LMP Score' ? a.event : a.flightNumber);
               const bCode = normaliseEventCode(b.type === 'LMP Score' ? b.event : b.flightNumber);
               return aCode.localeCompare(bCode);
           });
           
           return combined;
       }, [lmpScores, assessments, traineeLmp]);

    const getTypeDisplayLabel = (type: 'LMP Score' | 'PT-051') => (
        type === 'PT-051' ? trainingReportName : type
    );

    const getTypeDisplayTitle = (type: 'LMP Score' | 'PT-051') => (
        type === 'PT-051' ? trainingReportName : type
    );

    const getScoreDisplay = (item: (typeof combinedHistory)[0]) => {
        let score: number | string | null = null;
        let isDoubleMarginal = false;

        if (item.type === 'LMP Score') {
            score = item.score;
        } else if (item.type === 'PT-051') {
            score = item.overallGrade;
        }

        if (score === null || score === undefined || score === 'No Grade') {
             return <span className="text-sm text-gray-500">-</span>;
        }

        // Check for double marginal if this item has a marginal grade
        if (score === 1) {
            
            // Find the index of this item in the combined history (newest first)
            const currentIndex = combinedHistory.findIndex(history => history.id === item.id);
            
            // Check if there was a previous marginal score in the LMP/progress timeline
            if (currentIndex > 0) {
                const previousItem = combinedHistory[currentIndex - 1];
                const prevScore = previousItem.type === 'LMP Score' ? previousItem.score : previousItem.overallGrade;
                
                if (prevScore === 1) {
                    isDoubleMarginal = true;
                }
            } else {
            }
        }

        // Check if this is a ground event completion (score = 5 for completed ground events)
        if (item.type === 'LMP Score' && item.score === 5) {
            return (
                <span className="text-green-300 text-sm font-semibold">Complete</span>
            );
        }

        const numScore = Number(score);
        let colorClass = 'bg-gray-500/20 text-gray-300';

        if (!isNaN(numScore)) {
            if (isDoubleMarginal) {
                colorClass = 'bg-red-500/20 text-red-300';
            } else if (numScore >= 2) {
                colorClass = 'bg-green-500/20 text-green-300';
            } else if (numScore === 1) {
                colorClass = 'bg-amber-500/20 text-amber-300';
            } else if (numScore === 0) {
                colorClass = 'bg-red-500/20 text-red-300';
            }
        }
        
        return <span className={`px-3 py-1 text-sm font-bold rounded-full ${colorClass}`}>{score}</span>;
    };

    const getStatusDisplay = (item: (typeof combinedHistory)[0]) => {
        if (item.type !== 'PT-051') {
            return <span className="text-sm text-gray-500">-</span>;
        }

        const statusCode = String(item.dcoResult || '').trim().toUpperCase();
        const statusClass = statusCode === 'DCO'
            ? 'bg-green-500/20 text-green-300'
            : statusCode === 'DPCO'
                ? 'bg-amber-500/20 text-amber-300'
                : statusCode === 'DNCO'
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-gray-600/40 text-gray-300';
        const statusLabel = statusCode ? getMissionStatusDisplayLabel(statusCode) : 'None';

        return (
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}`}>
                {statusLabel}
            </span>
        );
    };

    const handleRowClick = (item: (typeof combinedHistory)[0]) => {
        // Always navigate to a training report for all events (including ground events)
        if (item.type === 'LMP Score') {
            const existingAssessment = assessments.find(assessment =>
                assessment.traineeFullName === trainee.fullName &&
                assessment.flightNumber === item.event &&
                (
                    !item.date ||
                    !assessment.date ||
                    assessment.date === item.date
                )
            ) || assessments.find(assessment =>
                assessment.traineeFullName === trainee.fullName &&
                assessment.flightNumber === item.event
            );

            if (existingAssessment) {
                onSelectPt051(existingAssessment);
                return;
            }

            // Create a mock training report assessment for the LMP Score
            const mockAssessment: Pt051Assessment = {
                id: `mock-${item.event}`,
                traineeFullName: trainee.fullName,
                eventId: `score-${trainee.id || trainee.fullName}-${item.event}-${item.date || 'undated'}`,
                flightNumber: item.event,
                date: item.date,
                instructorName: item.instructor,
                overallGrade: item.score === 5 ? 'No Grade' : item.score as any, // Type cast to Pt051OverallGrade
                overallResult: item.score === 5 ? 'P' : null,
                dcoResult: item.score === 5 ? 'DCO' : undefined,
                overallComments: item.notes,
                scores: ALL_ELEMENTS.map(element => ({
                    element,
                    grade: null,
                    comment: ''
                })) // Properly structured scores array
            };
            onSelectPt051(mockAssessment);
        } else if (item.type === 'PT-051') {
            onSelectPt051(item as Pt051Assessment);
        }
    };

    const handleDeletePT051 = async (eventId: string) => {
        if (!canEditPt051) {
            onAccessDenied?.(`delete ${trainingReportName} assessment`);
            return;
        }
        
        // Find the assessment to delete
        const assessmentToDelete = localPt051Events.find(assessment => assessment.id === eventId || assessment.eventId === eventId);
        
        if (!assessmentToDelete) {
            await showDarkAlert(`${trainingReportName} assessment not found.`, `${trainingReportName} Not Found`, 'warning');
            return;
        }


        // Confirm deletion
        const confirmMessage = `Are you sure you want to delete this ${trainingReportName} assessment?\n\nDate: ${assessmentToDelete.date}\nGrade: ${assessmentToDelete.overallGrade || 'N/A'}\nEvent: ${assessmentToDelete.flightNumber || 'N/A'}\n\nThis action cannot be undone.`;
        
        // Use custom dark confirm modal instead of browser default
        const confirmed = await showDarkConfirm(confirmMessage);
        if (!confirmed) return;

        try {
            
            // Delete from the authoritative trainee performance table first.
            const response = await fetch(`/api/trainee-performance/${encodeURIComponent(assessmentToDelete.eventId)}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });


            if (!response.ok) {
                console.error('❌ Database deletion failed:', response.statusText);
                // Even if database deletion fails, we still want to log the attempt and remove from local state
            }

            // Record deletion in AUDIT before removing from local state
            const auditDetails = `Assessment: ${assessmentToDelete.id || 'Unknown'}, Event: ${assessmentToDelete.eventId || 'Unknown'}, Date: ${assessmentToDelete.date || 'Unknown'}, Grade: ${assessmentToDelete.overallGrade || 'N/A'}, ${reportAssessorLabel}: ${assessmentToDelete.instructorName || assessmentToDelete.instructor || 'Unknown'}`;
            const traineeName = trainee.name || trainee.fullName || 'Trainee not recorded';
            
            logAudit('Performance History', 'Delete', `Deleted ${trainingReportName} assessment for ${traineeName}`, auditDetails);

            // Remove from local state after database deletion and audit logging
            setLocalPt051Events(prev => prev.filter(assessment => assessment.id !== eventId));
            
            // Refresh events from database to ensure consistency
            if (refreshEvents) {
                setTimeout(() => {
                    refreshEvents();
                }, 500);
            }
            
            
        } catch (error) {
            console.error('Error deleting training report:', error);
            await showDarkAlert(`Failed to delete ${trainingReportName}. Please try again.`, `${trainingReportName} Delete Failed`, 'error');
        }
    };
    
    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-white">Performance History</h1>
                    <p className="text-sm text-gray-400">{trainee.rank} {trainee.name || trainee.fullName} - {trainee.course}</p>
                    
                </div>
                   <div className="flex items-center gap-px">
                <button
                    onClick={onBackToRoster}
                    className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed"
                >
                    ← Back
                </button>
                       <AuditButton pageName="Performance History" />
                   </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto relative">
                {/* Transparent freeze overlay */}
                {isFrozen && (
                    <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                )}
                <div className="p-4 md:p-6 max-w-7xl mx-auto">
                    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-700/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Event</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Overall Score</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{reportAssessorLabel}</th>
                                    
                                </tr>
                            </thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-14 text-gray-300">
                                            <div className="flex flex-col items-center justify-center gap-4">
                                                <div className="h-10 w-10 rounded-full border-4 border-sky-500/25 border-t-sky-400 animate-spin" />
                                                <div>
                                                    <div className="text-sm font-semibold text-white">Loading performance history</div>
                                                    <div className="mt-1 text-xs text-gray-400">Retrieving {trainingReportName} and LMP records...</div>
                                                </div>
                                                <div className="h-1.5 w-56 overflow-hidden rounded-full bg-gray-700">
                                                    <div className="h-full w-1/2 rounded-full bg-sky-400 animate-pulse" />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : combinedHistory.length > 0 ? (
                                    combinedHistory.map((item, index) => (
                                        <tr 
                                            key={index}
                                            onClick={() => handleRowClick(item)} 
                                            className="hover:bg-gray-700/50 transition-all duration-200 cursor-pointer"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{item.date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-semibold text-sky-400">
                                                    {/* FIX: Use discriminated union to safely access event/flightNumber. */}
                                                    {item.type === 'LMP Score' ? item.event : item.flightNumber}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`max-w-32 truncate px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.type === 'LMP Score' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'}`}
                                                    title={getTypeDisplayTitle(item.type)}
                                                >
                                                    {getTypeDisplayLabel(item.type)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {getStatusDisplay(item)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {getScoreDisplay(item)}
                                            </td>
                                            {/* FIX: Use discriminated union to safely access instructor/instructorName. */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{item.type === 'LMP Score' ? item.instructor : item.instructorName}</td>
                                            
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} 
                                            className="text-center py-10 text-gray-500"
                                        >
                                            No performance records for this trainee.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HateSheetView;
