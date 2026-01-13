import React from 'react';
import { Instructor } from '../types';

interface StaffDatabaseTableProps {
  instructorsData: Instructor[];
}

const StaffDatabaseTable: React.FC<StaffDatabaseTableProps> = ({ instructorsData }) => {
  // Real database staff IDs from Postgres backend
  const REAL_DATABASE_STAFF_IDS = [8207939, 4300401, 4300403];
  
  // Filter to show ONLY real database staff (not mockdata)
  const realDatabaseStaff = instructorsData.filter(instructor => 
    REAL_DATABASE_STAFF_IDS.includes(instructor.idNumber)
  );

  // Determine type based on role
  const getType = (role: string): 'STAFF' | 'TRAINEE' => {
    // For real database staff, all are STAFF (QFI or SIM IP)
    return 'STAFF';
  };

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
                UNIT
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                PMKEYS/ID
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                TYPE
              </th>
            </tr>
          </thead>
          <tbody>
            {realDatabaseStaff.map((instructor, index) => {
              const type = getType(instructor.role);
              const typeBadgeColor = type === 'TRAINEE' 
                ? 'bg-green-600 text-white' 
                : 'bg-blue-600 text-white';
              const rowBackgroundColor = index % 2 === 0 
                ? 'bg-blue-950/30' 
                : 'bg-blue-900/40';

              return (
                <tr 
                  key={instructor.idNumber} 
                  className={rowBackgroundColor}
                >
                  <td className="px-4 py-3 text-sm text-white">
                    {instructor.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {instructor.rank} - {instructor.service || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {instructor.unit || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">
                    {instructor.idNumber}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${typeBadgeColor}`}>
                      {type}
                    </span>
                  </td>
                </tr>
              );
            })}
            {realDatabaseStaff.length === 0 && (
              <tr className="bg-blue-950/30">
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No real database staff records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Record count */}
      <div className="mt-4 text-sm text-gray-400">
        Total Records: {realDatabaseStaff.length}
      </div>
    </div>
  );
};

export default StaffDatabaseTable;
