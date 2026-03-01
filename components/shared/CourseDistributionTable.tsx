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
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
      <h2 className="text-xl font-semibold text-sky-400 mb-4">Course Distribution Analysis</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-300 font-semibold">Course</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold">Target %</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold">Actual %</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold">Deviation</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold">Possible</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold">Scheduled</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold">Efficiency</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold">Flight</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold">FTD</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold">CPT</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold">Ground</th>
              <th className="text-center py-3 px-4 text-gray-300 font-semibold">Status</th>
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
                <tr key={index} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 px-4 font-semibold text-white">{course.courseName}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{course.targetPercentage.toFixed(1)}%</td>
                  <td className="py-3 px-4 text-right text-gray-300">{course.actualPercentage.toFixed(1)}%</td>
                  <td className={`py-3 px-4 text-right font-semibold ${deviationColor}`}>
                    {course.deviation > 0 ? '+' : ''}{course.deviation.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-white">{course.possibleEvents || 0}</td>
                  <td className="py-3 px-4 text-right font-semibold text-white">{course.eventCount}</td>
                  <td className={`py-3 px-4 text-right font-semibold ${efficiencyColor}`}>
                    {(course.schedulingEfficiency || 0).toFixed(0)}%
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">{course.eventsByType.flight}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{course.eventsByType.ftd}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{course.eventsByType.cpt}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{course.eventsByType.ground}</td>
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