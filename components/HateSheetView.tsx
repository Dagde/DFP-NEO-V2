import React, { useState, useRef, useCallback } from 'react';
import { Trainee, Score, Pt051Assessment } from '../types';
import AuditButton from './AuditButton';
import { logAudit } from '../utils/auditLogger';
import { showDarkConfirm } from './DarkMessageModal';
import { useSystemFreeze } from '../hooks/useSystemFreeze';

// Define ALL_ELEMENTS to match PT051View
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
    userProfile: any;
    refreshEvents?: () => void;
    onSelectLmpScore: (score: Score) => void;
    onSelectPt051: (assessment: Pt051Assessment) => void;
    onBackToRoster: () => void;
    onInsertPt051: (insertIndex: number, targetDate: string) => void;
    canEditPt051?: boolean;
    onAccessDenied?: (actionLabel: string) => void;
}

const HateSheetView: React.FC<HateSheetViewProps> = ({ trainee, lmpScores, assessments, pt051Events, userProfile, refreshEvents, onSelectLmpScore, onSelectPt051, onBackToRoster, onInsertPt051, canEditPt051 = true, onAccessDenied }) => {
    const { isFrozen } = useSystemFreeze();
    // Drag and drop state - simplified to just highlight target row
    const [isDragging, setIsDragging] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
    const [localPt051Events, setLocalPt051Events] = useState(pt051Events);

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
           // Filter out placeholder/empty PT-051 records - only show records with actual assessment data OR date+instructor
              // NOTE: isCompleted alone is NOT sufficient - historical seed records have isCompleted=true with no actual data
              // Events like mass briefs, CUT, TUT have no grade but DO have date+instructor - these should be shown
              const completedAssessments = assessments.filter(assessment => {
                  const hasGrade = assessment.overallGrade !== null && assessment.overallGrade !== undefined;
                  const hasResult = assessment.overallResult !== null && assessment.overallResult !== undefined;
                  const hasScoredElements = assessment.scores && assessment.scores.length > 0 && assessment.scores.some(s => s.grade !== null);
                  const hasDateAndInstructor = (assessment.date && assessment.date.trim() !== '') && (assessment.instructorName && assessment.instructorName.trim() !== '');
                  return hasGrade || hasResult || hasScoredElements || hasDateAndInstructor;
              });

              // DISPLAY DEDUP: keep one PT-051 row per trainee/event/date. Older
              // builds could create synthetic score/mock PT-051 records when the
              // user clicked a blue LMP score row; those should not surface as a
              // second PT-051 when a real assessment row exists.
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

              // DISPLAY DEDUP: For unassessed PT-051s (no overallResult/DCO/DNCO/DPCO checked),
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
           // Filter out LMP Score placeholder records when a PT-051 row exists for
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
           
           console.log('=== Building combinedHistory ===');
           console.log('LMP Scores:', lmpScores.length, lmpScores);
           console.log('All PT-051 Assessments:', assessments.length, assessments);
           console.log('Completed PT-051 Assessments (filtered):', completedAssessments.length, completedAssessments);
           
           // Combine and sort by date, newest first
           const combined = [...lmpItems, ...pt051Items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
           console.log('Combined History:', combined.length, combined);
           
           return combined;
       }, [lmpScores, assessments]);

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
            console.log('Checking double marginal for:', item.type === 'LMP Score' ? item.event : item.flightNumber, 'ID:', item.id, 'on', item.date);
            
            // Find the index of this item in the combined history (newest first)
            const currentIndex = combinedHistory.findIndex(history => history.id === item.id);
            
            // Check if there was a previous marginal score in the overall timeline
            if (currentIndex >= 0 && currentIndex < combinedHistory.length - 1) {
                const previousItem = combinedHistory[currentIndex + 1]; // Next item in newest-first order
                const prevScore = previousItem.type === 'LMP Score' ? previousItem.score : previousItem.overallGrade;
                console.log('Previous item in timeline:', previousItem.type === 'LMP Score' ? previousItem.event : previousItem.flightNumber, 'score:', prevScore, 'type:', previousItem.type, 'ID:', previousItem.id);
                
                if (prevScore === 1) {
                    isDoubleMarginal = true;
                    console.log('✅ DOUBLE MARGINAL DETECTED for', item.type === 'LMP Score' ? item.event : item.flightNumber, 'ID:', item.id, '- consecutive with previous event');
                }
            } else {
                console.log('No previous item found in timeline for', item.type === 'LMP Score' ? item.event : item.flightNumber);
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

    const handleRowClick = (item: (typeof combinedHistory)[0]) => {
        // Always navigate to PT-051 for all events (including ground events)
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

            // Create a mock PT-051 assessment for the LMP Score
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

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent) => {
        if (!canEditPt051) {
            e.preventDefault();
            onAccessDenied?.('insert PT-051 assessment');
            return;
        }
        console.log('🟢 DRAG STARTED - PT-051 drag initiated');
        console.log('🟢 Drag event details:', e.type, e.currentTarget);
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', 'pt051-new');
        // Force visual feedback
        setTimeout(() => console.log('🟢 isDragging state:', isDragging), 100);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        setHighlightedIndex(null);
    };

    // Instant drag handler - highlight immediately without delay
    const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
        if (!canEditPt051) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        
        // Instant highlighting - no delay!
        setHighlightedIndex(index);
        console.log('⚡ INSTANT HIGHLIGHT - Row:', index);
    }, [canEditPt051]);

    const handleDragLeave = useCallback(() => {
        // Instant clear - no delay!
        setHighlightedIndex(null);
        console.log('⚡ CLEARED HIGHLIGHT');
    }, []);

    const handleDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (!canEditPt051) {
            onAccessDenied?.('insert PT-051 assessment');
            handleDragEnd();
            return;
        }
        
        // Calculate target date based on the highlighted row
        let targetDate = '';
        let insertIndex = index + 1; // Insert after the highlighted row
        
        if (insertIndex === 0) {
            // Insert at the beginning
            targetDate = new Date().toISOString().split('T')[0];
        } else if (insertIndex >= combinedHistory.length) {
            // Insert at the end
            const oldestItem = combinedHistory[combinedHistory.length - 1];
            targetDate = oldestItem ? new Date(new Date(oldestItem.date).getTime() + 86400000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        } else {
            // Insert between items - use the highlighted row's date
            const highlightedItem = combinedHistory[index];
            targetDate = highlightedItem ? highlightedItem.date : new Date().toISOString().split('T')[0];
        }
        
        console.log('🎯 DROPPED PT-051 - Will insert after index:', index, 'on date:', targetDate);
        onInsertPt051(insertIndex, targetDate);
        handleDragEnd();
    };

    const handleDeletePT051 = async (eventId: string) => {
        if (!canEditPt051) {
            onAccessDenied?.('delete PT-051 assessment');
            return;
        }
        console.log('🎯 handleDeletePT051 called with eventId:', eventId);
        
        // Find the assessment to delete
        const assessmentToDelete = localPt051Events.find(assessment => assessment.id === eventId || assessment.eventId === eventId);
        console.log('🔍 Assessment found:', assessmentToDelete ? 'Yes' : 'No', 'Total assessments:', localPt051Events.length);
        console.log("\ud83d\udd0d Looking for eventId:", eventId, "Available IDs:", localPt051Events.map(a => ({ id: a.id, eventId: a.eventId })));
        
        if (!assessmentToDelete) {
            console.log('❌ Assessment not found with ID:', eventId);
            alert('PT-051 assessment not found.');
            return;
        }

        console.log('📋 Assessment details:', {
            id: assessmentToDelete.id,
            date: assessmentToDelete.date,
            grade: assessmentToDelete.overallGrade
        });

        // Confirm deletion
        const confirmMessage = `Are you sure you want to delete this PT-051 assessment?\n\nDate: ${assessmentToDelete.date}\nGrade: ${assessmentToDelete.overallGrade || 'N/A'}\nEvent: ${assessmentToDelete.flightNumber || 'N/A'}\n\nThis action cannot be undone.`;
        
        // Use custom dark confirm modal instead of browser default
        const confirmed = await showDarkConfirm(confirmMessage);
        console.log('🤔 User confirmed deletion:', confirmed);
        if (!confirmed) return;

        try {
            console.log('🗑️ Starting PT-051 deletion process for:', assessmentToDelete.id);
            
            // Delete from database first (using the eventId from the assessment)
            const response = await fetch(`/api/events/${assessmentToDelete.eventId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            console.log('📡 Database deletion response:', response.status);

            if (!response.ok) {
                console.error('❌ Database deletion failed:', response.statusText);
                // Even if database deletion fails, we still want to log the attempt and remove from local state
                console.log('⚠️ Continuing with local deletion despite database error');
            }

            // Record deletion in AUDIT before removing from local state
            console.log('\ud83d\udccb Assessment object structure:', Object.keys(assessmentToDelete), assessmentToDelete);
            const auditDetails = `Assessment: ${assessmentToDelete.id || 'Unknown'}, Event: ${assessmentToDelete.eventId || 'Unknown'}, Date: ${assessmentToDelete.date || 'Unknown'}, Grade: ${assessmentToDelete.overallGrade || 'N/A'}, Instructor: ${assessmentToDelete.instructorName || assessmentToDelete.instructor || 'Unknown'}`;
            const traineeName = trainee.name || trainee.fullName || 'Unknown Trainee';
            console.log('📋 About to log audit entry:', {
                page: 'Performance History',
                action: 'Delete',
                description: `Deleted PT-051 assessment for ${traineeName}`,
                details: auditDetails
            });
            
            logAudit('Performance History', 'Delete', `Deleted PT-051 assessment for ${traineeName}`, auditDetails);
            console.log('✅ PT-051 deletion recorded in audit log');

            // Remove from local state after database deletion and audit logging
            setLocalPt051Events(prev => prev.filter(assessment => assessment.id !== eventId));
            
            // Refresh events from database to ensure consistency
            if (refreshEvents) {
                setTimeout(() => {
                    refreshEvents();
                }, 500);
            }
            
            console.log('PT-051 deleted successfully:', assessmentToDelete.id);
            
        } catch (error) {
            console.error('Error deleting PT-051:', error);
            alert('Failed to delete PT-051. Please try again.');
        }
    };
    
    // Debug state logging
    React.useEffect(() => {
        console.log('🔍 DEBUG STATE - isDragging:', isDragging, 'highlightedIndex:', highlightedIndex);
    }, [isDragging, highlightedIndex]);

    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-white">Performance History</h1>
                    <p className="text-sm text-gray-400">{trainee.rank} {trainee.name || trainee.fullName} - {trainee.course}</p>
                    
                </div>
                   <div className="flex items-center gap-2">
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
                    {/* Draggable PT-051 Button */}
                    <div className="mb-4 flex justify-center">
                        <div
                            draggable={canEditPt051}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            className={`inline-flex items-center px-4 py-2 text-white rounded-md transition-all duration-200 ${canEditPt051 ? 'bg-green-600 cursor-move hover:bg-green-700 hover:shadow-lg' : 'bg-gray-700 cursor-not-allowed opacity-60'} ${isDragging ? 'opacity-50 scale-95' : ''}`}
                            title={canEditPt051 ? 'Drag and drop to insert PT-051 assessment' : 'Your permission profile does not allow PT-051 editing'}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM2 7a2 2 0 012-2h12a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V7z"/>
                            </svg>
                            <span className="font-semibold">+ Insert PT-051</span>
                            <span className="ml-2 text-xs opacity-75">(drag to timeline)</span>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-700/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Event</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Overall Score</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Instructor</th>
                                    
                                </tr>
                            </thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                                {combinedHistory.length > 0 ? (
                                    combinedHistory.map((item, index) => (
                                        <tr 
                                            key={index}
                                            onClick={() => handleRowClick(item)} 
                                            className={`hover:bg-gray-700/50 transition-all duration-200 cursor-pointer ${
                                                highlightedIndex === index 
                                                    ? 'bg-yellow-500/30 border-2 border-yellow-400 shadow-lg shadow-yellow-400/50 animate-pulse' 
                                                    : ''
                                            }`}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, index)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{item.date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-semibold text-sky-400">
                                                    {/* FIX: Use discriminated union to safely access event/flightNumber. */}
                                                    {item.type === 'LMP Score' ? item.event : item.flightNumber}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.type === 'LMP Score' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'}`}>
                                                    {item.type}
                                                </span>
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
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                console.log('🔶 DRAG OVER EMPTY STATE');
                                                setHighlightedIndex(0);
                                            }}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, 0)}
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
