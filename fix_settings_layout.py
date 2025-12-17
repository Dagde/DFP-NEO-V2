#!/usr/bin/env python3

with open('components/SettingsView.tsx', 'r') as f:
    content = f.read()

# Find and replace the return statement structure
old_structure = '''    return (
        <>
            <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <header>
                <div className="p-6 space-y-6 max-w-5xl">
                    <h1 className="text-3xl font-bold text-white">Settings</h1>
                    <p className="text-lg text-gray-400">Application configuration and data management.</p>'''

new_structure = '''    return (
        <>
            <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-6 max-w-5xl">
                  <header className="flex justify-between items-start mb-6">
                      <div>
                          <h2 className="text-2xl font-bold text-white mb-2">
                              {activeSection === 'scoring-matrix' && 'Scoring Matrix'}
                              {activeSection === 'location' && 'Location'}
                              {activeSection === 'units' && 'Units'}
                              {activeSection === 'sct-events' && 'SCT Events'}
                              {activeSection === 'currencies' && 'Currencies'}
                              {activeSection === 'data-loaders' && 'Data Loaders'}
                              {activeSection === 'event-limits' && 'Event Limits'}
                              {activeSection === 'permissions' && 'Permissions Manager'}
                          </h2>'''

content = content.replace(old_structure, new_structure)

# Fix the closing of the permission warning and header
old_header_close = '''                       )}
                       <div className="flex justify-end mt-2"><AuditButton pageName="Settings" /></div>
                </header>'''

new_header_close = '''                       )}
                      </div>
                      <AuditButton pageName="Settings" />
                  </header>'''

content = content.replace(old_header_close, new_header_close)

# Remove duplicate h2 headers inside each section
content = content.replace('<div className="p-4 flex justify-between items-center border-b border-gray-700">\n                               <h2 className="text-lg font-semibold text-gray-200">Scoring Matrix</h2>\n                           </div>\n                           <div className="p-4 grid grid-cols-2 gap-3">', '<div className="grid grid-cols-2 gap-4">')

with open('components/SettingsView.tsx', 'w') as f:
    f.write(content)

print("Layout fixed successfully")