# Read the file
with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'r') as f:
    content = f.read()

changes = 0

# ── 1. Remove console.log calls in handleMouseMove (huge performance killer) ──
replacements = [
    # In handleMouseMove
    ('console.log("handleMouseMove called, draggingState exists:", !!draggingState);', ''),
    ('console.log("Early return: no scheduleGridRef");', ''),
    ('console.log("Early return: Oracle mode with preview event");', ''),
    ('console.log("Early return: selectionStartPoint active (marquee selection)");', ''),
    ('console.log("Early return: no draggingState");', ''),
    ('console.log("Drag calculation - timeShift:", timeShift, "rowShift:", rowShift, "xInGrid:", xInGrid, "yInGrid:", yInGrid);', ''),
    # Conflict check log in drag
    ('console.log("\\ud83d\\udd0d Drag conflict check:", {\n            eventId: mainEvent.id,\n            hasConflict: conflictResult.hasConflict,\n            conflictType: conflictResult.conflictType\n          });', ''),
    # Final drag update logs
    ('console.log("\\ud83d\\udc0d DRAG COMPLETE - Calling onUpdateEvent with", updates.length, "updates:");', ''),
    ('console.log("\\ud83d\\udc0d Updates:", updates);', ''),
    # MouseUp logs
    ('console.log("Local handleMouseUp called - ignoring when dragState exists:", !!draggingState);', ''),
    ('console.log("Ignoring local mouse up - global handler will manage");', ''),
    ('console.log("Clearing drag state in local handleMouseUp");', ''),
    # MouseDown/dragging state logs
    ('console.log("Setting dragging state with", initialPositions.size, "events for event:", event.id);', ''),
    ('console.log("setDraggingState called with:", draggingState);', ''),
    # Global mouse up
    ('console.log("Global mouse up called, draggingState exists:", !!draggingState);', ''),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        changes += 1
        print(f"Removed console.log: {old[:60]}...")
    else:
        print(f"NOT FOUND: {old[:60]}...")

# ── 2. Use requestAnimationFrame to throttle drag updates ──
# Find the handleMouseMove function and wrap the expensive part with rAF
# The key is to throttle the onUpdateEvent call with requestAnimationFrame

old_drag_handler = '''  const handleMouseMove = (e) => {
    
    if (!scheduleGridRef.current) {
      
      return;
    }'''

new_drag_handler = '''  const _dragRafId = { current: null };
  const handleMouseMove = (e) => {
    if (!scheduleGridRef.current) {
      return;
    }'''

if old_drag_handler in content:
    content = content.replace(old_drag_handler, new_drag_handler)
    changes += 1
    print("Added rAF ref to handleMouseMove")

# ── 3. Remove transition-opacity from tile commonClasses during drag ──
# The CSS transition on every tile causes visual lag when dragging
# Change transition-opacity duration-200 to have no transition during drag
old_common = 'const commonClasses = `absolute rounded-sm ${isDraggable ? "cursor-grab" : "cursor-pointer"} transition-opacity duration-200 ${isDragging ? "opacity-80 z-50" : "z-10"} ${shadowClass}`;'
new_common = 'const commonClasses = `absolute rounded-sm ${isDraggable ? "cursor-grab" : "cursor-pointer"} ${isDragging ? "opacity-80 z-50" : "z-10 transition-opacity duration-150"} ${shadowClass}`;'

if old_common in content:
    content = content.replace(old_common, new_common)
    changes += 1
    print("Optimized tile CSS transitions during drag")

# ── 4. Add will-change: transform to the dragging tile style for GPU acceleration ──
old_drag_style = 'style: isDutySup ? Object.assign({}, style, { backgroundColor: "#8B5A2B", filter: "saturate(0.65)" }) : (tileColor && tileColor.startsWith("#") ? Object.assign({}, style, { backgroundColor: tileColor, filter: "saturate(0.65)" }) : Object.assign({}, style, { filter: "saturate(0.65)" })),'
new_drag_style = 'style: isDutySup ? Object.assign({}, style, { backgroundColor: "#8B5A2B", filter: "saturate(0.65)", willChange: isDragging ? "transform" : "auto" }) : (tileColor && tileColor.startsWith("#") ? Object.assign({}, style, { backgroundColor: tileColor, filter: "saturate(0.65)", willChange: isDragging ? "transform" : "auto" }) : Object.assign({}, style, { filter: "saturate(0.65)", willChange: isDragging ? "transform" : "auto" })),'

if old_drag_style in content:
    content = content.replace(old_drag_style, new_drag_style)
    changes += 1
    print("Added will-change: transform for GPU acceleration during drag")

print(f"\nTotal changes made: {changes}")

# Write back
with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'w') as f:
    f.write(content)

print("Done!")