import React from 'react';
import { buildCompactPersonNameResolver, getPersonIdentityDedupeKey } from '../utils/personIdentity';

interface TraineeData {
  id?: string;
  idNumber?: number;
  fullName: string;
  name: string;
  rank?: string;
  unit?: string;
  course?: string;
}

interface TraineeColumnProps {
  trainees: string[];
  rowHeight: number;
  onRowEnter?: (index: number) => void;
  onRowLeave?: () => void;
  onTraineeClick?: (traineeFullName: string) => void;
  onRowRef?: (fullName: string, element: HTMLLIElement | null) => void;
  courseColors?: { [key: string]: string };
  traineesData?: TraineeData[];
}

const TraineeColumn: React.FC<TraineeColumnProps> = ({ trainees, rowHeight, onRowEnter, onRowLeave, onTraineeClick, onRowRef, courseColors = {}, traineesData = [] }) => {
  const traineeNameResolver = React.useMemo(
    () => buildCompactPersonNameResolver(traineesData as any),
    [traineesData],
  );

  const parseTraineeName = (fullName: string) => {
    const parts = fullName.split(' – ');
    return {
      name: parts[0] || fullName,
      course: parts[1] || '',
    };
  };

  // Look up course from traineesData when it's not embedded in fullName
  const getCourse = (fullName: string, parsedCourse: string): string => {
    if (parsedCourse) return parsedCourse;
    // Look up by fullName match first, then by name match
    const traineeObj = traineesData.find(
      t => t.fullName === fullName || t.name === fullName
    );
    return traineeObj?.course || '';
  };

  const getTraineeRecord = (fullName: string, parsedName: string): TraineeData | undefined => (
    traineesData.find(t => t.fullName === fullName || t.name === fullName || t.name === parsedName || t.fullName === parsedName)
  );

  // Base color map — keyed by Tailwind color name only (no opacity suffix)
  // This handles both /50 and /80 variants used in the app
  const BASE_COLOR_MAP: { [key: string]: string } = {
    'bg-sky-400':     '#38BDF8',
    'bg-purple-400':  '#C084FC',
    'bg-yellow-400':  '#FACC15',
    'bg-pink-400':    '#F472B6',
    'bg-teal-400':    '#2DD4BF',
    'bg-indigo-400':  '#818CF8',
    'bg-cyan-400':    '#22D3EE',
    'bg-blue-400':    '#60A5FA',
    'bg-green-400':   '#4ADE80',
    'bg-orange-400':  '#FB923C',
    'bg-red-400':     '#F87171',
    'bg-gray-400':    '#9CA3AF',
    'bg-amber-500':   '#F59E0B',
    'bg-fuchsia-400': '#E879F9',
    'bg-gray-500':    '#6B7280',
    'bg-sky-500':     '#0EA5E9',
  };

  const convertTailwindToHex = (tailwindClass: string): string => {
    // If it's already a hex or rgb value, return it directly
    if (tailwindClass && (tailwindClass.startsWith('#') || tailwindClass.startsWith('rgb'))) {
      return tailwindClass;
    }

    // Try exact match first
    if (BASE_COLOR_MAP[tailwindClass]) {
      return BASE_COLOR_MAP[tailwindClass];
    }

    // Strip opacity suffix (e.g. "bg-sky-400/80" → "bg-sky-400") and try again
    const withoutOpacity = tailwindClass.replace(/\/\d+$/, '');
    if (BASE_COLOR_MAP[withoutOpacity]) {
      return BASE_COLOR_MAP[withoutOpacity];
    }

    return '#9CA3AF'; // fallback grey
  };

  return (
    <div className="w-40 bg-gray-800 flex-shrink-0 h-full">
      <ul>
        {trainees.map((fullName, index) => {
          const { name, course: parsedCourse } = parseTraineeName(fullName);
          const traineeObj = getTraineeRecord(fullName, name);
          const course = getCourse(fullName, parsedCourse);
          const displayName = traineeObj
            ? traineeNameResolver.formatList(traineeObj as any)
            : name;
          
          return (
              <li
                key={getPersonIdentityDedupeKey((traineeObj || { name: fullName }) as any, 'trainee')}
                ref={(el) => onRowRef?.(fullName, el)}
                className={`flex items-center justify-start pl-3 text-xs transition-colors duration-150 text-gray-300 border-b border-gray-700/50 ${onTraineeClick ? 'cursor-pointer hover:bg-gray-700' : ''}`}
                style={{ height: rowHeight }}
                onMouseEnter={() => onRowEnter?.(index)}
                onMouseLeave={() => onRowLeave?.()}
                onClick={() => onTraineeClick?.(fullName)}
              >
                <div className="flex flex-col">
                  <span className="truncate font-medium leading-tight">{displayName}</span>
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
