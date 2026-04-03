import json
import urllib.request
import urllib.error

# All 102 deleted records with their exact data from the earlier API output
# Created dates: 2026-01-08 (61 records) and 2026-03-20 (37 records) and 2026-03-21 (4 records)

deleted_personnel = [
    # Created 2026-01-08 (61 records)
    {"name": "Anderson, David", "rank": "FLTLT"},
    {"name": "Baker, Michael", "rank": "FLTLT"},
    {"name": "Brown, Ashley", "rank": "SQNLDR"},
    {"name": "Carter, Noah", "rank": "FLTLT"},
    {"name": "Carter, Steven", "rank": "WGCDR"},
    {"name": "Clark, Benjamin", "rank": "FLTLT"},
    {"name": "Clark, Charles", "rank": "FLTLT"},
    {"name": "Clark, Oliver", "rank": "FLTLT"},
    {"name": "Cooper, Thomas", "rank": "FLTLT"},
    {"name": "Davies, Charles", "rank": "FLTLT"},
    {"name": "Davies, Harper", "rank": "Mr"},
    {"name": "Davies, Noah", "rank": "FLTLT"},
    {"name": "Davies, Steven", "rank": "FLTLT"},
    {"name": "Edwards, Joseph", "rank": "FLTLT"},
    {"name": "Edwards, Noah", "rank": "FLTLT"},
    {"name": "Green, Charlotte", "rank": "SQNLDR"},
    {"name": "Hall, Daniel", "rank": "SQNLDR"},
    {"name": "Hill, William", "rank": "SQNLDR"},
    {"name": "Jackson, Amelia", "rank": "FLTLT"},
    {"name": "Jackson, Emily", "rank": "FLTLT"},
    {"name": "Jackson, Isabella", "rank": "Mr"},
    {"name": "Jackson, Noah", "rank": "FLTLT"},
    {"name": "Johnson, James", "rank": "FLTLT"},
    {"name": "Jones, Elijah", "rank": "FLTLT"},
    {"name": "Jones, Jessica", "rank": "FLTLT"},
    {"name": "Jones, John", "rank": "FLTLT"},
    {"name": "Jones, Liam", "rank": "FLTLT"},
    {"name": "Jones, Richard", "rank": "FLTLT"},
    {"name": "King, Sophia", "rank": "FLTLT"},
    {"name": "Lee, Patricia", "rank": "FLTLT"},
    {"name": "Lewis, Jennifer", "rank": "Mr"},
    {"name": "Lewis, Jessica", "rank": "FLTLT"},
    {"name": "Martin, John", "rank": "FLTLT"},
    {"name": "Martin, Joseph", "rank": "FLTLT"},
    {"name": "Moore, Joseph", "rank": "FLTLT"},
    {"name": "Moore, Lucas", "rank": "SQNLDR"},
    {"name": "Moore, Mary", "rank": "SQNLDR"},
    {"name": "Morris, Oliver", "rank": "FLTLT"},
    {"name": "Parker, Barbara", "rank": "FLTLT"},
    {"name": "Roberts, Mary", "rank": "FLTLT"},
    {"name": "Roberts, Noah", "rank": "FLTLT"},
    {"name": "Robinson, Linda", "rank": "FLTLT"},
    {"name": "Scott, Liam", "rank": "FLTLT"},
    {"name": "Stewart, Daniel", "rank": "FLTLT"},
    {"name": "Stewart, Mark", "rank": "SQNLDR"},
    {"name": "Stewart, Sarah", "rank": "FLTLT"},
    {"name": "Taylor, Robert", "rank": "FLTLT"},
    {"name": "Thomas, Thomas", "rank": "WGCDR"},
    {"name": "Thompson, Charles", "rank": "FLTLT"},
    {"name": "Thompson, Mia", "rank": "FLTLT"},
    {"name": "Thompson, Patricia", "rank": "FLTLT"},
    {"name": "Turner, Jessica", "rank": "Mr"},
    {"name": "Turner, Noah", "rank": "FLTLT"},
    {"name": "Walker, Joseph", "rank": "FLTLT"},
    {"name": "White, Jessica", "rank": "FLTLT"},
    {"name": "White, Thomas", "rank": "FLTLT"},
    {"name": "Williams, Lucas", "rank": "SQNLDR"},
    {"name": "Wood, Charlotte", "rank": "Mr"},
    {"name": "Wood, John", "rank": "FLTLT"},
    {"name": "Wood, Steven", "rank": "FLTLT"},
    {"name": "Wright, Noah", "rank": "FLTLT"},
    # Created 2026-03-20 (37 records)
    {"name": "Baker, Elijah", "rank": "FLTLT"},
    {"name": "Bloggs, Joe", "rank": "FLTLT"},
    {"name": "Clark, Ava", "rank": "FLTLT"},
    {"name": "Clark, Jessica", "rank": "FLTLT"},
    {"name": "Cooper, James", "rank": "FLTLT"},
    {"name": "Evans, Harper", "rank": "FLTLT"},
    {"name": "Evans, Joseph", "rank": "FLTLT"},
    {"name": "Hall, Emily", "rank": "FLTLT"},
    {"name": "Hall, Olivia", "rank": "FLTLT"},
    {"name": "Hill, Ava", "rank": "FLTLT"},
    {"name": "Hill, Charlotte", "rank": "SQNLDR"},
    {"name": "Johnson, Jennifer", "rank": "FLTLT"},
    {"name": "Jones, Joseph", "rank": "FLTLT"},
    {"name": "King, Benjamin", "rank": "FLTLT"},
    {"name": "Lee, Barbara", "rank": "FLTLT"},
    {"name": "Lee, David", "rank": "FLTLT"},
    {"name": "Martin, Patricia", "rank": "FLTLT"},
    {"name": "Martin, Paul", "rank": "FLTLT"},
    {"name": "Mitchell, Ashley", "rank": "SQNLDR"},
    {"name": "Mitchell, William", "rank": "FLTLT"},
    {"name": "Moore, Theodore", "rank": "FLTLT"},
    {"name": "Parker, Michael", "rank": "SQNLDR"},
    {"name": "Parker, Noah", "rank": "FLTLT"},
    {"name": "Parker, Thomas", "rank": "FLTLT"},
    {"name": "Robinson, Sarah", "rank": "FLTLT"},
    {"name": "Scott, Ava", "rank": "SQNLDR"},
    {"name": "Scott, Emily", "rank": "FLTLT"},
    {"name": "Smith, Richard", "rank": "FLTLT"},
    {"name": "Stewart, Sarah", "rank": "FLTLT"},
    {"name": "Walker, Daniel", "rank": "FLTLT"},
    {"name": "White, Benjamin", "rank": "FLTLT"},
    {"name": "Williams, Amelia", "rank": "FLTLT"},
    {"name": "Williams, Henry", "rank": "FLTLT"},
    {"name": "Williams, Theodore", "rank": "FLTLT"},
    {"name": "Wood, Patricia", "rank": "FLTLT"},
    {"name": "Wright, Benjamin", "rank": "FLTLT"},
    {"name": "Wright, Michael", "rank": "FLTLT"},
    # Created 2026-03-21 (4 records)
    {"name": "King, Chris", "rank": "WGCDR"},
    {"name": "Lewis, Jennifer", "rank": "Mr"},  # duplicate name - second entry
    {"name": "Turner, Patricia", "rank": "Mr"},
    {"name": "Wood, Charlotte", "rank": "Mr"},  # duplicate name - second entry
]

BASE_URL = "https://dfp-neo-v2-production.up.railway.app"

success_count = 0
fail_count = 0
skipped_duplicates = 0

# Track names to handle duplicates (Lewis, Jennifer and Wood, Charlotte appear twice)
seen_names = set()

for person in deleted_personnel:
    name = person["name"]
    
    # Handle duplicate names - skip the second occurrence of same name/rank combos
    key = f"{name}_{person['rank']}"
    if key in seen_names:
        print(f"  SKIP duplicate: {name}")
        skipped_duplicates += 1
        continue
    seen_names.add(key)
    
    # Parse name: "Last, First" format
    parts = name.split(", ", 1)
    last_name = parts[0] if len(parts) > 0 else name
    first_name = parts[1] if len(parts) > 1 else ""
    
    payload = json.dumps({
        "name": name,
        "rank": person["rank"],
        "role": "INSTRUCTOR",
        "category": "QFI",
        "unit": "1FTS",
        "isActive": True,
    }).encode("utf-8")
    
    req = urllib.request.Request(
        f"{BASE_URL}/api/personnel",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            success_count += 1
            if success_count % 10 == 0:
                print(f"  Progress: {success_count} restored...")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  FAIL {name}: HTTP {e.code} - {body[:100]}")
        fail_count += 1
    except Exception as e:
        print(f"  FAIL {name}: {e}")
        fail_count += 1

print(f"\n✅ Restored: {success_count}")
print(f"⚠️  Skipped duplicates: {skipped_duplicates}")
print(f"❌ Failed: {fail_count}")