import React from 'react';

interface CourseAnalysis {
  courseName: string;
  targetPercentage: number;
  actualPercentage: number;
  deviation: number;
  eventCount: number;
  possibleEvents: number;
  schedulingEfficiency: number;
  eventsByType: {
    flight: number;
    ftd: number;
    cpt: number;
    ground: number;
  };
  limitingFactors: {
    insufficientInstructors: number;
    noAircraftSlots: number;
    noFtdSlots: number;
    noCptSlots: number;
    traineeLimit: number;
    instructorLimit: number;
    noTimeSlots: number;
  };
  status: 'good' | 'fair' | 'poor';
}

interface CourseDistributionTableProps {
  courseAnalysis: CourseAnalysis[];
}

const CourseDistributionTable: React.FC<CourseDistributionTableProps> = ({ courseAnalysis }) => {
  return (
    <div className="overflow-hidden rounded-lg border border-cyan-500/20 bg-slate-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
      <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-5 py-4">
        <h2 className="text-xl font-semibold text-white">Course Distribution Analysis</h2>
      </div>
      <div className="overflow-x-auto p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-950/60">
              <th className="px-4 py-3 text-left font-semibold text-slate-300">Course</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Target %</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Actual %</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Deviation</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Possible</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Scheduled</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Efficiency</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Flight</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">FTD</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">CPT</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Ground</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-300">Status</th>
            </tr>
          </thead>
          <tbody>
            {courseAnalysis.map((course, index) => {
              const deviationColor = Math.abs(course.deviation) <= 5 ? 'text-green-400' :
                                    Math.abs(course.deviation) <= 10 ? 'text-amber-400' : 'text-red-400';
              
              const efficiencyColor = (course.schedulingEfficiency || 0) >= 80 ? 'text-green-400' :
                                     (course.schedulingEfficiency || 0) >= 60 ? 'text-amber-400' : 'text-red-400';
              
              const statusColor = course.status === 'good' ? 'text-green-400' :
                                course.status === 'fair' ? 'text-amber-400' : 'text-red-400';
              
              const statusIcon = course.status === 'good' ? '✓' :
                               course.status === 'fair' ? '⚠' : '✗';
              
              return (
                <tr key={index} className="border-b border-slate-700/60 hover:bg-cyan-500/5">
                  <td className="py-3 px-4 font-semibold text-white">{course.courseName}</td>
                  <td className="py-3 px-4 text-right text-slate-300">{course.targetPercentage.toFixed(1)}%</td>
                  <td className="py-3 px-4 text-right text-slate-300">{course.actualPercentage.toFixed(1)}%</td>
                  <td className={`py-3 px-4 text-right font-semibold ${deviationColor}`}>
                    {course.deviation > 0 ? '+' : ''}{course.deviation.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-white">{course.possibleEvents || 0}</td>
                  <td className="py-3 px-4 text-right font-semibold text-white">{course.eventCount}</td>
                  <td className={`py-3 px-4 text-right font-semibold ${efficiencyColor}`}>
                    {(course.schedulingEfficiency || 0).toFixed(0)}%
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300">{course.eventsByType.flight}</td>
                  <td className="py-3 px-4 text-right text-slate-300">{course.eventsByType.ftd}</td>
                  <td className="py-3 px-4 text-right text-slate-300">{course.eventsByType.cpt}</td>
                  <td className="py-3 px-4 text-right text-slate-300">{course.eventsByType.ground}</td>
                  <td className={`py-3 px-4 text-center font-semibold ${statusColor}`}>
                    {statusIcon} {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CourseDistributionTable;
