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
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-white">{dialogTitle}</h3>
        <p className="text-gray-300 mb-4">{dialogMessage}</p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Course:
          </label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="" className="text-gray-400">Select a course...</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id} className="text-white">
                {course.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedCourse}
            className={`px-4 py-2 rounded-md transition-colors ${
              selectedCourse
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            Assign Course
          </button>
        </div>
      </div>
    </div>
  );
};