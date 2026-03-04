# Read the file
with open('/workspace/dfp-neo-platform/lib/auth.ts', 'r') as f:
    lines = f.readlines()

# Fix lines with extra indentation
new_lines = []
for i, line in enumerate(lines):
    # Fix username in Session interface (line 11)
    if 'username: string;' in line and i == 10:
        new_lines.append('        username: string;\n')
    # Fix username in User interface (line 18)
    elif 'username: string;' in line and i == 17:
        new_lines.append('        username: string;\n')
    # Fix username in authorize return (line 46)
    elif 'username: user.username,' in line and i == 45:
        new_lines.append('            username: user.username,\n')
    # Fix username in jwt callback (line 57)
    elif 'token.username = user.username;' in line and i == 56:
        new_lines.append('          token.username = user.username;\n')
    # Fix username in session callback (line 66)
    elif 'session.user.username = token.username as string;' in line and i == 65:
        new_lines.append('          session.user.username = token.username as string;\n')
    else:
        new_lines.append(line)

# Write the file
with open('/workspace/dfp-neo-platform/lib/auth.ts', 'w') as f:
    f.writelines(new_lines)

print("Fixed indentation in auth.ts")