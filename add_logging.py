import re

with open('App.tsx', 'r') as f:
    content = f.read()

# Pattern to find the PATCH section in onUpdateInstructor
pattern = r"(const response = await fetch\(`/api/personnel/\$\{dbId\}`, \{[\s\S]*?method: 'PATCH',[\s\S]*?body: JSON\.stringify\(data\),[\s\S]*?\}\);)"

def add_logging_after_patch(match):
    original = match.group(1)
    new_logging = """
                                        
                                        console.log('📝 [APP] PATCHing existing instructor to /api/personnel/' + dbId);
                                        console.log('📝 [APP] PATCH body:', JSON.stringify(data));
                                        console.log('📝 [APP] PATCH body unavailability field:', data.unavailability);
"""
    # Insert after the closing brace of the fetch call
    return original.replace('});', '});' + new_logging)

content = re.sub(pattern, add_logging_after_patch, content)

with open('App.tsx', 'w') as f:
    f.write(content)

print("Logging added successfully")