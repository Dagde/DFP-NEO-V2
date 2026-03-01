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

interface LimitingFactorsSectionProps {
  courseAnalysis: CourseAnalysis[];
}

const LimitingFactorsSection: React.FC<LimitingFactorsSectionProps> = ({ courseAnalysis }) => {
  // Aggregate limiting factors across all courses
  const totalLimitingFactors = {
    insufficientInstructors: 0,
    noAircraftSlots: 0,
    noFtdSlots: 0,
    noCptSlots: 0,
    traineeLimit: 0,
    instructorLimit: 0,
    noTimeSlots: 0
  };
  
  courseAnalysis.forEach(course => {
    if (course.limitingFactors) {
      Object.keys(totalLimitingFactors).forEach(key => {
        totalLimitingFactors[key as keyof typeof totalLimitingFactors] += 
          course.limitingFactors[key as keyof typeof course.limitingFactors] || 0;
      });
    }
  });
  
  const hasLimitingFactors = Object.values(totalLimitingFactors).some(v => v > 0);
  
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
      <h2 className="text-xl font-semibold text-sky-400 mb-4">Scheduling Bottlenecks</h2>
      
      {hasLimitingFactors ? (
        <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4">
          <h3 className="text-amber-400 font-semibold mb-3 flex items-center">
            <span className="mr-2">⚠</span> Scheduling Constraints Detected
          </h3>
          <ul className="space-y-2 text-sm">
            {totalLimitingFactors.insufficientInstructors > 0 && (
              <li className="text-gray-300">
                <strong className="text-white">Insufficient Instructors:</strong> {totalLimitingFactors.insufficientInstructors} events could not be scheduled due to lack of available instructors
              </li>
            )}
            {totalLimitingFactors.noAircraftSlots > 0 && (
              <li className="text-gray-300">
                <strong className="text-white">No Aircraft Slots:</strong> {totalLimitingFactors.noAircraftSlots} flight events could not be scheduled due to lack of available aircraft
              </li>
            )}
            {totalLimitingFactors.noFtdSlots > 0 && (
              <li className="text-gray-300">
                <strong className="text-white">No FTD Slots:</strong> {totalLimitingFactors.noFtdSlots} FTD events could not be scheduled due to lack of available simulators
              </li>
            )}
            {totalLimitingFactors.noCptSlots > 0 && (
              <li className="text-gray-300">
                <strong className="text-white">No CPT Slots:</strong> {totalLimitingFactors.noCptSlots} CPT events could not be scheduled due to lack of available simulators
              </li>
            )}
            {totalLimitingFactors.traineeLimit > 0 && (
              <li className="text-gray-300">
                <strong className="text-white">Trainee Daily Limit:</strong> {totalLimitingFactors.traineeLimit} events could not be scheduled because trainees reached their daily event limit
              </li>
            )}
            {totalLimitingFactors.instructorLimit > 0 && (
              <li className="text-gray-300">
                <strong className="text-white">Instructor Daily Limit:</strong> {totalLimitingFactors.instructorLimit} events could not be scheduled because instructors reached their daily event limit
              </li>
            )}
            {totalLimitingFactors.noTimeSlots > 0 && (
              <li className="text-gray-300">
                <strong className="text-white">No Suitable Time Slots:</strong> {totalLimitingFactors.noTimeSlots} events could not be scheduled due to turnaround time conflicts or unavailability
              </li>
            )}
          </ul>
        </div>
      ) : (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
          <h3 className="text-green-400 font-semibold mb-2 flex items-center">
            <span className="mr-2">✓</span> No Scheduling Constraints
          </h3>
          <p className="text-gray-300 text-sm">
            All possible events were successfully scheduled without hitting any resource or personnel limits.
          </p>
        </div>
      )}
    </div>
  );
};

export default LimitingFactorsSection;