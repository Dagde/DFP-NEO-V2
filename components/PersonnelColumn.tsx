import React from 'react';
import { InstructorRank } from '../types';
import { type CrewPositionTerminology } from '../utils/crewPositionTerminology';
import { getStaffRoleDisplay } from '../utils/staffRoleColours';

interface Personnel {
  name: string;
  rank: InstructorRank;
  unit?: string;
  role?: string;
}

interface PersonnelColumnProps {
  personnel: Personnel[];
  rowHeight: number;
  onRowEnter?: (index: number) => void;
  onRowLeave?: () => void;
  onPersonClick?: (personName: string) => void;
  onRowRef?: (name: string, element: HTMLLIElement | null) => void;
  showUnits?: boolean;
  useUnitColors?: boolean;
  useRoleColors?: boolean;
  crewPositionTerminology?: CrewPositionTerminology;
  instructorLabel?: string;
}

// Unit color mapping - only text colors
const getUnitTextColor = (unit?: string): string => {
  const unitColors: { [key: string]: string } = {
    '1FTS': 'text-blue-300',
    '2FTS': 'text-green-300', 
    'CFS': 'text-purple-300',
    'CFTS': 'text-orange-300',
    'RMC': 'text-red-300',
    'ARFTU': 'text-yellow-300',
    'AWMU': 'text-teal-300',
    'No. 1 Squadron': 'text-indigo-300',
    'No. 2 Squadron': 'text-pink-300',
    'No. 3 Squadron': 'text-cyan-300',
    'No. 75 Squadron': 'text-amber-300',
    'No. 76 Squadron': 'text-lime-300',
    'No. 77 Squadron': 'text-emerald-300',
    '11SQN': 'text-sky-300',
    '12SQN': 'text-violet-300',
  };
  console.log('🎨 UNIT COLOR DEBUG - Unit:', unit, 'Color:', unitColors[unit || ''] || 'text-gray-300');
     return unitColors[unit || ''] || 'text-gray-300';
};

// Unit color for headers
const getUnitColor = (unit?: string): string => {
  const unitColors: { [key: string]: string } = {
    '1FTS': 'bg-blue-500/20 border-blue-500/50 text-blue-300',
    '2FTS': 'bg-green-500/20 border-green-500/50 text-green-300', 
    'CFS': 'bg-purple-500/20 border-purple-500/50 text-purple-300',
    'CFTS': 'bg-orange-500/20 border-orange-500/50 text-orange-300',
    'RMC': 'bg-red-500/20 border-red-500/50 text-red-300',
    'ARFTU': 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
    'AWMU': 'bg-teal-500/20 border-teal-500/50 text-teal-300',
    'No. 1 Squadron': 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300',
    'No. 2 Squadron': 'bg-pink-500/20 border-pink-500/50 text-pink-300',
    'No. 3 Squadron': 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
    'No. 75 Squadron': 'bg-amber-500/20 border-amber-500/50 text-amber-300',
    'No. 76 Squadron': 'bg-lime-500/20 border-lime-500/50 text-lime-300',
    'No. 77 Squadron': 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
    '11SQN': 'bg-sky-500/20 border-sky-500/50 text-sky-300',
    '12SQN': 'bg-violet-500/20 border-violet-500/50 text-violet-300',
  };
  return unitColors[unit || ''] || 'bg-gray-600/20 border-gray-500/50 text-gray-300';
};

const PersonnelColumn: React.FC<PersonnelColumnProps> = ({ 
  personnel, 
  rowHeight, 
  onRowEnter, 
  onRowLeave, 
  onPersonClick, 
  onRowRef, 
  showUnits = false, 
  useUnitColors = false,
  useRoleColors = false,
  crewPositionTerminology,
  instructorLabel = 'QFI',
}) => {
  console.log('🔍 PERSONNEL COLUMN DEBUG - Props:', {
       personnelCount: personnel.length,
       showUnits,
       useUnitColors,
       samplePersonnel: personnel.slice(0, 3).map(p => ({ name: p.name, unit: p.unit }))
     });
     
     // Group personnel by unit if needed, preserving the incoming sorted unit order.
  const groupedPersonnel = React.useMemo(() => {
    if (!showUnits) return personnel;

    const groups: Record<string, Personnel[]> = {};
    personnel.forEach(person => {
      const unit = person.unit || 'Unassigned';
      if (!groups[unit]) {
        groups[unit] = [];
      }
      groups[unit].push(person);
    });

    return groups;
  }, [personnel, showUnits]);

  // If not showing units, render original layout
  if (!showUnits) {
    return (
      <div className="w-40 bg-gray-800 flex-shrink-0 h-full">
        <ul>
          {personnel.map(({ name, rank, unit, role }, index) => {
            const roleDisplay = getStaffRoleDisplay(role, crewPositionTerminology, instructorLabel);
            const nameTextClass = useRoleColors ? roleDisplay.textClassName : useUnitColors ? getUnitTextColor(unit) : 'text-gray-300';
            return (
            <li
              key={name}
              ref={(el) => onRowRef?.(name, el)}
              className={`flex items-center justify-start pl-3 text-xs transition-colors duration-150 border-b border-gray-700/50 ${onPersonClick ? 'cursor-pointer hover:bg-gray-700' : ''}`}
              style={{ height: rowHeight }}
              onMouseEnter={() => onRowEnter?.(index)}
              onMouseLeave={() => onRowLeave?.()}
              onClick={() => onPersonClick?.(name)}
              title={useRoleColors ? `${name} - ${roleDisplay.label}` : name}
            >
              <span className="font-mono text-gray-500 w-12 flex-shrink-0">{rank}</span>
              <span className={`truncate font-medium ${nameTextClass}`}>{name}</span>
            </li>
          );
          })}
        </ul>
      </div>
    );
  }

  // Render grouped by units
  let visualRowIndex = 0;
  return (
    <div className="w-40 bg-gray-800 flex-shrink-0 h-full">
      <ul>
        {Object.entries(groupedPersonnel).map(([unit, people]) => {
          visualRowIndex += 1;
          return (
            <React.Fragment key={unit}>
              {/* Unit header */}
              <li
                className={`flex items-center border-b px-3 ${getUnitColor(unit)}`}
                style={{ height: rowHeight, minHeight: rowHeight }}
              >
                <span className={`text-xs font-semibold ${useUnitColors ? getUnitColor(unit).split(' ').find(c => c.startsWith('text-')) || 'text-gray-400' : 'text-gray-400'}`}>
                  {unit} ({people.length})
                </span>
              </li>

              {/* Personnel in this unit - NO unit text under name, only colored text */}
              {people.map(({ name, rank, unit: personUnit, role }) => {
                const rowIndex = visualRowIndex;
                visualRowIndex += 1;
              const roleDisplay = getStaffRoleDisplay(role, crewPositionTerminology, instructorLabel);
              const nameTextClass = useRoleColors ? roleDisplay.textClassName : useUnitColors ? getUnitTextColor(personUnit) : 'text-gray-300';
              return (
              <li
                key={`${unit}-${name}`}
                ref={(el) => onRowRef?.(name, el)}
                className={`flex items-center justify-start pl-3 pr-2 py-1 text-xs transition-colors duration-150 border-b border-gray-700/50 bg-gray-800 ${
                  onPersonClick ? 'cursor-pointer hover:bg-gray-700' : ''
                }`}
                style={{ height: rowHeight, minHeight: rowHeight }}
                onMouseEnter={() => onRowEnter?.(rowIndex)}
                onMouseLeave={() => onRowLeave?.()}
                onClick={() => onPersonClick?.(name)}
                title={useRoleColors ? `${name} - ${roleDisplay.label}` : name}
              >
                <span className="font-mono text-gray-500 w-10 text-xs">{rank}</span>
                <span className={`truncate font-medium flex-1 ${nameTextClass}`}>{name}</span>
              </li>
            );
              })}
            </React.Fragment>
          );
        })}
      </ul>
    </div>
  );
};

export default PersonnelColumn;
