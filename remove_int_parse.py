# Read the file
with open('App.tsx', 'r') as f:
    content = f.read()

# Remove parseInt and compare as strings
content = content.replace(
    "i.name === user.name && i.idNumber === parseInt(user.pmkeysId || '0')",
    "i.name === user.name && i.idNumber === user.pmkeysId"
)

content = content.replace(
    "t.name === user.name && t.idNumber === parseInt(user.pmkeysId || '0')",
    "t.name === user.name && t.idNumber === user.pmkeysId"
)

# Write back
with open('App.tsx', 'w') as f:
    f.write(content)

print("✅ Removed parseInt, now comparing as strings")