#!/usr/bin/env python3

with open('/workspace/components/StaffDatabaseTable.tsx', 'r') as f:
    content = f.read()

# Add console.log after fetch call
content = content.replace(
    "const response = await fetch('/api/personnel');",
    "console.log('🔍 StaffDatabaseTable: Fetching from /api/personnel');\n        const response = await fetch('/api/personnel');"
)

# Add console.log after response.json()
content = content.replace(
    "const data = await response.json();\n        \n        if (data.personnel && Array.isArray(data.personnel)) {",
    "const data = await response.json();\n        console.log('📊 StaffDatabaseTable: API Response:', data);\n        \n        if (data.personnel && Array.isArray(data.personnel)) {"
)

# Add console.log for total count
content = content.replace(
    "if (data.personnel && Array.isArray(data.personnel)) {\n          // Filter to show ONLY real database staff",
    "if (data.personnel && Array.isArray(data.personnel)) {\n          console.log(`📊 StaffDatabaseTable: Total personnel in DB: ${data.personnel.length}`);\n          // Filter to show ONLY real database staff"
)

# Add console.log for filtered count and fix error log
content = content.replace(
    "const realStaff = data.personnel.filter((staff: DatabaseStaff) => \n            staff.userId !== null && staff.userId !== undefined && staff.userId !== ''\n          );\n          setStaffData(realStaff);",
    "const realStaff = data.personnel.filter((staff: DatabaseStaff) => \n            staff.userId !== null && staff.userId !== undefined && staff.userId !== ''\n          );\n          console.log(`✅ StaffDatabaseTable: Real staff with userId: ${realStaff.length}`);\n          setStaffData(realStaff);"
)

# Update error log
content = content.replace(
    "console.error('Error fetching database staff:', err);",
    "console.error('❌ Error fetching database staff:', err);"
)

with open('/workspace/components/StaffDatabaseTable.tsx', 'w') as f:
    f.write(content)

print("✅ Debug logging added successfully")