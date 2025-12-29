import React, { useState, useEffect } from 'react';
import { AircraftAvailabilitySnapshot, DailyAvailabilityRecord } from '../types/AircraftAvailability';
import { calculateDailyAverageAvailability, formatTime, formatDate, convertSnapshotsToTimeline } from '../utils/aircraftAvailabilityUtils';

interface AircraftAvailabilityPanelProps {
    currentDate: Date;
    totalAircraft: number;
    plannedAvailability: number;
    dayFlyingStart: string; // HH:mm
    dayFlyingEnd: string; // HH:mm
    onAvailabilityChange: (record: DailyAvailabilityRecord) => void;
}

const AircraftAvailabilityPanel: React.FC<AircraftAvailabilityPanelProps> = ({
    currentDate,
    totalAircraft,
    plannedAvailability,
    dayFlyingStart,
    dayFlyingEnd,
    onAvailabilityChange
}) => {
    const [currentAvailable, setCurrentAvailable] = useState<number>(plannedAvailability);
    const [snapshots, setSnapshots] = useState<AircraftAvailabilitySnapshot[]>([]);
    const [averageAvailability, setAverageAvailability] = useState<number>(0);
    const [isDragging, setIsDragging] = useState(false);

    // Load snapshots from localStorage on mount
    useEffect(() => {
        const dateKey = formatDate(currentDate);
        const stored = localStorage.getItem(`aircraft-availability-${dateKey}`);
        if (stored) {
            const data = JSON.parse(stored);
            setSnapshots(data.snapshots.map((s: any) => ({
                ...s,
                timestamp: new Date(s.timestamp)
            })));
            setCurrentAvailable(data.snapshots[data.snapshots.length - 1]?.available || plannedAvailability);
        } else {
            // Initialize with planned availability
            const initialSnapshot: AircraftAvailabilitySnapshot = {
                timestamp: new Date(),
                available: plannedAvailability,
                total: totalAircraft,
                notes: 'Initial planned availability'
            };
            setSnapshots([initialSnapshot]);
            setCurrentAvailable(plannedAvailability);
        }
    }, [currentDate, plannedAvailability, totalAircraft]);

    // Calculate average whenever snapshots change
    useEffect(() => {
        if (snapshots.length > 0) {
            const timeline = convertSnapshotsToTimeline(snapshots);
            const avg = calculateDailyAverageAvailability(timeline, dayFlyingStart.replace(':', ''), dayFlyingEnd.replace(':', ''));
            setAverageAvailability(avg);

            // Create daily record
            const record: DailyAvailabilityRecord = {
                date: formatDate(currentDate),
                snapshots: snapshots,
                averageAvailability: avg,
                dayFlyingStart,
                dayFlyingEnd
            };

            // Save to localStorage
            localStorage.setItem(`aircraft-availability-${record.date}`, JSON.stringify(record));

            // Notify parent
            onAvailabilityChange(record);
        }
    }, [snapshots, dayFlyingStart, dayFlyingEnd, currentDate, onAvailabilityChange]);

    const handleAvailabilityChange = (newAvailable: number, notes?: string) => {
        const newSnapshot: AircraftAvailabilitySnapshot = {
            timestamp: new Date(),
            available: newAvailable,
            total: totalAircraft,
            notes: notes || `Availability changed to ${newAvailable}`
        };

        setSnapshots(prev => [...prev, newSnapshot]);
        setCurrentAvailable(newAvailable);
    };

    const handleDragStart = () => {
        setIsDragging(true);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value);
        setCurrentAvailable(value);
    };

    const handleSliderRelease = () => {
        if (currentAvailable !== (snapshots[snapshots.length - 1]?.available || 0)) {
            handleAvailabilityChange(currentAvailable);
        }
    };

    const getAvailabilityColor = (available: number, total: number): string => {
        const percentage = (available / total) * 100;
        if (percentage >= 80) return 'text-green-400';
        if (percentage >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getAvailabilityBgColor = (available: number, total: number): string => {
        const percentage = (available / total) * 100;
        if (percentage >= 80) return 'bg-green-500';
        if (percentage >= 60) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-sky-400">Aircraft Availability</h2>
                <div className="text-sm text-gray-400">
                    {formatDate(currentDate)}
                </div>
            </div>

            {/* Current Availability Display */}
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-sm">Current Availability</span>
                    <span className={`text-2xl font-bold ${getAvailabilityColor(currentAvailable, totalAircraft)}`}>
                        {currentAvailable} / {totalAircraft}
                    </span>
                </div>
                
                {/* Drag Slider */}
                <div className="mt-4">
                    <input
                        type="range"
                        min="0"
                        max={totalAircraft}
                        value={currentAvailable}
                        onChange={handleSliderChange}
                        onMouseDown={handleDragStart}
                        onMouseUp={handleDragEnd}
                        onTouchStart={handleDragStart}
                        onTouchEnd={handleDragEnd}
                        onMouseLeave={handleSliderRelease}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                            background: `linear-gradient(to right, ${
                                currentAvailable / totalAircraft >= 0.8 ? '#10b981' :
                                currentAvailable / totalAircraft >= 0.6 ? '#f59e0b' : '#ef4444'
                            } 0%, ${
                                currentAvailable / totalAircraft >= 0.8 ? '#10b981' :
                                currentAvailable / totalAircraft >= 0.6 ? '#f59e0b' : '#ef4444'
                            } ${(currentAvailable / totalAircraft) * 100}%, #374151 ${(currentAvailable / totalAircraft) * 100}%, #374151 100%)`
                        }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0</span>
                        <span>{totalAircraft}</span>
                    </div>
                </div>
            </div>

            {/* Planned vs Actual */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-900 rounded p-3">
                    <div className="text-xs text-gray-400 mb-1">Planned</div>
                    <div className="text-lg font-semibold text-blue-400">
                        {plannedAvailability} / {totalAircraft}
                    </div>
                </div>
                <div className="bg-gray-900 rounded p-3">
                    <div className="text-xs text-gray-400 mb-1">Daily Average</div>
                    <div className={`text-lg font-semibold ${getAvailabilityColor(Math.round(averageAvailability * totalAircraft / 100), totalAircraft)}`}>
                        {averageAvailability.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Timeline History */}
            <div className="bg-gray-900 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Today's History</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {snapshots.slice().reverse().map((snapshot, index) => (
                        <div key={index} className="flex items-center justify-between text-xs border-b border-gray-700 pb-2">
                            <div className="flex items-center space-x-2">
                                <span className="text-gray-500">
                                    {formatTime(snapshot.timestamp)}
                                </span>
                                <span className={`font-semibold ${getAvailabilityColor(snapshot.available, snapshot.total)}`}>
                                    {snapshot.available} / {snapshot.total}
                                </span>
                            </div>
                            {snapshot.notes && (
                                <span className="text-gray-400 italic text-xs truncate max-w-xs">
                                    {snapshot.notes}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 flex gap-2">
                <button
                    onClick={() => handleAvailabilityChange(currentAvailable - 1, 'Aircraft unserviceable')}
                    disabled={currentAvailable <= 0}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md text-sm font-semibold transition-colors"
                >
                    -1 U/S
                </button>
                <button
                    onClick={() => handleAvailabilityChange(currentAvailable + 1, 'Aircraft serviceable')}
                    disabled={currentAvailable >= totalAircraft}
                    className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md text-sm font-semibold transition-colors"
                >
                    +1 Serviceable
                </button>
            </div>
        </div>
    );
};

export default AircraftAvailabilityPanel;