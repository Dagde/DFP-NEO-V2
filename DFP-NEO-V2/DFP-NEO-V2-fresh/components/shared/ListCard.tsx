import React, { useState, useMemo } from 'react';
import { Trainee } from '../../types';

interface ListCardProps {
  title: string;
  trainees: Trainee[];
}

const ListCard: React.FC<ListCardProps> = ({ title, trainees }) => {
  const [filter, setFilter] = useState<string>('Total');
  
  // Get unique courses from trainees
  const courses = useMemo(() => {
    const uniqueCourses = new Set(trainees.map(t => t.course));
    return ['Total', ...Array.from(uniqueCourses).sort()];
  }, [trainees]);
  
  // Filter trainees based on selected course
  const filteredTrainees = useMemo(() => {
    if (filter === 'Total') return trainees;
    return trainees.filter(t => t.course === filter);
  }, [trainees, filter]);
  
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 flex flex-col h-fit">
      <div className="p-3 border-b border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <span className="text-base font-semibold text-gray-200">{title}</span>
          <span className="text-sm font-mono text-sky-400 bg-gray-700/50 px-2 py-0.5 rounded">
            {filteredTrainees.length}
          </span>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-2 py-1 text-sm bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          {courses.map(course => (
            <option key={course} value={course}>
              {course}
            </option>
          ))}
        </select>
      </div>
      <ul className="p-3 space-y-2 overflow-y-auto max-h-60">
        {filteredTrainees.length > 0 ? filteredTrainees.map((trainee, index) => (
          <li key={trainee.idNumber} className="flex items-baseline text-sm text-gray-300">
            <span className="font-mono text-gray-500 w-8 text-right mr-2 flex-shrink-0">{index + 1}.</span>
            <span className="font-semibold text-gray-200 truncate">{trainee.name}</span>
          </li>
        )) : <li className="text-sm text-gray-500 italic text-center">None</li>}
      </ul>
    </div>
  );
};

export default ListCard;