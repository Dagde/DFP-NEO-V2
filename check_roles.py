#!/usr/bin/env python3
import re

with open('/workspace/mockData.ts', 'r') as f:
    content = f.read()

# Find the instructors array
match = re.search(r'instructors:\s*\[(.*?)\];', content, re.DOTALL)
if match:
    print('Found instructors array')
    instructors_str = match.group(1)
    # Count roles
    qfi_count = len(re.findall(r"role:\s*['&quot;]QFI['&quot;]", instructors_str))
    sim_ip_count = len(re.findall(r"role:\s*['&quot;]SIM IP['&quot;]", instructors_str))
    instructor_count = len(re.findall(r"role:\s*['&quot;]INSTRUCTOR['&quot;]", instructors_str))
    print(f'QFI: {qfi_count}')
    print(f'SIM IP: {sim_ip_count}')
    print(f'INSTRUCTOR: {instructor_count}')
else:
    print('Could not find instructors array')