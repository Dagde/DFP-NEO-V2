data = open('index.js', 'rb').read()
original_size = len(data)

# Fix duplicate unavailability: check inside the map callback if it already exists
# The unavailPeriod.id is unique per eventId (deployed-${eventId}-${timestamp})
# But since timestamp changes each call, we need to match on eventId embedded in the id
# Better: check if there's already a "Deployed" entry with the same startDate and startTime

old = b'''staffNames.forEach((personName) => {
            const instructor = instructorsData.find((i) => i.name === personName || i.fullName === personName);
            if (instructor) {
              const instrName = instructor.name;
              setInstructorsData((prev) => prev.map((i) => {
                if (i.name !== instrName) return i;
                return { ...i, unavailability: [...(i.unavailability || []), unavailPeriod] };
              }));
            }
            const trainee = traineesData.find((t) => t.name === personName || t.fullName === personName);
            if (trainee) {
              const traineeName = trainee.name;
              const traineeFullName = trainee.fullName;
              setTraineesData((prev) => prev.map((t) => {
                if (t.name !== traineeName && t.fullName !== traineeFullName) return t;
                return { ...t, unavailability: [...(t.unavailability || []), unavailPeriod] };
              }));
            }
          });'''

new = b'''staffNames.forEach((personName) => {
            const instructor = instructorsData.find((i) => i.name === personName || i.fullName === personName);
            if (instructor) {
              const instrName = instructor.name;
              setInstructorsData((prev) => prev.map((i) => {
                if (i.name !== instrName) return i;
                const alreadyExists = (i.unavailability || []).some(
                  (u) => u.reason === "Deployed" && u.startDate === unavailPeriod.startDate && u.startTime === unavailPeriod.startTime && u.endTime === unavailPeriod.endTime
                );
                if (alreadyExists) return i;
                return { ...i, unavailability: [...(i.unavailability || []), unavailPeriod] };
              }));
            }
            const trainee = traineesData.find((t) => t.name === personName || t.fullName === personName);
            if (trainee) {
              const traineeName = trainee.name;
              const traineeFullName = trainee.fullName;
              setTraineesData((prev) => prev.map((t) => {
                if (t.name !== traineeName && t.fullName !== traineeFullName) return t;
                const alreadyExists = (t.unavailability || []).some(
                  (u) => u.reason === "Deployed" && u.startDate === unavailPeriod.startDate && u.startTime === unavailPeriod.startTime && u.endTime === unavailPeriod.endTime
                );
                if (alreadyExists) return t;
                return { ...t, unavailability: [...(t.unavailability || []), unavailPeriod] };
              }));
            }
          });'''

count = data.count(old)
print(f'Pattern found: {count} times')

if count == 1:
    data = data.replace(old, new, 1)
    print('Patch applied successfully')
    print(f'Original size: {original_size}, New size: {len(data)}')
    open('index.js', 'wb').write(data)
    print('File written')
else:
    print('ERROR: not found exactly once')
    partial = b'staffNames.forEach((personName) => {'
    idx = data.find(partial)
    print(f'Partial at {idx}: {repr(data[idx:idx+200])}')