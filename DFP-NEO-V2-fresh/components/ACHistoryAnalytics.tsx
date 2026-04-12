import React, { useState, useMemo } from 'react';
import { CancellationAnalytics, TimePeriod, CancellationRecord, CancellationCode } from '../types';

interface ACHistoryAnalyticsProps {
  cancellationRecords: CancellationRecord[];
  cancellationCodes: CancellationCode[];
}

const ACHistoryAnalytics: React.FC<ACHistoryAnalyticsProps> = ({
  cancellationRecords,
  cancellationCodes,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const [showAllCodes, setShowAllCodes] = useState(false);
  const [sortBy, setSortBy] = useState<'count' | 'percentage' | 'category'>('count');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const getDateRange = (period: TimePeriod): { start: Date; end: Date } => {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);

    switch (period) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case '6months':
        start.setMonth(now.getMonth() - 6);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
      case '2years':
        start.setFullYear(now.getFullYear() - 2);
        break;
      case '5years':
        start.setFullYear(now.getFullYear() - 5);
        break;
      case 'lastFY':
        // Australian FY: July 1 to June 30
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        if (currentMonth >= 6) {
          // After July, last FY is previous year July to current year June
          start = new Date(currentYear - 1, 6, 1);
          end.setFullYear(currentYear);
          end.setMonth(5, 30);
        } else {
          // Before July, last FY is two years ago July to last year June
          start = new Date(currentYear - 2, 6, 1);
          end.setFullYear(currentYear - 1);
          end.setMonth(5, 30);
        }
        break;
      case 'lastCY':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end.setFullYear(now.getFullYear() - 1);
        end.setMonth(11, 31);
        break;
    }

    return { start, end };
  };

  const getPreviousDateRange = (period: TimePeriod): { start: Date; end: Date } => {
    const currentRange = getDateRange(period);
    const duration = currentRange.end.getTime() - currentRange.start.getTime();
    
    const end = new Date(currentRange.start);
    const start = new Date(currentRange.start.getTime() - duration);

    return { start, end };
  };

  const filterRecordsByDateRange = (records: CancellationRecord[], start: Date, end: Date) => {
    return records.filter(record => {
      const recordDate = new Date(record.eventDate);
      return recordDate >= start && recordDate <= end;
    });
  };

  const analytics = useMemo(() => {
    const currentRange = getDateRange(selectedPeriod);
    const previousRange = getPreviousDateRange(selectedPeriod);

    const currentRecords = filterRecordsByDateRange(cancellationRecords, currentRange.start, currentRange.end);
    const previousRecords = filterRecordsByDateRange(cancellationRecords, previousRange.start, previousRange.end);

    const totalCurrent = currentRecords.length;

    const analyticsData: CancellationAnalytics[] = cancellationCodes.map(code => {
      const currentCount = currentRecords.filter(r => 
        r.cancellationCode === code.code || 
        (r.cancellationCode === 'OTHER' && r.manualCodeEntry === code.code)
      ).length;

      const previousCount = previousRecords.filter(r => 
        r.cancellationCode === code.code || 
        (r.cancellationCode === 'OTHER' && r.manualCodeEntry === code.code)
      ).length;

      const percentage = totalCurrent > 0 ? (currentCount / totalCurrent) * 100 : 0;
      
      // Calculate trend: positive = increase, negative = decrease
      let trend = 0;
      if (previousCount > 0) {
        trend = ((currentCount - previousCount) / previousCount) * 100;
      } else if (currentCount > 0) {
        trend = 100; // New occurrences
      }

      return {
        code: code.code,
        category: code.category,
        description: code.description,
        totalCount: currentCount,
        percentage,
        trend,
        previousCount,
      };
    });

    // Sort analytics
    let sorted = [...analyticsData];
    switch (sortBy) {
      case 'count':
        sorted.sort((a, b) => sortDirection === 'desc' ? b.totalCount - a.totalCount : a.totalCount - b.totalCount);
        break;
      case 'percentage':
        sorted.sort((a, b) => sortDirection === 'desc' ? b.percentage - a.percentage : a.percentage - b.percentage);
        break;
      case 'category':
        sorted.sort((a, b) => {
          const categoryCompare = sortDirection === 'desc' 
            ? b.category.localeCompare(a.category)
            : a.category.localeCompare(b.category);
          if (categoryCompare !== 0) return categoryCompare;
          return b.totalCount - a.totalCount; // Secondary sort by count
        });
        break;
    }

    // Filter out zero occurrences if showAllCodes is false
    if (!showAllCodes) {
      sorted = sorted.filter(a => a.totalCount > 0);
    }

    return sorted;
  }, [cancellationRecords, cancellationCodes, selectedPeriod, sortBy, sortDirection, showAllCodes]);

  const handleSort = (column: 'count' | 'percentage' | 'category') => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  const formatPeriodLabel = (period: TimePeriod): string => {
    const labels: Record<TimePeriod, string> = {
      week: 'Past Week',
      month: 'Past Month',
      '6months': 'Past 6 Months',
      year: 'Past Year',
      '2years': 'Past 2 Years',
      '5years': 'Past 5 Years',
      lastFY: 'Last Financial Year',
      lastCY: 'Last Calendar Year',
    };
    return labels[period];
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 5) {
      return <span className="text-red-400">↑</span>;
    } else if (trend < -5) {
      return <span className="text-green-400">↓</span>;
    } else {
      return <span className="text-gray-400">→</span>;
    }
  };

  const totalCancellations = analytics.reduce((sum, a) => sum + a.totalCount, 0);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">AC History (Cancellation Analytics & Trends)</h2>
      </div>

      {/* Time Period Selectors */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-400 mb-2">Time Period</label>
        <div className="flex flex-wrap gap-2">
          {(['week', 'month', '6months', 'year', '2years', '5years', 'lastFY', 'lastCY'] as TimePeriod[]).map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                selectedPeriod === period
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {formatPeriodLabel(period)}
            </button>
          ))}
        </div>
      </div>

      {/* Show All Codes Toggle */}
      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showAllCodes}
            onChange={(e) => setShowAllCodes(e.target.checked)}
            className="h-4 w-4 bg-gray-700 border-gray-600 rounded focus:ring-sky-500 accent-sky-500"
          />
          <span className="text-sm text-gray-300">Show codes with zero occurrences</span>
        </label>
        <div className="text-sm text-gray-400">
          Total Cancellations: <span className="font-semibold text-white">{totalCancellations}</span>
        </div>
      </div>

      {/* Analytics Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-300 font-semibold">Code</th>
              <th 
                className="text-left py-3 px-4 text-gray-300 font-semibold cursor-pointer hover:text-white"
                onClick={() => handleSort('category')}
              >
                Category {sortBy === 'category' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th className="text-left py-3 px-4 text-gray-300 font-semibold">Description</th>
              <th 
                className="text-right py-3 px-4 text-gray-300 font-semibold cursor-pointer hover:text-white"
                onClick={() => handleSort('count')}
              >
                Total {sortBy === 'count' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th 
                className="text-right py-3 px-4 text-gray-300 font-semibold cursor-pointer hover:text-white"
                onClick={() => handleSort('percentage')}
              >
                Percentage {sortBy === 'percentage' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th className="text-center py-3 px-4 text-gray-300 font-semibold">Trend</th>
            </tr>
          </thead>
          <tbody>
            {analytics.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  No cancellation data available for the selected period.
                </td>
              </tr>
            ) : (
              analytics.map((item) => (
                <tr key={item.code} className="border-b border-gray-700 hover:bg-gray-700/20">
                  <td className="py-3 px-4 text-white font-mono font-semibold">{item.code}</td>
                  <td className="py-3 px-4 text-gray-300">{item.category}</td>
                  <td className="py-3 px-4 text-gray-300">{item.description}</td>
                  <td className="py-3 px-4 text-right text-white font-semibold">{item.totalCount}</td>
                  <td className="py-3 px-4 text-right text-white">{item.percentage.toFixed(1)}%</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {getTrendIcon(item.trend)}
                      <span className={`text-xs ${
                        item.trend > 5 ? 'text-red-400' : 
                        item.trend < -5 ? 'text-green-400' : 
                        'text-gray-400'
                      }`}>
                        {item.trend > 0 ? '+' : ''}{item.trend.toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      (prev: {item.previousCount})
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-400">
        <p>• Percentages are calculated relative to all Flight + FTD cancellations in the selected period.</p>
        <p>• Trend indicators compare the selected period to the immediately preceding equivalent period.</p>
        <p>• Both active and inactive codes appear in analytics if used historically.</p>
      </div>
    </div>
  );
};

export default ACHistoryAnalytics;