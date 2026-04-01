with open('lib/dataService.ts', 'r') as f:
    content = f.read()

# Find the exact block to replace using index
start_marker = "    // Check for duplicate idNumbers"
end_marker = "    dbInstructorNames.add(instructor.name);\n  });\n  \n  // Start with database instructors"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker) + len(end_marker)

print(f"Start index: {start_idx}")
print(f"End index: {end_idx}")
print("Block to replace:")
print(repr(content[start_idx:end_idx]))

if start_idx >= 0 and end_idx > start_idx:
    new_block = """    // Extract currencyStatus from qualifications JSON field if present
    if (instructor.qualifications && typeof instructor.qualifications === 'object' && (instructor.qualifications as any).currencyStatus) {
      instructor = { ...instructor, currencyStatus: (instructor.qualifications as any).currencyStatus };
    }

    // Check for duplicate idNumbers - prefer the one with currencyStatus data
    if (dbInstructorMap.has(instructor.idNumber)) {
      const existing = dbInstructorMap.get(instructor.idNumber);
      const existingHasData = existing.currencyStatus && existing.currencyStatus.length > 0;
      const newHasData = instructor.currencyStatus && instructor.currencyStatus.length > 0;
      if (!existingHasData && newHasData) {
        console.log(`  Replacing duplicate idNumber: ${instructor.idNumber} with record that has currencyStatus data`);
      } else {
        console.log(`  Skipping duplicate idNumber: ${instructor.idNumber}`);
        dbInstructorNames.add(instructor.name);
        return; // Skip this duplicate
      }
    }
    
    // Tag with dataSource
    const taggedInstructor = { ...instructor, _dataSource: 'database' as const };
    dbInstructorMap.set(instructor.idNumber, taggedInstructor);
    dbInstructorNames.add(instructor.name);
  });
  
  // Start with database instructors"""

    content = content[:start_idx] + new_block + content[end_idx:]
    with open('lib/dataService.ts', 'w') as f:
        f.write(content)
    print("Replacement successful!")
else:
    print("Could not find block!")