import re

with open('DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 910 (index 909): prev button - replace only the className part
lines[909] = lines[909].replace(
    'className=\\"p-0.5 rounded-full hover:bg-gray-600 text-white flex-shrink-0\\"',
    'className=\\"text-gray-400 hover:text-white transition-colors p-0.5\\"'
)
# Line 911 (index 910): replace < with ←
lines[910] = lines[910].replace('<', '←')

# Line 913 (index 912): date span className
lines[912] = lines[912].replace(
    'className=\\"min-w-0 text-center font-semibold text-white cursor-default text-sm whitespace-nowrap\\"',
    'className=\\"text-xs text-gray-300 font-bold tracking-wider whitespace-nowrap\\"'
)
# Line 914 (index 913): next button
lines[913] = lines[913].replace(
    'className=\\"p-0.5 rounded-full hover:bg-gray-600 text-white flex-shrink-0\\"',
    'className=\\"text-gray-400 hover:text-white transition-colors p-0.5\\"'
)
# Line 915 (index 914): replace > with →
lines[914] = lines[914].replace('>', '→')

with open('DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

# Verify
print("Line 910:", repr(lines[909].strip()))
print("Line 911:", repr(lines[910].strip()))
print("Line 913:", repr(lines[912].strip()))
print("Line 914:", repr(lines[913].strip()))
print("Line 915:", repr(lines[914].strip()))