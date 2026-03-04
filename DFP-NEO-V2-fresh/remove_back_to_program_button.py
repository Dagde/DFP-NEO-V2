#!/usr/bin/env python3
import re

# Read the file
with open('components/InstructorListView.tsx', 'r') as f:
    content = f.read()

# Remove the divider and Back to Program button
old_content = '''                <div className="w-[6px]"></div>
                <AuditButton pageName="Staff" />
                <div className="w-px h-8 bg-gray-600 mx-2"></div>
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md"
                >
                    Back to Program
                </button>
              </div>'''

new_content = '''                <div className="w-[6px]"></div>
                <AuditButton pageName="Staff" />
              </div>'''

content = content.replace(old_content, new_content)

# Write the file
with open('components/InstructorListView.tsx', 'w') as f:
    f.write(content)

print('✓ Removed Back to Program button from Staff page')