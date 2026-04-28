with open('dfp-neo-deployment/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

# Find the SECOND occurrence of "// Append to existing unavailability array"
# (the first is quick, the second is custom)
append_lines = []
for i, line in enumerate(lines):
    if '// Append to existing unavailability array' in line:
        append_lines.append(i)
        print(f"Found append at line {i+1}: {repr(line[:60])}")

if len(append_lines) < 2:
    print(f"ERROR: Expected 2 append lines, found {len(append_lines)}")
    exit(1)

custom_append_line = append_lines[1]  # second occurrence = custom endpoint

# Find the "const updated = [...existing, newPeriod];" after custom_append_line
updated_line = None
for i in range(custom_append_line, custom_append_line + 10):
    if 'const updated = [...existing, newPeriod]' in lines[i]:
        updated_line = i
        print(f"Found 'const updated' at line {i+1}: {repr(lines[i][:60])}")
        break

if updated_line is None:
    print("ERROR: Could not find 'const updated' line for custom endpoint")
    exit(1)

# Dedup block for custom unavailability (matches on startDateTime/endDateTime/reason)
dedup_block = '''         // ── Deduplication check ───────────────────────────────────────────────
         // Prevent duplicate entries if the iOS app retries or the user submits twice.
         // For custom unavailability, match on startDate, endDate, startTime, endTime, reason.
         const startDateOnly = startDateTime ? startDateTime.split('T')[0] : '';
         const endDateOnly   = endDateTime   ? endDateTime.split('T')[0]   : '';
         const startTimeOnly = startDateTime && startDateTime.includes('T')
           ? startDateTime.split('T')[1].substring(0, 5) : startTime;
         const endTimeOnly   = endDateTime   && endDateTime.includes('T')
           ? endDateTime.split('T')[1].substring(0, 5)   : endTime;

         const isDuplicate = existing.some(e =>
           e.startDate === startDateOnly &&
           e.endDate   === endDateOnly   &&
           String(e.startTime || '').replace(':', '') === String(startTimeOnly || '').replace(':', '') &&
           String(e.endTime   || '').replace(':', '') === String(endTimeOnly   || '').replace(':', '') &&
           e.reason    === reasonId
         );

         if (isDuplicate) {
           const existingEntry = existing.find(e =>
             e.startDate === startDateOnly && e.endDate === endDateOnly && e.reason === reasonId
           );
           console.log('\\u26a0\\ufe0f POST /api/mobile/unavailability/create - DUPLICATE for userId=' + humanUserId + ', start=' + startDateTime + ' - returning existing entry');
           return res.json({
             id: existingEntry.id,
             status: 'approved',
             startDateTime,
             endDateTime,
             reason: { id: reasonId, code: reasonId, description: reasonId, requiresApproval: false },
             notes: notes || null,
             submittedAt: new Date().toISOString(),
             message: `Unavailability already registered from ${startDateOnly} to ${endDateOnly}`,
           });
         }
         // ── End deduplication check ───────────────────────────────────────────

'''

# Insert dedup block before the 'const updated' line
new_lines = lines[:updated_line] + dedup_block.split('\n') + lines[updated_line:]
new_content = '\n'.join(new_lines)

with open('dfp-neo-deployment/server.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"SUCCESS: Custom endpoint dedup block inserted before line {updated_line+1}")
print(f"New file size: {len(new_content)} chars")