#!/usr/bin/env python3
"""
Add data tracking to App.tsx for instructor updates
"""

import re

# Read the file
with open('/workspace/App.tsx', 'r') as f:
    content = f.read()

# Find the onUpdateInstructor function and add tracking
old_function = '''onUpdateInstructor={(data) => {
                                setInstructorsData(prev => {
                                    const exists = prev.some(i => i.idNumber === data.idNumber);
                                    if (exists) {
                                        return prev.map(i => i.idNumber === data.idNumber ? data : i);
                                    }
                                    return [...prev, data];
                                });
                            }}'''

new_function = '''onUpdateInstructor={(data) => {
                                console.log('🔍 [DATA TRACKING] Instructor update/save called');
                                console.log('🔍 [DATA TRACKING] Instructor data:', data);
                                console.log('🔍 [DATA TRACKING] Instructor ID:', data.idNumber);
                                console.log('🔍 [DATA TRACKING] Instructor name:', data.name);
                                console.log('🔍 [DATA TRACKING] Instructor category:', data.category);
                                console.log('🔍 [DATA TRACKING] Instructor unit:', data.unit);
                                console.log('🔍 [DATA TRACKING] Instructor role:', data.role);
                                setInstructorsData(prev => {
                                    const exists = prev.some(i => i.idNumber === data.idNumber);
                                    if (exists) {
                                        console.log('🔍 [DATA TRACKING] Updating existing instructor');
                                        return prev.map(i => i.idNumber === data.idNumber ? data : i);
                                    }
                                    console.log('🔍 [DATA TRACKING] Adding new instructor to state');
                                    console.log('🔍 [DATA TRACKING] Total instructors before:', prev.length);
                                    const result = [...prev, data];
                                    console.log('🔍 [DATA TRACKING] Total instructors after:', result.length);
                                    return result;
                                });
                            }}'''

content = content.replace(old_function, new_function)

# Write back
with open('/workspace/App.tsx', 'w') as f:
    f.write(content)

print("✅ Added tracking to App.tsx onUpdateInstructor function")