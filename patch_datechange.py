with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_text = """    const handleDateChange = (increment: number) => {
        const currentDate = new Date(`${date}T00:00:00Z`);
        currentDate.setUTCDate(currentDate.getUTCDate() + increment);
        const newDateStr = currentDate.toISOString().split('T')[0];
        setDate(newDateStr);
    };"""

new_text = """    const handleDateChange = (increment: number) => {
        const currentDate = new Date(`${date}T00:00:00Z`);
        currentDate.setUTCDate(currentDate.getUTCDate() + increment);
        const newDateStr = currentDate.toISOString().split('T')[0];
        setDate(newDateStr);
        // On-demand load: if this date has a snapshot not yet loaded, fetch it
        if (snapshotDates.includes(newDateStr)) {
            loadSnapshotForDate(newDateStr);
        }
    };

    // Navigate directly to a specific date (used by calendar dropdown on date selector)
    const handleDateSelect = (selectedDate: string) => {
        setDate(selectedDate);
        // On-demand load: fetch snapshot for this date if available and not yet loaded
        if (snapshotDates.includes(selectedDate)) {
            loadSnapshotForDate(selectedDate);
        }
    };"""

if old_text not in content:
    print("ERROR: Could not find handleDateChange")
    idx = content.find('const handleDateChange = (increment: number)')
    print(f"Found at: {idx}")
    print(repr(content[idx:idx+300]))
    exit(1)

new_content = content.replace(old_text, new_text, 1)
print(f"SUCCESS. New length={len(new_content)}")
with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/App.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("File written")