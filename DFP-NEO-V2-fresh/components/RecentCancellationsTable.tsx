import React, { useState, useMemo } from 'react';
import { CancellationRecord, CancellationCode } from '../types';

interface RecentCancellationsTableProps {
  cancellationRecords: CancellationRecord[];
  cancellationCodes: CancellationCode[];
}

type TimePeriod = '7days' | '30days' | '90days' | 'all';
type SortField = 'date' | 'event' | 'code' | 'personnel';
type SortDirection = 'asc' | 'desc';

const RecentCancellationsTable: React.FC<RecentCancellationsTableProps> = ({
  cancellationRecords,
  cancellationCodes,
}) => {
  
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30days');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter records by time period
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (timePeriod) {
      case '7days':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '30days':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '90days':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case 'all':
        return cancellationRecords;
    }

    return cancellationRecords.filter(record => {
      const recordDate = new Date(record.cancelledAt);
      return recordDate >= cutoffDate;
    });
  }, [cancellationRecords, timePeriod]);

  // Sort records
  const sortedRecords = useMemo(() => {
    const sorted = [...filteredRecords];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'date':
          comparison = new Date(a.cancelledAt).getTime() - new Date(b.cancelledAt).getTime();
          break;
        case 'event':
          comparison = (a.eventName || '').localeCompare(b.eventName || '');
          break;
        case 'code':
          comparison = a.cancellationCode.localeCompare(b.cancellationCode);
          break;
        case 'personnel':
          comparison = (a.personnelAffected || '').localeCompare(b.personnelAffected || '');
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredRecords, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getCodeDescription = (code: string) => {
    const codeObj = cancellationCodes.find(c => c.code === code);
    return codeObj?.description || 'Unknown';
  };

  const formatDate = (cancelledAt: string) => {
    if (!cancelledAt) {
      return 'No Date';
    }
    
    const date = new Date(cancelledAt);
    
    if (isNaN(date.getTime())) {
      console.log('DATE FIX: Invalid date from:', cancelledAt);
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-500">⇅</span>;
    }
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Recent Cancellations</h2>
        
        {/* Time Period Filter */}
        <div className="flex items-center space-x-2">
          <label className="text-gray-400 text-sm">Time Period:</label>
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white text-sm"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {sortedRecords.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No cancellations found for the selected time period.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th 
                    className="py-3 px-4 text-left text-gray-300 font-semibold cursor-pointer hover:text-white"
                    onClick={() => handleSort('date')}
                  >
                    Date/Time <SortIcon field="date" />
                  </th>
                  <th 
                    className="py-3 px-4 text-left text-gray-300 font-semibold cursor-pointer hover:text-white"
                    onClick={() => handleSort('event')}
                  >
                    Event <SortIcon field="event" />
                  </th>
                  <th 
                    className="py-3 px-4 text-left text-gray-300 font-semibold cursor-pointer hover:text-white"
                    onClick={() => handleSort('code')}
                  >
                    Code <SortIcon field="code" />
                  </th>
                  <th className="py-3 px-4 text-left text-gray-300 font-semibold">
                    Reason
                  </th>
                  <th 
                    className="py-3 px-4 text-left text-gray-300 font-semibold cursor-pointer hover:text-white"
                    onClick={() => handleSort('personnel')}
                  >
                    Personnel Affected <SortIcon field="personnel" />
                  </th>
                  <th className="py-3 px-4 text-left text-gray-300 font-semibold">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((record, index) => (
                  <tr key={index} className="border-b border-gray-700 hover:bg-gray-700/20">
                    <td className="py-3 px-4 text-gray-300 text-sm">
                      {formatDate(record.cancelledAt || record.timestamp)}
                    </td>
                    <td className="py-3 px-4 text-white font-semibold">
                      {record.eventName || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-amber-400">
                        {record.cancellationCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300 text-sm">
                      {getCodeDescription(record.cancellationCode)}
                    </td>
                    <td className="py-3 px-4 text-gray-300 text-sm">
                      {record.personnelAffected || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-sm max-w-xs truncate">
                      {record.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-sm text-gray-400">
            Showing {sortedRecords.length} cancellation{sortedRecords.length !== 1 ? 's' : ''}
          </div>
        </>
      )}
    </div>
  );
};

export default RecentCancellationsTable;