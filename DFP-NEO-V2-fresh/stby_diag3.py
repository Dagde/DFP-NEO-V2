import re

with open('App.tsx', 'r') as f:
    content = f.read()

# Add diagnostic to isInstructorAvailableForStby
old = """    const isInstructorAvailableForStby = (
        instructorName: string,
        startTime: number,
        duration: number,
        events: Omit<ScheduleEvent, 'date'>[]
    ): boolean => {
        // Use turnaround time as the only buffer (typically 20-30 min)
        const turnaround = flightTurnaround / 60; // convert minutes to hours
        const eventStart = startTime - turnaround;
        const eventEnd = startTime + duration + turnaround;

        return !events.some(e => {
            if (!getPersonnel(e).includes(instructorName)) return false;
            // For the existing event, also use actual time + turnaround (not full brief window)
            const existStart = e.startTime - turnaround;
            const existEnd = e.startTime + e.duration + turnaround;
            return eventStart < existEnd && eventEnd > existStart;
        });
    };"""

new = """    let _stbyInstrDiagCount = 0; // Global counter to limit diagnostic output
    const isInstructorAvailableForStby = (
        instructorName: string,
        startTime: number,
        duration: number,
        events: Omit<ScheduleEvent, 'date'>[]
    ): boolean => {
        // Use turnaround time as the only buffer (typically 20-30 min)
        const turnaround = flightTurnaround / 60; // convert minutes to hours
        const eventStart = startTime - turnaround;
        const eventEnd = startTime + duration + turnaround;

        const conflict = events.find(e => {
            if (!getPersonnel(e).includes(instructorName)) return false;
            // For the existing event, also use actual time + turnaround (not full brief window)
            const existStart = e.startTime - turnaround;
            const existEnd = e.startTime + e.duration + turnaround;
            return eventStart < existEnd && eventEnd > existStart;
        });

        if (conflict && _stbyInstrDiagCount < 20) {
            _stbyInstrDiagCount++;
            console.log('[STBY INSTR BLOCKED] ' + instructorName + ' at ' + startTime.toFixed(2) + ' blocked by event ' + conflict.flightNumber + ' t=' + conflict.startTime.toFixed(2) + ' dur=' + conflict.duration.toFixed(2) + ' res=' + conflict.resourceId);
        }
        return !conflict;
    };"""

if old in content:
    content = content.replace(old, new, 1)
    with open('App.tsx', 'w') as f:
        f.write(content)
    print("SUCCESS: Diagnostic patch applied")
else:
    print("ERROR: Target not found")
    idx = content.find('isInstructorAvailableForStby')
    print(f"Function found at: {idx}")
    if idx >= 0:
        print(repr(content[idx:idx+400]))