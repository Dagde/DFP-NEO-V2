# Fix: Move mobile API endpoints BEFORE the catch-all route
# The catch-all app.get('*') at line 6893 must come AFTER all API routes

with open('/workspace/dfp-neo-deployment/server.js', 'r') as f:
    content = f.read()
    lines = f.readlines()

# Re-read lines properly
with open('/workspace/dfp-neo-deployment/server.js', 'r') as f:
    lines = f.readlines()

total = len(lines)
print(f"Total lines: {total}")

# Find the key section boundaries (0-indexed)
catchall_line = None
mobile_api_section_start = None  # The "// MOBILE API ENDPOINTS" comment block
app_listen_line = None

for i, line in enumerate(lines):
    if "app.get('*'" in line and catchall_line is None:
        catchall_line = i
    if '// MOBILE API ENDPOINTS' in line and mobile_api_section_start is None:
        mobile_api_section_start = i
    if 'app.listen(PORT' in line:
        app_listen_line = i

print(f"Catch-all route at line: {catchall_line + 1}")
print(f"Mobile API section starts at line: {mobile_api_section_start + 1}")
print(f"app.listen at line: {app_listen_line + 1}")

# The structure is:
# lines 0 to catchall_line-1 : everything before catch-all (keep)
# lines catchall_line to mobile_api_section_start-1 : catch-all + START SERVER comment (move to end)
# lines mobile_api_section_start to app_listen_line-1 : mobile API endpoints (move before catch-all)
# lines app_listen_line to end : app.listen (keep at end)

before_catchall = lines[:catchall_line]
catchall_block = lines[catchall_line:mobile_api_section_start]  # catch-all + START SERVER comment
mobile_api_block = lines[mobile_api_section_start:app_listen_line]
app_listen_block = lines[app_listen_line:]

print(f"\nBefore catch-all: {len(before_catchall)} lines")
print(f"Catch-all block: {len(catchall_block)} lines")
print(f"Mobile API block: {len(mobile_api_block)} lines")
print(f"App listen block: {len(app_listen_block)} lines")

# New order: before_catchall + mobile_api_block + catchall_block + app_listen_block
new_lines = before_catchall + mobile_api_block + catchall_block + app_listen_block

print(f"\nNew total lines: {len(new_lines)}")

# Verify the fix
new_content = ''.join(new_lines)

# Find positions in new content
for i, line in enumerate(new_lines):
    if "app.get('*'" in line:
        print(f"Catch-all now at line: {i + 1}")
    if '// MOBILE API ENDPOINTS' in line:
        print(f"Mobile API section now at line: {i + 1}")
    if 'app.listen(PORT' in line:
        print(f"app.listen now at line: {i + 1}")

with open('/workspace/dfp-neo-deployment/server.js', 'w') as f:
    f.write(new_content)

print("\n✅ server.js reordered successfully!")