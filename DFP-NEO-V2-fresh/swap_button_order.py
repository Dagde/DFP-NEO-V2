#!/usr/bin/env python3
import re

# Read the file
with open('components/CourseRosterView.tsx', 'r') as f:
    content = f.read()

# Current order: Add Trainee, Delete Trainee, Active Courses, Archived Courses, [gap], Audit Button
# Desired order: Active Courses, Archived Courses, Add Trainee, Delete Trainee, [gap], Audit Button

old_order = '''                        <button
                            onClick={handleAddTraineeClick}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-green-500"
                        >
                            Add Trainee
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirmation(true)}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-red-500"
                        >
                            Delete Trainee
                        </button>
                        <ViewToggleButton label="Active Courses" value="active" />
                        <ViewToggleButton label="Archived Courses" value="archived" />
                        <div className="w-[5px]"></div>
                        <AuditButton pageName="Trainee Roster" />'''

new_order = '''                        <ViewToggleButton label="Active Courses" value="active" />
                        <ViewToggleButton label="Archived Courses" value="archived" />
                        <button
                            onClick={handleAddTraineeClick}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-green-500"
                        >
                            Add Trainee
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirmation(true)}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-red-500"
                        >
                            Delete Trainee
                        </button>
                        <div className="w-[5px]"></div>
                        <AuditButton pageName="Trainee Roster" />'''

content = content.replace(old_order, new_order)

# Write the file
with open('components/CourseRosterView.tsx', 'w') as f:
    f.write(content)

print('✓ Swapped button order: Active Courses, Archived Courses, Add Trainee, Delete Trainee')