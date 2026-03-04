with open('/workspace/DFP-NEO-V2-fresh/components/SettingsViewWithMenu.tsx', 'r') as f:
    content = f.read()

# Find the trainee-database section and replace &quot; with proper quotes
start = content.find("{ id: 'trainee-database'")
end = content.find("{ id: 'staff-mockdata'")

if start > 0 and end > start:
    section = content[start:end]
    fixed = section.replace('&quot;', '"')
    content = content[:start] + fixed + content[end:]
    print('Fixed &quot; in trainee-database section')
else:
    print('Section not found: start=%d end=%d' % (start, end))

with open('/workspace/DFP-NEO-V2-fresh/components/SettingsViewWithMenu.tsx', 'w') as f:
    f.write(content)

print('Done')