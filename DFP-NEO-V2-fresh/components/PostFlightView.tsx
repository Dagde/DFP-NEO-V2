
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScheduleEvent, Trainee, Instructor } from '../types';
import AuditButton from './AuditButton';
import UnsavedChangesWarning from './UnsavedChangesWarning';
import { addFile } from '../utils/db';
import { debouncedAuditLog, flushPendingAudits } from '../utils/auditDebounce';
import { logAudit } from '../utils/auditLogger';

interface PostFlightViewProps {
  event: ScheduleEvent;
  onReturn: () => void;
  onSave: (data: any) => void;
  school: 'ESL' | 'PEA';
  traineesData: Trainee[];
  instructorsData: Instructor[];
}

// FIX: Changed to a named export to resolve module resolution errors.
export const PostFlightView: React.FC<PostFlightViewProps> = ({ event, onReturn, onSave, school, traineesData, instructorsData }) => {
    // Find trainee or pilot for header
    const person = useMemo(() => {
        const personName = event.student || event.pilot;
        return traineesData.find(t => t.fullName === personName);
    }, [event, traineesData]);

    // State
    const [result, setResult] = useState<'DCO' | 'DPCO' | 'DNCO' | ''>('');
    const [aircraftNumber, setAircraftNumber] = useState('001');
    const [from, setFrom] = useState<string>(school);
    const [to, setTo] = useState<string>(school);
    
    // Flight Mode State
    const [isFlightLog, setIsFlightLog] = useState(event.type === 'flight');
    const [isFtdLog, setIsFtdLog] = useState(event.type === 'ftd');
    const [isSolo, setIsSolo] = useState(event.flightType === 'Solo');
    const [isDual, setIsDual] = useState(event.flightType === 'Dual');

    const [takeoffTime, setTakeoffTime] = useState('');
    const [landTime, setLandTime] = useState('');

    // New state for Durations & Approaches
    const [duty, setDuty] = useState(`${event.origin || school}-${event.destination || school} : ${event.flightNumber}`);
    const [captainTime, setCaptainTime] = useState('');
    const [instructorTime, setInstructorTime] = useState('');
    const [nightTime, setNightTime] = useState('');
    const [ifActualTime, setIfActualTime] = useState('');
    const [ifSimTime, setIfSimTime] = useState('');
    const [ineffectiveTime, setIneffectiveTime] = useState('');
    const [ilsChecked, setIlsChecked] = useState(false);
    const [ilsCount, setIlsCount] = useState(0);
    const [rnpChecked, setRnpChecked] = useState(false);
    const [rnpCount, setRnpCount] = useState(0);
    const [tacanChecked, setTacanChecked] = useState(false);
    const [tacanCount, setTacanCount] = useState(0);
    const [vorChecked, setVorChecked] = useState(false);
    const [vorCount, setVorCount] = useState(0);

    // Dirty check and save status
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
    const initialFormState = useRef<any>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving...' | 'Unsaved'>('Saved');
    const isFirstRender = useRef(true);

    const getFormattedName = (name: string | undefined) => {
        if (!name) return '';
        const cleanName = name.split(' – ')[0];
        
        const instructor = instructorsData.find(i => i.name === cleanName);
        if (instructor) {
            return `${instructor.rank} ${cleanName.split(',')[0]}`;
        }
        
        const trainee = traineesData.find(t => t.name === cleanName || t.fullName === name);
        if (trainee) {
            return `${trainee.rank} ${cleanName.split(',')[0]}`;
        }

        return cleanName.split(',')[0];
    };

     // Derived Total Time
    const totalTime = useMemo(() => {
        const parseTime = (tStr: string) => {
             const clean = tStr.replace(':', '');
             if (clean.length < 4) return null;
             const h = parseInt(clean.substring(0, 2), 10);
             const m = parseInt(clean.substring(2, 4), 10);
             if (isNaN(h) || isNaN(m)) return null;
             return h * 60 + m;
        };

        const startMins = parseTime(takeoffTime);
        const endMins = parseTime(landTime);

        if (startMins === null || endMins === null) {
            return '0.0';
        }

        let durationMinutes = endMins - startMins;

        if (durationMinutes < 0) {
            durationMinutes += 24 * 60; // Add a day if landing is on the next day
        }

        const durationHours = durationMinutes / 60;

        return durationHours.toFixed(1);
    }, [takeoffTime, landTime]);
    
    useEffect(() => {
        // Prefill times
        const takeoff = event.startTime;
        const takeoffH = String(Math.floor(takeoff)).padStart(2, '0');
        const takeoffM = String(Math.round((takeoff % 1) * 60)).padStart(2, '0');
        const initialTakeoff = `${takeoffH}:${takeoffM}`;
        setTakeoffTime(initialTakeoff);
        
        const land = event.landTime || event.startTime + event.duration;
        const landH = String(Math.floor(land)).padStart(2, '0');
        const landM = String(Math.round((land % 1) * 60)).padStart(2, '0');
        const initialLand = `${landH}:${landM}`;
        setLandTime(initialLand);

        // Store the initial state once on mount
        if (!initialFormState.current) {
            initialFormState.current = {
                result: '',
                aircraftNumber: '001',
                from: school,
                to: school,
                isFlightLog: event.type === 'flight',
                isFtdLog: event.type === 'ftd',
                isSolo: event.flightType === 'Solo',
                isDual: event.flightType === 'Dual',
                duty: `${event.origin || school}-${event.destination || school} : ${event.flightNumber}`,
                takeoffTime: initialTakeoff,
                landTime: initialLand,
                captainTime: '',
                instructorTime: '',
                nightTime: '',
                ifActualTime: '',
                ifSimTime: '',
                ineffectiveTime: '',
                ilsChecked: false,
                ilsCount: 0,
                rnpChecked: false,
                rnpCount: 0,
                tacanChecked: false,
                tacanCount: 0,
                vorChecked: false,
                vorCount: 0,
            };
        }
    }, [event, school]);
    
    // Auto-populate Instructor and Captain times based on Dual status
    useEffect(() => {
        if (isDual) {
            setInstructorTime(totalTime);
            setCaptainTime(totalTime);
        }
    }, [isDual, totalTime]);

    // --- LOGBOOK CALCULATION LOGIC ---
    const getLogbookData = (role: 'Captain' | 'Crew') => {
        const total = parseFloat(totalTime) || 0;
        const ifActual = parseFloat(ifActualTime) || 0;
        
        // 2D vs 3D Apps
        const app2D = (rnpChecked ? rnpCount : 0) + (tacanChecked ? tacanCount : 0) + (vorChecked ? vorCount : 0);
        const app3D = (ilsChecked ? ilsCount : 0);

        // Time variables
        let dayP1 = 0;
        let dayDual = 0;
        let nightP1 = 0;
        let nightDual = 0;
        
        let simP1 = 0;
        let simDual = 0;
        let simTotal = 0;
        
        let logCaptTime = '';
        let logInstTime = '';
        
        // Variable for the main "TOTAL" column (Flight Time)
        let flightTotal = 0;

        if (isFlightLog) {
            if (role === 'Crew' && isSolo) {
                // If it's a Solo flight, the "Crew" row should be empty (no time credited)
                flightTotal = 0;
            } else {
                flightTotal = total;
                const night = parseFloat(nightTime) || 0;
                const day = Math.max(0, total - night);
    
                if (role === 'Captain') {
                    // Captain logs P1 in both Solo (Pilot) and Dual (Instructor) scenarios for flights
                    dayP1 = day;
                    nightP1 = night;
                    logCaptTime = captainTime || (isDual ? totalTime : '');
                    if (isDual) {
                        logInstTime = instructorTime || totalTime;
                    }
                } else if (role === 'Crew') {
                    // Crew (Student) logs Dual in Dual scenarios
                    if (isDual) {
                        dayDual = day;
                        nightDual = night;
                    }
                }
            }
        } else if (isFtdLog) {
            if (role === 'Crew' && isSolo) {
                 simTotal = 0;
            } else {
                simTotal = total;
                if (role === 'Captain') {
                    // Instructor: Gets Total in Instructor Box and Simulator Total
                    logInstTime = totalTime;
                } else if (role === 'Crew') {
                    // Student: Gets Simulator Dual and Total
                    simDual = total;
                }
            }
        }
        
        // Parsing Date
        const dateObj = new Date(event.date);
        const yearStr = dateObj.getFullYear().toString().slice(-2);
        const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

        // Personnel Names
        const captainName = (event.instructor || event.pilot)?.split(' – ')[0]?.split(',')[0] || '';
        const crewName = event.student?.split(' – ')[0]?.split(',')[0] || (isSolo ? 'Solo' : '');

        return {
            year: yearStr,
            date: dateStr,
            type: isFtdLog ? 'FTD' : 'PC-21',
            tail: isFtdLog ? `FTD-${aircraftNumber}` : `A54-${aircraftNumber}`,
            captain: captainName,
            crew: crewName,
            duty: duty, 
            dayP1: dayP1 > 0 ? dayP1.toFixed(1) : '',
            dayP2: '',
            dayDual: dayDual > 0 ? dayDual.toFixed(1) : '',
            nightP1: nightP1 > 0 ? nightP1.toFixed(1) : '',
            nightP2: '',
            nightDual: nightDual > 0 ? nightDual.toFixed(1) : '',
            total: flightTotal > 0 ? flightTotal.toFixed(1) : '',
            captTime: logCaptTime,
            instTime: logInstTime,
            simActual: ifActual > 0 ? ifActual.toFixed(1) : '',
            app2D: app2D > 0 ? app2D : '',
            app3D: app3D > 0 ? app3D : '',
            simP1: simP1 > 0 ? simP1.toFixed(1) : '',
            simP2: '',
            simDual: simDual > 0 ? simDual.toFixed(1) : '',
            simTotal: simTotal > 0 ? simTotal.toFixed(1) : '',
        };
    };


    // Determine if any data has changed
    useEffect(() => {
        if (!initialFormState.current) return;

        const currentState = {
            result, aircraftNumber, from, to, isFlightLog, isFtdLog, isSolo, isDual, duty, takeoffTime, landTime, captainTime, instructorTime, nightTime, ifActualTime, ifSimTime, ineffectiveTime, ilsChecked, ilsCount: ilsChecked ? ilsCount : 0, rnpChecked, rnpCount: rnpChecked ? rnpCount : 0, tacanChecked, tacanCount: tacanChecked ? tacanCount : 0, vorChecked, vorCount: vorChecked ? vorCount : 0,
        };
        const initialStateForCompare = {
            ...initialFormState.current,
            ilsCount: initialFormState.current.ilsChecked ? initialFormState.current.ilsCount : 0,
            rnpCount: initialFormState.current.rnpChecked ? initialFormState.current.rnpCount : 0,
            tacanCount: initialFormState.current.tacanChecked ? initialFormState.current.tacanCount : 0,
            vorCount: initialFormState.current.vorChecked ? initialFormState.current.vorCount : 0,
        };

        if (JSON.stringify(currentState) !== JSON.stringify(initialStateForCompare)) {
            setIsDirty(true);
            setSaveStatus('Saving...');
        }
    }, [result, aircraftNumber, from, to, isFlightLog, isFtdLog, isSolo, isDual, duty, takeoffTime, landTime, captainTime, instructorTime, nightTime, ifActualTime, ifSimTime, ineffectiveTime, ilsChecked, ilsCount, rnpChecked, rnpCount, tacanChecked, tacanCount, vorChecked, vorCount]);

    const aircraftNumberOptions = useMemo(() => Array.from({ length: 49 }, (_, i) => String(i + 1).padStart(3, '0')), []);

    // Debounced field change handler for result
    const handleResultChange = (newResult: 'DCO' | 'DPCO' | 'DNCO' | '') => {
        const oldResult = result;
        setResult(newResult);
        if (oldResult && newResult && oldResult !== newResult) {
            debouncedAuditLog(
                `postflight-${event.id}-result`,
                'Edit',
                `Updated post-flight result for ${event.flightNumber}`,
                `Result: ${oldResult} → ${newResult}`,
                'Post-Flight'
            );
        }
    };

    const handleSave = async (isAutoSave = false) => {
        const saveData = {
            result,
            aircraftNumber,
            from,
            to,
            isFlightLog,
            isFtdLog,
            isSolo,
            isDual,
            duty,
            takeoffTime,
            landTime,
            totalTime,
            captainTime,
            instructorTime,
            nightTime,
            ifActualTime,
            ifSimTime,
            ineffectiveTime,
            approaches: {
                ils: ilsChecked ? ilsCount : 0,
                rnp: rnpChecked ? rnpCount : 0,
                tacan: tacanChecked ? tacanCount : 0,
                vor: vorChecked ? vorCount : 0,
            }
        };
        
        // Flush any pending debounced logs before saving
        if (!isAutoSave) {
            flushPendingAudits();
            
            // Log the save action
            const changes: string[] = [];
            changes.push(`Result: ${result}`);
            if (takeoffTime) changes.push(`Takeoff: ${takeoffTime}`);
            if (landTime) changes.push(`Land: ${landTime}`);
            if (totalTime) changes.push(`Total Time: ${totalTime}`);
            
            logAudit({
                action: 'Edit',
                description: `Saved post-flight data for ${event.flightNumber}`,
                changes: changes.join(', '),
                page: 'Post-Flight'
            });
        }
        
        // 1. Notify parent (updates app state)
        // Only notify parent if NOT auto-saving, because parent closes the view.
        if (!isAutoSave) {
            onSave(saveData);
        }
        
        // 2. Persist to Data Storage (Auto-Save to File)
        // Determine the "User File" location. 
        // Priority: Student (for dual/solo trainee events), then Instructor.
        let targetFolderId = 'trainee_logbook';
        let userName = event.student;
        
        if (!userName || userName === 'Multiple') {
             if (event.pilot) {
                 userName = event.pilot; // Solo trainee or pilot
             } else if (event.instructor) {
                 userName = event.instructor; // Instructor only event
                 targetFolderId = 'staff_logbook';
             }
        }
        
        if (userName) {
            const cleanName = userName.split(' – ')[0].replace(/,\s/g, '_');
            // Deterministic filename to overwrite the same entry during edits
            const fileName = `Entry_${event.date}_${event.flightNumber.replace(/\s/g, '')}_${cleanName}.json`;
            
            try {
                const fileContent = JSON.stringify(saveData, null, 2);
                const file = new File([fileContent], fileName, { type: "application/json" });
                await addFile(file, targetFolderId, fileName);
            } catch (error) {
                console.error("Failed to auto-save post-flight data to file:", error);
            }
        }

        if (!isAutoSave) {
            setIsDirty(false);
            setSaveStatus('Saved');
        }
    };
    
    // Auto-save effect
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        
        if (isDirty) {
            const timer = setTimeout(() => {
                handleSave(true);
                setSaveStatus('Saved');
                setIsDirty(false); // Reset dirty after auto-save
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isDirty, result, aircraftNumber, from, to, isFlightLog, isFtdLog, isSolo, isDual, duty, takeoffTime, landTime, captainTime, instructorTime, nightTime, ifActualTime, ifSimTime, ineffectiveTime, ilsChecked, ilsCount, rnpChecked, rnpCount, tacanChecked, tacanCount, vorChecked, vorCount]);

    const handleAttemptReturn = () => {
        if (isDirty) {
            setShowUnsavedWarning(true);
        } else {
            onReturn();
        }
    };
    
    const handleManualSave = () => {
        handleSave(false);
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
        let val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length > 4) val = val.substring(0, 4);
        
        if (val.length > 2) {
            val = val.slice(0, 2) + ':' + val.slice(2);
        }
        setter(val);
    };
    
    const handleFlightLogChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setIsFlightLog(true);
            setIsFtdLog(false);
        }
    };

    const handleFtdLogChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setIsFtdLog(true);
            setIsFlightLog(false);
        }
    };

    const handleSoloChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setIsSolo(checked);
        setIsDual(!checked);
    };

    const handleDualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setIsDual(checked);
        setIsSolo(!checked);
    };

    const ResultRadio: React.FC<{ value: string }> = ({ value }) => (
        <label className="flex items-center space-x-2 cursor-pointer">
            <input
                type="radio"
                name="result"
                value={value}
                checked={result === value}
                onChange={(e) => handleResultChange(e.target.value as any)}
                className="h-4 w-4 accent-sky-500 bg-gray-600 border-gray-500"
            />
            <span className="text-white">{value}</span>
        </label>
    );

    const ApproachInput: React.FC<{
        label: string, 
        isChecked: boolean, 
        setIsChecked: (val: boolean) => void, 
        count: number, 
        setCount: (val: number) => void
    }> = ({ label, isChecked, setIsChecked, count, setCount }) => (
        <div className="flex-shrink-0 flex items-end space-x-1">
            <label className="flex items-center space-x-1 pb-2 cursor-pointer h-[38px]">
                <span className="text-sm font-medium text-gray-400 w-10 text-right">{label}</span>
                <input 
                    type="checkbox" 
                    checked={isChecked} 
                    onChange={e => {
                        const checked = e.target.checked;
                        setIsChecked(checked);
                        if (checked && count === 0) {
                            setCount(1);
                        }
                    }} 
                    className="h-4 w-4 accent-sky-500 bg-gray-600 rounded border-gray-500"
                />
            </label>
            <div className="flex flex-col items-center">
                <label className="text-xs font-medium text-gray-400 mb-1">Number</label>
                <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={count === 0 ? '' : count}
                    onChange={e => setCount(parseInt(e.target.value, 10) || 0)}
                    disabled={!isChecked}
                    className="block w-10 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-1 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                />
            </div>
        </div>
    );

    // Reusable Cell for Logbook Row
    const LogbookCell: React.FC<{ label?: string, subLabel?: string, value: string, width: string, bgColor?: string, borderColor?: string, customTextClass?: string }> = ({ label, subLabel, value, width, bgColor = "bg-gray-800", borderColor = "border-gray-600", customTextClass = "text-xs" }) => (
        <div className={`flex flex-col items-center justify-end ${width} flex-shrink-0 border-r ${borderColor} last:border-r-0`}>
             {(label || subLabel) && (
                 <div className="w-full text-center border-b border-gray-700 bg-gray-900/30 py-0.5">
                    {label && <div className="text-[9px] font-bold text-gray-400 uppercase leading-tight">{label}</div>}
                    {subLabel && <div className="text-[8px] text-gray-500 leading-tight">{subLabel}</div>}
                 </div>
             )}
            <div className={`w-full ${bgColor} text-white ${customTextClass} font-mono py-1.5 text-center truncate px-0.5 h-7`}>
                {value}
            </div>
        </div>
    );

    // Reusable Logbook Strip Component
    const LogbookStrip: React.FC<{ title: string, data: any }> = ({ title, data }) => (
        <div className="mt-2">
            <h4 className="text-sm font-bold text-sky-400 mb-1 ml-1">{title}</h4>
            <div className="overflow-x-auto">
                <div className="flex flex-nowrap bg-gray-900 border border-gray-600 rounded-md min-w-max">
                    {/* Identity */}
                    <LogbookCell label="Year" value={data.year} width="w-10" />
                    <LogbookCell label="Date" value={data.date} width="w-14" />
                    <LogbookCell label="Type" value={data.type} width="w-12" />
                    <LogbookCell label="Tail" subLabel="(Mark)" value={data.tail} width="w-16" />
                    <LogbookCell label="Captain" value={data.captain} width="w-24" />
                    <LogbookCell label="Co-Pilot /" subLabel="Crew" value={data.crew} width="w-24" />
                    <LogbookCell label="Duty" value={data.duty} width="w-24" customTextClass="text-[8px]" />
                    
                    {/* Day Flying */}
                    <div className="flex flex-col border-r border-gray-600">
                        <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30">Day Flying</div>
                        <div className="flex">
                            <LogbookCell subLabel="P1" value={data.dayP1} width="w-10" borderColor="border-gray-700" />
                            <LogbookCell subLabel="P2" value={data.dayP2} width="w-10" borderColor="border-gray-700" />
                            <LogbookCell subLabel="Dual" value={data.dayDual} width="w-10" borderColor="border-transparent" />
                        </div>
                    </div>

                    {/* Night Flying */}
                    <div className="flex flex-col border-r border-gray-600">
                        <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30">Night Flying</div>
                        <div className="flex">
                            <LogbookCell subLabel="P1" value={data.nightP1} width="w-10" borderColor="border-gray-700" />
                            <LogbookCell subLabel="P2" value={data.nightP2} width="w-10" borderColor="border-gray-700" />
                            <LogbookCell subLabel="Dual" value={data.nightDual} width="w-10" borderColor="border-transparent" />
                        </div>
                    </div>

                    {/* Totals */}
                    <LogbookCell label="TOTAL" value={data.total} width="w-12" bgColor="bg-gray-700/50" />
                    <LogbookCell label="Captain" value={data.captTime} width="w-12" />
                    <LogbookCell label="Instructor" value={data.instTime} width="w-12" />
                    
                    {/* Instrument */}
                    <LogbookCell label="Sim" value="" width="w-10" /> {/* Not populated in flight view */}
                    <LogbookCell label="Actual" value={data.simActual} width="w-10" />
                    <LogbookCell label="2D App" value={String(data.app2D)} width="w-10" />
                    <LogbookCell label="3D App" value={String(data.app3D)} width="w-10" />

                    {/* Simulator */}
                    <div className="flex flex-col">
                        <div className="text-[9px] font-bold text-gray-400 uppercase text-center border-b border-gray-700 bg-gray-900/30">Simulator</div>
                        <div className="flex">
                            <LogbookCell subLabel="P1" value={data.simP1} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
                            <LogbookCell subLabel="P2" value={data.simP2} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
                            <LogbookCell subLabel="Dual" value={data.simDual} width="w-10" borderColor="border-gray-700" bgColor="bg-gray-800/50" />
                            <LogbookCell subLabel="TOTAL" value={data.simTotal} width="w-10" borderColor="border-transparent" bgColor="bg-gray-800/50" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col bg-gray-900 h-full">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
                <div className="flex items-center gap-4 w-1/3">
                    <span className="font-bold text-white text-lg">{event.flightNumber}</span>
                    <div className="flex items-center px-3 py-1 rounded-full bg-gray-900/50 border border-gray-700">
                        <div className={`w-2 h-2 rounded-full mr-2 ${saveStatus === 'Saved' ? 'bg-green-500' : saveStatus === 'Saving...' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="text-xs text-gray-300 font-mono uppercase">{saveStatus === 'Saved' ? 'Saved' : saveStatus}</span>
                    </div>
                </div>
                <h2 className="text-xl font-bold text-sky-400 text-center w-1/3">POST FLIGHT TIMES</h2>
                <span className="font-mono text-gray-300 text-lg w-1/3 text-right">{event.date}</span>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
                {/* Top Section */}
                <div className="flex items-start gap-6">
                    {/* Result (Top Left) */}
                    <div className="bg-gray-700/50 p-4 rounded-lg">
                        <label className="block text-sm font-medium text-gray-400 mb-2">Result</label>
                        <div className="flex flex-col space-y-3">
                            <ResultRadio value="DCO" />
                            <ResultRadio value="DPCO" />
                            <ResultRadio value="DNCO" />
                        </div>
                    </div>
                </div>

                {/* Main "Times" Window */}
                <fieldset className="p-4 border border-gray-600 rounded-lg">
                    <legend className="px-2 text-lg font-semibold text-gray-300">Times</legend>
                    
                    {/* Row 1: Flight, FTD, Solo, Dual, Date, AC, Number, Duty, Captain, Crew */}
                    <div className="mt-2 flex items-end space-x-4">
                        
                        {/* Flight Checkbox */}
                        <div className="flex-shrink-0 flex flex-col items-center">
                            <label className="block text-sm font-medium text-gray-400">Flight</label>
                            <div className="mt-1 h-[38px] flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={isFlightLog}
                                    onChange={handleFlightLogChange}
                                    className="h-5 w-5 bg-gray-700 border-gray-600 rounded focus:ring-sky-500 focus:ring-offset-gray-800 accent-sky-500"
                                />
                            </div>
                        </div>

                        {/* FTD Checkbox */}
                        <div className="flex-shrink-0 flex flex-col items-center">
                            <label className="block text-sm font-medium text-gray-400">FTD</label>
                            <div className="mt-1 h-[38px] flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={isFtdLog}
                                    onChange={handleFtdLogChange}
                                    className="h-5 w-5 bg-gray-700 border-gray-600 rounded focus:ring-sky-500 focus:ring-offset-gray-800 accent-sky-500"
                                />
                            </div>
                        </div>

                        {/* Solo Checkbox */}
                        <div className="flex-shrink-0 flex flex-col items-center">
                            <label className="block text-sm font-medium text-gray-400">Solo</label>
                            <div className="mt-1 h-[38px] flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={isSolo}
                                    onChange={handleSoloChange}
                                    className="h-5 w-5 bg-gray-700 border-gray-600 rounded focus:ring-sky-500 focus:ring-offset-gray-800 accent-sky-500"
                                />
                            </div>
                        </div>

                        {/* Dual Checkbox */}
                        <div className="flex-shrink-0 flex flex-col items-center">
                            <label className="block text-sm font-medium text-gray-400">Dual</label>
                            <div className="mt-1 h-[38px] flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={isDual}
                                    onChange={handleDualChange}
                                    className="h-5 w-5 bg-gray-700 border-gray-600 rounded focus:ring-sky-500 focus:ring-offset-gray-800 accent-sky-500"
                                />
                            </div>
                        </div>

                        {/* Date */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Date</label>
                            <div className="mt-1 p-2 bg-gray-700 rounded-md text-white h-[38px] flex items-center">{event.date}</div>
                        </div>
                        {/* Aircraft */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Aircraft</label>
                            <div className="mt-1 p-2 bg-gray-700 rounded-md text-white h-[38px] flex items-center">PC-21</div>
                        </div>
                         {/* Number */}
                        <div className="flex-shrink-0" style={{width: '6.75rem'}}>
                            <label className="block text-sm font-medium text-gray-400">Number</label>
                            <div className="flex items-center space-x-1 mt-1">
                                <span className="p-2 bg-gray-700 rounded-l-md text-white h-[38px] flex items-center">A54-</span>
                                <select value={aircraftNumber} onChange={e => setAircraftNumber(e.target.value)} className="block w-full bg-gray-700 border border-gray-600 rounded-r-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm appearance-none text-center">
                                    {aircraftNumberOptions.map(num => <option key={num} value={num}>{num}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        {/* Duty (New) */}
                        <div className="flex-shrink-0" style={{width: '12rem'}}>
                            <label className="block text-sm font-medium text-gray-400">Duty</label>
                            <input
                                type="text"
                                value={duty}
                                onChange={e => setDuty(e.target.value)}
                                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white text-xs focus:outline-none focus:ring-sky-500"
                            />
                        </div>

                        {/* Captain/Instructor */}
                        <div className="flex-1 min-w-0" style={{flexBasis: '8rem'}}>
                            <label className="block text-sm font-medium text-gray-400">Captain/Instructor</label>
                            <div className="mt-1 p-2 bg-gray-700 rounded-md text-white h-[38px] flex items-center truncate">{(event.instructor || event.pilot)?.split(' – ')[0]}</div>
                        </div>
                        {/* Crew */}
                        <div className="flex-1 min-w-0" style={{flexBasis: '6rem'}}>
                            <label className="block text-sm font-medium text-gray-400">Crew/Trainee</label>
                            <div className="mt-1 p-2 bg-gray-700 rounded-md text-white h-[38px] flex items-center truncate">
                                {isSolo ? 'Solo' : event.student?.split(' – ')[0]}
                            </div>
                        </div>
                    </div>
                    
                    {/* Row 2: Route, Takeoff, Land, Total, Night, IF Actual, IF Sim, Ineffective, Approaches */}
                    <div className="mt-4 flex items-end space-x-4 overflow-x-auto pb-2">
                        {/* Route */}
                         <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400 text-center">Route</label>
                            <div className="flex items-center space-x-2 mt-1">
                                <input type="text" value={from} onChange={e => setFrom(e.target.value.toUpperCase())} maxLength={3} placeholder="From" className="w-16 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-2 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center"/>
                                <input type="text" value={to} onChange={e => setTo(e.target.value.toUpperCase())} maxLength={3} placeholder="To" className="w-16 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center"/>
                            </div>
                         </div>
                        {/* Takeoff Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Takeoff</label>
                            <input
                                type="text"
                                value={takeoffTime}
                                onChange={e => handleTimeChange(e, setTakeoffTime)}
                                placeholder="HH:MM"
                                className="mt-1 block w-24 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                        {/* Land Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Land</label>
                            <input
                                type="text"
                                value={landTime}
                                onChange={e => handleTimeChange(e, setLandTime)}
                                placeholder="HH:MM"
                                className="mt-1 block w-24 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                        {/* Total Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Total</label>
                            <div className="mt-1 p-2 bg-gray-900/50 border border-gray-500 rounded-md text-white h-[38px] flex items-center justify-center font-mono w-20">{totalTime}</div>
                        </div>
                         {/* Captain Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Captain</label>
                            <input
                                type="text"
                                value={captainTime}
                                onChange={e => setCaptainTime(e.target.value)}
                                placeholder="0.0"
                                className="mt-1 block w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                         {/* Instructor Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Instructor</label>
                            <input
                                type="text"
                                value={instructorTime}
                                onChange={e => setInstructorTime(e.target.value)}
                                placeholder="0.0"
                                className="mt-1 block w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                         {/* Night Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Night</label>
                            <input
                                type="text"
                                value={nightTime}
                                onChange={e => setNightTime(e.target.value)}
                                placeholder="0.0"
                                className="mt-1 block w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                        {/* IF Actual Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">IF Actual</label>
                            <input
                                type="text"
                                value={ifActualTime}
                                onChange={e => setIfActualTime(e.target.value)}
                                placeholder="0.0"
                                className="mt-1 block w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                        {/* IF Sim Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">IF Sim</label>
                            <input
                                type="text"
                                value={ifSimTime}
                                onChange={e => setIfSimTime(e.target.value)}
                                placeholder="0.0"
                                className="mt-1 block w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>
                        {/* Ineffective Time */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-400">Ineffective</label>
                            <input
                                type="text"
                                value={ineffectiveTime}
                                onChange={e => setIneffectiveTime(e.target.value)}
                                placeholder="0.0"
                                className="mt-1 block w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center font-mono"
                            />
                        </div>

                         {/* Approaches */}
                        <ApproachInput label="ILS/GLS" isChecked={ilsChecked} setIsChecked={setIlsChecked} count={ilsCount} setCount={setIlsCount} />
                        <ApproachInput label="RNP" isChecked={rnpChecked} setIsChecked={setRnpChecked} count={rnpCount} setCount={setRnpCount} />
                        <ApproachInput label="TACAN" isChecked={tacanChecked} setIsChecked={setTacanChecked} count={tacanCount} setCount={setTacanCount} />
                        <ApproachInput label="VOR/DME" isChecked={vorChecked} setIsChecked={setVorChecked} count={vorCount} setCount={setVorCount} />
                    </div>
                </fieldset>

                {/* Logbook Strips */}
                <LogbookStrip title={`Captain's Log (${getFormattedName(event.instructor || event.pilot)})`} data={getLogbookData('Captain')} />
                {!isSolo && <LogbookStrip title={`Crew's Log (${getFormattedName(event.student)})`} data={getLogbookData('Crew')} />}

              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                <button onClick={handleManualSave} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold">Save & Return</button>
                <button onClick={handleAttemptReturn} className="px-4 py-2 bg-transparent border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors text-sm">Return</button>
                   <AuditButton pageName="Post-Flight" />
            </div>
            {showUnsavedWarning && (
                <UnsavedChangesWarning 
                    onSaveAndExit={() => { setShowUnsavedWarning(false); handleManualSave(); onReturn(); }}
                    onExitWithoutSaving={() => { setShowUnsavedWarning(false); onReturn(); }}
                    onCancel={() => setShowUnsavedWarning(false)}
                />
            )}
        </div>
    );
};
