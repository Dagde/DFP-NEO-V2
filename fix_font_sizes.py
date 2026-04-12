filepath = "DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# FIX 1: Event font size - 20 -> 18 (in eventContent, passed to EventDropdown)
old = 'nextLMPEvent={nextLMPEvent} fontSize={20} color={flightNumber ? WHITE_FULL : WHITE_GHOST} disabled={eventCategory === \'lmp_currency\'} />'
new = 'nextLMPEvent={nextLMPEvent} fontSize={18} color={flightNumber ? WHITE_FULL : WHITE_GHOST} disabled={eventCategory === \'lmp_currency\'} />'
if old in content:
    content = content.replace(old, new)
    print("✅ Event fontSize: 20 → 18")
    changes += 1
else:
    print("❌ Could not find Event fontSize=20")

# FIX 2: Aircraft number font size - 12 -> 18
old = '<span style={{ fontFamily: monoFamily, fontSize: 12, color: \'rgba(255,255,255,0.55)\', lineHeight: 1 }}>#{aircraftNumber || \'001\'}</span>'
new = '<span style={{ fontFamily: monoFamily, fontSize: 18, color: \'rgba(255,255,255,0.55)\', lineHeight: 1 }}>#{aircraftNumber || \'001\'}</span>'
if old in content:
    content = content.replace(old, new)
    print("✅ Aircraft fontSize: 12 → 18")
    changes += 1
else:
    print("❌ Could not find aircraft fontSize=12")

# FIX 3: Callsign input font size - 12 -> 18
old = '          fontFamily: monoFamily, fontSize: 12, fontStyle: \'italic\', lineHeight: 1,'
new = '          fontFamily: monoFamily, fontSize: 18, fontStyle: \'italic\', lineHeight: 1,'
if old in content:
    content = content.replace(old, new)
    print("✅ Callsign fontSize: 12 → 18")
    changes += 1
else:
    print("❌ Could not find callsign fontSize=12")

# FIX 4: Also fix duration font size 20 -> 18 for consistency
old = '<span style={{ fontFamily: monoFamily, fontSize: 20, fontWeight: 700, color: WHITE_FULL, lineHeight: 1 }}>[{duration.toFixed(1)}]</span>'
new = '<span style={{ fontFamily: monoFamily, fontSize: 18, fontWeight: 700, color: WHITE_FULL, lineHeight: 1 }}>[{duration.toFixed(1)}]</span>'
if old in content:
    content = content.replace(old, new)
    print("✅ Duration fontSize: 20 → 18")
    changes += 1
else:
    print("❌ Could not find duration fontSize=20")

# FIX 5: Area font size 20 -> 18 for consistency  
old = '<span style={{ fontSize: 20, fontWeight: 600, color: /^[A-H]$/.test(area) ? WHITE_FULL : \'rgba(255,220,60,0.95)\', lineHeight: 1 }}>{area || \'-\'}</span>'
new = '<span style={{ fontSize: 18, fontWeight: 600, color: /^[A-H]$/.test(area) ? WHITE_FULL : \'rgba(255,220,60,0.95)\', lineHeight: 1 }}>{area || \'-\'}</span>'
if old in content:
    content = content.replace(old, new)
    print("✅ Area fontSize: 20 → 18")
    changes += 1
else:
    print("❌ Could not find area fontSize=20")

# Also fix EventDropdown's internal display font (in EventDropdown component itself)
old = '        style={{\n          fontSize,\n          fontStyle: \'italic\',\n          fontFamily: \'ui-monospace, SFMono-Regular, "Courier New", monospace\','
new = '        style={{\n          fontSize,\n          fontStyle: \'italic\',\n          fontFamily: \'ui-monospace, SFMono-Regular, "Courier New", monospace\','
# This is already dynamic (uses `fontSize` prop), so no change needed there

print(f"\nTotal changes: {changes}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("File saved.")