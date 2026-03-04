#!/usr/bin/env python3
import re

# Read the file
with open('components/CourseRosterView.tsx', 'r') as f:
    content = f.read()

# Find and replace the header section with buttons on the right side
old_header = '''          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-[1px]">
              <h2 className="text-xl font-bold text-white mr-4">Trainee Roster</h2>
              <button
                onClick={() => setShowAddTraineeModal(true)}
                className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed"
              >
                Add Trainee
              </button>
              <button
                onClick={() => setShowDeleteTraineeModal(true)}
                className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed"
              >
                Delete Trainee
              </button>
            </div>
            <div className="flex gap-[1px]">
              <button
                onClick={() => setActiveTab('active')}
                className={`w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed ${activeTab === 'active' ? 'active' : ''}`}
              >
                Active Courses
              </button>
              <button
                onClick={() => setActiveTab('archived')}
                className={`w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed ${activeTab === 'archived' ? 'active' : ''}`}
              >
                Archived Courses
              </button>
            </div>
          </div>'''

new_header = '''          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Trainee Roster</h2>
            <div className="flex gap-[1px]">
              <button
                onClick={() => setShowAddTraineeModal(true)}
                className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed text-green-500"
              >
                Add Trainee
              </button>
              <button
                onClick={() => setShowDeleteTraineeModal(true)}
                className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed text-red-500"
              >
                Delete Trainee
              </button>
              <button
                onClick={() => setActiveTab('active')}
                className={`w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed ${activeTab === 'active' ? 'active' : ''}`}
              >
                Active Courses
              </button>
              <button
                onClick={() => setActiveTab('archived')}
                className={`w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed ${activeTab === 'archived' ? 'active' : ''}`}
              >
                Archived Courses
              </button>
            </div>
          </div>'''

content = content.replace(old_header, new_header)

# Write the file
with open('components/CourseRosterView.tsx', 'w') as f:
    f.write(content)

print("✓ Updated CourseRosterView.tsx: Moved Add/Delete Trainee buttons to right side with colored text")