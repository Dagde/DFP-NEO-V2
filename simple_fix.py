#!/usr/bin/env python3
import re

# Read the file
with open('/workspace/dfp-neo-deployment/server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the Schedule endpoint and fix it
output = []
in_schedule_endpoint = False
found_jwt_user_id = False

for i, line in enumerate(lines):
    if "app.get('/api/mobile/schedule'" in line:
        in_schedule_endpoint = True
    
    if in_schedule_endpoint:
        # Replace line with jwtUserId = req.mobileUserId
        if "const userId = req.mobileUserId;" in line and not found_jwt_user_id:
            output.append("        const jwtUserId = req.mobileUserId; // Human-readable userId (e.g., \"alexander.burns\")\n")
            # Add User lookup after this line
            output.append("\n")
            output.append("        console.log(`📅 Fetching schedule for jwtUserId=${jwtUserId}, date=${date}`);\n")
            output.append("\n")
            output.append("        // Step 1: Look up the User record by userId to get the DB id (cuid)\n")
            output.append("        const users = await db.$queryRawUnsafe(\n")
            output.append("          `SELECT id, \"userId\", \"firstName\", \"lastName\" FROM \"User\" WHERE \"userId\" = $1 LIMIT 1`,\n")
            output.append("          jwtUserId\n")
            output.append("        );\n")
            output.append("\n")
            output.append("        if (!users || users.length === 0) {\n")
            output.append("          console.log(`❌ No user found for jwtUserId=${jwtUserId}`);\n")
            output.append("          return res.status(404).json({ error: 'User not found' });\n")
            output.append("        }\n")
            output.append("\n")
            output.append("        const dbUser = users[0];\n")
            output.append("        const dbUserId = dbUser.id; // cuid - used as FK in Schedule table\n")
            output.append("        const userFullName = ((dbUser.firstName || '') + ' ' + (dbUser.lastName || '')).trim();\n")
            output.append("\n")
            output.append("        console.log(`👤 Resolved user: dbId=${dbUserId}, name=${userFullName}`);\n")
            output.append("\n")
            output.append("        // Step 2: Find schedule using database ID\n")
            found_jwt_user_id = True
            continue
        
        # Replace userId with dbUserId in the where clause
        if found_jwt_user_id and "where: {" in line and not "// Step 2:" in lines[max(0, i-10):i]:
            output.append("          where: {\n")
            output.append("            userId: dbUserId,\n")
            # Skip the next line which would have userId: userId
            i += 1
            in_schedule_endpoint = False
            found_jwt_user_id = False
            continue
    
    output.append(line)

# Write back
with open('/workspace/dfp-neo-deployment/server.js', 'w', encoding='utf-8') as f:
    f.writelines(output)

print("Schedule API fixed with simple approach!")