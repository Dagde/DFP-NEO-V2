import React, { useState, useMemo } from 'react';
import { Trainee, Score, SyllabusItemDetail, Instructor } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AddRemedialPackageFlyoutProps {
  trainee: Trainee;
  instructors: Instructor[];
  scores: Score[];
  traineeLmp: SyllabusItemDetail[];
  onClose: () => void;
  onSave: (
    trainee: Trainee,
    eventToRemediate: SyllabusItemDetail,
    newEvents: { type: 'TUT' | 'FTD' | 'Flight', duration: number, instructor: string }[]
  ) => void;
}

const AddRemedialPackageFlyout: React.FC<AddRemedialPackageFlyoutProps> = ({
  trainee,
  instructors,
  scores,
  traineeLmp,
  onClose,
  onSave
}) => {
  const [eventToRemediateId, setEventToRemediateId] = useState<string>('');
  const [remedialEvents, setRemedialEvents] = useState<{ id: string, type: 'TUT' | 'FTD' | 'Flight', duration: number, instructor: string }[]>([]);

  // State for the three new rows
  const [tutState, setTutState] = useState({ quantity: 0, duration: 1.0, instructor: '' });
  const [ftdState, setFtdState] = useState({ quantity: 0, duration: 1.5, instructor: '' });
  const [flightState, setFlightState] = useState({ quantity: 0, duration: 1.5, instructor: '' });


  const failedEvents = useMemo(() => {
    return scores
      .filter(score => score.score === 0 || score.score === 1)
      .map(score => traineeLmp.find(item => item.id === score.event))
      .filter((item): item is SyllabusItemDetail => !!item)
      .sort((a, b) => new Date(scores.find(s => s.event === b.id)!.date).getTime() - new Date(scores.find(s => s.event === a.id)!.date).getTime());
  }, [scores, traineeLmp]);

  // Find the last completed event (based on PT-051 flight history - last event actually flown)
  const lastCompletedEvent = useMemo(() => {
    // Get all events that have been flown (any score >= 0) with actual flight dates
    // Even Fail (0) or Marginal (1) scores count as "completed" for progression purposes
    const flownEventsWithDates = traineeLmp
      .map(item => {
        const score = scores.find(s => s.event === item.id);
        return {
          item,
          score,
          date: score && score.score >= 0 ? new Date(score.date).getTime() : null
        };
      })
      .filter(eventData => eventData.score && eventData.score.score >= 0 && eventData.date !== null);
    
    // Sort by flight date (most recent first) to find the last event actually flown
    const sortedByFlightDate = flownEventsWithDates.sort((a, b) => b.date! - a.date!);
    
    return sortedByFlightDate.length > 0 ? sortedByFlightDate[0].item : null;
  }, [traineeLmp, scores]);

  // Find the next event in Individual LMP after the last completed event
  const nextEvent = useMemo(() => {
    if (!lastCompletedEvent) return null;
    
    const lastCompletedIndex = traineeLmp.findIndex(item => item.id === lastCompletedEvent.id);
    
    // Return the next event in the Individual LMP (if it exists)
    return lastCompletedIndex >= 0 && lastCompletedIndex < traineeLmp.length - 1 
      ? traineeLmp[lastCompletedIndex + 1] 
      : null;
  }, [traineeLmp, lastCompletedEvent]);

  const eventToRemediate = useMemo(() => {
    return traineeLmp.find(item => item.id === eventToRemediateId);
  }, [eventToRemediateId, traineeLmp]);

  const reFlyEvent = useMemo(() => {
    if (!eventToRemediate) return null;
    return {
      ...eventToRemediate,
      code: `${eventToRemediate.code}-RF`,
      eventDescription: `Re-Fly: ${eventToRemediate.eventDescription}`,
    };
  }, [eventToRemediate]);

  const handleAddEvents = () => {
    const eventsToAdd: { id: string, type: 'TUT' | 'FTD' | 'Flight', duration: number, instructor: string }[] = [];

    // Process Tutorials
    if (tutState.quantity > 0 && tutState.instructor && tutState.duration > 0) {
        for (let i = 0; i < tutState.quantity; i++) {
            eventsToAdd.push({ id: uuidv4(), type: 'TUT', duration: tutState.duration, instructor: tutState.instructor });
        }
    }
    // Process FTDs
    if (ftdState.quantity > 0 && ftdState.instructor && ftdState.duration > 0) {
        for (let i = 0; i < ftdState.quantity; i++) {
            eventsToAdd.push({ id: uuidv4(), type: 'FTD', duration: ftdState.duration, instructor: ftdState.instructor });
        }
    }
    // Process Flights
    if (flightState.quantity > 0 && flightState.instructor && flightState.duration > 0) {
        for (let i = 0; i < flightState.quantity; i++) {
            eventsToAdd.push({ id: uuidv4(), type: 'Flight', duration: flightState.duration, instructor: flightState.instructor });
        }
    }

    if (eventsToAdd.length > 0) {
        setRemedialEvents(prev => [...prev, ...eventsToAdd]);
        // Reset forms
        setTutState({ quantity: 0, duration: 1.0, instructor: '' });
        setFtdState({ quantity: 0, duration: 1.5, instructor: '' });
        setFlightState({ quantity: 0, duration: 1.5, instructor: '' });
    } else {
        alert("Please enter a quantity, duration, and instructor for at least one event type.");
    }
  };
  
  const handleRemoveEvent = (id: string) => {
    setRemedialEvents(prev => prev.filter(e => e.id !== id));
  };

  const handleSavePackage = () => {
    if (!eventToRemediate || remedialEvents.length === 0) {
        alert("Please select an event to remediate and add at least one remedial event.");
        return;
    }
    onSave(trainee, eventToRemediate, remedialEvents);
  };
  
  const InputRow: React.FC<{
    label: string;
    state: { quantity: number; duration: number; instructor: string; };
    setState: React.Dispatch<React.SetStateAction<{ quantity: number; duration: number; instructor: string; }>>;
  }> = ({ label, state, setState }) => (
    <div className="flex items-end space-x-2">
        <div className="w-28 flex-shrink-0">
            <label className="block text-sm font-medium text-gray-300">{label}</label>
        </div>
        <div style={{ width: '4.5rem' }}>
            <label className="block text-xs font-medium text-gray-400">Qty</label>
            <input type="number" min="0" value={state.quantity} onChange={e => setState(p => ({ ...p, quantity: parseInt(e.target.value, 10) || 0 }))} className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm" />
        </div>
        <div style={{ width: '6rem' }}>
            <label className="block text-xs font-medium text-gray-400">Dur (hrs)</label>
            <input type="number" step="0.1" min="0" value={state.duration} onChange={e => setState(p => ({ ...p, duration: parseFloat(e.target.value) || 0 }))} className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm" />
        </div>
        <div className="flex-grow">
            <label className="block text-xs font-medium text-gray-400">Instructor</label>
            <select value={state.instructor} onChange={e => setState(p => ({ ...p, instructor: e.target.value }))} className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm">
                <option value="" disabled>Select</option>
                {instructors.map(i => <option key={i.idNumber} value={i.name}>{i.name}</option>)}
            </select>
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700 flex flex-col h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-sky-400">Add Remedial Package for {trainee.name}</h2>
          <button onClick={onClose} className="text-white hover:text-gray-300"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Step 1: Select Event to Remediate */}
          <fieldset className="p-4 border border-gray-600 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Step 1: Select Failed Event</legend>
            <div className="mt-2">
              <div className="relative">
                <select
                  value={eventToRemediateId}
                  onChange={e => setEventToRemediateId(e.target.value)}
                  className="block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-sky-500 sm:text-sm"
                  size="8"
                >
                  <option value="" disabled>Select an event to remediate...</option>
                  {failedEvents.map(event => (
                    <option 
                      key={event.id} 
                      value={event.id}
                      style={{ 
                        color: lastCompletedEvent?.id === event.id ? '#ef4444' : '#ffffff',
                        fontWeight: lastCompletedEvent?.id === event.id ? 'bold' : 'normal'
                      }}
                    >
                      {event.code}
                    </option>
                  ))}
                </select>
                {/* Center the last completed event in the dropdown */}
                {lastCompletedEvent && (() => {
                  const lastCompletedIndex = failedEvents.findIndex(event => event.id === lastCompletedEvent!.id);
                  if (lastCompletedIndex >= 0) {
                    const selectElement = document.querySelector('select[size="8"]') as HTMLSelectElement;
                    if (selectElement) {
                      // Center the selected item in the visible area
                      const visibleStart = Math.max(0, lastCompletedIndex - 3);
                      selectElement.selectedIndex = visibleStart;
                      setTimeout(() => {
                        selectElement.selectedIndex = eventToRemediateId || -1;
                      }, 100);
                    }
                  }
                  return null;
                })()}
              </div>
              <div className="mt-2 text-xs space-y-1">
                {lastCompletedEvent && (
                  <div className="text-red-400">
                    Last completed: {lastCompletedEvent.code}
                  </div>
                )}
                {nextEvent && (
                  <div className="text-green-400">
                    Next event: {nextEvent.code}
                  </div>
                )}
              </div>
            </div>
          </fieldset>

          {eventToRemediate && (
            <>
              {/* Step 2: Build Package */}
              <fieldset className="p-4 border border-gray-600 rounded-lg">
                <legend className="px-2 text-sm font-semibold text-gray-300">Step 2: Build Remedial Package</legend>
                <div className="mt-2 p-3 bg-gray-700/30 rounded-lg space-y-3">
                    <InputRow label="Tutorials" state={tutState} setState={setTutState} />
                    <InputRow label="FTDs" state={ftdState} setState={setFtdState} />
                    <InputRow label="Flights" state={flightState} setState={setFlightState} />
                </div>
                <button onClick={handleAddEvents} className="w-full mt-3 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold">Add Events to Package</button>
                
                <div className="mt-4 space-y-2">
                    {remedialEvents.map((event) => (
                        <div key={event.id} className="flex items-center justify-between p-2 bg-gray-700/50 rounded-md text-sm">
                            <div className="flex items-center space-x-3">
                                <span className="font-bold text-sky-400 w-16">{event.type}</span>
                                <span className="text-gray-300">{event.duration.toFixed(1)} hrs with {event.instructor.split(',')[0]}</span>
                            </div>
                            <button onClick={() => handleRemoveEvent(event.id)} className="p-1 text-gray-400 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
                        </div>
                    ))}
                </div>
              </fieldset>

              {/* Step 3: Review Re-Fly */}
              {reFlyEvent && (
                <fieldset className="p-4 border border-gray-600 rounded-lg">
                    <legend className="px-2 text-sm font-semibold text-gray-300">Step 3: Review Auto-Generated Re-Fly</legend>
                    <div className="mt-2 p-3 bg-gray-700/30 rounded-lg">
                        <p className="text-white font-semibold">{reFlyEvent.code} - {reFlyEvent.eventDescription}</p>
                        <p className="text-sm text-gray-400 mt-1">This is a copy of the original event and will be added as the final step of the package.</p>
                    </div>
                </fieldset>
              )}
            </>
          )}
        </div>
        
        <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end space-x-3">
            <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancel</button>
            <button onClick={handleSavePackage} disabled={!eventToRemediate || remedialEvents.length === 0} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:bg-gray-500 disabled:cursor-not-allowed">Save Package</button>
        </div>
      </div>
    </div>
  );
};

export default AddRemedialPackageFlyout;