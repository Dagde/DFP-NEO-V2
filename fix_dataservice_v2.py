#!/usr/bin/env python3
import re

with open('/workspace/lib/dataService.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the line with "export async function initializeData"
insert_index = None
for i, line in enumerate(lines):
    if 'export async function initializeData()' in line:
        insert_index = i
        break

if insert_index is None:
    print("ERROR: Could not find initializeData function")
    exit(1)

# Find where to insert the data source settings code
# Insert after the opening brace and before the first console.log
for i in range(insert_index + 1, min(insert_index + 20, len(lines))):
    if 'let instructors:' in lines[i]:
        # Insert the data source settings code before "let instructors"
        new_code = '''    // Read data source settings from localStorage
    let dataSourceSettings = { staff: false, trainee: false, course: false };
    try {
      const settingsStr = localStorage.getItem('dataSourceSettings');
      if (settingsStr) {
        dataSourceSettings = JSON.parse(settingsStr);
      }
      console.log('🎛️ Data source settings:', dataSourceSettings);
    } catch (e) {
      console.log('⚠️ Could not read dataSourceSettings, using defaults');
    }
    
'''
        lines.insert(i, new_code)
        break

# Update the version in the first console.log
for i, line in enumerate(lines):
    if 'console.log' in line and 'initializeData() - Starting' in line:
        lines[i] = line.replace('initializeData() - Starting data initialization', 'initializeData() v2.2 - Starting data initialization')
        break

# Find where to insert the merge logic after instructors are loaded
merge_insert_index = None
for i in range(len(lines)):
    if 'console.log' in lines[i] and 'Instructors loaded:' in lines[i]:
        merge_insert_index = i + 1
        break

if merge_insert_index:
    # Insert the merge logic
    merge_code = '''      
      // Merge with mock data if staff toggle is ON
      if (dataSourceSettings.staff) {
        console.log('🔄 Staff toggle is ON - merging database + mock data');
        instructors = mergeInstructorData(instructors, ESL_DATA.instructors);
      }
      
'''
    lines.insert(merge_insert_index, merge_code)

# Find where to insert trainee merge logic
trainee_merge_index = None
for i in range(len(lines)):
    if 'console.log' in lines[i] and 'Trainees loaded:' in lines[i]:
        trainee_merge_index = i + 1
        break

if trainee_merge_index:
    # Insert the merge logic for trainees
    trainee_merge_code = '''      
      // Merge with mock data if trainee toggle is ON
      if (dataSourceSettings.trainee) {
        console.log('🔄 Trainee toggle is ON - merging database + mock data');
        trainees = mergeTraineeData(trainees, ESL_DATA.trainees);
      }
      
'''
    lines.insert(trainee_merge_index, trainee_merge_code)

# Write back
with open('/workspace/lib/dataService.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("✅ Successfully updated dataService.ts with v2.2 changes")