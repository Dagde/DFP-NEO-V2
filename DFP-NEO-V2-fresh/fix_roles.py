#!/usr/bin/env python3
"""
Fix Bug 1: Update DB instructor roles from 'INSTRUCTOR' to 'QFI' for all flying instructors.
- All non-SIM-IP personnel who are FLTLTs, SQNLDRs, WGCDRs should be role='QFI'
- SIM IPs (role='SIM IP', rank='Mr') stay as-is
- Burns (already QFI) stays as-is

Fix Bug 4: Set isFlyingSupervisor=true on WGCDRs (they are the senior supervisors)
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

# Show current role distribution
from collections import Counter
roles = Counter(p.get('role','') for p in personnel)
print(f"Current roles: {dict(roles)}")

# Identify who needs role updates
to_update_qfi = []
to_update_supervisor = []

for p in personnel:
    current_role = p.get('role', '')
    rank = p.get('rank', '')
    name = p.get('name', '')
    
    # SIM IPs (rank=Mr) stay as 'SIM IP' - already correct
    if current_role == 'SIM IP':
        print(f"  KEEP SIM IP: {name} (rank={rank})")
        continue
    
    # Burns already QFI - still check isFlyingSupervisor
    if current_role == 'QFI' and 'Burns' in name:
        print(f"  KEEP QFI: {name}")
        # Burns is SQNLDR, set as flying supervisor
        if not p.get('isFlyingSupervisor', False):
            to_update_supervisor.append(p)
        continue
    
    # All INSTRUCTOR role → QFI (they are flying instructors)
    if current_role == 'INSTRUCTOR':
        to_update_qfi.append(p)
    
    # WGCDRs → set isFlyingSupervisor=True (they are senior supervisors)
    if rank == 'WGCDR' and not p.get('isFlyingSupervisor', False):
        to_update_supervisor.append(p)
    
    # SQNLDRs → also set isFlyingSupervisor=True (flying supervisors)
    if rank == 'SQNLDR' and not p.get('isFlyingSupervisor', False):
        to_update_supervisor.append(p)

print(f"\nNeed role update (INSTRUCTOR → QFI): {len(to_update_qfi)}")
print(f"Need isFlyingSupervisor=True: {len(to_update_supervisor)}")

# Apply role updates
print(f"\nApplying role updates...")
success_role = 0
fail_role = 0

for p in to_update_qfi:
    payload = json.dumps({'role': 'QFI', 'isQFI': True}).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}/api/personnel/{p['id']}",
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='PATCH'
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            success_role += 1
            if success_role % 20 == 0:
                print(f"  Progress: {success_role} role updates...")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  FAIL {p['name']}: HTTP {e.code} - {body[:100]}")
        fail_role += 1
    except Exception as e:
        print(f"  FAIL {p['name']}: {e}")
        fail_role += 1

print(f"\n✅ Role updates: {success_role} succeeded, {fail_role} failed")

# Apply isFlyingSupervisor updates
print(f"\nApplying isFlyingSupervisor updates...")
success_sup = 0
fail_sup = 0

for p in to_update_supervisor:
    rank = p.get('rank', '')
    is_exec = rank == 'WGCDR'  # WGCDRs are executives
    payload = json.dumps({
        'isFlyingSupervisor': True,
        'isExecutive': is_exec
    }).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}/api/personnel/{p['id']}",
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='PATCH'
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            success_sup += 1
            print(f"  ✅ {p['name']} (rank={rank}): isFlyingSupervisor=True, isExecutive={is_exec}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  FAIL {p['name']}: HTTP {e.code} - {body[:100]}")
        fail_sup += 1
    except Exception as e:
        print(f"  FAIL {p['name']}: {e}")
        fail_sup += 1

print(f"\n✅ Supervisor updates: {success_sup} succeeded, {fail_sup} failed")

# Verify final state
print("\nVerifying final distribution...")
resp2 = urllib.request.urlopen(f"{BASE_URL}/api/personnel")
data2 = json.loads(resp2.read())
personnel2 = data2.get('personnel', [])
roles2 = Counter(p.get('role','') for p in personnel2)
sup2 = Counter('isFlyingSupervisor=True' if p.get('isFlyingSupervisor') else 'isFlyingSupervisor=False' for p in personnel2)
exec2 = Counter('isExecutive=True' if p.get('isExecutive') else 'isExecutive=False' for p in personnel2)
print(f"Final roles: {dict(roles2)}")
print(f"Flying supervisors: {dict(sup2)}")
print(f"Executives: {dict(exec2)}")