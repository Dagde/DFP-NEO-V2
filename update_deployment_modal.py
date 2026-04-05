#!/usr/bin/env python3
import re

# Read the file
with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'r') as f:
    content = f.read()

# Add deploymentTimeOptions after timeOptions
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
time_options_match = re.search(r'(const timeOptions = useMemo\(\(\) => \{[^}]+\}, \[\]\);)', content)
if time_options_match:
    insert_pos = time_options_match.end()
    content = content[:insert_pos] + deployment_time_options + '\n' + content[insert_pos:]

# Change default deployment times from '' to '08:00'
content = content.replace(
    "const [deploymentStartTime, setDeploymentStartTime] = useState('');",
    "const [deploymentStartTime, setDeploymentStartTime] = useState('08:00');"
)
content = content.replace(
    "const [deploymentEndTime, setDeploymentEndTime] = useState('');",
    "const [deploymentEndTime, setDeploymentEndTime] = useState('08:00');"
)

# Widen the date inputs by adding min-w-[140px] class
content = content.replace(
    """className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm"
                      type="date"
                      value={deploymentStartDate}""",
    """className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm min-w-[140px]"
                      type="date"
                      value={deploymentStartDate}"""
)
content = content.replace(
    """className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm"
                      type="time"
                      value={deploymentStartTime}""",
    """className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm min-w-[140px]"
                      type="time"
                      value={deploymentStartTime}"""
)
content = content.replace(
    """className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm"
                      type="date"
                      value={deploymentEndDate}""",
    """className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm min-w-[140px]"
                      type="date"
                      value={deploymentEndDate}"""
)
content = content.replace(
    """className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm"
                      type="time"
                      value={deploymentEndTime}""",
    """className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm min-w-[140px]"
                      type="time"
                      value={deploymentEndTime}"""
)

# Now the big change: wrap sections that should be hidden when isDeploy is true
# We need to find the Flight Tile section and wrap it

# Find "Flight Tile" label and wrap it
content = content.replace(
    """{/* Flight Tile label + tile */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Flight Tile</label>
            <FlightTilePreview""",
    """{/* Flight Tile label + tile - hidden when deployment is checked */}
          {!isDeploy && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Flight Tile</label>
              <FlightTilePreview"""
)

# Close the FlightTilePreview div wrapper
content = content.replace(
    """onHoveredCourseChange={setHoveredCourse}
            />
          </div>""",
    """onHoveredCourseChange={setHoveredCourse}
            />
            </div>
          )}"""
)

# Wrap Additional Fields section
content = content.replace(
    """{/* Additional Fields */}
          <div className="border-t border-gray-700 pt-4">
            {/* Flight Type Toggle and Deployment Checkbox */}
            <div className="grid grid-cols-2 gap-4 mb-4">""",
    """{/* Additional Fields - hidden when deployment is checked */}
          {!isDeploy && (
          <div className="border-t border-gray-700 pt-4">
            {/* Flight Type Toggle and Deployment Checkbox */}
            <div className="grid grid-cols-2 gap-4 mb-4">"""
)

# Close Additional Fields section - need to find where it ends
# It should end after Notes section, before Errors section
# Let's find the Notes textarea and close after it
content = content.replace(
    """className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 resize-none"
              />
          </div>""",
    """className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 resize-none"
              />
          </div>
          )}"""
)

# But we need to keep the Deployment Checkbox always visible!
# So we need to extract it from the now-hidden section and show it always
# Let's find the deployment checkbox and move it to be always visible
# Actually, let's just wrap everything except the deployment checkbox

# Better approach: only hide what's inside Additional Fields except the Deployment Checkbox
# Let me re-think this...

# Actually, the easiest way is to:
# 1. Keep the Deployment Checkbox always visible (at the top of Additional Fields)
# 2. Hide everything else in Additional Fields when isDeploy is true
# 3. Show Deployment Details section when isDeploy is true

# Let's rewrite this more carefully...

# Write the updated content
with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'w') as f:
    f.write(content)

print("✅ Updated AddFlightTileModal.tsx")