with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("Checking line 931:", repr(lines[930]))
print("Checking line 939:", repr(lines[938]))

# Direct replacement by line index
# Line 931 (index 930)
if '                            <\n' in repr(lines[930]) or lines[930].strip() == '<':
    indent = '                            '
    lines[930] = indent + '<\n'
    print(f"Fixed line 931 -> {repr(lines[930])}")

# Line 939 (index 938)
if lines[938].strip() == '>':
    indent = '                            '
    lines[938] = indent + '>\n'
    print(f"Fixed line 939 -> {repr(lines[938])}")

with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Done")