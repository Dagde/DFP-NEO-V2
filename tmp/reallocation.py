import json
import random
from collections import defaultdict

# Load data
trainees = json.load(open('/tmp/trainees_raw.json'))
personnel = json.load(open('/tmp/personnel_raw.json'))

# Filter to active trainees only
trainees = [t for t in trainees if t.get('id')]
print(f"Total trainees: {len(trainees)}")
print(f"Total personnel: {len(personnel)}")

# Build unit maps
units = ['1FTS', '2FTS', 'CFS']

def allocate_unit(unit_trainees, unit_staff, max_per_staff=3, min_per_trainee=2):
    """
    Allocate instructors to trainees within a unit.
    - Each trainee gets min min_per_trainee instructors (best effort)
    - Each instructor gets max max_per_staff trainees
    Returns: list of {trainee_id, instructor_names: [...]}
    """
    n_trainees = len(unit_trainees)
    n_staff = len(unit_staff)
    total_slots = n_staff * max_per_staff
    
    print(f"\n  Trainees: {n_trainees}, Staff: {n_staff}, Total slots: {total_slots}")
    print(f"  Min required (min {min_per_trainee}/trainee): {n_trainees * min_per_trainee}")
    
    # Shuffle both lists for random but fair distribution
    random.seed(42)
    shuffled_trainees = unit_trainees.copy()
    shuffled_staff = unit_staff.copy()
    random.shuffle(shuffled_trainees)
    random.shuffle(shuffled_staff)
    
    # Track how many trainees each instructor has been assigned
    staff_load = {s['name']: 0 for s in shuffled_staff}
    
    # Each trainee's assigned instructors
    trainee_instructors = {t['id']: [] for t in shuffled_trainees}
    
    # Allocate in rounds - first round gives everyone 1, second round gives everyone 2, etc.
    for round_num in range(1, min_per_trainee + 1):
        # Sort staff by current load (ascending) so least loaded get assigned first
        available_staff = [s for s in shuffled_staff if staff_load[s['name']] < max_per_staff]
        
        for trainee in shuffled_trainees:
            tid = trainee['id']
            # Skip if trainee already has enough for this round
            if len(trainee_instructors[tid]) >= round_num:
                continue
            
            # Find available staff not already assigned to this trainee
            already_assigned = set(trainee_instructors[tid])
            candidates = [
                s for s in available_staff 
                if s['name'] not in already_assigned and staff_load[s['name']] < max_per_staff
            ]
            
            if not candidates:
                print(f"    ⚠️  No available staff for trainee {trainee['name']} in round {round_num}")
                continue
            
            # Pick the least-loaded instructor
            candidates.sort(key=lambda s: staff_load[s['name']])
            chosen = candidates[0]
            trainee_instructors[tid].append(chosen['name'])
            staff_load[chosen['name']] += 1
    
    return trainee_instructors, staff_load

# Run allocation for each role type (primary and secondary separately)
results = {}  # trainee_id -> {primaryInstructors: [], secondaryInstructors: []}

for unit in units:
    print(f"\n{'='*50}")
    print(f"Processing {unit}...")
    
    unit_trainees = [t for t in trainees if t['unit'] == unit]
    unit_staff = [p for p in personnel if p['unit'] == unit]
    
    print(f"  Allocating PRIMARY instructors...")
    primary_assignments, primary_load = allocate_unit(unit_trainees, unit_staff)
    
    print(f"  Allocating SECONDARY instructors...")
    secondary_assignments, secondary_load = allocate_unit(unit_trainees, unit_staff)
    
    # Ensure secondary != primary where possible
    # Swap secondary instructors if they overlap with primary
    print(f"  Resolving primary/secondary overlaps...")
    for trainee in unit_trainees:
        tid = trainee['id']
        primary = set(primary_assignments.get(tid, []))
        secondary = secondary_assignments.get(tid, [])
        
        new_secondary = []
        for sec_inst in secondary:
            if sec_inst in primary:
                # Try to find a different instructor with capacity
                available = [
                    s for s in unit_staff 
                    if s['name'] not in primary 
                    and s['name'] not in new_secondary
                    and secondary_load[s['name']] < 3
                ]
                if available:
                    available.sort(key=lambda s: secondary_load[s['name']])
                    # Reduce load of original, increase load of new
                    secondary_load[sec_inst] -= 1
                    new_instructor = available[0]['name']
                    secondary_load[new_instructor] += 1
                    new_secondary.append(new_instructor)
                    print(f"    Swapped {sec_inst} -> {new_instructor} for {trainee['name']}")
                else:
                    # Keep the overlap if no alternative
                    new_secondary.append(sec_inst)
            else:
                new_secondary.append(sec_inst)
        
        secondary_assignments[tid] = new_secondary
    
    # Store results
    for trainee in unit_trainees:
        tid = trainee['id']
        results[tid] = {
            'id': tid,
            'name': trainee['name'],
            'unit': unit,
            'primaryInstructors': primary_assignments.get(tid, []),
            'secondaryInstructors': secondary_assignments.get(tid, [])
        }
    
    # Print load summary
    print(f"\n  PRIMARY load distribution for {unit}:")
    load_counts = defaultdict(int)
    for name, count in primary_load.items():
        load_counts[count] += 1
    for count in sorted(load_counts.keys()):
        print(f"    {load_counts[count]} instructors with {count} primary trainees")
    
    print(f"  SECONDARY load distribution for {unit}:")
    load_counts = defaultdict(int)
    for name, count in secondary_load.items():
        load_counts[count] += 1
    for count in sorted(load_counts.keys()):
        print(f"    {load_counts[count]} instructors with {count} secondary trainees")

# Summary
print(f"\n{'='*50}")
print(f"FINAL SUMMARY")
print(f"{'='*50}")
total_with_2_primary = sum(1 for r in results.values() if len(r['primaryInstructors']) >= 2)
total_with_1_primary = sum(1 for r in results.values() if len(r['primaryInstructors']) == 1)
total_with_0_primary = sum(1 for r in results.values() if len(r['primaryInstructors']) == 0)
total_with_2_secondary = sum(1 for r in results.values() if len(r['secondaryInstructors']) >= 2)
total_with_1_secondary = sum(1 for r in results.values() if len(r['secondaryInstructors']) == 1)
total_with_0_secondary = sum(1 for r in results.values() if len(r['secondaryInstructors']) == 0)

print(f"PRIMARY:")
print(f"  Trainees with 2+ primary instructors: {total_with_2_primary}")
print(f"  Trainees with 1 primary instructor:   {total_with_1_primary}")
print(f"  Trainees with 0 primary instructors:  {total_with_0_primary}")
print(f"SECONDARY:")
print(f"  Trainees with 2+ secondary instructors: {total_with_2_secondary}")
print(f"  Trainees with 1 secondary instructor:   {total_with_1_secondary}")
print(f"  Trainees with 0 secondary instructors:  {total_with_0_secondary}")

# Save results
with open('/tmp/reallocation_results.json', 'w') as f:
    json.dump(list(results.values()), f, indent=2)

print(f"\n✅ Results saved to /tmp/reallocation_results.json")
print(f"   Total trainees processed: {len(results)}")