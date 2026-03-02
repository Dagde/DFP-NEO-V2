import React, { useState, useEffect } from 'react';

interface StaffDatabaseTableProps {
  // No props needed - fetches data from API
}

interface DatabaseStaff {
  id: string;
  idNumber?: number;
  name: string;
  rank?: string;
  role?: string;
  category?: string;
  flight?: string;
  location?: string;
  email?: string;
  phoneNumber?: string;
  isQFI?: boolean;
  isOFI?: boolean;
  isCFI?: boolean;
  isActive?: boolean;
  isAdminStaff?: boolean;
  userId?: string; // This identifies real database staff (not mockdata)
  createdAt: string;
  updatedAt: string;
}

const StaffDatabaseTable: React.FC<StaffDatabaseTableProps> = () => {
  const [staffData, setStaffData] = useState<DatabaseStaff[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDatabaseStaff();
  }, []);

  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebug = (msg: string) => {
    console.log('[StaffDB Debug]', msg);
    setDebugInfo(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} ${msg}`]);
  };

  const fetchDatabaseStaff = async () => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo([]);

      const API_URL = '/api/personnel';
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

      if (data.personnel && Array.isArray(data.personnel)) {
        addDebug(`Total personnel: ${data.personnel.length}`);
        const realStaff = data.personnel.filter((staff: DatabaseStaff) =>
          staff.userId !== null && staff.userId !== undefined && staff.userId !== ''
        );
        addDebug(`Staff with userId: ${realStaff.length}`);
        setStaffData(realStaff);
      } else {
        throw new Error(`Invalid format. Keys: ${Object.keys(data).join(', ')}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addDebug(`ERROR: ${msg}`);
      console.error('❌ Error fetching database staff:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Determine type based on role and category
  const getType = (staff: DatabaseStaff): 'STAFF' | 'TRAINEE' => {
    // Trainees are typically in categories UnCat, D, C
    if (staff.category && ['UnCat', 'D', 'C'].includes(staff.category)) {
      return 'TRAINEE';
    }
    return 'STAFF';
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="text-gray-400 text-sm">
          Loading database staff...
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
            onClick={fetchDatabaseStaff}
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

  if (staffData.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="text-gray-400 text-sm">
          No real database staff records found (staff with userId)
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
            <tr className="bg-blue-900/40 text-white">
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                NAME
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                RANK/SERVICE
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                UNIT/FLIGHT
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                PMKEYS/ID
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                TYPE
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                ROLE
              </th>
            </tr>
          </thead>
          <tbody>
            {staffData.map((staff, index) => {
              const type = getType(staff);
              const typeBadgeColor = type === 'TRAINEE' 
                ? 'bg-green-600 text-white' 
                : 'bg-blue-600 text-white';
              const rowBackgroundColor = index % 2 === 0 
                ? 'bg-blue-950/30' 
                : 'bg-blue-900/40';

              return (
                <tr 
                  key={staff.id} 
                  className={rowBackgroundColor}
                >
                  <td className="px-4 py-3 text-sm text-white">
                    {staff.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {staff.rank || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {staff.flight || staff.location || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {staff.idNumber || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${typeBadgeColor}`}>
                      {type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {staff.role || 'N/A'}
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
          Count: {staffData.length}
        </div>
      </div>
    </div>
  );
};

export default StaffDatabaseTable;