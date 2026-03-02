import React, { useState, useEffect } from 'react';

interface TraineeDatabaseTableProps {
  // No props needed - fetches data from API
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

const TraineeDatabaseTable: React.FC<TraineeDatabaseTableProps> = () => {
  const [traineeData, setTraineeData] = useState<DatabaseTrainee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-green-900/40 text-white">
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                NAME
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                RANK/SERVICE
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                COURSE/LMP
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                UNIT/FLIGHT
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                PMKEYS/ID
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                PRIMARY INSTR
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                STATUS
              </th>
            </tr>
          </thead>
          <tbody>
            {traineeData.map((trainee, index) => {
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