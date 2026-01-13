#!/usr/bin/env python3
# Add content sections for staff-mockdata and staff-combined-data

with open('components/SettingsViewWithMenu.tsx', 'r') as f:
    content = f.read()

old_content = """                             {activeSection === 'staff-database' && (
                                 <div className="text-center py-12">
                                     <div className="text-6xl mb-4">👥</div>
                                     <h3 className="text-xl font-bold text-gray-300 mb-2">Staff Database</h3>
                                     <p className="text-gray-400">This section is under construction.</p>
                                 </div>
                             )}"""

new_content = """                             {activeSection === 'staff-database' && (
                                 <div className="text-center py-12">
                                     <div className="text-6xl mb-4">👥</div>
                                     <h3 className="text-xl font-bold text-gray-300 mb-2">Staff Database</h3>
                                     <p className="text-gray-400">This section is under construction.</p>
                                 </div>
                             )}
                             {activeSection === 'staff-mockdata' && (
                                 <div className="text-center py-12">
                                     <div className="text-6xl mb-4">📋</div>
                                     <h3 className="text-xl font-bold text-gray-300 mb-2">Staff MockData</h3>
                                     <p className="text-gray-400">This section is under construction.</p>
                                 </div>
                             )}
                             {activeSection === 'staff-combined-data' && (
                                 <div className="text-center py-12">
                                     <div className="text-6xl mb-4">🔗</div>
                                     <h3 className="text-xl font-bold text-gray-300 mb-2">Staff Combined Data</h3>
                                     <p className="text-gray-400">This section is under construction.</p>
                                 </div>
                             )}"""

content = content.replace(old_content, new_content)
print("Step 4: Content sections added")

with open('components/SettingsViewWithMenu.tsx', 'w') as f:
    f.write(content)