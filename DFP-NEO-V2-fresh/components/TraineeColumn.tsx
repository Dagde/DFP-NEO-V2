import React from 'react';

interface TraineeColumnProps {
  trainees: string[];
  rowHeight: number;
  onRowEnter?: (index: number) => void;
  onRowLeave?: () => void;
  onTraineeClick?: (traineeFullName: string) => void;
  onRowRef?: (fullName: string, element: HTMLLIElement | null) => void;
  courseColors?: { [key: string]: string };
}

const TraineeColumn: React.FC<TraineeColumnProps> = ({ trainees, rowHeight, onRowEnter, onRowLeave, onTraineeClick, onRowRef, courseColors = {} }) => {

  const parseTraineeName = (fullName: string) => {
    const parts = fullName.split(' – ');
    return {
      name: parts[0] || fullName,
      course: parts[1] || '',
    };
  };

  const convertTailwindToHex = (tailwindClass: string) => {
    const colorMap: { [key: string]: string } = {
      'bg-sky-400/50': '#38BDF8',
      'bg-purple-400/50': '#C084FC',
      'bg-yellow-400/50': '#FACC15',
      'bg-pink-400/50': '#F472B6',
      'bg-teal-400/50': '#2DD4BF',
      'bg-indigo-400/50': '#818CF8',
      'bg-cyan-400/50': '#22D3EE',
      'bg-blue-400/50': '#60A5FA',
      'bg-green-400/50': '#4ADE80',
      'bg-orange-400/50': '#FB923C',
      'bg-red-400/50': '#F87171',
      'bg-gray-400/50': '#9CA3AF',
    };
    return colorMap[tailwindClass] || '#9CA3AF';
  };

  return (
    <div className="w-40 bg-gray-800 flex-shrink-0 h-full">
      <ul>
        {trainees.map((fullName, index) => {
          const { name, course } = parseTraineeName(fullName);
          
          return (
              <li
                ref={(el) => onRowRef?.(fullName, el)}
                className={`flex items-center justify-start pl-3 text-xs transition-colors duration-150 text-gray-300 border-b border-gray-700/50 ${onTraineeClick ? 'cursor-pointer hover:bg-gray-700' : ''}`}
                style={{ height: rowHeight }}
                onMouseEnter={() => onRowEnter?.(index)}
                onMouseLeave={() => onRowLeave?.()}
                onClick={() => onTraineeClick?.(fullName)}
              >
                <div className="flex flex-col">
                  <span className="truncate font-medium leading-tight">{name}</span>
                  {course && <span className="font-mono leading-tight" style={{ color: convertTailwindToHex(courseColors[course] || 'bg-gray-400/50') }}>{course}</span>}
                </div>
              </li>
            );
        })}
      </ul>
    </div>
  );
};

export default TraineeColumn;