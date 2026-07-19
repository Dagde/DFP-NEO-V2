import React, { useEffect, useRef, useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Instructor, SctRequest } from '../types';
import { BASE_AIRCRAFT_CONFIG, type AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import { DEFAULT_SCT_TERMINOLOGY, normaliseSctTerminology, type SctTerminology } from '../utils/sctTerminology';

interface SctRequestFlyoutProps {
  instructor: Instructor;
  onClose: () => void;
  onSave: (request: SctRequest) => void;
  currencyNames: string[];
  sctEvents?: string[];
  sctTerminology?: SctTerminology;
  nightContinuationDefaultTime?: string;
  aircraftConfigurationDefinitions?: AircraftConfigurationDefinition[];
}

const SctRequestFlyout: React.FC<SctRequestFlyoutProps> = ({ instructor, onClose, onSave, currencyNames, sctEvents: sctEventsProp, sctTerminology = DEFAULT_SCT_TERMINOLOGY, nightContinuationDefaultTime = '18:30', aircraftConfigurationDefinitions = [] }) => {
  const resolvedSctTerminology = useMemo(() => normaliseSctTerminology(sctTerminology), [sctTerminology]);
  const continuationShortLabel = resolvedSctTerminology.shortLabel;
  const continuationLongLabel = resolvedSctTerminology.longLabel;
  const sctEvents = useMemo(() => (Array.isArray(sctEventsProp) ? sctEventsProp.filter(Boolean) : []), [sctEventsProp]);
  const normaliseRequestedTime = (value: string, fallback: string) => (/^\d{2}:\d{2}$/.test(value) ? value : fallback);
  const isNightContinuationEvent = (value: string) => /\bnight\b/i.test(value);
  const defaultDayRequestedTime = '15:00';
  const defaultNightRequestedTime = normaliseRequestedTime(nightContinuationDefaultTime, '18:30');
  const initialEvent = sctEvents[0] || '';
  const [event, setEvent] = useState(() => sctEvents[0] || '');
  const [flightType, setFlightType] = useState<'Solo' | 'Dual'>('Dual');
  const [currency, setCurrency] = useState('');
  const [currencyExpire, setCurrencyExpire] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [notes, setNotes] = useState('');
  const [requestedTime, setRequestedTime] = useState(() => isNightContinuationEvent(initialEvent) ? defaultNightRequestedTime : defaultDayRequestedTime);
  const requestedTimeTouchedRef = useRef(false);
  const [aircraftConfigId, setAircraftConfigId] = useState(BASE_AIRCRAFT_CONFIG.id);

  useEffect(() => {
    if (!sctEvents.length) {
      setEvent('');
      return;
    }
    setEvent(current => sctEvents.includes(current) ? current : sctEvents[0]);
  }, [sctEvents]);

  useEffect(() => {
    if (requestedTimeTouchedRef.current) return;
    setRequestedTime(isNightContinuationEvent(event) ? defaultNightRequestedTime : defaultDayRequestedTime);
  }, [defaultNightRequestedTime, event]);
  const aircraftConfigOptions = useMemo(() => {
    const definitions = aircraftConfigurationDefinitions.length > 0
      ? aircraftConfigurationDefinitions
      : [BASE_AIRCRAFT_CONFIG];
    return definitions.some(definition => definition.id === BASE_AIRCRAFT_CONFIG.id)
      ? definitions
      : [BASE_AIRCRAFT_CONFIG, ...definitions];
  }, [aircraftConfigurationDefinitions]);
  
  // Generate time options at 5-minute intervals from 06:00 to 23:55
  const timeOptions = useMemo(() => {
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

  const handleSave = () => {
    if (!event || !currency || !currencyExpire) {
      alert('Please fill out all required fields: Event, Flight Type, Currency, and Expiry Date.');
      return;
    }
    const newRequest: SctRequest = {
      id: uuidv4(),
      name: instructor.name,
      event,
      flightType,
      currency,
      currencyExpire,
      priority,
      notes,
      dateRequested: new Date().toISOString().split('T')[0],
      requestedTime,
      dayNight: isNightContinuationEvent(event) ? 'Night' : 'Day',
      aircraftConfigId,
      acceptableAircraftConfigs: [aircraftConfigId],
    };
    onSave(newRequest);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-sky-400">Request {continuationShortLabel} for {instructor.name}</h2>
          <button onClick={onClose} className="text-white hover:text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400">Event</label>
              <select value={event} onChange={e => setEvent(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white">
                {sctEvents.length > 0
                  ? sctEvents.map(e => <option key={e} value={e}>{e}</option>)
                  : <option value="">Configure {continuationLongLabel} events in Settings</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as any)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white">
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">Requested Time</label>
              <select
                value={requestedTime}
                onChange={e => {
                  requestedTimeTouchedRef.current = true;
                  setRequestedTime(e.target.value);
                }}
                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
              >
                {timeOptions.map(time => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Flight Type</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="Solo"
                    checked={flightType === 'Solo'}
                    onChange={e => setFlightType(e.target.value as 'Solo' | 'Dual')}
                    className="mr-2 text-sky-600 focus:ring-sky-500 border-gray-600 bg-gray-700"
                  />
                  <span className="text-white">Solo</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="Dual"
                    checked={flightType === 'Dual'}
                    onChange={e => setFlightType(e.target.value as 'Solo' | 'Dual')}
                    className="mr-2 text-sky-600 focus:ring-sky-500 border-gray-600 bg-gray-700"
                  />
                  <span className="text-white">Dual</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">Required CONFIG</label>
              <select
                value={aircraftConfigId}
                onChange={e => setAircraftConfigId(e.target.value)}
                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
                title={aircraftConfigOptions.find(definition => definition.id === aircraftConfigId)?.definition || BASE_AIRCRAFT_CONFIG.definition}
              >
                {aircraftConfigOptions.map(definition => (
                  <option key={definition.id} value={definition.id}>{definition.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400">Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white">
                <option value="">Select Currency...</option>
                <option value="GF">GF</option>
                <option value="30 Day">30 Day</option>
                {currencyNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">Currency Expires</label>
              <input type="date" value={currencyExpire} onChange={e => setCurrencyExpire(e.target.value)} style={{colorScheme: 'dark'}} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400">Notes for Scheduler</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white"
              placeholder="e.g., Specific training objectives, time constraints..."
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700">Submit Request</button>
        </div>
      </div>
    </div>
  );
};

export default SctRequestFlyout;
