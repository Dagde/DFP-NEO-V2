import re

# Read the file
with open('/workspace/dfp-neo-platform/lib/auth.ts', 'r') as f:
    content = f.read()

# Fix indentation for username in Session interface
content = content.replace(
    '        userId: string;\n          username: string;',
    '        userId: string;\n        username: string;'
)

# Fix indentation for username in User interface
content = content.replace(
    '        userId: string;\n          username: string;',
    '        userId: string;\n        username: string;'
)

# Fix indentation in authorize return
content = content.replace(
    '            role: user.role,\n              username: user.username,\n          };',
    '            role: user.role,\n            username: user.username,\n          };'
)

# Fix indentation in jwt callback
content = content.replace(
    '          token.userId = user.userId;\n            token.username = user.username;',
    '          token.userId = user.userId;\n          token.username = user.username;'
)

# Fix indentation in session callback
content = content.replace(
    '          session.user.userId = token.userId as string;\n            session.user.username = token.username as string;',
    '          session.user.userId = token.userId as string;\n          session.user.username = token.username as string;'
)

# Write the file
with open('/workspace/dfp-neo-platform/lib/auth.ts', 'w') as f:
    f.write(content)

print("Fixed indentation in auth.ts")