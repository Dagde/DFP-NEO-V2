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
    <div className="flex h-fit flex-col overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
      <div className="border-b border-cyan-500/20 bg-cyan-500/10 p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-base font-semibold text-white">{title}</span>
          <span className="rounded bg-slate-950/70 px-2 py-0.5 font-mono text-sm text-cyan-200">
            {filteredTrainees.length}
          </span>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          {courses.map(course => (
            <option key={course} value={course}>
              {course}
            </option>
          ))}
        </select>
      </div>
      <ul className="max-h-60 space-y-2 overflow-y-auto p-3">
        {filteredTrainees.length > 0 ? filteredTrainees.map((trainee, index) => (
          <li key={trainee.idNumber} className="flex items-baseline text-sm text-slate-300">
            <span className="mr-2 w-8 flex-shrink-0 text-right font-mono text-slate-500">{index + 1}.</span>
            <span className="truncate font-semibold text-slate-100">{trainee.name}</span>
          </li>
        )) : <li className="text-center text-sm italic text-slate-500">None</li>}
      </ul>
    </div>
  );
};

export default ListCard;
