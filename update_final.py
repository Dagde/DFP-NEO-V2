#!/usr/bin/env python3
with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'r') as f:
    lines = f.readlines()

# Find key markers
additional_fields_line = 1588
deployment_fields_line = 1640
location_line = 1698
notes_line = 1717
notes_close_line = 1722

print("Rebuilding deployment section...")

# Create new content
new_lines = lines[:additional_fields_line]

# New Additional Fields structure
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
            <>
            {/* Flight Type Toggle */}
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
            </>

            {/* Deployment Fields (shown when isDeploy is checked) */}
            {isDeploy && (
'''
new_lines.extend([new_section])

# Add Deployment Fields content
new_lines.extend(lines[deployment_fields_line:location_line])

# Close Deployment section
new_lines.append('''            )}\n''')

# Add flight fields (Location, Date)
new_lines.append('''{/* Flight-related fields continued - HIDDEN when deployment is checked */}\n''')
new_lines.append('''{!isDeploy && (\n''')
new_lines.append('''<div className="grid grid-cols-2 gap-4">\n''')
new_lines.extend(lines[location_line:notes_line])

# Close Location grid
new_lines.append('''</div>\n''')

# Add Notes
new_lines.append('''{/* Notes - HIDDEN when deployment is checked */}\n''')
new_lines.append('''<div className="mt-3">\n''')
new_lines.extend(lines[notes_line:notes_close_line+1])

# Close Notes and all conditionals
new_lines.append('''</div>\n''')
new_lines.append('''</div>\n''')
new_lines.append('''</div>\n''')  # close {!isDeploy && (
new_lines.append('''</div>\n''')  # close Additional Fields

# Add Errors and Footer
new_lines.extend(lines[notes_close_line+1:])

# Write file
with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'w') as f:
    f.writelines(new_lines)

print("✅ Done!")