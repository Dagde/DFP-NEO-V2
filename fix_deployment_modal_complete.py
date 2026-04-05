#!/usr/bin/env python3
import re

# Read the file
with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'r') as f:
    content = f.read()

# ============================================================================
# PART 1: Add deploymentTimeOptions
# ============================================================================
deployment_time_options = '''
  // Time options with 30-minute intervals for deployment (0000 to 2330)
  const deploymentTimeOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let h = 0; h <= 23; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hours = String(h).padStart(2, '0');
        const minutes = String(m).padStart(2, '0');
        opts.push({ value: `${hours}:${minutes}`, label: `${hours}:${minutes}` });
      }
    }
    return opts;
  }, []);
'''

# Insert deploymentTimeOptions after timeOptions
pattern = r'(const timeOptions = useMemo\(\(\) => \{[^}]+\}, \[\]\);)'
match = re.search(pattern, content)
if match:
    insert_pos = match.end()
    content = content[:insert_pos] + deployment_time_options + '\n' + content[insert_pos:]
    print("✅ Added deploymentTimeOptions")

# ============================================================================
# PART 2: Change default deployment times
# ============================================================================
content = content.replace(
    "const [deploymentStartTime, setDeploymentStartTime] = useState('');",
    "const [deploymentStartTime, setDeploymentStartTime] = useState('08:00');"
)
content = content.replace(
    "const [deploymentEndTime, setDeploymentEndTime] = useState('');",
    "const [deploymentEndTime, setDeploymentEndTime] = useState('08:00');"
)
print("✅ Changed default deployment times to 08:00")

# ============================================================================
# PART 3: Widen date/time inputs
# ============================================================================
# Replace all four date/time input classes to include min-w-[140px]
content = re.sub(
    r'(type="date"\s+value=\{deploymentStartDate\}[\s\S]*?)className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm"',
    r'\1className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm min-w-[140px]"',
    content
)
content = re.sub(
    r'(type="time"\s+value=\{deploymentStartTime\}[\s\S]*?)className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm"',
    r'\1className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm min-w-[140px]"',
    content
)
content = re.sub(
    r'(type="date"\s+value=\{deploymentEndDate\}[\s\S]*?)className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm"',
    r'\1className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm min-w-[140px]"',
    content
)
content = re.sub(
    r'(type="time"\s+value=\{deploymentEndTime\}[\s\S]*?)className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm"',
    r'\1className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm min-w-[140px]"',
    content
)
print("✅ Widened date/time inputs")

# ============================================================================
# PART 4: Restructure conditional rendering
# ============================================================================

# The current structure has the Deployment Checkbox inside {!isDeploy && (
# We need to move it OUTSIDE and wrap only the flight-related fields

# Find the Additional Fields section and restructure it
old_additional_fields = r'''
          {/* Additional Fields - hidden when deployment is checked */}
          \{!isDeploy && \(
          <div className="border-t border-gray-700 pt-4">
            {/* Flight Type Toggle and Deployment Checkbox */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Flight Type</label>
                <div className="flex gap-2">
'''

new_additional_fields = r'''
          {/* Additional Fields */}
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
            \{!isDeploy && \(
            <>
            {/* Flight Type Toggle */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Flight Type</label>
                <div className="flex gap-2">
'''

content = re.sub(old_additional_fields, new_additional_fields, content)

# Now we need to close the {!isDeploy && ( wrapper at the right place
# Find where the Deployment Fields block starts and wrap everything before it
old_deployment_start = r'''
            {/* Deployment Fields \(shown when isDeploy is checked\) */}
            \{isDeploy && \('''

new_deployment_start = r'''
            </>
            )}

            {/* Deployment Fields (shown when isDeploy is checked) */}
            {isDeploy && ('''

content = re.sub(old_deployment_start, new_deployment_start, content)

# Now close the Deployment Fields and the main Additional Fields div
old_deployment_close = r'''
              </div>
            \)}
            <div className="grid grid-cols-2 gap-4">'''

new_deployment_close = r'''
              </div>
            )}
            
            {/* Flight-related fields continued - HIDDEN when deployment is checked */}
            {!isDeploy && (
            <div className="grid grid-cols-2 gap-4">'''

content = re.sub(old_deployment_close, new_deployment_close, content)

# Close the final wrapping div
# Find the Notes textarea and close after it with )}
old_notes_close = r'''                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 resize-none"
              />
          </div>'''

new_notes_close = r'''                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 resize-none"
              />
            </div>
            )}
          </div>'''

content = re.sub(old_notes_close, new_notes_close, content)

print("✅ Restructured conditional rendering")

# ============================================================================
# Write the updated file
# ============================================================================
with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'w') as f:
    f.write(content)

print("\n✅✅✅ All updates completed successfully!")