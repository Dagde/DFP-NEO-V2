#!/usr/bin/env python3
"""
Assign units, locations and fix ranks for 100 DB personnel.

Target distribution:
  1FTS (ESL):  1 WGCDR, 5 SQNLDR (incl Burns), 31 FLTLT, 2 Mr (SIM IP)  = 39
  CFS  (ESL):  1 WGCDR, 5 SQNLDR,              16 FLTLT, 2 Mr (SIM IP)  = 24
  2FTS (PEA):  1 WGCDR, 5 SQNLDR,              29 FLTLT, 2 Mr (SIM IP)  = 37
  Total:       3 WGCDR  15 SQNLDR               76 FLTLT  6 Mr           = 100

We have: 3 WGCDR, 12+1(Burns) SQNLDR, 78 FLTLT, 6 Mr = 100
Gap: need 14 non-Burns SQNLDRs but only have 12 → promote 2 random FLTLTs to SQNLDR
"""
import json
import urllib.request
import urllib.error
import random

BASE_URL = "https://dfp-neo-v2-production.up.railway.app"

# Fetch all personnel
resp = urllib.request.urlopen(f"{BASE_URL}/api/personnel")
data = json.loads(resp.read())
personnel = data.get('personnel', [])
print(f"Total personnel: {len(personnel)}")

# Separate Burns (stays as 1FTS SQNLDR QFI)
burns = next(p for p in personnel if 'Burns' in p['name'])
others = [p for p in personnel if 'Burns' not in p['name']]

# Separate by rank
wgcdrs  = [p for p in others if p['rank'] == 'WGCDR']
sqnldrs = [p for p in others if p['rank'] == 'SQNLDR']
fltlts  = [p for p in others if p['rank'] == 'FLTLT']
mrs     = [p for p in others if p['rank'] == 'Mr']

print(f"WGCDRs: {len(wgcdrs)}, SQNLDRs(excl Burns): {len(sqnldrs)}, FLTLTs: {len(fltlts)}, Mr: {len(mrs)}")

# We need 14 non-Burns SQNLDRs, have 12 → promote 2 FLTLTs randomly
random.seed(42)  # deterministic for reproducibility
fltlts_shuffled = fltlts[:]
random.shuffle(fltlts_shuffled)

promote_to_sqnldr = fltlts_shuffled[:2]
remaining_fltlts  = fltlts_shuffled[2:]

# Add promoted FLTLTs to sqnldrs pool
all_sqnldrs_no_burns = sqnldrs + promote_to_sqnldr
random.shuffle(all_sqnldrs_no_burns)

print(f"After promotion: SQNLDRs: {len(all_sqnldrs_no_burns)}, FLTLTs: {len(remaining_fltlts)}")
print(f"Promoting to SQNLDR: {[p['name'] for p in promote_to_sqnldr]}")

# Shuffle all pools randomly for even distribution
random.shuffle(wgcdrs)
random.shuffle(remaining_fltlts)
random.shuffle(mrs)

# --- ASSIGN UNITS ---
# WGCDRs: 1 per unit
unit_wgcdrs = {
    '1FTS': wgcdrs[0:1],
    'CFS':  wgcdrs[1:2],
    '2FTS': wgcdrs[2:3],
}

# SQNLDRs: Burns takes 1FTS slot, rest distributed 4+5+5
# Burns already assigned 1FTS, so non-Burns slots: 4 for 1FTS, 5 for CFS, 5 for 2FTS
unit_sqnldrs = {
    '1FTS': all_sqnldrs_no_burns[0:4],    # 4 non-Burns → fills 1FTS to 5 (incl Burns)
    'CFS':  all_sqnldrs_no_burns[4:9],    # 5 for CFS
    '2FTS': all_sqnldrs_no_burns[9:14],   # 5 for 2FTS
}

# FLTLTs: 31 → 1FTS, 16 → CFS, 29 → 2FTS
unit_fltlts = {
    '1FTS': remaining_fltlts[0:31],
    'CFS':  remaining_fltlts[31:47],
    '2FTS': remaining_fltlts[47:76],
}

# Mr (SIM IPs): 2 → 1FTS, 2 → CFS, 2 → 2FTS (4 ESL split between 1FTS and CFS, 2 PEA)
unit_mrs = {
    '1FTS': mrs[0:2],
    'CFS':  mrs[2:4],
    '2FTS': mrs[4:6],
}

# Location per unit
UNIT_LOCATION = {
    '1FTS': 'East Sale',
    'CFS':  'East Sale',
    '2FTS': 'Pearce',
}

# Build update list
updates = []

for unit, people in {**{u: unit_wgcdrs[u] + unit_sqnldrs[u] + unit_fltlts[u] + unit_mrs[u] 
                        for u in ['1FTS', 'CFS', '2FTS']}}.items():
    location = UNIT_LOCATION[unit]
    for p in people:
        new_rank = p['rank']
        # Check if this person is being promoted to SQNLDR
        if p in promote_to_sqnldr:
            new_rank = 'SQNLDR'
        
        update = {
            'id': p['id'],
            'name': p['name'],
            'current_unit': p.get('unit', '1FTS'),
            'new_unit': unit,
            'current_location': p.get('location'),
            'new_location': location,
            'current_rank': p['rank'],
            'new_rank': new_rank,
        }
        updates.append(update)

# Add Burns (no change needed, just confirm)
print(f"\nBurns stays: unit=1FTS, location=East Sale, rank=SQNLDR")

# Summary
print(f"\nAssignment summary:")
unit_counts = {}
for u in updates:
    key = f"{u['new_unit']} ({UNIT_LOCATION[u['new_unit']]})"
    unit_counts[key] = unit_counts.get(key, 0) + 1
for k, v in sorted(unit_counts.items()):
    print(f"  {k}: {v}")
print(f"  Total (excl Burns): {len(updates)}")

rank_promotions = [u for u in updates if u['current_rank'] != u['new_rank']]
print(f"\nRank changes: {len(rank_promotions)}")
for u in rank_promotions:
    print(f"  {u['name']}: {u['current_rank']} → {u['new_rank']}")

# Apply updates
print(f"\nApplying {len(updates)} updates...")
success = 0
fail = 0

for u in updates:
    payload = {
        'unit': u['new_unit'],
        'location': u['new_location'],
    }
    if u['current_rank'] != u['new_rank']:
        payload['rank'] = u['new_rank']
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}/api/personnel/{u['id']}",
        data=data,
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
        print(f"  FAIL {u['name']}: HTTP {e.code} - {body[:100]}")
        fail += 1
    except Exception as e:
        print(f"  FAIL {u['name']}: {e}")
        fail += 1

# Also update Burns' location just to be sure
burns_payload = json.dumps({'unit': '1FTS', 'location': 'East Sale'}).encode('utf-8')
burns_req = urllib.request.Request(
    f"{BASE_URL}/api/personnel/{burns['id']}",
    data=burns_payload,
    headers={'Content-Type': 'application/json'},
    method='PATCH'
)
try:
    with urllib.request.urlopen(burns_req, timeout=10) as resp:
        print(f"  ✅ Burns location confirmed: East Sale, 1FTS")
except Exception as e:
    print(f"  Burns update: {e}")

print(f"\n✅ Updated: {success}")
print(f"❌ Failed: {fail}")

# Verify
print("\nVerifying final distribution...")
resp2 = urllib.request.urlopen(f"{BASE_URL}/api/personnel")
data2 = json.loads(resp2.read())
personnel2 = data2.get('personnel', [])
from collections import Counter
unit_dist = Counter(p['unit'] for p in personnel2)
loc_dist  = Counter(p.get('location','null') for p in personnel2)
rank_dist = Counter((p['unit'], p['rank']) for p in personnel2)

print("Unit distribution:")
for k,v in sorted(unit_dist.items()):
    print(f"  {k}: {v}")
print("Location distribution:")
for k,v in sorted(loc_dist.items()):
    print(f"  {k}: {v}")
print("Rank by unit:")
for (unit,rank),count in sorted(rank_dist.items()):
    print(f"  {unit} {rank}: {count}")