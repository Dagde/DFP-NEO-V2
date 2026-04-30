with open('components/FlightDetailModal.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')

# Print the exact lines to confirm
print("Lines 2374-2445:")
for i in range(2374, min(2446, len(lines))):
    print(f"{i}: {lines[i]}")