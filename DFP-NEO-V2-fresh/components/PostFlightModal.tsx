
import React, { useState, useEffect, useMemo } from 'react';
import { ScheduleEvent, Trainee } from '../types';

interface PostFlightModalProps {
  event: ScheduleEvent;
  onClose: () => void;
  onSave: (data: any) => void;
  school: 'ESL' | 'PEA';
  traineesData: Trainee[];
}

const PostFlightModal: React.FC<PostFlightModalProps> = ({ event, onClose, onSave, school, traineesData }) => {
    // Find trainee or pilot for header
    const person = useMemo(() => {
        const personName = event.student || event.pilot;
        return traineesData.find(t => t.fullName === personName);
    }, [event, traineesData]);

    // State
    const [result, setResult] = useState<'DCO' | 'DPCO' | 'DNCO' | ''>('');
    const [aircraftNumber, setAircraftNumber] = useState('001');
    // FIX: Explicitly type 'from' and 'to' as string to allow any airport code.
    const [from, setFrom] = useState<string>(school);
    const [to, setTo] = useState<string>(school);

    const [takeoffHour, setTakeoffHour] = useState('08');
    const [takeoffMinute, setTakeoffMinute] = useState('00');
    const [landHour, setLandHour] = useState('09');
    const [landMinute, setLandMinute] = useState('30');
    
    useEffect(() => {
        // Prefill times
        const takeoff = event.startTime;
        const takeoffH = Math.floor(takeoff);
        const takeoffM = Math.round((takeoff % 1) * 60);
        setTakeoffHour(String(takeoffH).padStart(2, '0'));
        setTakeoffMinute(String(takeoffM).padStart(2, '0'));
        
        const land = event.landTime || event.startTime + event.duration;
        const landH = Math.floor(land);
        const landM = Math.round((land % 1) * 60);
        setLandHour(String(landH).padStart(2, '0'));
        setLandMinute(String(landM).padStart(2, '0'));

    }, [event]);

    // Dropdown options
    const aircraftNumberOptions = useMemo(() => Array.from({ length: 49 }, (_, i) => String(i + 1).padStart(3, '0')), []);
    const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), []);
    const minuteOptions = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')), []);

    const handleSave = () => {
        const saveData = {
            result,
            aircraftNumber,
            from,
            to,
            takeoffTime: `${takeoffHour}:${takeoffMinute}`,
            landTime: `${landHour}:${landMinute}`
        };
        onSave(saveData);
        onClose();
    };
    
    const ResultRadio: React.FC<{ value: string }> = ({ value }) => (
        <label className="flex items-center space-x-2 cursor-pointer">
            <input
                type="radio"
                name="result"
                value={value}
                checked={result === value}
                onChange={(e) => setResult(e.target.value as any)}
                className="h-4 w-4 accent-sky-500 bg-gray-600 border-gray-500"
            />
            <span className="text-white">{value}</span>
        </label>
    );

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl border border-gray-700 transform transition-all animate-fade-in" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <span className="font-bold text-white text-lg">{event.flightNumber}</span>
                    <h2 className="text-xl font-bold text-sky-400 text-center">{person?.rank} {person?.name}</h2>
                    <span className="font-mono text-gray-300 text-lg">{event.date}</span>
                </div>

                <div className="p-6 space-y-6">
                    {/* Top Section */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Aircraft/FTD Number (Top Left) */}
                        <div className="bg-gray-700/50 p-4 rounded-lg">
                            <label className="block text-sm font-medium text-gray-400 mb-2">Aircraft Number</label>
                            <div className="flex items-center space-x-2">
                                <span className="text-white font-semibold">A54-</span>
                                <select value={aircraftNumber} onChange={e => setAircraftNumber(e.target.value)} className="block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm">
                                    {aircraftNumberOptions.map(num => <option key={num} value={num}>{num}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Result (Top Right) */}
                        <div className="bg-gray-700/50 p-4 rounded-lg">
                            <label className="block text-sm font-medium text-gray-400 mb-2">Result</label>
                            <div className="flex items-center space-x-6">
                                <ResultRadio value="DCO" />
                                <ResultRadio value="DPCO" />
                                <ResultRadio value="DNCO" />
                            </div>
                        </div>
                    </div>

                    {/* Main "Times" Window */}
                    <fieldset className="p-4 border border-gray-600 rounded-lg">
                        <legend className="px-2 text-lg font-semibold text-gray-300">Times</legend>
                        <div className="mt-2 flex items-end space-x-4">
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
                             {/* Number - duplicate of top left as requested */}
                            <div className="flex-shrink-0">
                                <label className="block text-sm font-medium text-gray-400">Number</label>
                                <div className="flex items-center space-x-1 mt-1">
                                    <span className="p-2 bg-gray-700 rounded-l-md text-white h-[38px] flex items-center">A54-</span>
                                    <select value={aircraftNumber} onChange={e => setAircraftNumber(e.target.value)} className="block w-24 bg-gray-700 border border-gray-600 rounded-r-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm">
                                        {aircraftNumberOptions.map(num => <option key={num} value={num}>{num}</option>)}
                                    </select>
                                </div>
                            </div>
                            {/* Captain */}
                            <div className="flex-1 min-w-0">
                                <label className="block text-sm font-medium text-gray-400">Captain</label>
                                <div className="mt-1 p-2 bg-gray-700 rounded-md text-white h-[38px] flex items-center truncate">{event.instructor || event.pilot}</div>
                            </div>
                            {/* Crew */}
                            <div className="flex-1 min-w-0">
                                <label className="block text-sm font-medium text-gray-400">Crew</label>
                                <div className="mt-1 p-2 bg-gray-700 rounded-md text-white h-[38px] flex items-center truncate">{event.student}</div>
                            </div>
                            {/* Route */}
                             <div>
                                <label className="block text-sm font-medium text-gray-400 text-center">Route</label>
                                <div className="flex items-center space-x-2 mt-1">
                                    <input type="text" value={from} onChange={e => setFrom(e.target.value.toUpperCase())} maxLength={3} placeholder="From" className="w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center"/>
                                    <input type="text" value={to} onChange={e => setTo(e.target.value.toUpperCase())} maxLength={3} placeholder="To" className="w-20 bg-gray-700 border border-gray-600 rounded-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm text-center"/>
                                </div>
                             </div>
                            {/* Takeoff Time */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400">Takeoff</label>
                                <div className="flex items-center space-x-1 mt-1">
                                    <select value={takeoffHour} onChange={e => setTakeoffHour(e.target.value)} className="block w-20 bg-gray-700 border border-gray-600 rounded-l-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm">{hourOptions.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                    <select value={takeoffMinute} onChange={e => setTakeoffMinute(e.target.value)} className="block w-20 bg-gray-700 border border-gray-600 rounded-r-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm">{minuteOptions.map(m => <option key={m} value={m}>{m}</option>)}</select>
                                </div>
                            </div>
                            {/* Land Time */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400">Land</label>
                                <div className="flex items-center space-x-1 mt-1">
                                    <select value={landHour} onChange={e => setLandHour(e.target.value)} className="block w-20 bg-gray-700 border border-gray-600 rounded-l-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm">{hourOptions.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                    <select value={landMinute} onChange={e => setLandMinute(e.target.value)} className="block w-20 bg-gray-700 border border-gray-600 rounded-r-md h-[38px] py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm">{minuteOptions.map(m => <option key={m} value={m}>{m}</option>)}</select>
                                </div>
                            </div>
                        </div>
                    </fieldset>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
                    <button onClick={handleSave} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold">Save</button>
                    <button onClick={onClose} className="px-4 py-2 bg-transparent border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors text-sm">Close</button>
                </div>
            </div>
        </div>
    );
};

export default PostFlightModal;
