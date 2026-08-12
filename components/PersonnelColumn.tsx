import React from 'react';
import { InstructorRank } from '../types';
import { type CrewPositionTerminology } from '../utils/crewPositionTerminology';
import { getStaffRoleDisplay } from '../utils/staffRoleColours';
import { buildCompactPersonNameResolver, getPersonIdentityDedupeKey } from '../utils/personIdentity';

interface Personnel {
  id?: string;
  idNumber?: number;
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
  simIpDisplayLabel?: string;
}

const unitPalette = [
  { text: 'text-blue-300', header: 'bg-blue-500/20 border-blue-500/50 text-blue-300' },
  { text: 'text-emerald-300', header: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' },
  { text: 'text-violet-300', header: 'bg-violet-500/20 border-violet-500/50 text-violet-300' },
  { text: 'text-amber-300', header: 'bg-amber-500/20 border-amber-500/50 text-amber-300' },
  { text: 'text-cyan-300', header: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' },
  { text: 'text-rose-300', header: 'bg-rose-500/20 border-rose-500/50 text-rose-300' },
  { text: 'text-lime-300', header: 'bg-lime-500/20 border-lime-500/50 text-lime-300' },
  { text: 'text-orange-300', header: 'bg-orange-500/20 border-orange-500/50 text-orange-300' },
];

const getUnitPaletteIndex = (unit?: string): number => {
  const value = String(unit || '').trim();
  if (!value) return -1;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) % unitPalette.length;
  }
  return hash;
};

const getUnitTextColor = (unit?: string): string => {
  const index = getUnitPaletteIndex(unit);
  return index >= 0 ? unitPalette[index].text : 'text-gray-300';
};

const getUnitColor = (unit?: string): string => {
  const index = getUnitPaletteIndex(unit);
  return index >= 0 ? unitPalette[index].header : 'bg-gray-600/20 border-gray-500/50 text-gray-300';
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
  instructorLabel = 'Instructor',
  simIpDisplayLabel = 'Contractor Staff',
}) => {
  const staffNameResolver = React.useMemo(
    () => buildCompactPersonNameResolver(personnel as any),
    [personnel],
  );

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
          {personnel.map(({ id, idNumber, name, rank, unit, role }, index) => {
            const roleDisplay = getStaffRoleDisplay(role, crewPositionTerminology, instructorLabel, simIpDisplayLabel);
            const nameTextClass = useRoleColors ? roleDisplay.textClassName : useUnitColors ? getUnitTextColor(unit) : 'text-gray-300';
            const displayName = staffNameResolver.formatList({ id, idNumber, name, rank, unit, role } as any);
            return (
            <li
              key={getPersonIdentityDedupeKey({ id, idNumber, name, rank, unit, role } as any, 'staff')}
              ref={(el) => onRowRef?.(name, el)}
              className={`flex items-center justify-start pl-3 text-xs transition-colors duration-150 border-b border-gray-700/50 ${onPersonClick ? 'cursor-pointer hover:bg-gray-700' : ''}`}
              style={{ height: rowHeight }}
              onMouseEnter={() => onRowEnter?.(index)}
              onMouseLeave={() => onRowLeave?.()}
              onClick={() => onPersonClick?.(name)}
              title={useRoleColors ? `${name} - ${roleDisplay.label}` : name}
            >
              <span className="font-mono text-gray-500 w-12 flex-shrink-0">{rank}</span>
              <span className={`truncate font-medium ${nameTextClass}`}>{displayName}</span>
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
              {people.map(({ id, idNumber, name, rank, unit: personUnit, role }) => {
                const rowIndex = visualRowIndex;
                visualRowIndex += 1;
              const roleDisplay = getStaffRoleDisplay(role, crewPositionTerminology, instructorLabel, simIpDisplayLabel);
              const nameTextClass = useRoleColors ? roleDisplay.textClassName : useUnitColors ? getUnitTextColor(personUnit) : 'text-gray-300';
              const displayName = staffNameResolver.formatList({ id, idNumber, name, rank, unit: personUnit, role } as any);
              return (
              <li
                key={`${unit}-${getPersonIdentityDedupeKey({ id, idNumber, name, rank, unit: personUnit, role } as any, 'staff')}`}
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
                <span className={`truncate font-medium flex-1 ${nameTextClass}`}>{displayName}</span>
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
