#!/usr/bin/env python3

with open('/workspace/DFP-NEO-V2-fresh/components/CourseRosterView.tsx', 'r') as f:
    content = f.read()

# Update Add Trainee button to match sidebar style
old_add_trainee = '''<button
                            onClick={handleAddTraineeClick}
                            className="w-[50px] h-[40px] bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-[9px] font-semibold shadow-md flex items-center justify-center"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add
                        </button>'''

new_add_trainee = '''<button
                            onClick={handleAddTraineeClick}
                            className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed"
                        >
                            Add Trainee
                        </button>'''

content = content.replace(old_add_trainee, new_add_trainee)

# Update Delete Trainee button to match sidebar style
old_delete_trainee = '''<button
                            onClick={() => setShowDeleteConfirmation(true)}
                            className="w-[50px] h-[40px] bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-[9px] font-semibold shadow-md flex items-center justify-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                        </button>'''

new_delete_trainee = '''<button
                            onClick={() => setShowDeleteConfirmation(true)}
                            className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed"
                        >
                            Delete Trainee
                        </button>'''

content = content.replace(old_delete_trainee, new_delete_trainee)

# Update ViewToggleButton component to match sidebar style
old_view_toggle = '''    const ViewToggleButton: React.FC<{ label: string; value: 'active' | 'archived' }> = ({ label, value }) => (
        <button
            onClick={() => setView(value)}
            className={`w-[50px] h-[40px] text-[9px] font-semibold rounded-md transition-colors flex items-center justify-center ${view === value ? 'bg-sky-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
        >
            {label}
        </button>
    );'''

new_view_toggle = '''    const ViewToggleButton: React.FC<{ label: string; value: 'active' | 'archived' }> = ({ label, value }) => (
        <button
            onClick={() => setView(value)}
            className={`w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed ${view === value ? 'active' : ''}`}
        >
            {label}
        </button>
    );'''

content = content.replace(old_view_toggle, new_view_toggle)

with open('/workspace/DFP-NEO-V2-fresh/components/CourseRosterView.tsx', 'w') as f:
    f.write(content)

print("Updated Trainee Roster buttons to match sidebar style (75px x 55px)")