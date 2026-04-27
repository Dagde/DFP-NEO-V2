import React, { useState } from 'react';
import { calculateAverageAircraftAvailability, parseTimeString, createAvailabilityTimeline, AvailabilityChange } from '../utils/aircraftAvailabilityCalculator';

interface AircraftAvailabilityCalculatorProps {
  flyingWindow?: { start: string; end: string };
  onCalculated?: (average: number) => void;
}

const AircraftAvailabilityCalculator: React.FC<AircraftAvailabilityCalculatorProps> = ({
  flyingWindow = { start: '0800', end: '1600' },
  onCalculated
}) => {
  const [windowStart, setWindowStart] = useState(flyingWindow.start);
  const [windowEnd, setWindowEnd] = useState(flyingWindow.end);
  const [availabilityChanges, setAvailabilityChanges] = useState([
    { time: '0800', availability: 10 },
    { time: '1200', availability: 20 }
  ]);
  const [averageAvailability, setAverageAvailability] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const addAvailabilityChange = () => {
    setAvailabilityChanges([...availabilityChanges, { time: '', availability: 0 }]);
  };

  const removeAvailabilityChange = (index: number) => {
    setAvailabilityChanges(availabilityChanges.filter((_, i) => i !== index));
  };

  const updateAvailabilityChange = (index: number, field: 'time' | 'availability', value: string | number) => {
    const updated = [...availabilityChanges];
    if (field === 'time') {
      updated[index].time = value as string;
    } else {
      updated[index].availability = Number(value);
    }
    setAvailabilityChanges(updated);
  };

  const calculateAverage = async () => {
    setIsCalculating(true);
    
    try {
      // Parse flying window
      const startTime = parseTimeString(windowStart);
      const endTime = parseTimeString(windowEnd);
      
      // Create timeline
      const timeline = createAvailabilityChanges(availabilityChanges);
      
      // Calculate average
      const average = calculateAverageAircraftAvailability(
        { startTime, endTime },
        timeline
      );
      
      setAverageAvailability(average);
      onCalculated?.(average);
    } catch (error) {
      console.error('Error calculating average availability:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const formatTimeDisplay = (time: string) => {
    const hours = parseTimeString(time);
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-700 rounded-lg p-6 text-white">
      <h3 className="text-xl font-semibold mb-4">Aircraft Availability Calculator</h3>
      
      {/* Flying Window Section */}
      <div className="mb-6">
        <h4 className="text-lg font-medium mb-3">Day Flying Window</h4>
        <div className="flex gap-4 items-center">
          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <input
              type="text"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              className="px-3 py-2 bg-gray-600 rounded border border-gray-500 focus:border-blue-400 focus:outline-none"
              placeholder="0800"
            />
          </div>
          <div className="text-xl mt-6">to</div>
          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <input
              type="text"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              className="px-3 py-2 bg-gray-600 rounded border border-gray-500 focus:border-blue-400 focus:outline-none"
              placeholder="1600"
            />
          </div>
        </div>
        <div className="text-sm text-gray-400 mt-2">
          Window: {formatTimeDisplay(windowStart)} - {formatTimeDisplay(windowEnd)} 
          ({(parseTimeString(windowEnd) - parseTimeString(windowStart)).toFixed(1)} hours)
        </div>
      </div>

      {/* Availability Timeline Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-lg font-medium">Availability Timeline</h4>
          <button
            onClick={addAvailabilityChange}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
          >
            Add Change
          </button>
        </div>
        
        <div className="space-y-2">
          {availabilityChanges.map((change, index) => (
            <div key={index} className="flex gap-3 items-center">
              <div className="flex-1">
                <input
                  type="text"
                  value={change.time}
                  onChange={(e) => updateAvailabilityChange(index, 'time', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-600 rounded border border-gray-500 focus:border-blue-400 focus:outline-none"
                  placeholder="0800"
                />
              </div>
              <div className="text-sm">
                <input
                  type="number"
                  value={change.availability}
                  onChange={(e) => updateAvailabilityChange(index, 'availability', e.target.value)}
                  className="w-20 px-3 py-2 bg-gray-600 rounded border border-gray-500 focus:border-blue-400 focus:outline-none"
                  placeholder="10"
                />
              </div>
              <div className="text-sm text-gray-400">aircraft</div>
              <button
                onClick={() => removeAvailabilityChange(index)}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                disabled={availabilityChanges.length === 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="text-sm text-gray-400 mt-2">
          Changes at different times create new availability segments
        </div>
      </div>

      {/* Calculate Button */}
      <button
        onClick={calculateAverage}
        disabled={isCalculating}
        className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded font-medium"
      >
        {isCalculating ? 'Calculating...' : 'Calculate Average Availability'}
      </button>

      {/* Results */}
      {averageAvailability !== null && (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h4 className="text-lg font-medium mb-2">Calculation Results</h4>
          <div className="text-2xl font-bold text-green-400">
            Average Availability: {averageAvailability.toFixed(2)} aircraft
          </div>
          <div className="text-sm text-gray-400 mt-2">
            This is the time-weighted average across the entire flying window
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
        <h4 className="text-sm font-medium mb-2 text-gray-300">How it works:</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• The flying window defines when aircraft are counted (e.g., 0800-1600)</li>
          <li>• Each change in availability creates a new time segment</li>
          <li>• Average = (aircraft × hours in each segment) ÷ total window hours</li>
          <li>• This is a time-weighted average across the flying window</li>
        </ul>
      </div>
    </div>
  );
};

export default AircraftAvailabilityCalculator;