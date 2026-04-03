#!/usr/bin/env python3
"""
Reassign trainee primary/secondary instructors using same-unit DB QFIs.

Rules:
- Each trainee gets 1 primary and 2 secondary instructors from their OWN unit
- QFIs only (role='QFI'), SIM IPs excluded
- Max 3 primary trainees per instructor
- Max 5 secondary trainees per instructor (soft limit for balance)
- FIC course trainees: still assign same-unit instructors
- Random seed for reproducibility
"""
import json
import urllib.request
import urllib.error
import random
from collections import defaultdict

random.seed(99)

BASE_URL = "https://dfp-neo-v2-production.up.railway.app"

# Fetch all personnel and trainees
resp = urllib.request.urlopen(f"{BASE_URL}/api/personnel")
personnel = json.loads(resp.read()).get('personnel', [])

resp2 = urllib.request.urlopen(f"{BASE_URL}/api/trainees")
trainees = json.loads(resp2.read()).get('trainees', [])

print(f"Personnel: {len(personnel)}, Trainees: {len(trainees)}")

# Build instructor lookup by unit - QFIs only
def normalize_unit(unit):
    if not unit: return ''
    return unit.split('/')[0]

qfis_by_unit = defaultdict(list)
for p in personnel:
    if p.get('role') == 'QFI':
        unit = normalize_unit(p.get('unit', ''))
        if unit:
            qfis_by_unit[unit].append(p['name'])

print("\nQFIs by unit:")
for unit, names in sorted(qfis_by_unit.items()):
    print(f"  {unit}: {len(names)} QFIs")

# Shuffle each unit's instructor list for random distribution
for unit in qfis_by_unit:
    random.shuffle(qfis_by_unit[unit])

# Track workload
primary_load = defaultdict(int)    # instructor_name → count of primary trainees
secondary_load = defaultdict(int)  # instructor_name → count of secondary trainees

MAX_PRIMARY = 3
MAX_SECONDARY = 6

def get_available_instructors(unit, load_map, max_load, exclude=None):
    """Get instructors from unit sorted by load, excluding specified names."""
    exclude = exclude or set()
    candidates = [
        name for name in qfis_by_unit.get(unit, [])
        if load_map[name] < max_load and name not in exclude
    ]
    # Sort by load (least loaded first), then shuffle ties
    candidates.sort(key=lambda n: load_map[n])
    return candidates

# Build assignments
assignments = []  # list of (trainee_id, trainee_name, primary_list, secondary_list)

for trainee in trainees:
    t_unit = normalize_unit(trainee.get('unit', ''))
    t_name = trainee.get('fullName', trainee.get('name', '?'))
    t_id = trainee.get('id')
    
    if not t_unit:
        print(f"  ⚠️  No unit for {t_name} - skipping")
        assignments.append((t_id, t_name, [], []))
        continue
    
    if t_unit not in qfis_by_unit:
        print(f"  ⚠️  No QFIs for unit {t_unit} ({t_name}) - skipping")
        assignments.append((t_id, t_name, [], []))
        continue
    
    # Assign 1 primary instructor
    primary_candidates = get_available_instructors(t_unit, primary_load, MAX_PRIMARY)
    if not primary_candidates:
        # Fallback: allow overload
        primary_candidates = qfis_by_unit.get(t_unit, [])
    
    primary = [primary_candidates[0]] if primary_candidates else []
    for p in primary:
        primary_load[p] += 1
    
    # Assign 2 secondary instructors (different from primary)
    secondary_candidates = get_available_instructors(t_unit, secondary_load, MAX_SECONDARY, exclude=set(primary))
    secondary = []
    for sc in secondary_candidates:
        if len(secondary) >= 2:
            break
        secondary.append(sc)
        secondary_load[sc] += 1
    
    # If we couldn't get 2 secondaries (small unit), allow overlap with primary
    if len(secondary) < 2:
        fallback = get_available_instructors(t_unit, secondary_load, MAX_SECONDARY)
        for sc in fallback:
            if sc not in secondary and len(secondary) < 2:
                secondary.append(sc)
                secondary_load[sc] += 1
    
    assignments.append((t_id, t_name, primary, secondary))

# Summary
print(f"\nAssignment summary:")
total_primary = sum(1 for _,_,p,_ in assignments if p)
total_secondary = sum(1 for _,_,_,s in assignments if s)
print(f"  Trainees with primary: {total_primary}/{len(trainees)}")
print(f"  Trainees with secondary (2): {sum(1 for _,_,_,s in assignments if len(s)>=2)}/{len(trainees)}")
print(f"  Primary load (top 10): {sorted(primary_load.items(), key=lambda x:-x[1])[:10]}")
print(f"  Secondary load (top 10): {sorted(secondary_load.items(), key=lambda x:-x[1])[:10]}")

# Cross-unit check
cross_unit = 0
for t_id, t_name, primary, secondary in assignments:
    t = next((x for x in trainees if x.get('id') == t_id), None)
    if not t: continue
    t_unit = normalize_unit(t.get('unit',''))
    for pi in primary:
        # find instructor unit
        inst = next((p for p in personnel if p['name'] == pi), None)
        if inst:
            i_unit = normalize_unit(inst.get('unit',''))
            if i_unit != t_unit:
                cross_unit += 1
                print(f"  CROSS-UNIT: {t_name} ({t_unit}) → primary {pi} ({i_unit})")
print(f"\nCross-unit assignments: {cross_unit} (should be 0)")

# Apply updates to DB
print(f"\nApplying {len(assignments)} trainee assignment updates...")
success = 0
fail = 0

# Need to use the trainee API PATCH endpoint
# Check what endpoint is available
for t_id, t_name, primary, secondary in assignments:
    if not t_id:
        print(f"  SKIP {t_name}: no ID")
        continue
    
    payload = json.dumps({
        'primaryInstructor': primary,
        'secondaryInstructor': secondary
    }).encode('utf-8')
    
    req = urllib.request.Request(
        f"{BASE_URL}/api/trainees/{t_id}",
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='PATCH'
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            success += 1
            if success % 20 == 0:
                print(f"  Progress: {success} updated...")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  FAIL {t_name}: HTTP {e.code} - {body[:120]}")
        fail += 1
    except Exception as e:
        print(f"  FAIL {t_name}: {e}")
        fail += 1

print(f"\n✅ Updated: {success}")
print(f"❌ Failed: {fail}")

# Verify
print("\nVerifying...")
resp3 = urllib.request.urlopen(f"{BASE_URL}/api/trainees")
trainees3 = json.loads(resp3.read()).get('trainees', [])
cross = 0
for t in trainees3:
    t_unit = normalize_unit(t.get('unit',''))
    for pi in (t.get('primaryInstructor') or []):
        inst = next((p for p in personnel if p['name'] == pi), None)
        if inst:
            i_unit = normalize_unit(inst.get('unit',''))
            if i_unit != t_unit:
                cross += 1
print(f"Cross-unit primaries after update: {cross} (should be 0)")