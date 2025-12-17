import React from 'react';
import { InstructorRank } from '../types';

interface Personnel {
  name: string;
  rank: InstructorRank;
}

interface PersonnelColumnProps {
  personnel: Personnel[];
  rowHeight: number;
  onRowEnter?: (index: number) => void;
  onRowLeave?: () => void;
  onPersonClick?: (personName: string) => void;
  onRowRef?: (name: string, element: HTMLLIElement | null) => void;
}

const PersonnelColumn: React.FC<PersonnelColumnProps> = ({ personnel, rowHeight, onRowEnter, onRowLeave, onPersonClick, onRowRef }) => {
  return (
    <div className="w-40 bg-gray-800 flex-shrink-0 h-full">
      <ul>
        {personnel.map(({ name, rank }, index) => (
          <li
            key={name}
            ref={(el) => onRowRef?.(name, el)}
            className={`flex items-center justify-start pl-3 text-xs transition-colors duration-150 text-gray-300 border-b border-gray-700/50 ${onPersonClick ? 'cursor-pointer hover:bg-gray-700' : ''}`}
            style={{ height: rowHeight }}
            onMouseEnter={() => onRowEnter?.(index)}
            onMouseLeave={() => onRowLeave?.()}
            onClick={() => onPersonClick?.(name)}
          >
            <span className="font-mono text-gray-500 w-12 flex-shrink-0">{rank}</span>
            <span className="truncate font-medium">{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PersonnelColumn;