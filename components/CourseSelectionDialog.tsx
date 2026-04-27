import React from 'react';

interface CourseSelectionDialogProps {
  isOpen: boolean;
  courses: string[];
  onSelect: (course: string) => void;
  onCancel: () => void;
}

const CourseSelectionDialog: React.FC<CourseSelectionDialogProps> = ({
  isOpen,
  courses,
  onSelect,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-white mb-4">Select Course</h2>
        <p className="text-gray-300 mb-6">
          Please select a course for the uploaded trainees:
        </p>
        <div className="space-y-2">
          {courses.map(course => (
            <button
              key={course}
              onClick={() => onSelect(course)}
              className="w-full text-left px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              {course}
            </button>
          ))}
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export { CourseSelectionDialog };