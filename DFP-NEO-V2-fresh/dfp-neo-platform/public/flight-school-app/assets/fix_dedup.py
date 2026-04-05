data = open('index.js', 'rb').read()
original_size = len(data)

# Fix: Add deduplication - only process each eventId once for the Deployed unavailability
# The updates array has one entry per crew member, but we only need to add unavailability once per flight

old = b'''updates.forEach((update) => {
      if (update.newResourceId && update.newResourceId.startsWith("Deployed")) {
        const event = (publishedSchedules[date] || []).find((e) => e.id === update.eventId);'''

new = b'''const processedDeployedEvents = new Set();
    updates.forEach((update) => {
      if (update.newResourceId && update.newResourceId.startsWith("Deployed")) {
        if (processedDeployedEvents.has(update.eventId)) return;
        processedDeployedEvents.add(update.eventId);
        const event = (publishedSchedules[date] || []).find((e) => e.id === update.eventId);'''

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
    partial = b'updates.forEach((update) => {\n      if (update.newResourceId'
    idx = data.find(partial)
    print(f'Partial match at {idx}: {repr(data[idx:idx+150])}')