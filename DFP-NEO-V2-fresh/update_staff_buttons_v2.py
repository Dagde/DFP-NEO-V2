#!/usr/bin/env python3
import re

# Read the file
with open('components/InstructorListView.tsx', 'r') as f:
    content = f.read()

# Find and replace the entire button section
old_button_section = '''              <div className="flex items-center space-x-3">
                {isArchiveMode && <span className="text-red-400 font-bold text-sm animate-pulse">ARCHIVE MODE ACTIVE</span>}
                 <button
                    onClick={handleShowAddChoice}
                    className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold shadow-md flex items-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Staff
                </button>
                <button
                    onClick={toggleArchiveMode}
                    className={`px-4 py-2 rounded-md transition-colors text-sm font-semibold shadow-md flex items-center ${isArchiveMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                        <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    {isArchiveMode ? 'Done' : 'Archive'}
                </button>
                <button
                    onClick={() => setShowArchivedFlyout(true)}
                    className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 hover:text-white transition-colors text-sm font-semibold shadow-md"
                >
                    View Archived
                </button>
                   <AuditButton pageName="Staff" />'''

new_button_section = '''              <div className="flex items-center gap-[1px]">
                {isArchiveMode && <span className="text-red-400 font-bold text-sm animate-pulse">ARCHIVE MODE ACTIVE</span>}
                <button
                    onClick={handleAddIndividual}
                    className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-green-500"
                >
                    Add Staff
                </button>
                <button
                    onClick={toggleArchiveMode}
                    className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed"
                >
                    {isArchiveMode ? 'Done' : 'Archive Staff'}
                </button>
                <button
                    onClick={() => setShowArchivedFlyout(true)}
                    className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed"
                >
                    View Archived
                </button>
                <div className="w-[6px]"></div>
                <AuditButton pageName="Staff" />'''

content = content.replace(old_button_section, new_button_section)

# Write the file
with open('components/InstructorListView.tsx', 'w') as f:
    f.write(content)

print('✓ Updated Staff page buttons:')
print('  - Add Staff: 56x41px, 10px text, green, no icon')
print('  - Archive Staff: 56x41px, 10px text, no icon, renamed to "Archive Staff"')
print('  - View Archived: 56x41px, 10px text')
print('  - Order: Add Staff, Archive Staff, View Archived, Audit')
print('  - Gaps: 1px between buttons, 6px before Audit')
print('  - Style: btn-aluminium-brushed (matching left menu)')