# Read the file
with open('App.tsx', 'r') as f:
    content = f.read()

# Replace the specific comparison patterns with && instead of ||
# Pattern 1: i.name === user.name || i.idNumber === parseInt(user.pmkeysId || '0')
content = content.replace(
    "i.name === user.name || i.idNumber === parseInt(user.pmkeysId || '0')",
    "i.name === user.name && i.idNumber === parseInt(user.pmkeysId || '0')"
)

# Pattern 2: t.name === user.name || t.idNumber === parseInt(user.pmkeysId || '0')
content = content.replace(
    "t.name === user.name || t.idNumber === parseInt(user.pmkeysId || '0')",
    "t.name === user.name && t.idNumber === parseInt(user.pmkeysId || '0')"
)

# Write back
with open('App.tsx', 'w') as f:
    f.write(content)

print("✅ Replaced || with && in comparison logic")