

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Instructor, Trainee, ScheduleEvent, SctRequest, SyllabusItemDetail, Score, RemedialRequest } from '../types';
import UnavailabilitiesWindow from './UnavailabilitiesWindow';
import AuditButton from './AuditButton';
import { logAudit } from '../utils/auditLogger';
import { InstructorPriorityConfig, InstructorPriorityGroups } from '../App';

interface PrioritiesViewProps {
  school?: 'ESL' | 'PEA';
  coursePriorities: string[];
  onUpdatePriorities: (newOrder: string[]) => void;
  coursePercentages: Map<string, number>;
  onUpdatePercentages: (newPercentages: Map<string, number>) => void;
  availableAircraftCount: number;
  onUpdateAircraftCount: (count: number) => void;
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
  instructorsData: Instructor[];
  traineesData: Trainee[];
  buildDfpDate: string;
  highestPriorityEvents: ScheduleEvent[];
  onSelectEvent: (event: ScheduleEvent) => void;
  onUpdatePriorityEvent: (eventId: string, updates: Partial<ScheduleEvent>) => void;
  onDeletePriorityEvent: (eventId: string) => void;
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
  scores?: Map<string, Score[]>; // Optional because it might not be passed initially but needed for new feature
  traineeLMPs?: Map<string, SyllabusItemDetail[]>; // Optional
  remedialRequests?: RemedialRequest[];
  onToggleRemedialRequest?: (traineeId: number, eventCode: string) => void;
  currencyNames: string[];
  activeSection?: 'build-timeline' | 'people-rules' | 'course-demand' | 'directed-events';
}

// FIX: Export component as a named const to fix module import error.
export const PrioritiesView: React.FC<PrioritiesViewProps> = ({ 
  school = 'ESL',
  coursePriorities, 
  onUpdatePriorities, 
  coursePercentages, 
  onUpdatePercentages,
  availableAircraftCount,
  onUpdateAircraftCount,
  availableFtdCount,
  onUpdateFtdCount,
  availableCptCount,
  onUpdateCptCount,
  flyingStartTime,
  onUpdateFlyingStartTime,
  flyingEndTime,
  onUpdateFlyingEndTime,
  ftdStartTime,
  onUpdateFtdStartTime,
  ftdEndTime,
  onUpdateFtdEndTime,
  allowNightFlying,
  onUpdateAllowNightFlying,
  commenceNightFlying,
  onUpdateCommenceNightFlying,
  ceaseNightFlying,
  onUpdateCeaseNightFlying,
  instructorsData,
  traineesData,
  buildDfpDate,
  highestPriorityEvents,
  onSelectEvent,
  onUpdatePriorityEvent,
  onDeletePriorityEvent,
  instructorPriority,
  onUpdateInstructorPriority,
  sctFlights,
  sctFtds,
  onAddSctRequest,
  onRemoveSctRequest,
  onUpdateSctRequest,
  onSubmitSctRequest,
  onToggleSctInclude,
  syllabusDetails,
  scores = new Map(),
  traineeLMPs = new Map(),
  remedialRequests = [],
  onToggleRemedialRequest = (_traineeId: number, _eventCode: string) => {},
  currencyNames,
}) => {
  // State for Course Priorities
  const courseDragItem = useRef<number | null>(null);
  const courseDragOverItem = useRef<number | null>(null);
  const [courseTimestamp, setCourseTimestamp] = useState(new Date().toLocaleString());

  // SCT Request Constants
  const sctEvents = ['SCT GF', 'SCT IF', 'SCT NAV', 'SCT FORM'];
  const instructorNames = useMemo(() => instructorsData.map(i => i.name).sort(), [instructorsData]);


  // State for Build Factors
  const [aircraftTimestamp, setAircraftTimestamp] = useState(new Date().toLocaleString());
  const [flyingWindowTimestamp, setFlyingWindowTimestamp] = useState(new Date().toLocaleString());
  const [dutyPeriodTimestamp, setDutyPeriodTimestamp] = useState(new Date().toLocaleString());
  const [turnaroundTimestamp, setTurnaroundTimestamp] = useState(new Date().toLocaleString());


  useEffect(() => {
    setCourseTimestamp(new Date().toLocaleString());
  }, [coursePriorities, coursePercentages]);

  useEffect(() => {
    setAircraftTimestamp(new Date().toLocaleString());
  }, [availableAircraftCount]);

  useEffect(() => {
    setFlyingWindowTimestamp(new Date().toLocaleString());
  }, [flyingStartTime, flyingEndTime, commenceNightFlying, ceaseNightFlying, allowNightFlying]);

  

  const totalPercentage = useMemo(() => {
    return Array.from(coursePercentages.values()).reduce((sum: number, p: number) => sum + p, 0);
  }, [coursePercentages]);

  const timeOptions = useMemo(() => {
    const options = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) { // 15 min increments
            const totalHours = h + m / 60;
            const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            options.push({ label, value: totalHours });
        }
    }
    return options;
  }, []);

  // --- Course Priority Handlers ---
  const handleCourseDragStart = (index: number) => { courseDragItem.current = index; };
  const handleCourseDragEnter = (index: number) => { courseDragOverItem.current = index; };
  const handleCourseDragEnd = () => {
    if (courseDragItem.current !== null && courseDragOverItem.current !== null) {
      const newPriorities = [...coursePriorities];
      const draggedItemContent = newPriorities.splice(courseDragItem.current, 1)[0];
      newPriorities.splice(courseDragOverItem.current, 0, draggedItemContent);
      onUpdatePriorities(newPriorities);
         
         // Log the change
         logAudit('Priorities', 'Edit', 'Updated course priority order', 
           `Moved ${draggedItemContent} from position ${courseDragItem.current + 1} to position ${courseDragOverItem.current + 1}`);
    }
    courseDragItem.current = null;
    courseDragOverItem.current = null;
  };

  const handlePercentageChange = (courseToChange: string, direction: 'increase' | 'decrease') => {
    const newPercentages = new Map<string, number>(coursePercentages);
    const currentPercent = newPercentages.get(courseToChange) ?? 0;
    const changeAmount = 5;
    
    // Calculate new percentage with 5% minimum enforcement
    let newPercent = direction === 'increase' 
      ? Math.min(100, currentPercent + changeAmount) 
      : Math.max(5, currentPercent - changeAmount); // Enforce 5% minimum
    
    newPercentages.set(courseToChange, newPercent);
       
    // Log the change
    logAudit('Priorities', 'Edit', `Updated course percentage for ${courseToChange}`, `${currentPercent}% → ${newPercent}%`);
    onUpdatePercentages(newPercentages);
  };
  
  const ArrowButton: React.FC<{ direction: 'up' | 'down', onClick: () => void, disabled?: boolean }> = ({ direction, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-0.5 text-gray-400 rounded-sm hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
      aria-label={direction === 'up' ? 'Increase percentage' : 'Decrease percentage'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
        {direction === 'up' ? <path fillRule="evenodd" d="M10 5l-5.5 5.5h11L10 5z" clipRule="evenodd" /> : <path fillRule="evenodd" d="M10 15l5.5-5.5h-11L10 15z" clipRule="evenodd" />}
      </svg>
    </button>
  );
  
  const formatTime = (time: number): string => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  
  
  const SctRequestTable: React.FC<{ type: 'flight' | 'ftd', requests: SctRequest[] }> = ({ type, requests }) => {
      
    const calculateDaysToExpire = (expireDateStr: string): { days: number; color: string } | null => {
        if (!expireDateStr) return null;
        try {
            const expiry = new Date(expireDateStr + 'T00:00:00Z');
            const build = new Date(buildDfpDate + 'T00:00:00Z');
            if (isNaN(expiry.getTime()) || isNaN(build.getTime())) return null;

            const diffTime = expiry.getTime() - build.getTime();
            const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let color = 'text-green-400';
            if (days <= 30) color = 'text-red-400';
            else if (days <= 60) color = 'text-amber-400';
            
            return { days, color };
        } catch (e) {
            return null;
        }
    };

    const formatDate = (dateString: string | undefined): string => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString + 'T00:00:00Z');
            if (isNaN(date.getTime())) return '-';
            const day = String(date.getUTCDate()).padStart(2, '0');
            const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
            const year = String(date.getUTCFullYear()).slice(-2);
            return `${day}${month}${year}`;
        } catch (e) {
            return '-';
        }
    };
    
    // Generate time options at 5-minute intervals from 06:00 to 23:55
    const timeOptions = React.useMemo(() => {
        const times: string[] = [];
        for (let hour = 6; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += 5) {
                const h = String(hour).padStart(2, '0');
                const m = String(minute).padStart(2, '0');
                times.push(`${h}:${m}`);
            }
        }
        return times;
    }, []);
      
      return (
      <div>
          <h3 className="text-lg font-semibold text-sky-400 mb-2">{type === 'flight' ? 'Flights' : 'FTD'}</h3>
          <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                  <thead className="text-xs text-gray-400 uppercase">
                      <tr>
                          <th className="py-2 px-2 text-left">Name</th>
                          <th className="py-2 px-2 text-left">Event</th>
                          <th className="py-2 px-2 text-left">Solo/Dual</th>
                          <th className="py-2 px-2 text-left">Currency</th>
                          <th className="py-2 px-2 text-left">Currency Expire</th>
                          <th className="py-2 px-2 text-left">Date Req.</th>
                          <th className="py-2 px-2 text-left">Days to Expire</th>
                          <th className="py-2 px-2 text-left">Requested Time</th>
                          <th className="py-2 px-2 text-left">Priority</th>
                          <th className="py-2 px-2 text-left">Status</th>
                          <th className="py-2 px-1 text-right"></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                      {requests.map(req => {
                          const expiryInfo = calculateDaysToExpire(req.currencyExpire);
                          return (
                          <tr key={req.id}>
                              <td className="py-1 px-2 w-48">
                                  <select value={req.name} onChange={e => onUpdateSctRequest(req.id, 'name', e.target.value, type)} className="w-full bg-gray-700 border-gray-600 rounded py-1 px-2 text-white focus:ring-sky-500 text-xs">
                                      <option value="">Select Instructor</option>
                                      {instructorNames.map(name => <option key={name} value={name}>{name}</option>)}
                                  </select>
                              </td>
                              <td className="py-1 px-2 w-40">
                                  <select value={req.event} onChange={e => onUpdateSctRequest(req.id, 'event', e.target.value, type)} className="w-full bg-gray-700 border-gray-600 rounded py-1 px-2 text-white focus:ring-sky-500 text-xs">
                                      {sctEvents.map(e => <option key={e} value={e}>{e}</option>)}
                                  </select>
                              </td>
                              <td className="py-1 px-2 w-32">
                                  <select value={req.flightType} onChange={e => onUpdateSctRequest(req.id, 'flightType', e.target.value, type)} className="w-full bg-gray-700 border-gray-600 rounded py-1 px-2 text-white focus:ring-sky-500 text-xs">
                                      <option value="Solo">Solo</option>
                                      <option value="Dual">Dual</option>
                                  </select>
                              </td>
                               <td className="py-1 px-2 w-48">
                                  <select value={req.currency} onChange={e => onUpdateSctRequest(req.id, 'currency', e.target.value, type)} className="w-full bg-gray-700 border-gray-600 rounded py-1 px-2 text-white focus:ring-sky-500 text-xs">
                                      <option value="">Select Currency</option>
                                      {currencyNames.map(name => <option key={name} value={name}>{name}</option>)}
                                  </select>
                              </td>
                               <td className="py-1 px-2 w-40">
                                  <input type="date" value={req.currencyExpire} onChange={e => onUpdateSctRequest(req.id, 'currencyExpire', e.target.value, type)} style={{colorScheme: 'dark'}} className="w-full bg-gray-700 border-gray-600 rounded py-1 px-2 text-white focus:ring-sky-500 text-xs" />
                              </td>
                              <td className="py-1 px-2 w-24 text-gray-300 font-mono">
                                {formatDate(req.dateRequested)}
                              </td>
                              <td className="py-1 px-2 w-32 text-center">
                                {expiryInfo ? <span className={`font-bold ${expiryInfo.color}`}>{expiryInfo.days}</span> : <span className="text-gray-500">-</span>}
                              </td>
                              <td className="py-1 px-2 w-32">
                                  <select value={req.requestedTime || '15:00'} onChange={e => onUpdateSctRequest(req.id, 'requestedTime', e.target.value, type)} className="w-full bg-gray-700 border-gray-600 rounded py-1 px-2 text-white focus:ring-sky-500 text-xs">
                                      {timeOptions.map(time => <option key={time} value={time}>{time}</option>)}
                                  </select>
                              </td>
                               <td className="py-1 px-2 w-32">
                                  <select value={req.priority} onChange={e => onUpdateSctRequest(req.id, 'priority', e.target.value, type)} className="w-full bg-gray-700 border-gray-600 rounded py-1 px-2 text-white focus:ring-sky-500 text-xs">
                                      <option value="High">High</option>
                                      <option value="Medium">Medium</option>
                                      <option value="Low">Low</option>
                                  </select>
                              </td>
                              <td className="py-1 px-2 w-24">
                                  {req.submitted ? (
                                      <span className="text-green-400 text-xs font-semibold">Submitted</span>
                                  ) : (
                                      <button 
                                          onClick={() => {
                                              if (req.name && req.currency) {
                                                  onSubmitSctRequest(req.id, type);
                                              }
                                          }}
                                          disabled={!req.name || !req.currency}
                                          className={`px-2 py-1 text-xs rounded font-semibold ${
                                              req.name && req.currency 
                                                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                                                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                          }`}
                                      >
                                          Submit
                                      </button>
                                  )}
                              </td>
                              <td className="py-1 px-1 text-right">
                                  <button onClick={() => onRemoveSctRequest(req.id, type)} className="p-1 text-gray-400 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg></button>
                              </td>
                          </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
          <button onClick={() => onAddSctRequest(type)} className="mt-2 px-3 py-1 bg-sky-600 text-white rounded hover:bg-sky-700 text-xs font-semibold">+ Add Request</button>
      </div>
  )};

  const isRemedialEvent = (event: ScheduleEvent) => {
      const item = syllabusDetails.find(s => s.code === event.flightNumber);
      return item?.isRemedial || event.flightNumber.includes('REM') || event.flightNumber.endsWith('RF') || event.isRemedial;
  };

  // CRITICAL FIX: Don't filter out force-scheduled remedial events
  // They should appear in Highest Priority Events list just like SCT events
  // Only filter out remedial events that are NOT in the highestPriorityEvents list
  const standardPriorityEvents = highestPriorityEvents;
  
  // Calculate incomplete remedials for display
  const incompleteRemedials = useMemo(() => {
        const list: { trainee: Trainee, item: SyllabusItemDetail }[] = [];
        traineesData.forEach(t => {
            if(t.isPaused) return;
            // Use individual LMP or fallback to master
            const lmp = traineeLMPs.get(t.fullName) || syllabusDetails;
            const tScores = scores.get(t.fullName) || [];
            const completedIds = new Set(tScores.map(s => s.event));

            lmp.forEach(item => {
                // Check if it's a remedial item (flag or naming convention) AND not completed
                if ((item.isRemedial || item.code.includes('REM') || item.code.endsWith('RF')) && !completedIds.has(item.id)) {
                    list.push({ trainee: t, item });
                }
            });
        });
        return list.sort((a, b) => a.trainee.name.localeCompare(b.trainee.name));
    }, [traineesData, traineeLMPs, scores, syllabusDetails]);


  const PriorityEventTable: React.FC<{ events: ScheduleEvent[] }> = ({ events }) => (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
            <thead className="text-xs text-gray-400 uppercase">
                <tr>
                    <th className="py-2 px-2 text-left">Name</th>
                    <th className="py-2 px-2 text-left">Event</th>
                    <th className="py-2 px-2 text-left">Solo/Dual</th>
                    <th className="py-2 px-2 text-left">Currency</th>
                    <th className="py-2 px-2 text-left">Priority</th>
                    <th className="py-2 px-2 text-left">Action</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
                {events.map(event => {
                    const personName = event.instructor || event.pilot || event.student || 'N/A';
                    return (
                    <tr key={event.id} onClick={() => onSelectEvent(event)} className="hover:bg-sky-900/50 transition-colors cursor-pointer">
                        <td className="py-2 px-2 text-gray-300">{personName}</td>
                        <td className="py-2 px-2 text-gray-300 font-semibold">{event.flightNumber}</td>
                        <td className="py-2 px-2 text-gray-300">{event.soloOrDual || event.flightType || 'N/A'}</td>
                        <td className="py-2 px-2 text-gray-300">{event.currency || 'N/A'}</td>
                        <td className="py-2 px-2 text-gray-300 bg-yellow-100 text-gray-800 font-semibold">High</td>
                        <td className="py-2 px-2">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeletePriorityEvent(event.id); }} 
                                className="p-1 text-gray-400 hover:text-red-400"
                                title="Delete event"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </td>
                    </tr>
                    );
                })}
            </tbody>
        </table>
      </div>
  );
  
     return (
       <>
           <div className="section-course-demand space-y-6">
            <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Third Input</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Course Demand</h2>
                <p className="mt-1 text-sm text-slate-300">Set the relative course weighting after time windows, resources and people rules are known.</p>
            </div>

            <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg h-fit">
                <div className="border-b border-cyan-500/20 bg-cyan-500/10 p-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-200">Course Priority</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {school === 'ESL' ? 'East Sale (ESL)' : 'Pearce (PEA)'} &mdash; locality courses only
                        </p>
                    </div>
                    <span className="text-xs text-gray-500">Last updated: {courseTimestamp}</span>
                </div>
                <div className="p-4 border-t border-gray-700">
                    {coursePriorities.length === 0 ? (
                        <div className="py-8 text-center text-gray-500">
                            <p className="text-sm font-medium">No courses found for {school === 'ESL' ? 'East Sale' : 'Pearce'}</p>
                            <p className="text-xs mt-1">Courses will appear here once trainees are loaded for this locality.</p>
                        </div>
                    ) : (
                        <>
                            <ul className="space-y-2">
                                {coursePriorities.map((course, index) => (
                                    <li
                                        key={course}
                                        draggable
                                        onDragStart={() => handleCourseDragStart(index)}
                                        onDragEnter={() => handleCourseDragEnter(index)}
                                        onDragEnd={handleCourseDragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                        className="p-3 bg-slate-950/70 border border-slate-700 rounded-md text-white flex items-center justify-between cursor-grab active:cursor-grabbing"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <span className="font-mono text-gray-500">{index + 1}</span>
                                            <span className="font-semibold">{course}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className={`font-mono w-12 text-center ${totalPercentage !== 100 && 'text-red-400'}`}>{coursePercentages.get(course) ?? 0}%</span>
                                            <div className="flex flex-col">
                                                <ArrowButton direction="up" onClick={() => handlePercentageChange(course, 'increase')} disabled={(coursePercentages.get(course) ?? 0) >= 100} />
                                                <ArrowButton direction="down" onClick={() => handlePercentageChange(course, 'decrease')} disabled={(coursePercentages.get(course) ?? 0) <= 5} />
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <div className={`mt-3 p-2 rounded text-center text-sm font-semibold ${totalPercentage === 100 ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                Total: {totalPercentage}%
                            </div>
                            <div data-priority-help="true" className="mt-2 p-2 bg-cyan-500/10 border border-cyan-500/30 rounded text-xs text-cyan-300">
                                <p className="font-semibold mb-1">&#x2139;&#xFE0F; Weighted Priority System:</p>
                                <ul className="list-disc list-inside space-y-1 text-cyan-200">
                                    <li>Percentages are auto-normalized to 100%</li>
                                    <li>Minimum percentage per course: 5%</li>
                                    <li>Higher % = more events (biased allocation)</li>
                                    <li>All courses still get events (no starvation)</li>
                                </ul>
                            </div>
                        </>
                    )}
                </div>
            </div>
           </div>

           <div className="section-build-timeline space-y-6">
                <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg">
                    <div className="border-b border-cyan-500/20 bg-cyan-500/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Time Input</p>
                        <h2 className="mt-1 text-xl font-semibold text-white">Flying Windows</h2>
                        <p className="mt-1 text-sm text-slate-300">Set the time boundaries that govern where flight, FTD and night events may be placed.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <label className="block text-sm font-medium text-slate-300">Day Flying Window</label>
                            <div className="mt-2 flex items-center space-x-2">
                                <select value={flyingStartTime} onChange={(e) => { logAudit("Priorities", "Edit", "Updated flying start time", `${flyingStartTime} \u2192 ${parseFloat(e.target.value)}`); onUpdateFlyingStartTime(parseFloat(e.target.value)); }} className="w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-center text-white focus:outline-none focus:ring-cyan-500">
                                    {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                                <span className="shrink-0 text-slate-400">to</span>
                                <select value={flyingEndTime} onChange={(e) => { logAudit("Priorities", "Edit", "Updated flying end time", `${flyingEndTime} \u2192 ${parseFloat(e.target.value)}`); onUpdateFlyingEndTime(parseFloat(e.target.value)); }} className="w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-center text-white focus:outline-none focus:ring-cyan-500">
                                    {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <label className="block text-sm font-medium text-slate-300">FTD Operating Window</label>
                            <div className="mt-2 flex items-center space-x-2">
                                <select value={ftdStartTime} onChange={(e) => { logAudit("Priorities", "Edit", "Updated FTD start time", `${ftdStartTime} \u2192 ${parseFloat(e.target.value)}`); onUpdateFtdStartTime(parseFloat(e.target.value)); }} className="w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-center text-white focus:outline-none focus:ring-cyan-500">
                                    {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                                <span className="shrink-0 text-slate-400">to</span>
                                <select value={ftdEndTime} onChange={(e) => { logAudit("Priorities", "Edit", "Updated FTD end time", `${ftdEndTime} \u2192 ${parseFloat(e.target.value)}`); onUpdateFtdEndTime(parseFloat(e.target.value)); }} className="w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-center text-white focus:outline-none focus:ring-cyan-500">
                                    {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <label className="mb-3 flex cursor-pointer items-center space-x-2">
                                <input type="checkbox" checked={allowNightFlying} onChange={(e) => { logAudit("Priorities", "Edit", "Updated allow night flying", `${allowNightFlying} \u2192 ${e.target.checked}`); onUpdateAllowNightFlying(e.target.checked); }} className="h-4 w-4 shrink-0 rounded bg-slate-800 accent-cyan-500" />
                                <span className="text-sm font-semibold text-cyan-300">Allow Night Flying</span>
                            </label>
                            <div className={`transition-opacity duration-150 ${allowNightFlying ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                <label className="block text-sm font-medium text-slate-300">Night Flying Window</label>
                                <div className="mt-2 flex items-center space-x-2">
                                    <select value={commenceNightFlying} disabled={!allowNightFlying} onChange={(e) => { logAudit("Priorities", "Edit", "Updated commence night flying time", `${commenceNightFlying} \u2192 ${parseFloat(e.target.value)}`); onUpdateCommenceNightFlying(parseFloat(e.target.value)); }} className="w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-center text-white focus:outline-none focus:ring-cyan-500 disabled:cursor-not-allowed">
                                        {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                    <span className="shrink-0 text-slate-400">to</span>
                                    <select value={ceaseNightFlying} disabled={!allowNightFlying} onChange={(e) => { logAudit("Priorities", "Edit", "Updated cease night flying time", `${ceaseNightFlying} \u2192 ${parseFloat(e.target.value)}`); onUpdateCeaseNightFlying(parseFloat(e.target.value)); }} className="w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-center text-white focus:outline-none focus:ring-cyan-500 disabled:cursor-not-allowed">
                                        {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg">
                    <div className="border-b border-cyan-500/20 bg-cyan-500/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Capacity Input</p>
                        <h2 className="mt-1 text-xl font-semibold text-white">Resource Capacity</h2>
                        <p className="mt-1 text-sm text-slate-300">Declare the physical capacity available for this build before weighting the course demand.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <label htmlFor="aircraft-count" className="block text-sm font-medium text-slate-300">Available Aircraft</label>
                            <input id="aircraft-count" type="number" value={availableAircraftCount} onChange={(e) => { logAudit("Priorities", "Edit", "Updated available aircraft count", `${availableAircraftCount} \u2192 ${parseInt(e.target.value)}`); onUpdateAircraftCount(parseInt(e.target.value)); }} className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-white focus:outline-none focus:ring-cyan-500"/>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <label htmlFor="ftd-count" className="block text-sm font-medium text-slate-300">FTD Available</label>
                            <input id="ftd-count" type="number" value={availableFtdCount} onChange={(e) => { logAudit("Priorities", "Edit", "Updated available FTD count", `${availableFtdCount} \u2192 ${parseInt(e.target.value)}`); onUpdateFtdCount(parseInt(e.target.value)); }} className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-white focus:outline-none focus:ring-cyan-500"/>
                        </div>
                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                            <label htmlFor="cpt-count" className="block text-sm font-medium text-slate-300">CPT Available</label>
                            <input id="cpt-count" type="number" value={availableCptCount} onChange={(e) => { logAudit("Priorities", "Edit", "Updated available CPT count", `${availableCptCount} \u2192 ${parseInt(e.target.value)}`); onUpdateCptCount(parseInt(e.target.value)); }} className="mt-2 w-full rounded-md border border-slate-600 bg-slate-950 py-2 px-3 text-white focus:outline-none focus:ring-cyan-500"/>
                        </div>
                    </div>
                </div>
           </div>

           <div className="section-people-rules space-y-6">
                <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg">
                    <div className="border-b border-cyan-500/20 bg-cyan-500/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Second Input</p>
                        <h2 className="mt-1 text-xl font-semibold text-white">Instructor Allocation Rules</h2>
                        <p className="mt-1 text-sm text-slate-300">Set how strongly the build should prefer or require assigned instructor groups for flight and FTD events.</p>
                    </div>
                    <div className="p-4 space-y-5">

                        {/* Master switch */}
                        <div>
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <div
                                    onClick={() => {
                                        const next = { ...instructorPriority, enabled: !instructorPriority.enabled };
                                        logAudit("Priorities", "Edit", "Instructor Priority Mode toggled", `${instructorPriority.enabled} → ${next.enabled}`);
                                        onUpdateInstructorPriority(next);
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${instructorPriority.enabled ? 'bg-sky-500' : 'bg-gray-600'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${instructorPriority.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </div>
                                <span className="font-semibold text-sky-400">Priority Mode</span>
                            </label>
                            <p className="text-xs text-gray-400 mt-1 ml-14">
                                When on, the scheduler prioritises selected instructor groups for flight and FTD events.
                            </p>
                        </div>

                        {instructorPriority.enabled && (
                            <div className="space-y-5 pl-2">

                                {/* Hard / Soft toggle */}
                                <div>
                                    <p className="text-sm font-medium text-gray-300 mb-2">Mode</p>
                                    <div className="flex items-center space-x-2 bg-gray-700 rounded-lg p-1 w-fit">
                                        {(['soft', 'hard'] as const).map((m) => (
                                            <button
                                                key={m}
                                                onClick={() => {
                                                    const next = { ...instructorPriority, mode: m };
                                                    logAudit("Priorities", "Edit", "Instructor Priority mode changed", `${instructorPriority.mode} → ${m}`);
                                                    onUpdateInstructorPriority(next);
                                                }}
                                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                                    instructorPriority.mode === m
                                                        ? m === 'hard' ? 'bg-red-600 text-white shadow' : 'bg-sky-600 text-white shadow'
                                                        : 'text-gray-400 hover:text-white'
                                                }`}
                                            >
                                                {m === 'soft' ? 'Soft' : 'Hard'}
                                            </button>
                                        ))}
                                    </div>
                                    {instructorPriority.mode === 'soft' && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            <span className="text-sky-400 font-medium">Soft:</span> The scheduler will prefer instructors from selected groups but will use any available instructor if none are free.
                                        </p>
                                    )}
                                    {instructorPriority.mode === 'hard' && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            <span className="text-red-400 font-medium">Hard:</span> Flight and FTD events will only be placed if an instructor from the required groups is available. If none are free, the event is placed on STBY with no instructor. CPT and Ground are unaffected.
                                        </p>
                                    )}
                                </div>

                                {/* Soft mode group selection */}
                                {instructorPriority.mode === 'soft' && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-300 mb-2">Preferred Groups
                                            <span className="text-xs text-gray-400 font-normal ml-2">(select one or more)</span>
                                        </p>
                                        <div className="space-y-2">
                                            {([ 
                                                { key: 'primary',    label: 'Primary Instructor',         desc: "Trainee's assigned primary instructor" },
                                                { key: 'secondary',  label: 'Secondary Instructor',       desc: "Trainee's assigned secondary instructor" },
                                                { key: 'sameFlight', label: 'Same Flight Instructor',     desc: 'Instructor from the exact same flight (e.g. CFS/A)' },
                                            ] as { key: keyof InstructorPriorityGroups; label: string; desc: string }[]).map(({ key, label, desc }) => (
                                                <label key={key} className="flex items-start space-x-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={instructorPriority.softGroups[key]}
                                                        onChange={(e) => {
                                                            const next: InstructorPriorityConfig = {
                                                                ...instructorPriority,
                                                                softGroups: { ...instructorPriority.softGroups, [key]: e.target.checked }
                                                            };
                                                            logAudit("Priorities", "Edit", `Soft group ${key} changed`, `${instructorPriority.softGroups[key]} → ${e.target.checked}`);
                                                            onUpdateInstructorPriority(next);
                                                        }}
                                                        className="mt-0.5 h-4 w-4 bg-gray-700 rounded accent-sky-500"
                                                    />
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-200 group-hover:text-white">{label}</span>
                                                        <p className="text-xs text-gray-400">{desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Hard mode group selection */}
                                {instructorPriority.mode === 'hard' && (
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-300 mb-1">Required Groups
                                                <span className="text-xs text-gray-400 font-normal ml-2">(flight/FTD will go to STBY if none available)</span>
                                            </p>
                                            <p className="text-xs text-gray-400 mb-2">
                                                Select which instructor groups must be available for a flight or FTD to be placed on the schedule. If none from the selected groups are free, the event is placed on STBY with no instructor assigned.
                                            </p>
                                            <div className="space-y-2 bg-gray-750 rounded-lg border border-red-900/40 p-3">
                                                {([
                                                    { key: 'primary',    label: 'Primary Instructor',     desc: "Trainee's assigned primary instructor" },
                                                    { key: 'secondary',  label: 'Secondary Instructor',   desc: "Trainee's assigned secondary instructor" },
                                                    { key: 'sameFlight', label: 'Same Flight Instructor', desc: 'Instructor from the exact same flight (e.g. CFS/A)' },
                                                ] as { key: keyof InstructorPriorityGroups; label: string; desc: string }[]).map(({ key, label, desc }) => (
                                                    <label key={key} className="flex items-start space-x-3 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            checked={instructorPriority.hardGroups[key]}
                                                            onChange={(e) => {
                                                                const next: InstructorPriorityConfig = {
                                                                    ...instructorPriority,
                                                                    hardGroups: { ...instructorPriority.hardGroups, [key]: e.target.checked }
                                                                };
                                                                logAudit("Priorities", "Edit", `Hard group ${key} changed`, `${instructorPriority.hardGroups[key]} → ${e.target.checked}`);
                                                                onUpdateInstructorPriority(next);
                                                            }}
                                                            className="mt-0.5 h-4 w-4 bg-gray-700 rounded accent-red-500"
                                                        />
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-200 group-hover:text-white">{label}</span>
                                                            <p className="text-xs text-gray-400">{desc}</p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-xs text-amber-400/80 bg-amber-900/20 border border-amber-800/40 rounded-lg p-3">
                                            <span className="font-semibold">Note:</span> CPT and Ground school events are not affected by Hard Priority — they will be scheduled with any available instructor as normal.
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>
                   
        <div className="section-directed-events space-y-6">
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Fourth Input</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Directed Events</h2>
            <p className="mt-1 text-sm text-slate-300">Review hard requests and build exceptions after the normal course weighting is set.</p>
        </div>

        <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg p-6">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">SCT Requests</h2>
            <div className="space-y-6">
                <SctRequestTable type="flight" requests={sctFlights} />
                <SctRequestTable type="ftd" requests={sctFtds} />
            </div>
        </div>

        <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg p-6">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">Highest Priority Events</h2>
            <PriorityEventTable events={standardPriorityEvents} />
        </div>

        {/* MEDIUM/LOW Priority SCT Events - User can manually include in build */}
        <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg p-6">
            <h2 className="text-xl font-semibold text-amber-400 mb-2">Optional SCT Events</h2>
            <p className="text-xs text-gray-400 mb-4">MEDIUM and LOW priority SCT events can be manually included in the NEO Build. Check the "Include" box to add to the build.</p>
            {sctFlights.filter(r => r.priority !== 'High').length === 0 && sctFtds.filter(r => r.priority !== 'High').length === 0 && (
              <p className="text-gray-500 text-sm italic">No MEDIUM or LOW priority SCT events. Add SCT requests with MEDIUM or LOW priority in the SCT Requests tab above.</p>
            )}

              {/* SCT Flights - MEDIUM/LOW */}
              {sctFlights.filter(r => r.priority !== 'High').length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-sky-300 mb-2">SCT Flights</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="text-xs text-gray-400 uppercase">
                            <tr>
                                <th className="py-2 px-2 text-left">Name</th>
                                <th className="py-2 px-2 text-left">Event</th>
                                <th className="py-2 px-2 text-left">Type</th>
                                <th className="py-2 px-2 text-left">Currency</th>
                                <th className="py-2 px-2 text-left">Priority</th>
                                <th className="py-2 px-2 text-center">Include in Build</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {sctFlights.filter(r => r.priority !== 'High').map(req => (
                                <tr key={req.id} className="hover:bg-sky-900/50">
                                    <td className="py-2 px-2 text-gray-300">{req.name}</td>
                                    <td className="py-2 px-2 text-amber-300 font-semibold">{req.event}</td>
                                    <td className="py-2 px-2 text-gray-300">{req.flightType}</td>
                                    <td className="py-2 px-2 text-gray-300">{req.currency || 'N/A'}</td>
                                    <td className={`py-2 px-2 font-semibold ${req.priority === 'Medium' ? 'text-orange-400' : 'text-green-400'}`}>{req.priority}</td>
                                    <td className="py-2 px-2 text-center">
                                        <input
                                            type="checkbox"
                                            checked={req.includeInBuild || false}
                                            onChange={() => onToggleSctInclude(req.id, 'flight')}
                                            className="h-4 w-4 bg-gray-700 rounded accent-sky-500"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SCT FTDs - MEDIUM/LOW */}
              {sctFtds.filter(r => r.priority !== 'High').length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-sky-300 mb-2">SCT FTDs</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="text-xs text-gray-400 uppercase">
                            <tr>
                                <th className="py-2 px-2 text-left">Name</th>
                                <th className="py-2 px-2 text-left">Event</th>
                                <th className="py-2 px-2 text-left">Type</th>
                                <th className="py-2 px-2 text-left">Currency</th>
                                <th className="py-2 px-2 text-left">Priority</th>
                                <th className="py-2 px-2 text-center">Include in Build</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {sctFtds.filter(r => r.priority !== 'High').map(req => (
                                <tr key={req.id} className="hover:bg-sky-900/50">
                                    <td className="py-2 px-2 text-gray-300">{req.name}</td>
                                    <td className="py-2 px-2 text-amber-300 font-semibold">{req.event}</td>
                                    <td className="py-2 px-2 text-gray-300">{req.flightType}</td>
                                    <td className="py-2 px-2 text-gray-300">{req.currency || 'N/A'}</td>
                                    <td className={`py-2 px-2 font-semibold ${req.priority === 'Medium' ? 'text-orange-400' : 'text-green-400'}`}>{req.priority}</td>
                                    <td className="py-2 px-2 text-center">
                                        <input
                                            type="checkbox"
                                            checked={req.includeInBuild || false}
                                            onChange={() => onToggleSctInclude(req.id, 'ftd')}
                                            className="h-4 w-4 bg-gray-700 rounded accent-sky-500"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                </div>
              )}
          </div>

        <div className="rounded-lg border border-cyan-500/25 bg-slate-900 shadow-lg p-6">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">Remedial Priority Queue</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                  <thead className="text-xs text-gray-400 uppercase">
                      <tr>
                          <th className="py-2 px-2 text-left">Trainee</th>
                          <th className="py-2 px-2 text-left">Course</th>
                          <th className="py-2 px-2 text-left">Event</th>
                          <th className="py-2 px-2 text-left">Staff</th>
                          <th className="py-2 px-2 text-center">Force Schedule</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                     {incompleteRemedials.map(({ trainee, item }) => {
                        const existingRequest = remedialRequests.find(r => r.traineeId === trainee.idNumber && r.eventCode === item.code);
                        const forceSchedule = existingRequest?.forceSchedule || false;
                        // Get allocated staff from the remedial package (resourcesHuman field)
                        const allocatedStaff = item.resourcesHuman && item.resourcesHuman.length > 0 
                            ? item.resourcesHuman[0] 
                            : "Not Assigned";
                        return (
                          <tr key={`${trainee.idNumber}-${item.code}`} className="hover:bg-sky-900/50">
                              <td className="py-2 px-2 font-semibold text-white">{trainee.name}</td>
                              <td className="py-2 px-2 text-gray-300">{trainee.course}</td>
                              <td className="py-2 px-2 text-amber-300 font-mono">{item.code}</td>
                              <td className="py-2 px-2 text-gray-300">
                                  {allocatedStaff}
                              </td>
                              <td className="py-2 px-2 text-center">
                                 <input
                                      type="checkbox"
                                      checked={forceSchedule}
                                      onChange={() => onToggleRemedialRequest(trainee.idNumber, item.code)}
                                      className="h-4 w-4 bg-gray-700 rounded accent-sky-500"
                                  />
                              </td>
                          </tr>
                        );
                     })}
                  </tbody>
              </table>
            </div>
        </div>
        </div>
       </>
  );
};
