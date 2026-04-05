data = open('index.js', 'rb').read()
original_size = len(data)

# Fix: Replace idNumber-based matching with name-based matching
# Also fix the stale closure issue by doing the unavailability update inside the prev=> callback

old = b'''staffNames.forEach((personName) => {
            const instructor = instructorsData.find((i) => i.name === personName || i.fullName === personName);
            if (instructor) {
              const updated = { ...instructor, unavailability: [...(instructor.unavailability || []), unavailPeriod] };
              setInstructorsData((prev) => prev.map((i) => i.idNumber === instructor.idNumber ? updated : i));
            }
            const trainee = traineesData.find((t) => t.name === personName || t.fullName === personName);
            if (trainee) {
              const updated = { ...trainee, unavailability: [...(trainee.unavailability || []), unavailPeriod] };
              setTraineesData((prev) => prev.map((t) => t.idNumber === trainee.idNumber ? updated : t));
            }
          });'''

new = b'''staffNames.forEach((personName) => {
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
    partial = b'staffNames.forEach((personName) => {'
    idx = data.find(partial)
    print(f'Partial match at {idx}: {repr(data[idx:idx+200])}')