#!/usr/bin/env python3

with open('/workspace/DFP-NEO-V2-fresh/components/CourseRosterView.tsx', 'r') as f:
    content = f.read()

# Remove Add Trainee and Delete Trainee from left side
old_left_buttons = '''                        <h1 className="text-2xl font-bold text-white">Trainee Roster</h1>
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
                           <AuditButton pageName="Trainee Roster" />
                    </div>'''

new_left_buttons = '''                        <h1 className="text-2xl font-bold text-white">Trainee Roster</h1>
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
                           <AuditButton pageName="Trainee Roster" />
                    </div>'''

content = content.replace(old_left_buttons, new_left_buttons)

with open('/workspace/DFP-NEO-V2-fresh/components/CourseRosterView.tsx', 'w') as f:
    f.write(content)

print("Moved Add/Delete buttons to right side and updated text colors")