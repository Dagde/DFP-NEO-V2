

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Instructor, Trainee, ScheduleEvent, SctRequest, SyllabusItemDetail, Score, RemedialRequest } from '../types';
import UnavailabilitiesWindow from './UnavailabilitiesWindow';
import AuditButton from './AuditButton';
   import { logAudit } from '../utils/auditLogger';

interface PrioritiesViewProps {
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
  programWithPrimaries: boolean;
  onUpdateProgramWithPrimaries: (value: boolean) => void;
  sctFlights: SctRequest[];
  sctFtds: SctRequest[];
  onAddSctRequest: (type: 'flight' | 'ftd') => void;
  onRemoveSctRequest: (id: string, type: 'flight' | 'ftd') => void;
  onUpdateSctRequest: (id: string, field: keyof SctRequest, value: string, type: 'flight' | 'ftd') => void;
  syllabusDetails: SyllabusItemDetail[];
  scores?: Map<string, Score[]>; // Optional because it might not be passed initially but needed for new feature
  traineeLMPs?: Map<string, SyllabusItemDetail[]>; // Optional
  remedialRequests?: RemedialRequest[];
  onToggleRemedialRequest?: (traineeId: number, eventCode: string) => void;
  currencyNames: string[];
  activeSection?: 'course-priority' | 'build-factors' | 'sct-requests' | 'highest-priority' | 'remedial-queue';
}

// FIX: Export component as a named const to fix module import error.
export const PrioritiesView: React.FC<PrioritiesViewProps> = ({ 
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
  programWithPrimaries,
  onUpdateProgramWithPrimaries,
  sctFlights,
  sctFtds,
  onAddSctRequest,
  onRemoveSctRequest,
  onUpdateSctRequest,
  syllabusDetails,
  scores = new Map(),
  traineeLMPs = new Map(),
  remedialRequests = [],
  onToggleRemedialRequest = (_traineeId: number, _eventCode: string) => {},
  currencyNames,
     activeSection = 'course-priority'
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
        return list.sort((a, b) => (a.trainee?.name ?? 'Unknown').localeCompare(b.trainee?.name ?? 'Unknown'));
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
                    </tr>
                    );
                })}
            </tbody>
        </table>
      </div>
  );
  
     return (
       <>
           <div className="section-course-priority grid grid-cols-1 lg:grid-cols-2 gap-6">

            <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 h-fit">
                <div className="p-4 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-200">Course Priority</h2>
                    <span className="text-xs text-gray-500">Last updated: {courseTimestamp}</span>
                </div>
                <div className="p-4 border-t border-gray-700">
                    <ul className="space-y-2">
                        {coursePriorities.map((course, index) => (
                            <li
                                key={course}
                                draggable
                                onDragStart={() => handleCourseDragStart(index)}
                                onDragEnter={() => handleCourseDragEnter(index)}
                                onDragEnd={handleCourseDragEnd}
                                onDragOver={(e) => e.preventDefault()}
                                className="p-3 bg-gray-700/50 rounded-md text-white flex items-center justify-between cursor-grab active:cursor-grabbing"
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
                    <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300">
                        <p className="font-semibold mb-1">ℹ️ Weighted Priority System:</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-200">
                            <li>Percentages are auto-normalized to 100%</li>
                            <li>Minimum percentage per course: 5%</li>
                            <li>Higher % = more events (biased allocation)</li>
                            <li>All courses still get events (no starvation)</li>
                        </ul>
                    </div>
                </div>
            </div>
           </div>

           <div className="section-build-factors">

            <div className="space-y-6">
                <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 h-fit">
                    <div className="p-4 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-200">Build Factors</h2>
                    </div>
                     <div className="p-4 border-t border-gray-700 space-y-4">
                        <div>
                            <label htmlFor="aircraft-count" className="block text-sm font-medium text-gray-400">Available Aircraft</label>
                            <input id="aircraft-count" type="number" value={availableAircraftCount} onChange={(e) => { logAudit("Priorities", "Edit", "Updated available aircraft count", `${availableAircraftCount} → ${parseInt(e.target.value)}`); onUpdateAircraftCount(parseInt(e.target.value)); }} className="w-full mt-1 bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500"/>
                        </div>
                        <div>
                            <label htmlFor="ftd-count" className="block text-sm font-medium text-gray-400">FTD Available</label>
                            <input id="ftd-count" type="number" value={availableFtdCount} onChange={(e) => { logAudit("Priorities", "Edit", "Updated available FTD count", `${availableFtdCount} → ${parseInt(e.target.value)}`); onUpdateFtdCount(parseInt(e.target.value)); }} className="w-full mt-1 bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500"/>
                        </div>
                        <div>
                            <label htmlFor="cpt-count" className="block text-sm font-medium text-gray-400">CPT Available</label>
                            <input id="cpt-count" type="number" value={availableCptCount} onChange={(e) => { logAudit("Priorities", "Edit", "Updated available CPT count", `${availableCptCount} → ${parseInt(e.target.value)}`); onUpdateCptCount(parseInt(e.target.value)); }} className="w-full mt-1 bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400">Day Flying Window</label>
                            <div className="flex items-center space-x-2 mt-1">
                                <select value={flyingStartTime} onChange={(e) => { logAudit("Priorities", "Edit", "Updated flying start time", `${flyingStartTime} → ${parseFloat(e.target.value)}`); onUpdateFlyingStartTime(parseFloat(e.target.value)); }} className="w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 text-center">
                                    {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                                <span className="text-gray-400">to</span>
                                <select value={flyingEndTime} onChange={(e) => { logAudit("Priorities", "Edit", "Updated flying end time", `${flyingEndTime} → ${parseFloat(e.target.value)}`); onUpdateFlyingEndTime(parseFloat(e.target.value)); }} className="w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 text-center">
                                    {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        </div>
                           <div>
                               <label className="block text-sm font-medium text-gray-400">FTD Operating Window</label>
                               <div className="flex items-center space-x-2 mt-1">
                                   <select value={ftdStartTime} onChange={(e) => { logAudit("Priorities", "Edit", "Updated FTD start time", `${ftdStartTime} → ${parseFloat(e.target.value)}`); onUpdateFtdStartTime(parseFloat(e.target.value)); }} className="w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 text-center">
                                       {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                   </select>
                                   <span className="text-gray-400">to</span>
                                   <select value={ftdEndTime} onChange={(e) => { logAudit("Priorities", "Edit", "Updated FTD end time", `${ftdEndTime} → ${parseFloat(e.target.value)}`); onUpdateFtdEndTime(parseFloat(e.target.value)); }} className="w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 text-center">
                                       {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                   </select>
                               </div>
                           </div>
                         <div>
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input type="checkbox" checked={allowNightFlying} onChange={(e) => { logAudit("Priorities", "Edit", "Updated allow night flying", `${allowNightFlying} → ${e.target.checked}`); onUpdateAllowNightFlying(e.target.checked); }} className="h-5 w-5 bg-gray-700 rounded accent-sky-500" />
                                <span className="font-semibold text-sky-400">Allow Night Flying</span>
                            </label>
                        </div>
                         {allowNightFlying && (
                             <div className="pl-8 space-y-2">
                                <label className="block text-sm font-medium text-gray-400">Night Flying Window</label>
                                <div className="flex items-center space-x-2">
                                    <select value={commenceNightFlying} onChange={(e) => { logAudit("Priorities", "Edit", "Updated commence night flying time", `${commenceNightFlying} → ${parseFloat(e.target.value)}`); onUpdateCommenceNightFlying(parseFloat(e.target.value)); }} className="w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 text-center">
                                        {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                    <span className="text-gray-400">to</span>
                                    <select value={ceaseNightFlying} onChange={(e) => { logAudit("Priorities", "Edit", "Updated cease night flying time", `${ceaseNightFlying} → ${parseFloat(e.target.value)}`); onUpdateCeaseNightFlying(parseFloat(e.target.value)); }} className="w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 text-center">
                                        {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                            </div>
                         )}
                         <div>
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input type="checkbox" checked={programWithPrimaries} onChange={(e) => { logAudit("Priorities", "Edit", "Updated program with primaries", `${programWithPrimaries} → ${e.target.checked}`); onUpdateProgramWithPrimaries(e.target.checked); }} className="h-5 w-5 bg-gray-700 rounded accent-sky-500" />
                                <span className="font-semibold text-sky-400">Program with Primaries</span>
                            </label>
                        </div>
                    </div>
                </div>


            </div>
        </div>
                   
        <div className="section-sct-requests bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">SCT Requests</h2>
            <div className="space-y-6">
                <SctRequestTable type="flight" requests={sctFlights} />
                <SctRequestTable type="ftd" requests={sctFtds} />
            </div>
        </div>

        <div className="section-highest-priority bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-sky-400 mb-4">Highest Priority Events</h2>
            <PriorityEventTable events={standardPriorityEvents} />
        </div>

        <div className="section-remedial-queue bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
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
       </>
  );
};
