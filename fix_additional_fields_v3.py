#!/usr/bin/env python3

with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'r') as f:
    lines = f.readlines()

additional_fields_start = 1588  # Line with "Additional Fields"
errors_start = 1743  # Line with "Errors comment"

print(f"Additional Fields starts at line {additional_fields_start}")
print(f"Errors section starts at line {errors_start}")

# Create the new Additional Fields section
new_section = '''          {/* Additional Fields */}
          <div className="border-t border-gray-700 pt-4">
            {/* Deployment Checkbox - ALWAYS VISIBLE */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer py-2">
                <input
                  type="checkbox"
                  checked={isDeploy}
                  onChange={e => {
                    const checked = e.target.checked;
                    setIsDeploy(checked);
                    if (checked) {
                      setLocationType('Land Away');
                    }
                  }}
                  className="h-5 w-5 accent-sky-500 bg-gray-600 rounded border-gray-500 focus:ring-sky-500"
                />
                <span className="text-sm text-white">Add Deployment Tile</span>
              </label>
            </div>

            {/* Flight-related fields - HIDDEN when deployment is checked */}
            {!isDeploy && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Flight Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFlightType('Dual')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${
                      flightType === 'Dual'
                        ? 'bg-sky-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Dual
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlightType('Solo')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${
                      flightType === 'Solo'
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Solo
                  </button>
                </div>
              </div>
            </div>
            )}
            
            {/* Deployment Fields (shown when isDeploy is checked) */}
            {isDeploy && (
              <div className="bg-gray-700/50 rounded-lg p-3 mb-4 border border-gray-600">
                <h4 className="text-sm font-semibold text-white mb-3">Deployment Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={deploymentStartDate}
                      onChange={e => setDeploymentStartDate(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm min-w-[140px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Time (24hr)</label>
                    <input
                      type="time"
                      value={deploymentStartTime}
                      onChange={e => setDeploymentStartTime(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm min-w-[140px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={deploymentEndDate}
                      onChange={e => setDeploymentEndDate(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm min-w-[140px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">End Time (24hr)</label>
                    <input
                      type="time"
                      value={deploymentEndTime}
                      onChange={e => setDeploymentEndTime(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm min-w-[140px]"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Aircraft Count</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={deploymentAircraftCount}
                      onChange={e => setDeploymentAircraftCount(parseInt(e.target.value) || 1)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Flight-related fields continued - HIDDEN when deployment is checked */}
            {!isDeploy && (
            <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Location</label>
                <select
                  value={locationType}
                  onChange={e => setLocationType(e.target.value as 'Local' | 'Land Away')}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                  disabled={isDeploy}
                >
                  <option value="Local">Local</option>
                  <option value="Land Away">Land Away</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Date</label>
                <div className="w-full bg-gray-700/50 border border-gray-600 rounded-md py-2 px-3 text-gray-300 text-sm font-mono">
                  {formatDate(date)}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes..."
                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 resize-none"
              />
            </div>
            </>
            )}
          </div>
'''

# Replace the old section with the new one
new_lines = lines[:additional_fields_start]
new_lines.append(new_section)
new_lines.extend(lines[errors_start:])

# Write the file
with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'w') as f:
    f.writelines(new_lines)

print("✅ Successfully replaced Additional Fields section")
