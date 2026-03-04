#!/usr/bin/env python3
import re

# Read the file
with open('components/CourseRosterView.tsx', 'r') as f:
    content = f.read()

# Find and replace the header section - Add/Delete buttons currently with title, need to move to right div
old_header = '''                        <h1 className="text-2xl font-bold text-white">Trainee Roster</h1>
                         <button
                            onClick={handleAddTraineeClick}
                            className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed"
                        >
                            Add Trainee
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirmation(true)}
                            className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed"
                        >
                            Delete Trainee
                        </button>
                    </div>
                    <div className="flex items-center gap-[1px]">
                        <ViewToggleButton label="Active Courses" value="active" />
                        <ViewToggleButton label="Archived Courses" value="archived" />
                           <AuditButton pageName="Trainee Roster" />'''

new_header = '''                        <h1 className="text-2xl font-bold text-white">Trainee Roster</h1>
                    </div>
                    <div className="flex items-center gap-[1px]">
                        <button
                            onClick={handleAddTraineeClick}
                            className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed text-green-500"
                        >
                            Add Trainee
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirmation(true)}
                            className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed text-red-500"
                        >
                            Delete Trainee
                        </button>
                        <ViewToggleButton label="Active Courses" value="active" />
                        <ViewToggleButton label="Archived Courses" value="archived" />
                           <AuditButton pageName="Trainee Roster" />'''

content = content.replace(old_header, new_header)

# Write the file
with open('components/CourseRosterView.tsx', 'w') as f:
    f.write(content)

print("✓ Updated CourseRosterView.tsx: Moved Add/Delete Trainee buttons to right side with colored text")