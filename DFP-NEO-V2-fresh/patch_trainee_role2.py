with open('components/TraineeDatabaseTable.tsx', 'r') as f:
    content = f.read()

# Find the name cell and add role cell after it
old_text = """                    <td className="px-4 py-3 text-sm text-white">
                      {trainee.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {[trainee.rank, trainee.service].filter(Boolean).join(' / ') || 'N/A'}
                    </td>"""

new_text = """                    <td className="px-4 py-3 text-sm text-white">
                      {trainee.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      Trainee
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {[trainee.rank, trainee.service].filter(Boolean).join(' / ') || 'N/A'}
                    </td>"""

if old_text in content:
    content = content.replace(old_text, new_text)
    print("Role cell added successfully.")
else:
    print("Pattern not found, trying flexible approach...")
    # Find line with trainee.name and insert after the closing </td>
    lines = content.split('\n')
    new_lines = []
    for i, line in enumerate(lines):
        new_lines.append(line)
        if '{trainee.name}' in line and '</td>' in lines[i+1]:
            # Insert role cell after the next line (the closing </td>)
            indent = '                     '
            new_lines.append(indent + '<td className="px-4 py-3 text-sm text-white">\n')
            new_lines.append(indent + '  Trainee\n')
            new_lines.append(indent + '</td>\n')
            print(f"Added role cell after line {i+2}")
    content = '\n'.join(new_lines)

with open('components/TraineeDatabaseTable.tsx', 'w') as f:
    f.write(content)

print("Done.")