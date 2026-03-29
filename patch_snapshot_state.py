with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_text = "    const [publishedSchedules, setPublishedSchedules] = useState<Record<string, ScheduleEvent[]>>({});\n    \n    // NDB state"

new_text = """    const [publishedSchedules, setPublishedSchedules] = useState<Record<string, ScheduleEvent[]>>({});
    // Snapshot dates available in DB (for calendar dropdown on date selector)
    const [snapshotDates, setSnapshotDates] = useState<string[]>([]);
    // Track which snapshot dates have already been loaded to avoid redundant fetches
    const loadedSnapshotDates = React.useRef<Set<string>>(new Set());
    
    // NDB state"""

if old_text not in content:
    print("ERROR: Could not find target text")
    idx = content.find('const [publishedSchedules, setPublishedSchedules]')
    print(f"Found at: {idx}")
    print(repr(content[idx:idx+200]))
    exit(1)

new_content = content.replace(old_text, new_text, 1)
print(f"SUCCESS: Replaced. New length={len(new_content)}")

with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/App.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("File written successfully")