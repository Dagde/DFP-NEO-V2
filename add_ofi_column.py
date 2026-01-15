#!/usr/bin/env python3
import re

# Read the file
with open('/workspace/components/InstructorListView.tsx', 'r') as f:
    content = f.read()

# Find the SIM IPs section and add OFI column after it
ofi_column = '''
                       {/* OFIs */}
                       <div className="bg-gray-800 border border-purple-900/50 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
                           <div className="p-3 border-b border-purple-900/50 bg-gray-800/80 flex justify-between items-center sticky top-0 z-10 rounded-t-lg backdrop-blur-sm">
                               <h3 className="text-lg font-bold text-purple-400">OFIs</h3>
                                <span className="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{ofis.length}</span>
                           </div>
                            <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                                {renderInstructorList(ofis)}
                           </div>
                       </div>'''

# Pattern to find the end of SIM IPs div and insert OFI column before the closing grid div
pattern = r'(/\* SIM IPs \*/.*?</div>\n                    </div>)'

replacement = r'\1\n' + ofi_column

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Write back
with open('/workspace/components/InstructorListView.tsx', 'w') as f:
    f.write(content)

print("✅ OFI column added successfully")