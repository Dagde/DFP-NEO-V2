import React, { useState } from 'react';

interface Course {
  id: string;
  name: string;
}

interface CourseSelectionDialogProps {
  isOpen: boolean;
  courses: Course[];
  onSelect: (courseId: string) => void;
  onCancel: () => void;
  mode: 'bulk' | 'minor';
}

export const CourseSelectionDialog: React.FC<CourseSelectionDialogProps> = ({
  isOpen,
  courses,
  onSelect,
  onCancel,
  mode
}) => {
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (selectedCourse) {
      onSelect(selectedCourse);
    }
  };

  const dialogTitle = mode === 'bulk' 
    ? 'Select Course for Bulk Update' 
    : 'Select Course for Minor Update';

  const dialogMessage = mode === 'bulk'
    ? 'Please select the course to assign to all trainees in this bulk upload:'
    : 'Please select the course to assign to updated trainees:';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">{dialogTitle}</h3>
        <p className="text-gray-600 mb-4">{dialogMessage}</p>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Course:
          </label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a course...</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedCourse}
            className={`px-4 py-2 rounded-md transition-colors ${
              selectedCourse
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Assign Course
          </button>
        </div>
      </div>
    </div>
  );
};