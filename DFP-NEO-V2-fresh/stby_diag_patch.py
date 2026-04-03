import re

with open('App.tsx', 'r') as f:
    content = f.read()

old = """    console.log('Trainees needing STBY flights:', traineesNeedingStby.length);
    
    // TWO-PASS APPROACH: Maximize instructor-allocated STBY events
    const timeIncrement = 5 / 60; // 5 minutes
    const scheduledTrainees = new Set<string>();
    
    // PASS 1: Schedule STBY events ONLY where instructor is available
    console.log('PASS 1: Scheduling STBY with instructors available...');
    console.log(`Flying window: ${flyingStartTime.toFixed(2)} to ${flyingEndTime.toFixed(2)}`);"""

new = """    console.log('Trainees needing STBY flights:', traineesNeedingStby.length);

    // STBY DIAGNOSTIC BLOCK - helps identify why instructors not being found
    const _stbyDiagLoc = config.school === 'ESL' ? 'East Sale' : 'Pearce';
    const _stbyLocFiltered = instructors.filter(i => {
        if (i.location) return i.location === _stbyDiagLoc;
        if (i.unit) {
            if (i.unit.startsWith('2FTS')) return _stbyDiagLoc === 'Pearce';
            if (i.unit.startsWith('1FTS') || i.unit.startsWith('CFS')) return _stbyDiagLoc === 'East Sale';
        }
        return true;
    });
    const _stbyQFIs = _stbyLocFiltered.filter(i => i.role === 'QFI' || i.isQFI === true);
    console.log('[STBY DIAG] school=' + config.school + ' loc=' + _stbyDiagLoc + ' totalInstr=' + instructors.length + ' locFiltered=' + _stbyLocFiltered.length + ' QFIs=' + _stbyQFIs.length + ' sharing=' + staffSharingEnabled);
    _stbyQFIs.slice(0, 10).forEach(function(i) { console.log('[STBY QFI] ' + i.name + ' unit=' + (i.unit||'null') + ' loc=' + (i.location||'null') + ' role=' + i.role + ' isQFI=' + i.isQFI); });
    if (traineesNeedingStby.length > 0) {
        const _st = traineesNeedingStby[0];
        const _elig = _stbyQFIs.filter(function(ip) { return isInstructorEligibleByUnit(ip, _st); });
        console.log('[STBY TRAINEE] ' + _st.fullName + ' unit=' + (_st.unit||'null') + ' eligQFIs=' + _elig.length);
        _elig.slice(0, 5).forEach(function(i) { console.log('[STBY ELIG] ' + i.name + ' unit=' + (i.unit||'null')); });
        if (_elig.length === 0) {
            console.log('[STBY ELIG NONE] Checking each QFI unit match:');
            _stbyQFIs.slice(0, 5).forEach(function(ip) {
                const tu = (_st.unit||'').split('/')[0];
                const iu = (ip.unit||'').split('/')[0];
                console.log('[STBY UNIT CHK] instr=' + ip.name + ' instrUnit=' + iu + ' traineeUnit=' + tu + ' match=' + (iu===tu));
            });
        }
    }

    // TWO-PASS APPROACH: Maximize instructor-allocated STBY events
    const timeIncrement = 5 / 60; // 5 minutes
    const scheduledTrainees = new Set<string>();

    // PASS 1: Schedule STBY events ONLY where instructor is available
    console.log('PASS 1: Scheduling STBY with instructors available...');
    console.log('Flying window: ' + flyingStartTime.toFixed(2) + ' to ' + flyingEndTime.toFixed(2));"""

if old in content:
    content = content.replace(old, new, 1)
    with open('App.tsx', 'w') as f:
        f.write(content)
    print("SUCCESS: Diagnostic patch applied")
else:
    print("ERROR: Old string not found in App.tsx")
    # Show what's around line 3412
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'Trainees needing STBY flights' in line:
            print(f"Found at line {i+1}")
            for j in range(max(0,i-2), min(len(lines), i+15)):
                print(f"{j+1}: {lines[j]}")