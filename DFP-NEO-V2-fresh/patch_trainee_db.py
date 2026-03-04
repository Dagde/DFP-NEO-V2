with open('components/TraineeDatabaseTable.tsx', 'r') as f:
    content = f.read()

# Find the main return statement and add header before the Table comment
old_text = """    return (
      <div className="w-full">
        {/* Table */}
        <div className="overflow-x-auto">"""

new_text = """    return (
      <div className="w-full">
        {/* Header with title and count */}
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden mb-4">
          <div className="p-4 bg-gray-800/80 border-b border-gray-700">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-sky-400">Trainee Database</h3>
              <span className="text-xs font-mono bg-gray-700 text-gray-300 px-3 py-1 rounded-full">
                {traineeData.length} Trainees
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              All trainee records from the database
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">"""

if old_text in content:
    content = content.replace(old_text, new_text)
    print("Header added successfully.")
else:
    print("Pattern not found, trying flexible approach...")
    # Find the line with "{/* Table */}" and insert before it
    lines = content.split('\n')
    new_lines = []
    for i, line in enumerate(lines):
        if '{/* Table */}' in line and 'overflow-x-auto' in lines[i+1]:
            # Insert header before this line
            indent = '        '
            new_lines.append('')
            new_lines.append(indent + '{/* Header with title and count */}')
            new_lines.append(indent + '<div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden mb-4">')
            new_lines.append(indent + '  <div className="p-4 bg-gray-800/80 border-b border-gray-700">')
            new_lines.append(indent + '    <div className="flex justify-between items-center">')
            new_lines.append(indent + '      <h3 className="text-lg font-bold text-sky-400">Trainee Database</h3>')
            new_lines.append(indent + '      <span className="text-xs font-mono bg-gray-700 text-gray-300 px-3 py-1 rounded-full">')
            new_lines.append(indent + '        {traineeData.length} Trainees')
            new_lines.append(indent + '      </span>')
            new_lines.append(indent + '    </div>')
            new_lines.append(indent + '    <p className="text-sm text-gray-400 mt-1">')
            new_lines.append(indent + '      All trainee records from the database')
            new_lines.append(indent + '    </p>')
            new_lines.append(indent + '  </div>')
            new_lines.append(indent + '</div>')
            new_lines.append('')
            print(f"Inserted header before line {i+1}")
        new_lines.append(line)
    content = '\n'.join(new_lines)

with open('components/TraineeDatabaseTable.tsx', 'w') as f:
    f.write(content)

print("Done.")