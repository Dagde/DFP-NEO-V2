import React, { useState, useEffect } from 'react';
import { DailyAvailabilityRecord, WeeklyAvailabilityRecord, MonthlyAvailabilityRecord, AircraftAvailabilitySnapshot } from '../types/AircraftAvailability';
import { 
    calculateDailyAverageAvailability,
    calculateWeeklyAverage, 
    calculateMonthlyAverage, 
    formatDate, 
    getWeekStart, 
    getWeekEnd,
    getLastNWeeksRange,
       convertSnapshotsToTimeline 
} from '../utils/aircraftAvailabilityUtils';

interface AircraftAvailabilitySettingsProps {}

type ViewMode = 'daily' | 'weekly' | 'monthly';

const AircraftAvailabilitySettings: React.FC<AircraftAvailabilitySettingsProps> = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('daily');
    const [dailyRecords, setDailyRecords] = useState<DailyAvailabilityRecord[]>([]);
    const [weeklyRecords, setWeeklyRecords] = useState<WeeklyAvailabilityRecord[]>([]);
    const [monthlyRecords, setMonthlyRecords] = useState<MonthlyAvailabilityRecord[]>([]);
    const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => getLastNWeeksRange(4));
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    
    // Get day flying window from the first record or use defaults
    const dayFlyingStart = dailyRecords.length > 0 ? dailyRecords[0].dayFlyingStart : '08:00';
    const dayFlyingEnd = dailyRecords.length > 0 ? dailyRecords[0].dayFlyingEnd : '17:00';

    // Load all availability records from localStorage
    useEffect(() => {
        loadDailyRecords();
    }, [dateRange]);

    // Calculate weekly and monthly records when daily records change
    useEffect(() => {
        if (dailyRecords.length > 0) {
            calculateWeeklyRecords();
            calculateMonthlyRecords();
        }
    }, [dailyRecords]);

    const loadDailyRecords = () => {
        const records: DailyAvailabilityRecord[] = [];
        const currentDate = new Date(dateRange.start);
        
        while (currentDate <= dateRange.end) {
            const dateKey = formatDate(currentDate);
            const stored = localStorage.getItem(`aircraft-availability-${dateKey}`);
            
            if (stored) {
                try {
                    const record = JSON.parse(stored);
                    // Convert timestamp strings back to Date objects
                    record.snapshots = record.snapshots.map((s: any) => ({
                        ...s,
                        timestamp: new Date(s.timestamp)
                    }));
                    records.push(record);
                } catch (error) {
                    console.error(`Error parsing record for ${dateKey}:`, error);
                }
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Add sample data if no records exist
        if (records.length === 0) {
            console.log("Adding sample aircraft availability data...");
            const today = new Date();
            const sampleRecord = {
                date: today.toISOString().split("T")[0],
                dayFlyingStart: "08:00",
                dayFlyingEnd: "17:00",
                averageAvailability: 12.5,
                snapshots: [
                    {timestamp: new Date(today.setHours(8, 0, 0, 0)), available: 15, total: 15},
                    {timestamp: new Date(today.setHours(17, 0, 0, 0)), available: 10, total: 15}
                ]
            };
            records.push(sampleRecord);
        }
        setDailyRecords(records.sort((a, b) => b.date.localeCompare(a.date)));
    };

    const calculateWeeklyRecords = () => {
        const weekMap = new Map<string, DailyAvailabilityRecord[]>();
        
        dailyRecords.forEach(record => {
            const date = new Date(record.date);
            const weekStart = getWeekStart(date);
            const weekKey = formatDate(weekStart);
            
            if (!weekMap.has(weekKey)) {
                weekMap.set(weekKey, []);
            }
            weekMap.get(weekKey)!.push(record);
        });
        
        const weekly: WeeklyAvailabilityRecord[] = [];
        weekMap.forEach((records, weekStartKey) => {
            const weekStart = new Date(weekStartKey);
            const weekEnd = getWeekEnd(weekStart);
            
            weekly.push({
                weekStart: weekStartKey,
                weekEnd: formatDate(weekEnd),
                averageAvailability: calculateWeeklyAverage(records),
                dailyRecords: records
            });
        });
        
        setWeeklyRecords(weekly.sort((a, b) => b.weekStart.localeCompare(a.weekStart)));
    };

    const calculateMonthlyRecords = () => {
        const monthMap = new Map<string, DailyAvailabilityRecord[]>();
        
        dailyRecords.forEach(record => {
            const monthKey = record.date.substring(0, 7); // YYYY-MM
            
            if (!monthMap.has(monthKey)) {
                monthMap.set(monthKey, []);
            }
            monthMap.get(monthKey)!.push(record);
        });
        
        const monthly: MonthlyAvailabilityRecord[] = [];
        monthMap.forEach((records, monthKey) => {
            monthly.push({
                month: monthKey,
                averageAvailability: calculateMonthlyAverage(records),
                dailyRecords: records
            });
        });
        
        setMonthlyRecords(monthly.sort((a, b) => b.month.localeCompare(a.month)));
    };

    const handleQuickRange = (weeks: number) => {
        setDateRange(getLastNWeeksRange(weeks));
    };

    const handleCustomRange = () => {
        if (customStartDate && customEndDate) {
            setDateRange({
                start: new Date(customStartDate),
                end: new Date(customEndDate)
            });
        }
    };

    const getAvailabilityColor = (percentage: number): string => {
        if (percentage >= 80) return 'text-green-400';
        if (percentage >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    const exportData = () => {
        const data = {
            dateRange: {
                start: formatDate(dateRange.start),
                end: formatDate(dateRange.end)
            },
            daily: dailyRecords,
            weekly: weeklyRecords,
            monthly: monthlyRecords
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aircraft-availability-${formatDate(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-sky-400">Aircraft Availability History</h2>
                <button
                    onClick={exportData}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold transition-colors"
                >
                    Export Data
                </button>
            </div>

            {/* Date Range Selector */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="text-lg font-semibold text-gray-300 mb-3">Date Range</h3>
                
                {/* Quick Range Buttons */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => handleQuickRange(1)}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm transition-colors"
                    >
                        Last Week
                    </button>
                    <button
                        onClick={() => handleQuickRange(2)}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm transition-colors"
                    >
                        Last 2 Weeks
                    </button>
                    <button
                        onClick={() => handleQuickRange(4)}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm transition-colors"
                    >
                        Last 4 Weeks
                    </button>
                    <button
                        onClick={() => handleQuickRange(12)}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm transition-colors"
                    >
                        Last 3 Months
                    </button>
                </div>

                {/* Custom Range */}
                <div className="flex gap-2 items-end">
                    <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1">End Date</label>
                        <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm"
                        />
                    </div>
                    <button
                        onClick={handleCustomRange}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold transition-colors"
                    >
                        Apply
                    </button>
                </div>

                <div className="mt-2 text-xs text-gray-400">
                    Showing: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
                </div>
                <div className="mt-1 text-xs text-gray-400">
                    Day Flying Window: <span className="text-blue-400 font-semibold">{dayFlyingStart} - {dayFlyingEnd}</span>
                </div>
            </div>

            {/* View Mode Tabs */}
            <div className="flex gap-2 border-b border-gray-700">
                <button
                    onClick={() => setViewMode('daily')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        viewMode === 'daily'
                            ? 'text-sky-400 border-b-2 border-sky-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Daily
                </button>
                <button
                    onClick={() => setViewMode('weekly')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        viewMode === 'weekly'
                            ? 'text-sky-400 border-b-2 border-sky-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Weekly
                </button>
                <button
                    onClick={() => setViewMode('monthly')}
                    className={`px-4 py-2 font-semibold transition-colors ${
                        viewMode === 'monthly'
                            ? 'text-sky-400 border-b-2 border-sky-400'
                            : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                    Monthly
                </button>
            </div>

            {/* Daily View */}
               {viewMode === 'daily' && (
                   <>
                       {/* Calculation Controls */}
                       <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-4">
                           <div className="flex justify-between items-center">
                               <h3 className="text-lg font-medium text-white">Calculation Details</h3>
                               <button
                                   onClick={() => {
                                       console.log("\n🧮 === AIRCRAFT AVAILABILITY CALCULATIONS ===");
                                       dailyRecords.forEach((record, index) => {
                                           console.log(`📅 Record ${index + 1}: ${record.date}`);
                                           console.log("Day Flying Window:", record.dayFlyingStart, "-", record.dayFlyingEnd);
                                           console.log("Average Availability:", record.averageAvailability);
                                           const timeline = convertSnapshotsToTimeline(record.snapshots);
                                           const recalc = calculateDailyAverageAvailability(
                                               timeline,
                                               record.dayFlyingStart ? record.dayFlyingStart.replace(":", "") : "0800",
                                               record.dayFlyingEnd ? record.dayFlyingEnd.replace(":", "") : "1600"
                                           );
                                           console.log("🔄 Recalculated Average:", recalc);
                                       });
                                       console.log("🏁 === END CALCULATIONS ===\n");
                                   }}
                                   className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
                               >
                                   🧮 Show Calculations in Console
                               </button>
                           </div>
                           <p className="text-sm text-gray-400 mt-2">
                               Click the button above to see detailed calculation steps in the browser console.
                           </p>
                       </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-900">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Day Flying Window</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Avg Availability</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Changes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {dailyRecords.map((record, index) => (
                                <tr 
                                    key={index} 
                                    className="hover:bg-gray-700/50 cursor-pointer"
                                    onClick={() => {
                                        console.log('📋 DETAILED RECORD FOR:', record.date);
                                        console.log('📊 Snapshots:', record.snapshots.map(s => ({
                                            time: new Date(s.timestamp).toLocaleTimeString(),
                                            available: s.available,
                                            total: s.total
                                        })));
                                        console.log('⏰ Day Flying Window:', record.dayFlyingStart, '-', record.dayFlyingEnd);
                                        console.log('💯 Average:', record.averageAvailability);
                                        
                                        // Recalculate to show the math
                                        const recalc = calculateDailyAverageAvailability(
                                            record.snapshots,
                                            record.dayFlyingStart,
                                            record.dayFlyingEnd
                                        );
                                        console.log('🔄 Recalculated Average:', recalc);
                                    }}
                                >
                                    <td className="px-4 py-3 text-sm text-gray-300">
                                        {new Date(record.date).toLocaleDateString('en-GB', { 
                                            day: '2-digit', 
                                            month: 'short', 
                                            year: '2-digit' 
                                        })}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-400">
                                        {record.dayFlyingStart} - {record.dayFlyingEnd}
                                    </td>
                                    <td className={`px-4 py-3 text-center text-lg font-bold ${getAvailabilityColor(record.averageAvailability)}`}>
                                        {record.averageAvailability.toFixed(1)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-400">
                                        {record.snapshots.length}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {dailyRecords.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                            No data available for selected date range
                        </div>
                    )}
                </div>
                   </>
            )}

            {/* Weekly View */}
            {viewMode === 'weekly' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-900">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Week</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Avg Availability</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Days Recorded</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {weeklyRecords.map((record, index) => (
                                <tr key={index} className="hover:bg-gray-700/50">
                                    <td className="px-4 py-3 text-sm text-gray-300">
                                        {record.weekStart} to {record.weekEnd}
                                    </td>
                                    <td className={`px-4 py-3 text-center text-lg font-bold ${getAvailabilityColor(record.averageAvailability)}`}>
                                        {record.averageAvailability.toFixed(1)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-400">
                                        {record.dailyRecords.length}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {weeklyRecords.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                            No data available for selected date range
                        </div>
                    )}
                </div>
            )}

            {/* Monthly View */}
            {viewMode === 'monthly' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-900">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Month</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Avg Availability</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Days Recorded</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {monthlyRecords.map((record, index) => (
                                <tr key={index} className="hover:bg-gray-700/50">
                                    <td className="px-4 py-3 text-sm text-gray-300">
                                        {new Date(record.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                                    </td>
                                    <td className={`px-4 py-3 text-center text-lg font-bold ${getAvailabilityColor(record.averageAvailability)}`}>
                                        {record.averageAvailability.toFixed(1)}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-400">
                                        {record.dailyRecords.length}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {monthlyRecords.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                            No data available for selected date range
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AircraftAvailabilitySettings;
