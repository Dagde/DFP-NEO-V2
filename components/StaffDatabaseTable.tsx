import React from 'react';
import { Instructor } from '../types';

interface StaffDatabaseTableProps {
  instructorsData: Instructor[];
}

const StaffDatabaseTable: React.FC<StaffDatabaseTableProps> = ({ instructorsData }) => {
  // Filter only active instructors (not archived)
  const activeStaff = instructorsData.filter(instructor => instructor.category !== 'UnCat');

  // Determine type based on category
  const getType = (category: string): 'STAFF' | 'TRAINEE' => {
    // Categories A, B, C, D are typically staff
    // Check if the instructor has a role that indicates trainee status
    const isTraineeCategory = ['UnCat', 'D', 'C'].includes(category);
    return isTraineeCategory ? 'TRAINEE' : 'STAFF';
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
            {activeStaff.map((instructor, index) => {
              const type = getType(instructor.category);
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
            {activeStaff.length === 0 && (
              <tr className="bg-blue-950/30">
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No staff records found in the database
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Record count */}
      <div className="mt-4 text-sm text-gray-400">
        Total Records: {activeStaff.length}
      </div>
    </div>
  );
};

export default StaffDatabaseTable;