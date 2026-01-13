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

  const fetchDatabaseStaff = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/personnel');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.personnel && Array.isArray(data.personnel)) {
        // Filter to show ONLY real database staff (those with a userId)
        // Mockdata from migration doesn't have a userId
        const realStaff = data.personnel.filter((staff: DatabaseStaff) => 
          staff.userId !== null && staff.userId !== undefined && staff.userId !== ''
        );
        setStaffData(realStaff);
      } else {
        setError('Invalid data format received from server');
      }
    } catch (err) {
      console.error('Error fetching database staff:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data from database');
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
          <div className="text-red-400 text-xs mb-3">
            {error}
          </div>
          <button
            onClick={fetchDatabaseStaff}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-xs rounded transition-colors"
          >
            Retry
          </button>
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
          Total Records: {staffData.length}
        </div>
        <div className="text-gray-500 text-xs">
          Real database staff only (excluding mockdata)
        </div>
      </div>
    </div>
  );
};

export default StaffDatabaseTable;