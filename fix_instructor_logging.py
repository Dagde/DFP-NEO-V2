import re

# Read the file
with open('App.tsx', 'r') as f:
    content = f.read()

# Find and replace the first duplicated onUpdateInstructor (around line 13851)
# Pattern: the duplicated dbId and try declarations
pattern1 = r"(console\.log\('📝 \[APP\] Instructor DB ID:', dbId\);\s*\n\s*try \{)(\s+const dbId = \(data as any\)\.id;\s*\n\s*try \{)"

replacement1 = r"\1"

content = re.sub(pattern1, replacement1, content, count=1)

# Find and replace the second duplicated onUpdateInstructor (around line 13941)
pattern2 = r"(console\.log\('📝 \[APP\] Instructor DB ID:', dbId\);\s*\n\s*try \{)(\s+const dbId = \(data as any\)\.id;\s*\n\s*try \{)"

replacement2 = r"\1"

content = re.sub(pattern2, replacement2, content, count=1)

# Add logging after the PATCH call in both instances
# Pattern 1: After the PATCH fetch in first instance
pattern3 = r"(const response = await fetch\(`/api/personnel/\$\{dbId\}`, \{[\s\S]*?body: JSON\.stringify\(data\),[\s\S]*?\}\);)(\s*if \(\!response\.ok\) \{)"

replacement3 = r"\1\n                                        \n                                        console.log('📝 [APP] PATCHing existing instructor to /api/personnel/' + dbId);\n                                        console.log('📝 [APP] PATCH body:', JSON.stringify(data));\n                                        console.log('📝 [APP] PATCH body unavailability field:', data.unavailability);\n                                        \n                                        console.log('📝 [APP] PATCH response status:', response.status);\n                                        console.log('📝 [APP] PATCH response ok:', response.ok);\n                                        \n                                        if (response.ok) {\n                                            const responseData = await response.json();\n                                            console.log('📝 [APP] PATCH response data:', responseData);\n                                        }\n                                        \2"

content = re.sub(pattern3, replacement3, content, count=2)

# Write the file
with open('App.tsx', 'w') as f:
    f.write(content)

print("Instructor logging fixed")