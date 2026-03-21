import React, { useState, useEffect, useMemo } from 'react';

interface TraineeDatabaseTableProps {
  currentUserPermission?: string;
  onShowSuccess?: (message: string) => void;
  onDataChanged?: () => void;  // Callback to refresh parent data
}

interface DatabaseTrainee {
  id: string;
  idNumber?: number;
  name: string;
  fullName: string;
  rank?: string;
  service?: string;
  course?: string;
  lmpType?: string;
  traineeCallsign?: string;
  seatConfig?: string;
  isPaused?: boolean;
  unit?: string;
  flight?: string;
  location?: string;
  phoneNumber?: string;
  email?: string;
  primaryInstructor?: string;
  secondaryInstructor?: string;
  isActive?: boolean;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

type SortField = 'name' | 'role' | 'rank' | 'course' | 'unit' | 'idNumber' | 'primaryInstructor' | 'status';
type SortDirection = 'asc' | 'desc';

const TraineeDatabaseTable: React.FC<TraineeDatabaseTableProps> = ({ currentUserPermission, onShowSuccess, onDataChanged }) => {
  const [traineeData, setTraineeData] = useState<DatabaseTrainee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const isAdmin = currentUserPermission === 'Super Admin' || currentUserPermission === 'Admin';

  useEffect(() => {
    fetchDatabaseTrainees();
  }, []);

  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebug = (msg: string) => {
    console.log('[TraineeDB Debug]', msg);
    setDebugInfo(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} ${msg}`]);
  };

  const fetchDatabaseTrainees = async () => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo([]);

      const API_URL = '/api/trainees';
      const resolvedUrl = new URL(API_URL, window.location.href).href;
      addDebug(`window.location = ${window.location.href}`);
      addDebug(`Resolved URL = ${resolvedUrl}`);
      addDebug(`Fetching ${API_URL}...`);

      const response = await fetch(API_URL);

      addDebug(`Status: ${response.status} ${response.statusText}`);
      addDebug(`Content-Type: ${response.headers.get('content-type') || 'none'}`);

      const rawText = await response.text();
      addDebug(`Response length: ${rawText.length} chars`);
      addDebug(`Preview: ${rawText.substring(0, 200)}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} — ${rawText.substring(0, 100)}`);
      }

      let data: any;
      try {
        data = JSON.parse(rawText);
        addDebug(`JSON OK. Keys: ${Object.keys(data).join(', ')}`);
      } catch (parseErr) {
        throw new Error(`JSON parse failed: ${parseErr}. Raw: ${rawText.substring(0, 150)}`);
      }

      if (data.trainees && Array.isArray(data.trainees)) {
        addDebug(`Total trainees: ${data.trainees.length}`);
        setTraineeData(data.trainees);
      } else {
        throw new Error(`Invalid format. Keys: ${Object.keys(data).join(', ')}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addDebug(`ERROR: ${msg}`);
      console.error('❌ Error fetching database trainees:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrainee = async (traineeId: string, traineeName: string) => {
    try {
      setDeletingId(traineeId);
      
      const response = await fetch(`/api/trainees/${traineeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete trainee');
      }

      // Remove from local state
      setTraineeData(prev => prev.filter(t => t.id !== traineeId));
      
      if (onShowSuccess) {
        onShowSuccess(`Deleted trainee: ${traineeName}`);
      }
      
      // Notify parent to refresh data (Trainee Profile list, etc.)
      if (onDataChanged) {
        onDataChanged();
      }
      
      console.log(`✅ Deleted trainee: ${traineeName}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error deleting trainee:', err);
      setError(msg);
    } finally {
      setDeletingId(null);
      setShowDeleteConfirm(null);
    }
  };

  // Sorting function
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sorted data using useMemo
  const sortedTraineeData = useMemo(() => {
    const sorted = [...traineeData].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'role':
          aValue = 'trainee';
          bValue = 'trainee';
          break;
        case 'rank':
          aValue = (a.rank || a.service || '')?.toLowerCase() || '';
          bValue = (b.rank || b.service || '')?.toLowerCase() || '';
          break;
        case 'course':
          aValue = (a.course || '')?.toLowerCase() || '';
          bValue = (b.course || '')?.toLowerCase() || '';
          break;
        case 'unit':
          aValue = (a.unit || a.flight || '')?.toLowerCase() || '';
          bValue = (b.unit || b.flight || '')?.toLowerCase() || '';
          break;
        case 'idNumber':
          aValue = a.idNumber || 0;
          bValue = b.idNumber || 0;
          break;
        case 'primaryInstructor':
          aValue = a.primaryInstructor?.toLowerCase() || '';
          bValue = b.primaryInstructor?.toLowerCase() || '';
          break;
        case 'status':
          aValue = a.isPaused ? 'paused' : 'active';
          bValue = b.isPaused ? 'paused' : 'active';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [traineeData, sortField, sortDirection]);

  // Sort indicator component
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="ml-1 text-gray-500">⇅</span>;
    }
    return (
      <span className="ml-1 text-sky-400">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Clickable header component
  const SortableHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <th
      className={`px-4 py-3 text-left text-sm font-semibold tracking-wide cursor-pointer hover:bg-green-800/40 select-none transition-colors ${className}`}
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center">
        {children}
        <SortIndicator field={field} />
      </span>
    </th>
  );

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="text-gray-400 text-sm">
          Loading database trainees...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 mb-4">
          <div className="text-red-300 text-sm font-semibold mb-2">
            Error Loading Database
          </div>
          <div className="text-red-400 text-xs mb-3 font-mono break-all">
            {error}
          </div>
          <button
            onClick={fetchDatabaseTrainees}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-xs rounded transition-colors mb-3"
          >
            Retry
          </button>
          {debugInfo.length > 0 && (
            <div className="mt-3 bg-black/60 border border-gray-600 rounded p-3">
              <div className="text-yellow-400 text-xs font-semibold mb-2">🔍 Debug Trace:</div>
              {debugInfo.map((line, i) => (
                <div key={i} className="text-green-300 text-xs font-mono break-all leading-5">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (traineeData.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="text-gray-400 text-sm">
          No trainee records found in database
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">

        {/* Header with title and count */}
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden mb-4">
          <div className="p-4 bg-gray-800/80 border-b border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-sky-400">Trainee Database</h3>
                <p className="text-sm text-gray-400 mt-1">
                  All trainee records from the database (click column headers to sort)
                </p>
              </div>
              <span className="text-xs font-mono bg-gray-700 text-gray-300 px-3 py-1 rounded-full">
                {traineeData.length} Trainees
              </span>
            </div>
          </div>
        </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-green-900/40 text-white">
              <SortableHeader field="name">NAME</SortableHeader>
              <SortableHeader field="role">ROLE</SortableHeader>
              <SortableHeader field="rank">RANK/SERVICE</SortableHeader>
              <SortableHeader field="course">COURSE/LMP</SortableHeader>
              <SortableHeader field="unit">UNIT/FLIGHT</SortableHeader>
              <SortableHeader field="idNumber">PMKEYS/ID</SortableHeader>
              <SortableHeader field="primaryInstructor">PRIMARY INSTR</SortableHeader>
              <SortableHeader field="status">STATUS</SortableHeader>
              {isAdmin && (
                <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                  ACTIONS
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedTraineeData.map((trainee, index) => {
              const rowBackgroundColor = index % 2 === 0
                ? 'bg-green-950/30'
                : 'bg-green-900/20';

              return (
                <tr
                  key={trainee.id}
                  className={rowBackgroundColor}
                >
                  <td className="px-4 py-3 text-sm text-white">
                    {trainee.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    Trainee
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {[trainee.rank, trainee.service].filter(Boolean).join(' / ') || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {trainee.course
                      ? <span>{trainee.course}{trainee.lmpType ? <span className="text-gray-400 ml-1 text-xs">({trainee.lmpType})</span> : null}</span>
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {[trainee.unit, trainee.flight].filter(Boolean).join(' / ') || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {trainee.idNumber || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {trainee.primaryInstructor || <span className="text-gray-500 italic">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {trainee.isPaused ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-600 text-white">
                        Paused
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-600 text-white">
                        Active
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-sm">
                      {showDeleteConfirm === trainee.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteTrainee(trainee.id, trainee.name)}
                            disabled={deletingId === trainee.id}
                            className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors disabled:opacity-50"
                          >
                            {deletingId === trainee.id ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(trainee.id)}
                          className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed hover:text-red-600 transition-colors"
                          title="Delete this trainee record"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Record count and metadata */}
      <div className="mt-4 flex justify-between items-center text-sm">
        <div className="text-gray-400">
          Source: Database
        </div>
        <div className="text-gray-500 text-xs">
          Count: {traineeData.length}
        </div>
      </div>
    </div>
  );
};

export default TraineeDatabaseTable;