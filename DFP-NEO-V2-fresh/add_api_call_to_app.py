#!/usr/bin/env python3
"""
Add API call to App.tsx onUpdateInstructor handler
"""

import re

# Read the file
with open('/workspace/App.tsx', 'r') as f:
    content = f.read()

# Find the onUpdateInstructor handler and replace it
old_handler = '''onUpdateInstructor={(data) => {
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

new_handler = '''onUpdateInstructor={async (data) => {
                                console.log('🔍 [DATA TRACKING] Instructor update/save called');
                                console.log('🔍 [DATA TRACKING] Instructor data:', data);
                                console.log('🔍 [DATA TRACKING] Instructor ID:', data.idNumber);
                                console.log('🔍 [DATA TRACKING] Instructor name:', data.name);
                                console.log('🔍 [DATA TRACKING] Instructor category:', data.category);
                                console.log('🔍 [DATA TRACKING] Instructor unit:', data.unit);
                                console.log('🔍 [DATA TRACKING] Instructor role:', data.role);

                                try {
                                    // Call API to save to database
                                    console.log('🔍 [DATA TRACKING] Calling /api/personnel POST endpoint');
                                    const response = await fetch('/api/personnel', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify(data),
                                    });

                                    if (!response.ok) {
                                        const errorData = await response.json();
                                        console.error('❌ [DATA TRACKING] API call failed:', response.status, errorData);
                                        throw new Error(`Failed to save: ${response.status} ${errorData.error || 'Unknown error'}`);
                                    }

                                    const result = await response.json();
                                    console.log('✅ [DATA TRACKING] Saved to database successfully');
                                    console.log('✅ [DATA TRACKING] API Response:', result);

                                } catch (error) {
                                    console.error('❌ [DATA TRACKING] Error saving to database:', error);
                                    // Continue with local state update even if API fails
                                    console.log('⚠️ [DATA TRACKING] Continuing with local state update');
                                }

                                // Update local state
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

content = content.replace(old_handler, new_handler)

# Write back
with open('/workspace/App.tsx', 'w') as f:
    f.write(content)

print("✅ Added API call to App.tsx onUpdateInstructor handler")