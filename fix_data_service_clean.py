with open('/workspace/lib/dataService.ts', 'r') as f:
    lines = f.readlines()

# Replace lines 99-119 (0-indexed: 98-118) with clean version
new_section = """       // Fetch instructors
       console.log('👨‍🏫 Fetching instructors from API...');
       instructors = await fetchInstructors();
       // Always merge with mock data for staff
       console.log('🔁 Merging database + mock data for staff');
       instructors = mergeInstructorData(instructors, ESL_DATA.instructors);
   

       // Fetch trainees
       console.log('👨‍🎓 Fetching trainees from API...');
       trainees = await fetchTrainees();
       console.log('✅ Trainees loaded:', trainees.length);
       // Always merge with mock data for trainees
       console.log('🔁 Merging database + mock data for trainees');
       trainees = mergeTraineeData(trainees, ESL_DATA.trainees);
   
"""

# Find the start of "Fetch instructors" section
start_idx = None
for i, line in enumerate(lines):
    if '// Fetch instructors' in line:
        start_idx = i
        break

if start_idx is not None:
    # Find the end (before "Fetch aircraft")
    end_idx = start_idx
    for i in range(start_idx, min(start_idx + 30, len(lines))):
        if '// Fetch aircraft' in lines[i]:
            end_idx = i
            break
    
    # Replace the section
    lines[start_idx:end_idx] = [new_section]

with open('/workspace/lib/dataService.ts', 'w') as f:
    f.writelines(lines)

print("Fixed dataService.ts")