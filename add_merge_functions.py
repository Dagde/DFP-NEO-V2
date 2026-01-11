#!/usr/bin/env python3

# Read the file
with open('/workspace/lib/dataService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add the merge functions before initializeData
merge_functions = '''
// Merge database instructors with mock data, deduplicating by idNumber
function mergeInstructorData(dbInstructors: any[], mockInstructors: any[]): any[] {
  console.log('🔄 Merging instructor data...');
  console.log('  Database instructors:', dbInstructors.length);
  console.log('  Mock instructors:', mockInstructors.length);
  
  // Create a map of database instructors by idNumber for deduplication
  const dbInstructorMap = new Map();
  dbInstructors.forEach((instructor: any) => {
    dbInstructorMap.set(instructor.idNumber, instructor);
  });
  
  // Merge mock instructors, skipping duplicates
  const merged = [...dbInstructors];
  mockInstructors.forEach((instructor: any) => {
    if (!dbInstructorMap.has(instructor.idNumber)) {
      merged.push(instructor);
    }
  });
  
  // Sort by: Unit → Rank → Name (alphabetical)
  merged.sort((a: any, b: any) => {
    // First by unit
    if (a.unit !== b.unit) {
      return a.unit.localeCompare(b.unit);
    }
    // Then by rank (higher rank first)
    const rankOrder = { 'QFI': 1, 'SIM IP': 2, 'INSTRUCTOR': 3 };
    const aRank = rankOrder[a.role] || 99;
    const bRank = rankOrder[b.role] || 99;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    // Finally by name (alphabetical)
    return a.name.localeCompare(b.name);
  });
  
  console.log('  Merged result:', merged.length, 'instructors');
  return merged;
}

// Merge database trainees with mock data, deduplicating by name
function mergeTraineeData(dbTrainees: any[], mockTrainees: any[]): any[] {
  console.log('🔄 Merging trainee data...');
  console.log('  Database trainees:', dbTrainees.length);
  console.log('  Mock trainees:', mockTrainees.length);
  
  // Create a map of database trainees by name for deduplication
  const dbTraineeMap = new Map();
  dbTrainees.forEach((trainee: any) => {
    dbTraineeMap.set(trainee.name, trainee);
  });
  
  // Merge mock trainees, skipping duplicates
  const merged = [...dbTrainees];
  mockTrainees.forEach((trainee: any) => {
    if (!dbTraineeMap.has(trainee.name)) {
      merged.push(trainee);
    }
  });
  
  // Sort by name (alphabetical)
  merged.sort((a: any, b: any) => a.name.localeCompare(b.name));
  
  console.log('  Merged result:', merged.length, 'trainees');
  return merged;
}

'''

# Find the position before "export async function initializeData"
insert_pos = content.find('export async function initializeData()')
if insert_pos == -1:
    print("❌ Could not find initializeData function")
    exit(1)

# Insert the merge functions
content = content[:insert_pos] + merge_functions + content[insert_pos:]

# Write the file back
with open('/workspace/lib/dataService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Successfully added merge helper functions")