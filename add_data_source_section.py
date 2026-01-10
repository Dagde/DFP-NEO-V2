# Read the file
with open('/workspace/components/SettingsView.tsx', 'r') as f:
    lines = f.readlines()

# Find the line before the closing of the permissions section and insert data-source section
data_source_section = '''
                      {/* Data Source Settings */}
                      {activeSection === 'data-source' && (
                          <div className="space-y-6">
                              {/* Error Tracking Log */}
                              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                                  <h3 className="text-lg font-semibold text-white mb-3">Data Source Configuration</h3>
                                  <p className="text-sm text-gray-400 mb-4">
                                      Configure which data sources to use for different data types. 
                                      Toggle switches to enable/disable database sources.
                                  </p>
                                  
                                  {/* Staff Toggle */}
                                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
                                      <div>
                                          <h4 className="text-white font-medium">Staff Data Source</h4>
                                          <p className="text-sm text-gray-400">Use database for instructors and staff</p>
                                      </div>
                                      <button
                                          onClick={() => {
                                              try {
                                                  console.log('[Data Source] Toggling staff data source');
                                                  const newValue = !localStorage.getItem('dataSource_staff');
                                                  localStorage.setItem('dataSource_staff', newValue ? 'true' : 'false');
                                                  console.log('[Data Source] Staff data source set to:', newValue);
                                                  onShowSuccess(`Staff data source ${newValue ? 'enabled' : 'disabled'}`);
                                                  // Force re-render
                                                  window.dispatchEvent(new Event('storage'));
                                              } catch (error) {
                                                  console.error('[Data Source ERROR] Failed to toggle staff data source:', error);
                                                  alert('Failed to update staff data source: ' + error.message);
                                              }
                                          }}
                                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                                              localStorage.getItem('dataSource_staff') === 'true' ? 'bg-green-600' : 'bg-gray-600'
                                          }`}
                                      >
                                          <span
                                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                  localStorage.getItem('dataSource_staff') === 'true' ? 'translate-x-6' : 'translate-x-1'
                                              }`}
                                          />
                                      </button>
                                  </div>

                                  {/* Trainees Toggle */}
                                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
                                      <div>
                                          <h4 className="text-white font-medium">Trainees Data Source</h4>
                                          <p className="text-sm text-gray-400">Use database for trainees and students</p>
                                      </div>
                                      <button
                                          onClick={() => {
                                              try {
                                                  console.log('[Data Source] Toggling trainees data source');
                                                  const newValue = !localStorage.getItem('dataSource_trainees');
                                                  localStorage.setItem('dataSource_trainees', newValue ? 'true' : 'false');
                                                  console.log('[Data Source] Trainees data source set to:', newValue);
                                                  onShowSuccess(`Trainees data source ${newValue ? 'enabled' : 'disabled'}`);
                                                  // Force re-render
                                                  window.dispatchEvent(new Event('storage'));
                                              } catch (error) {
                                                  console.error('[Data Source ERROR] Failed to toggle trainees data source:', error);
                                                  alert('Failed to update trainees data source: ' + error.message);
                                              }
                                          }}
                                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                                              localStorage.getItem('dataSource_trainees') === 'true' ? 'bg-green-600' : 'bg-gray-600'
                                          }`}
                                      >
                                          <span
                                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                  localStorage.getItem('dataSource_trainees') === 'true' ? 'translate-x-6' : 'translate-x-1'
                                              }`}
                                          />
                                      </button>
                                  </div>

                                  {/* Courses Toggle */}
                                  <div className="flex justify-between items-center">
                                      <div>
                                          <h4 className="text-white font-medium">Courses Data Source</h4>
                                          <p className="text-sm text-gray-400">Use database for courses and syllabi</p>
                                      </div>
                                      <button
                                          onClick={() => {
                                              try {
                                                  console.log('[Data Source] Toggling courses data source');
                                                  const newValue = !localStorage.getItem('dataSource_courses');
                                                  localStorage.setItem('dataSource_courses', newValue ? 'true' : 'false');
                                                  console.log('[Data Source] Courses data source set to:', newValue);
                                                  onShowSuccess(`Courses data source ${newValue ? 'enabled' : 'disabled'}`);
                                                  // Force re-render
                                                  window.dispatchEvent(new Event('storage'));
                                              } catch (error) {
                                                  console.error('[Data Source ERROR] Failed to toggle courses data source:', error);
                                                  alert('Failed to update courses data source: ' + error.message);
                                              }
                                          }}
                                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                                              localStorage.getItem('dataSource_courses') === 'true' ? 'bg-green-600' : 'bg-gray-600'
                                          }`}
                                      >
                                          <span
                                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                  localStorage.getItem('dataSource_courses') === 'true' ? 'translate-x-6' : 'translate-x-1'
                                              }`}
                                          />
                                      </button>
                                  </div>

                                  {/* Current State Display */}
                                  <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
                                      <h5 className="text-sm font-semibold text-gray-300 mb-3">Current Configuration</h5>
                                      <div className="space-y-2 text-sm">
                                          <div className="flex justify-between">
                                              <span className="text-gray-400">Staff:</span>
                                              <span className={localStorage.getItem('dataSource_staff') === 'true' ? 'text-green-400' : 'text-gray-500'}>
                                                  {localStorage.getItem('dataSource_staff') === 'true' ? 'Database (Enabled)' : 'Mock (Disabled)'}
                                              </span>
                                          </div>
                                          <div className="flex justify-between">
                                              <span className="text-gray-400">Trainees:</span>
                                              <span className={localStorage.getItem('dataSource_trainees') === 'true' ? 'text-green-400' : 'text-gray-500'}>
                                                  {localStorage.getItem('dataSource_trainees') === 'true' ? 'Database (Enabled)' : 'Mock (Disabled)'}
                                              </span>
                                          </div>
                                          <div className="flex justify-between">
                                              <span className="text-gray-400">Courses:</span>
                                              <span className={localStorage.getItem('dataSource_courses') === 'true' ? 'text-green-400' : 'text-gray-500'}>
                                                  {localStorage.getItem('dataSource_courses') === 'true' ? 'Database (Enabled)' : 'Mock (Disabled)'}
                                              </span>
                                          </div>
                                      </div>
                                  </div>

                                  {/* Reset Button */}
                                  <div className="mt-6">
                                      <button
                                          onClick={() => {
                                              try {
                                                  console.log('[Data Source] Resetting all data sources to database');
                                                  localStorage.setItem('dataSource_staff', 'true');
                                                  localStorage.setItem('dataSource_trainees', 'true');
                                                  localStorage.setItem('dataSource_courses', 'true');
                                                  console.log('[Data Source] All data sources reset to database');
                                                  onShowSuccess('All data sources reset to database');
                                                  // Force re-render
                                                  window.dispatchEvent(new Event('storage'));
                                              } catch (error) {
                                                  console.error('[Data Source ERROR] Failed to reset data sources:', error);
                                                  alert('Failed to reset data sources: ' + error.message);
                                              }
                                          }}
                                          className="w-full px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors font-medium"
                                      >
                                          Reset All to Database
                                      </button>
                                  </div>

                                  {/* Debug Info */}
                                  <div className="mt-6 p-4 bg-yellow-900/20 rounded-lg border border-yellow-600/30">
                                      <h5 className="text-sm font-semibold text-yellow-400 mb-2">Debug Information</h5>
                                      <div className="text-xs text-yellow-200/80 space-y-1 font-mono">
                                          <div>Active Section: {activeSection || 'N/A'}</div>
                                          <div>LocalStorage Available: {typeof localStorage !== 'undefined' ? 'Yes' : 'No'}</div>
                                          <div>Staff Value: {localStorage.getItem('dataSource_staff') || 'null'}</div>
                                          <div>Trainees Value: {localStorage.getItem('dataSource_trainees') || 'null'}</div>
                                          <div>Courses Value: {localStorage.getItem('dataSource_courses') || 'null'}</div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}
'''

# Find the line before the closing of the permissions section
for i, line in enumerate(lines):
    if ")}" in line and i > 10:
        # Look for the closing of permissions section
        if i > 0 and "PermissionsManagerWindow" in lines[i-20:i]:
            # Insert data-source section after the closing parentheses
            lines.insert(i + 1, data_source_section)
            print(f"Inserted data-source section at line {i + 2}")
            break

# Write the file back
with open('/workspace/components/SettingsView.tsx', 'w') as f:
    f.writelines(lines)

print("Data Source section added successfully!")