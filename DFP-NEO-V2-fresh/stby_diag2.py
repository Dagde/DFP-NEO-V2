import re

with open('App.tsx', 'r') as f:
    content = f.read()

# Find the Pass 1 loop and add per-trainee diagnostics
old = """    for (const trainee of traineesNeedingStby) {
        const { next } = traineeNextEventMap.get(trainee.fullName)!;
        if (!next) continue;
        
        let placed = false;
        // Try to find a time slot where an instructor IS available
        for (let time = flyingStartTime; time < flyingEndTime; time += timeIncrement) {
            // Debug logging for 10:00-10:20 window
            const isDebugWindow = time >= 10.0 && time <= 10.33;
            
            // Check if flight already starts at this time
            if (hasFlightStartTime(time, generatedEvents)) {
                if (isDebugWindow) console.log(`  ${time.toFixed(2)}: Flight already exists`);
                continue;
            }
            
            // Check if flight block time fits within flying window
            const flightEndTime = time + next.duration;
            if (flightEndTime > flyingEndTime) {
                if (isDebugWindow) console.log(`  ${time.toFixed(2)}: Would exceed flying window`);
                continue;
            }
            
            // Check "8 flights per hour" rule
            if (wouldViolate8PerHourRule(time, generatedEvents)) {
                if (isDebugWindow) console.log(`  ${time.toFixed(2)}: Would violate 8-per-hour rule`);
                continue;
            }
            
            // Try to find available instructor
            const instructor = findBestInstructorForStby(trainee, next, time, next.duration, 'flight', generatedEvents);
            
            // ONLY schedule if instructor is available (skip TBA for now)
            if (!instructor) {
                if (isDebugWindow) console.log(`  ${time.toFixed(2)}: No instructor available`);
                continue;
            }"""

new = """    // Log first 3 trainees needing STBY for diagnosis
    traineesNeedingStby.slice(0, 3).forEach(function(t) {
        const nx = traineeNextEventMap.get(t.fullName);
        console.log('[STBY PASS1 TRAINEE] ' + t.fullName + ' unit=' + (t.unit||'null') + ' next=' + (nx && nx.next ? nx.next.id : 'null') + ' _ds=' + (t as any)._dataSource);
    });

    for (const trainee of traineesNeedingStby) {
        const { next } = traineeNextEventMap.get(trainee.fullName)!;
        if (!next) continue;
        
        let placed = false;
        let _diagChecked = 0, _diagNoSlot = 0, _diagNo8Rule = 0, _diagNoWindow = 0, _diagNoInstr = 0;
        // Try to find a time slot where an instructor IS available
        for (let time = flyingStartTime; time < flyingEndTime; time += timeIncrement) {
            _diagChecked++;
            // Check if flight already starts at this time
            if (hasFlightStartTime(time, generatedEvents)) {
                _diagNoSlot++; continue;
            }
            
            // Check if flight block time fits within flying window
            const flightEndTime = time + next.duration;
            if (flightEndTime > flyingEndTime) {
                _diagNoWindow++; continue;
            }
            
            // Check "8 flights per hour" rule
            if (wouldViolate8PerHourRule(time, generatedEvents)) {
                _diagNo8Rule++; continue;
            }
            
            // Try to find available instructor
            const instructor = findBestInstructorForStby(trainee, next, time, next.duration, 'flight', generatedEvents);
            
            // ONLY schedule if instructor is available (skip TBA for now)
            if (!instructor) {
                _diagNoInstr++;
                continue;
            }"""

if old in content:
    content = content.replace(old, new, 1)
    # Also add the placed/not-placed log
    old2 = """        if (!placed) {
            console.log(`PASS 1: Could not place ${trainee.fullName} anywhere in flying window`);
        }
    }"""
    new2 = """        if (!placed) {
            console.log('[STBY PASS1 FAIL] ' + trainee.fullName + ' unit=' + (trainee.unit||'null') + ' checked=' + _diagChecked + ' noSlot=' + _diagNoSlot + ' noWindow=' + _diagNoWindow + ' no8Rule=' + _diagNo8Rule + ' noInstr=' + _diagNoInstr);
        }
    }"""
    if old2 in content:
        content = content.replace(old2, new2, 1)
        print("SUCCESS: Both patches applied")
    else:
        print("WARNING: Second patch not found, first patch applied only")
    with open('App.tsx', 'w') as f:
        f.write(content)
else:
    print("ERROR: First patch target not found")
    # Show surrounding area
    idx = content.find('for (const trainee of traineesNeedingStby)')
    if idx >= 0:
        print("Found loop at index", idx)
        print(repr(content[idx:idx+300]))
    else:
        print("Loop not found at all")