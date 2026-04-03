#!/usr/bin/env python3
"""
Update DB personnel units to match mockData distribution:
- Executives (WGCDR/SQNLDR): first 4 → 1FTS, rest → CFS
- FLTLTs: first 34 → 1FTS, next 15 → CFS, remaining → 1FTS (default)
- Mr: first 3 → 1FTS, 1 → CFS (to match SIM IP split), rest → 1FTS
- Burns, Alexander: keep as 1FTS (already correct)

We update via PATCH /api/personnel/:id
"""
import json
import urllib.request
import urllib.error

BASE_URL = "https://dfp-neo-v2-production.up.railway.app"

# Fetch all personnel
resp = urllib.request.urlopen(f"{BASE_URL}/api/personnel")
data = json.loads(resp.read())
personnel = data.get('personnel', [])

print(f"Total personnel: {len(personnel)}")

# Separate Burns from the rest
burns = [p for p in personnel if p['name'] == 'Burns, Alexander']
others = [p for p in personnel if p['name'] != 'Burns, Alexander']

print(f"Non-Burns personnel: {len(others)}")

# Sort by rank priority: WGCDR first, then SQNLDR, then FLTLT, then FLGOFF, then PLTOFF, then Mr
# Within same rank, sort alphabetically by name
rank_order = {'WGCDR': 1, 'SQNLDR': 2, 'FLTLT': 3, 'FLGOFF': 4, 'PLTOFF': 5, 'Mr': 6}
others_sorted = sorted(others, key=lambda p: (rank_order.get(p['rank'], 99), p['name']))

# Apply mockData unit distribution logic
# Executives (WGCDR + SQNLDR): first 4 → 1FTS, rest → CFS
# FLTLTs: first 34 → 1FTS, next 15 → CFS, rest → 1FTS
# Mr: first 3 → 1FTS, 1 → CFS, rest → 1FTS

exec_count = 0
num_1fts_execs = 4

fltlt_count = 0
num_1fts_fltlts = 34
num_cfs_fltlts = 15  # next 15 after 1FTS FLTLTs

mr_count = 0
num_1fts_mr = 3

updates = []
for p in others_sorted:
    rank = p['rank']
    if rank in ('WGCDR', 'SQNLDR'):
        if exec_count < num_1fts_execs:
            new_unit = '1FTS'
        else:
            new_unit = 'CFS'
        exec_count += 1
    elif rank == 'FLTLT':
        if fltlt_count < num_1fts_fltlts:
            new_unit = '1FTS'
        elif fltlt_count < num_1fts_fltlts + num_cfs_fltlts:
            new_unit = 'CFS'
        else:
            new_unit = '1FTS'  # extra FLTLTs default to 1FTS
        fltlt_count += 1
    elif rank == 'Mr':
        if mr_count < num_1fts_mr:
            new_unit = '1FTS'
        elif mr_count == num_1fts_mr:
            new_unit = 'CFS'
        else:
            new_unit = '1FTS'
        mr_count += 1
    else:
        new_unit = '1FTS'

    current_unit = p.get('unit', '1FTS')
    updates.append({
        'id': p['id'],
        'name': p['name'],
        'rank': rank,
        'current_unit': current_unit,
        'new_unit': new_unit,
        'changed': current_unit != new_unit
    })

# Show summary
print("\nPlanned unit assignments:")
from collections import Counter
planned = Counter(u['new_unit'] for u in updates)
for k, v in sorted(planned.items()):
    print(f"  {k}: {v}")

changes = [u for u in updates if u['changed']]
print(f"\nRecords to update: {len(changes)}")

# Show sample changes
print("\nSample changes (first 10):")
for u in changes[:10]:
    print(f"  {u['name']:<30} {u['rank']:<8} {u['current_unit']} → {u['new_unit']}")

# Actually apply the updates
print(f"\nApplying {len(changes)} unit updates...")
success = 0
fail = 0

for u in changes:
    payload = json.dumps({'unit': u['new_unit']}).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}/api/personnel/{u['id']}",
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='PATCH'
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            success += 1
            if success % 10 == 0:
                print(f"  Progress: {success} updated...")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  FAIL {u['name']}: HTTP {e.code} - {body[:100]}")
        fail += 1
    except Exception as e:
        print(f"  FAIL {u['name']}: {e}")
        fail += 1

print(f"\n✅ Updated: {success}")
print(f"❌ Failed: {fail}")
print(f"⏭️  Unchanged: {len(updates) - len(changes)}")