with open('components/TraineeDatabaseTable.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    
    # After NAME header, add ROLE header
    if line.strip() == 'NAME' and i > 0 and '<th' in lines[i-1]:
        indent = '                 '
        new_lines.append(indent + '<th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">\n')
        new_lines.append(indent + '  ROLE\n')
        new_lines.append(indent + '</th>\n')
        print(f"Added ROLE header after line {i+1}")
    
    # After the name cell in tbody, add role cell
    # Look for the pattern: <td className="...">{trainee.name}</td>
    if 'trainee.name}' in line and '<td' in line and '</td>' in line:
        indent = '                     '
        new_lines.append(indent + '<td className="px-4 py-3 text-sm text-white">\n')
        new_lines.append(indent + '  Trainee\n')
        new_lines.append(indent + '</td>\n')
        print(f"Added ROLE cell after line {i+1}")

with open('components/TraineeDatabaseTable.tsx', 'w') as f:
    f.writelines(new_lines)

print("Done.")