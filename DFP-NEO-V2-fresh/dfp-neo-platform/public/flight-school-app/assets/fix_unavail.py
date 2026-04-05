data = open('index.js', 'rb').read()
original_size = len(data)

# Fix the unavailPeriod object - replace 'date:' with 'startDate:' and 'endDate:'
# Also need to add endDate field (same date for same-day deployment)

old = b'''const unavailPeriod = {
            id: `deployed-${update.eventId}-${Date.now()}`,
            date: event.date || date,
            startTime: `${String(Math.floor(flightEndHour)).padStart(2, "0")}:${String(Math.round((flightEndHour % 1) * 60)).padStart(2, "0")}`,
            endTime: `${String(Math.floor(deployEndHour)).padStart(2, "0")}:${String(Math.round((deployEndHour % 1) * 60)).padStart(2, "0")}`,
            reason: "Deployed",
            allDay: false
          };'''

new = b'''const unavailDate = event.date || date;
          const unavailPeriod = {
            id: `deployed-${update.eventId}-${Date.now()}`,
            startDate: unavailDate,
            endDate: deploymentEvent?.deploymentEndDate || unavailDate,
            startTime: `${String(Math.floor(flightEndHour)).padStart(2, "0")}:${String(Math.round((flightEndHour % 1) * 60)).padStart(2, "0")}`,
            endTime: `${String(Math.floor(deployEndHour)).padStart(2, "0")}:${String(Math.round((deployEndHour % 1) * 60)).padStart(2, "0")}`,
            reason: "Deployed",
            allDay: false
          };'''

count = data.count(old)
print(f'Pattern found: {count} times')

if count == 1:
    data = data.replace(old, new, 1)
    print('Patch applied successfully')
    print(f'Original size: {original_size}, New size: {len(data)}')
    open('index.js', 'wb').write(data)
    print('File written')
else:
    print('ERROR: Pattern not found exactly once!')
    # Debug: find partial match
    partial = b'const unavailPeriod = {'
    idx = data.find(partial)
    print(f'Partial match at {idx}:')
    print(repr(data[idx:idx+400]))