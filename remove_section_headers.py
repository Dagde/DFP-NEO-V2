#!/usr/bin/env python3
import re

with open('components/SettingsView.tsx', 'r') as f:
    content = f.read()

# Remove Location section header but keep the edit buttons
location_old = '''                       {/* Location Window */}
                       <div className={`bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6 ${activeSection !== 'location' ? 'hidden' : ''}`}>
                           <div className="p-4 flex justify-between items-center border-b border-gray-700">
                               <h2 className="text-lg font-semibold text-gray-200">Location</h2>
                               {isEditingLocations ? (
                                   <div className="flex space-x-2">
                                       <button onClick={handleSaveLocations} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">Save</button>
                                       <button onClick={handleCancelLocations} className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-semibold">Cancel</button>
                                   </div>
                               ) : (
                                   <button 
                                      onClick={handleEditLocations} 
                                      disabled={!canEditSettings}
                                      className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                          canEditSettings 
                                              ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer' 
                                              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                      }`}
                                  >
                                      Edit
                                  </button>
                               )}
                           </div>
                           <div className="p-4 space-y-4">'''

location_new = '''                       {/* Location Window */}
                       <div className={`bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6 ${activeSection !== 'location' ? 'hidden' : ''}`}>
                           <div className="flex justify-between items-center mb-4">
                               {isEditingLocations ? (
                                   <div className="flex space-x-2">
                                       <button onClick={handleSaveLocations} className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold">Save</button>
                                       <button onClick={handleCancelLocations} className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-semibold">Cancel</button>
                                   </div>
                               ) : (
                                   <button 
                                      onClick={handleEditLocations} 
                                      disabled={!canEditSettings}
                                      className={`px-3 py-1 rounded-md text-xs font-semibold ${
                                          canEditSettings 
                                              ? 'bg-gray-600 text-white hover:bg-gray-700 cursor-pointer' 
                                              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                      }`}
                                  >
                                      Edit
                                  </button>
                               )}
                           </div>
                           <div className="space-y-4">'''

content = content.replace(location_old, location_new)

with open('components/SettingsView.tsx', 'w') as f:
    f.write(content)

print("Location section header removed")