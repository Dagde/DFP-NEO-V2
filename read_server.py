with open('DFP-NEO-V2-fresh/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the LMP sync routes
import re
idx = content.find('lmp-sync')
while idx != -1:
    print(f"\n{'='*60}")
    print(f"Found 'lmp-sync' at position {idx}")
    print('='*60)
    print(content[max(0, idx-200):idx+1500])
    idx = content.find('lmp-sync', idx+1)