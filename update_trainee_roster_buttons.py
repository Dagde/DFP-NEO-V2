#!/usr/bin/env python3

with open('/workspace/DFP-NEO-V2-fresh/components/CourseRosterView.tsx', 'r') as f:
    content = f.read()

# Update Add Trainee button
old_add_trainee = '''<button
                            onClick={handleAddTraineeClick}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-semibold shadow-md flex items-center"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Trainee
                        </button>'''

new_add_trainee = '''<button
                            onClick={handleAddTraineeClick}
                            className="w-[40px] h-[30px] bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-[9px] font-semibold shadow-md flex items-center justify-center"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add
                        </button>'''

content = content.replace(old_add_trainee, new_add_trainee)

# Update Delete Trainee button
old_delete_trainee = '''<button
                            onClick={() => setShowDeleteConfirmation(true)}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-semibold shadow-md flex items-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Trainee
                        </button>'''

new_delete_trainee = '''<button
                            onClick={() => setShowDeleteConfirmation(true)}
                            className="w-[40px] h-[30px] bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-[9px] font-semibold shadow-md flex items-center justify-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                        </button>'''

content = content.replace(old_delete_trainee, new_delete_trainee)

# Update ViewToggleButton component
old_view_toggle = '''    const ViewToggleButton: React.FC<{ label: string; value: 'active' | 'archived' }> = ({ label, value }) => (
        <button
            onClick={() => setView(value)}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${view === value ? 'bg-sky-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
        >
            {label}
        </button>
    );'''

new_view_toggle = '''    const ViewToggleButton: React.FC<{ label: string; value: 'active' | 'archived' }> = ({ label, value }) => (
        <button
            onClick={() => setView(value)}
            className={`w-[40px] h-[30px] text-[9px] font-semibold rounded-md transition-colors flex items-center justify-center ${view === value ? 'bg-sky-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
        >
            {label}
        </button>
    );'''

content = content.replace(old_view_toggle, new_view_toggle)

with open('/workspace/DFP-NEO-V2-fresh/components/CourseRosterView.tsx', 'w') as f:
    f.write(content)

print("Updated Trainee Roster buttons")