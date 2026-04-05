# Read the file
with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'r') as f:
    lines = f.readlines()

# Find key line numbers
additional_fields_start = None
deployment_fields_start = None
location_start = None
notes_start = None
notes_end = None

for i, line in enumerate(lines):
    if 'Additional Fields' in line and 'hidden when' in line:
        additional_fields_start = i
    elif 'Deployment Fields' in line and 'shown when' in line:
        deployment_fields_start = i
    elif '<label' in line and 'Location' in line and 'uppercase tracking-wider' in line:
        location_start = i
    elif '<label' in line and 'Notes' in line and 'uppercase tracking-wider' in line:
        notes_start = i
    elif '</textarea>' in line and i > (notes_start or 0):
        notes_end = i
        break

print(f"Additional Fields start: {additional_fields_start}")
print(f"Deployment Fields start: {deployment_fields_start}")
print(f"Location start: {location_start}")
print(f"Notes start: {notes_start}")
print(f"Notes end: {notes_end}")

if all(v is not None for v in [additional_fields_start, deployment_fields_start, location_start, notes_start, notes_end]):
    # Build the new structure
    new_content = lines[:additional_fields_start]
    
    # New Additional Fields section
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
'''
    new_content.extend([new_section])
    
    # Add Flight Type section (from original but only the Flight Type part)
    for i in range(additional_fields_start + 2, deployment_fields_start - 2):
        if 'Options' not in lines[i] and 'checkbox' not in lines[i] and 'Deployment Tile' not in lines[i]:
            if 'Flight Type' in lines[i] or 'Dual' in lines[i] or 'Solo' in lines[i] or 'button' in lines[i] or 'Flex' in lines[i]:
                new_content.append(lines[i])
    
    # Close Flight Type section and Deployment Fields section
    new_close1 = '''            </div>
            </div>
            </>

            {/* Deployment Fields (shown when isDeploy is checked) */}
            {isDeploy && (
'''
    new_content.append(new_close1)
    
    # Add Deployment Fields content
    for i in range(deployment_fields_start, location_start):
        new_content.append(lines[i])
    
    # Close Deployment Fields
    new_close2 = '''            )}
            
            {/* Flight-related fields continued - HIDDEN when deployment is checked */}
            {!isDeploy && (
            <div className="grid grid-cols-2 gap-4">
'''
    new_content.append(new_close2)
    
    # Add Location and Date content
    for i in range(location_start, notes_start):
        new_content.append(lines[i])
    
    # Close grid
    new_close3 = '''            </div>
            
            {/* Notes - HIDDEN when deployment is checked */}
            <div className="mt-3">
'''
    new_content.append(new_close3)
    
    # Add Notes content
    for i in range(notes_start, notes_end + 1):
        new_content.append(lines[i])
    
    # Close Notes and the main div
    new_close4 = '''            </div>
            )}
          </div>
'''
    new_content.append(new_close4)
    
    # Add the rest of the file (Errors section, Footer)
    new_content.extend(lines[notes_end + 1:])
    
    # Write the updated file
    with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'w') as f:
        f.writelines(new_content)
    
    print("✅ Successfully rebuilt Deployment section")
else:
    print("❌ Could not find all required line markers")
