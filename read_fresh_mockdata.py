with open('DFP-NEO-V2-fresh/mockData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the flight block
start = content.find("} else { // It's a flight")
end = content.find("type = 'Flight';", start) + 200
if start != -1:
    print("=== CURRENT FLIGHT BLOCK ===")
    print(content[start:end])
    print()

# Find flightOrSimHours values
import re
matches = list(re.finditer(r'flightOrSimHours\s*=\s*[\d\.]+', content))
print(f"\nAll flightOrSimHours assignments ({len(matches)}):")
for m in matches:
    print(f"  Position {m.start()}: {m.group()}")
    print(f"  Context: {content[max(0,m.start()-100):m.end()+100]}")
    print()