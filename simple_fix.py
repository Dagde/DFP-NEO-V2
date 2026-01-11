# Read the file
with open('App.tsx', 'r') as f:
    lines = f.readlines()

# Fix line 2933 (instructor comparison in first instance)
# Fix line 3003 (instructor comparison in second instance)
# Fix line 3618 (instructor comparison in third instance)
# Fix line 8823 (instructor comparison - this is the one being used)

# Change || to && on line 8823
lines[8822] = lines[8822].replace('||', '&&')

# Change || to && on line 8837 (trainee comparison)
lines[8836] = lines[8836].replace('||', '&&')

# Write back
with open('App.tsx', 'w') as f:
    f.writelines(lines)

print("✅ Changed || to && on lines 8823 and 8837")