#!/usr/bin/env python3
"""
Add data tracking to handleAddIndividual function in InstructorListView.tsx
"""

import re

# Read the file
with open('/workspace/components/InstructorListView.tsx', 'r') as f:
    content = f.read()

# Find the handleAddIndividual function and add tracking
old_function = '''  const handleAddIndividual = () => {
    setShowAddChoice(false);
    setIsArchiveMode(false);
    setSelectedInstructor(null);
    setNewInstructorTemplate(generateNewInstructorTemplate());
    setIsAddingNew(true);
    setIsClosing(false);
    setOriginRect(null); // Center animation for new
  };'''

new_function = '''  const handleAddIndividual = () => {
    console.log('🔍 [DATA TRACKING] Add Staff button clicked');
    console.log('🔍 [DATA TRACKING] Current instructors count:', instructorsData.length);
    setShowAddChoice(false);
    setIsArchiveMode(false);
    setSelectedInstructor(null);
    const newTemplate = generateNewInstructorTemplate();
    console.log('🔍 [DATA TRACKING] New instructor template created:', newTemplate);
    setNewInstructorTemplate(newTemplate);
    setIsAddingNew(true);
    setIsClosing(false);
    setOriginRect(null); // Center animation for new
  };'''

content = content.replace(old_function, new_function)

# Write back
with open('/workspace/components/InstructorListView.tsx', 'w') as f:
    f.write(content)

print("✅ Added tracking to handleAddIndividual function")