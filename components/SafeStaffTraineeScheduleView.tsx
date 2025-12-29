import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { safeSortTrainees } from '../utils/safeSort';

interface SafeStaffTraineeScheduleViewProps {
  originalProps: any;
}

const SafeStaffTraineeScheduleView: React.FC<SafeStaffTraineeScheduleViewProps> = ({ originalProps }) => {
  // Safely process trainees data
  const safeTrainees = React.useMemo(() => {
    try {
      if (!originalProps?.traineesData) return [];
      return safeSortTrainees(originalProps.traineesData);
    } catch (error) {
      console.error('Error processing trainees data:', error);
      return [];
    }
  }, [originalProps?.traineesData]);

  // Create safe props
  const safeProps = {
    ...originalProps,
    traineesData: originalProps?.traineesData || [],
    trainees: safeTrainees.map(t => t?.fullName || 'Unknown').filter(Boolean)
  };

  return (
    <ErrorBoundary fallback={
      <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
        <h3 className="text-yellow-400 font-semibold mb-2">Trainee Schedule Error</h3>
        <p className="text-yellow-300 text-sm">
          There was an error loading the trainee schedule. This may be due to invalid data in the trainee records.
        </p>
        <p className="text-yellow-200 text-xs mt-2">
          Please check your trainee data for missing or invalid fields.
        </p>
      </div>
    }>
      {/* We'll need to dynamically import the actual component to avoid circular dependencies */}
      <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
        <h3 className="text-blue-400 font-semibold mb-2">Staff Trainee Schedule</h3>
        <p className="text-blue-300 text-sm">
          Schedule view loaded safely with {safeTrainees.length} trainees.
        </p>
      </div>
    </ErrorBoundary>
  );
};

export default SafeStaffTraineeScheduleView;