filepath = 'DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File: {content.count(chr(10))} lines, {len(content)} bytes")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 1: Add ReactDOM import for Portal
# ═══════════════════════════════════════════════════════════════════════════════
old_import = "import React, { useState, useMemo, useEffect, useRef } from 'react';"
new_import = "import React, { useState, useMemo, useEffect, useRef } from 'react';\nimport ReactDOM from 'react-dom';"

if old_import in content:
    content = content.replace(old_import, new_import, 1)
    print("✅ FIX 1: ReactDOM import added")
else:
    print("❌ FIX 1: import line not found")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 2: Rewrite PersonDropdown to use a Portal for the dropdown panel
#         so it always renders at document body level with correct z-index,
#         completely outside any tile overflow/stacking context.
#         Also add a zIndex prop so PIC (9000) > coPilot (8000).
# ═══════════════════════════════════════════════════════════════════════════════
old_person_interface = (
    "interface PersonDropdownProps {\n"
    "  value: string;\n"
    "  onChange: (name: string, callsigns: string[]) => void;\n"
    "  allUnits: string[];\n"
    "  getLayer2: (unit: string) => string[];\n"
    "  getNames: (unit: string, sel: string) => { name: string; label: string; color?: string }[];\n"
    "  placeholder: string;\n"
    "  fontSize: number;\n"
    "  color: string;\n"
    "  bold?: boolean;\n"
    "  allowSolo?: boolean;    // shows SOLO as first option\n"
    "  onSoloSelect?: () => void;\n"
    "}"
)
new_person_interface = (
    "interface PersonDropdownProps {\n"
    "  value: string;\n"
    "  onChange: (name: string, callsigns: string[]) => void;\n"
    "  allUnits: string[];\n"
    "  getLayer2: (unit: string) => string[];\n"
    "  getNames: (unit: string, sel: string) => { name: string; label: string; color?: string }[];\n"
    "  placeholder: string;\n"
    "  fontSize: number;\n"
    "  color: string;\n"
    "  bold?: boolean;\n"
    "  allowSolo?: boolean;    // shows SOLO as first option\n"
    "  onSoloSelect?: () => void;\n"
    "  dropdownZIndex?: number; // z-index for the portal dropdown (default 9000)\n"
    "}"
)

if old_person_interface in content:
    content = content.replace(old_person_interface, new_person_interface, 1)
    print("✅ FIX 2: dropdownZIndex prop added to PersonDropdownProps")
else:
    print("❌ FIX 2: PersonDropdownProps not found")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 3: Rewrite PersonDropdown component body to use Portal
# ═══════════════════════════════════════════════════════════════════════════════
old_person_component = (
    "const PersonDropdown: React.FC<PersonDropdownProps> = ({\n"
    "  value, onChange, allUnits, getLayer2, getNames,\n"
    "  placeholder, fontSize, color, bold = false, allowSolo, onSoloSelect,\n"
    "}) => {\n"
    "  const [open, setOpen] = useState(false);\n"
    "  const [hovUnit, setHovUnit] = useState<string | null>(null);\n"
    "  const [hovL2, setHovL2] = useState<string | null>(null);\n"
    "  const ref = useRef<HTMLDivElement>(null);\n"
    "\n"
    "  useEffect(() => {\n"
    "    const handler = (e: MouseEvent) => {\n"
    "      if (ref.current && !ref.current.contains(e.target as Node)) {\n"
    "        setOpen(false);\n"
    "      }\n"
    "    };\n"
    "    document.addEventListener('mousedown', handler);\n"
    "    return () => document.removeEventListener('mousedown', handler);\n"
    "  }, []);\n"
    "\n"
    "  return (\n"
    "    <div ref={ref} style={{ position: 'relative' }}>\n"
    "      <div\n"
    "        onClick={() => setOpen(o => !o)}\n"
    "        style={{\n"
    "          fontSize,\n"
    "          fontWeight: bold ? 700 : 400,\n"
    "          fontStyle: 'italic',\n"
    "          color,\n"
    "          cursor: 'pointer',\n"
    "          userSelect: 'none',\n"
    "          whiteSpace: 'nowrap',\n"
    "          overflow: 'hidden',\n"
    "          textOverflow: 'ellipsis',\n"
    "          minWidth: 120,\n"
    "          padding: '2px 4px',\n"
    "          borderRadius: 3,\n"
    "        }}\n"
    "        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}\n"
    "        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}\n"
    "      >\n"
    "        {value || placeholder}\n"
    "      </div>\n"
    "\n"
    "      {open && (\n"
    "        <div\n"
    "          onClick={e => e.stopPropagation()}\n"
    "          style={{\n"
    "            position: 'absolute',\n"
    "            top: '100%',\n"
    "            left: 0,\n"
    "            zIndex: 2000,\n"
    "            display: 'flex',\n"
    "            width: 520,\n"
    "            maxHeight: 300,\n"
    "            backgroundColor: '#1a2f4a',\n"
    "            borderRadius: 8,\n"
    "            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',\n"
    "            overflow: 'hidden',\n"
    "            marginTop: 4,\n"
    "            border: '1px solid rgba(255,255,255,0.12)',\n"
    "          }}\n"
    "        >"
)

new_person_component = (
    "const PersonDropdown: React.FC<PersonDropdownProps> = ({\n"
    "  value, onChange, allUnits, getLayer2, getNames,\n"
    "  placeholder, fontSize, color, bold = false, allowSolo, onSoloSelect,\n"
    "  dropdownZIndex = 9000,\n"
    "}) => {\n"
    "  const [open, setOpen] = useState(false);\n"
    "  const [hovUnit, setHovUnit] = useState<string | null>(null);\n"
    "  const [hovL2, setHovL2] = useState<string | null>(null);\n"
    "  const ref = useRef<HTMLDivElement>(null);\n"
    "  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });\n"
    "\n"
    "  useEffect(() => {\n"
    "    const handler = (e: MouseEvent) => {\n"
    "      if (ref.current && !ref.current.contains(e.target as Node)) {\n"
    "        // Also check if click was inside the portal dropdown\n"
    "        const portalEl = document.getElementById('person-dropdown-portal');\n"
    "        if (portalEl && portalEl.contains(e.target as Node)) return;\n"
    "        setOpen(false);\n"
    "      }\n"
    "    };\n"
    "    document.addEventListener('mousedown', handler);\n"
    "    return () => document.removeEventListener('mousedown', handler);\n"
    "  }, []);\n"
    "\n"
    "  const handleOpen = () => {\n"
    "    if (ref.current) {\n"
    "      const rect = ref.current.getBoundingClientRect();\n"
    "      setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });\n"
    "    }\n"
    "    setOpen(o => !o);\n"
    "  };\n"
    "\n"
    "  // Portal dropdown rendered at document.body level\n"
    "  const dropdownPanel = open ? ReactDOM.createPortal(\n"
    "    <div\n"
    "      id=\"person-dropdown-portal\"\n"
    "      onClick={e => e.stopPropagation()}\n"
    "      style={{\n"
    "        position: 'fixed',\n"
    "        top: dropdownPos.top - window.scrollY,\n"
    "        left: dropdownPos.left,\n"
    "        zIndex: dropdownZIndex,\n"
    "        display: 'flex',\n"
    "        width: 520,\n"
    "        maxHeight: 300,\n"
    "        backgroundColor: '#1a2f4a',\n"
    "        borderRadius: 8,\n"
    "        boxShadow: '0 8px 32px rgba(0,0,0,0.85)',\n"
    "        overflow: 'hidden',\n"
    "        border: '1px solid rgba(255,255,255,0.18)',\n"
    "      }}\n"
    "    >\n"
    "      {/* Col 1: Units */}\n"
    "      <div style={{ width: 110, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 300, backgroundColor: '#1a2f4a' }}>\n"
    "        {allowSolo && (\n"
    "          <div\n"
    "            onClick={() => { onSoloSelect?.(); setOpen(false); }}\n"
    "            style={{ padding: '9px 12px', color: '#ffd43b', fontWeight: 700, fontSize: 13, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'transparent' }}\n"
    "            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,212,59,0.15)')}\n"
    "            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}\n"
    "          >\n"
    "            SOLO\n"
    "          </div>\n"
    "        )}\n"
    "        {allUnits.map(unit => (\n"
    "          <div\n"
    "            key={unit}\n"
    "            onMouseEnter={() => { setHovUnit(unit); setHovL2(null); }}\n"
    "            onClick={() => setHovUnit(unit)}\n"
    "            style={{\n"
    "              padding: '9px 12px', fontSize: 13, cursor: 'pointer',\n"
    "              display: 'flex', justifyContent: 'space-between', alignItems: 'center',\n"
    "              color: hovUnit === unit ? '#fff' : 'rgba(255,255,255,0.8)',\n"
    "              backgroundColor: hovUnit === unit ? 'rgba(255,255,255,0.12)' : 'transparent',\n"
    "            }}\n"
    "          >\n"
    "            {unit}\n"
    "            <span style={{ fontSize: 9, opacity: 0.5 }}>\u25b6</span>\n"
    "          </div>\n"
    "        ))}\n"
    "      </div>\n"
    "\n"
    "      {/* Col 2: STAFF / Courses */}\n"
    "      <div style={{ width: 130, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 300, backgroundColor: '#16293f' }}>\n"
    "        {hovUnit ? (\n"
    "          getLayer2(hovUnit).map(opt => (\n"
    "            <div\n"
    "              key={opt}\n"
    "              onMouseEnter={() => setHovL2(opt)}\n"
    "              onClick={() => setHovL2(opt)}\n"
    "              style={{\n"
    "                padding: '9px 12px', fontSize: 13, cursor: 'pointer',\n"
    "                display: 'flex', justifyContent: 'space-between', alignItems: 'center',\n"
    "                fontWeight: opt === 'STAFF' ? 600 : 400,\n"
    "                color: hovL2 === opt ? '#fff' : 'rgba(255,255,255,0.8)',\n"
    "                backgroundColor: hovL2 === opt ? 'rgba(255,255,255,0.12)' : 'transparent',\n"
    "              }}\n"
    "            >\n"
    "              {opt}\n"
    "              <span style={{ fontSize: 9, opacity: 0.5 }}>\u25b6</span>\n"
    "            </div>\n"
    "          ))\n"
    "        ) : (\n"
    "          <div style={{ padding: '16px 12px', color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center' }}>\n"
    "            Select unit\n"
    "          </div>\n"
    "        )}\n"
    "      </div>\n"
    "\n"
    "      {/* Col 3: Names */}\n"
    "      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 300, backgroundColor: '#122437' }}>\n"
    "        {hovUnit && hovL2 ? (\n"
    "          getNames(hovUnit, hovL2).map(person => (\n"
    "            <div\n"
    "              key={person.name}\n"
    "              onClick={() => {\n"
    "                onChange(person.name, []);\n"
    "                setOpen(false);\n"
    "                setHovUnit(null);\n"
    "                setHovL2(null);\n"
    "              }}\n"
    "              style={{\n"
    "                padding: '9px 12px', fontSize: 13, cursor: 'pointer',\n"
    "                color: person.color || '#fff',\n"
    "                backgroundColor: 'transparent',\n"
    "                whiteSpace: 'nowrap',\n"
    "              }}\n"
    "              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}\n"
    "              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}\n"
    "            >\n"
    "              {person.label}\n"
    "            </div>\n"
    "          ))\n"
    "        ) : (\n"
    "          <div style={{ padding: '16px 12px', color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center' }}>\n"
    "            {hovUnit ? 'Select category' : 'Select unit'}\n"
    "          </div>\n"
    "        )}\n"
    "      </div>\n"
    "    </div>,\n"
    "    document.body\n"
    "  ) : null;\n"
    "\n"
    "  return (\n"
    "    <div ref={ref} style={{ position: 'relative' }}>\n"
    "      <div\n"
    "        onClick={handleOpen}\n"
    "        style={{\n"
    "          fontSize,\n"
    "          fontWeight: bold ? 700 : 400,\n"
    "          fontStyle: 'italic',\n"
    "          color,\n"
    "          cursor: 'pointer',\n"
    "          userSelect: 'none',\n"
    "          whiteSpace: 'nowrap',\n"
    "          overflow: 'hidden',\n"
    "          textOverflow: 'ellipsis',\n"
    "          minWidth: 120,\n"
    "          padding: '2px 4px',\n"
    "          borderRadius: 3,\n"
    "        }}\n"
    "        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}\n"
    "        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}\n"
    "      >\n"
    "        {value || placeholder}\n"
    "      </div>\n"
    "      {dropdownPanel}\n"
    "    </div>\n"
    "  );\n"
    "};"
)

# Find the old component - it spans from the function definition to the closing };
# We need to find the exact old text to replace
# The old component ends after the closing brace of the return and the };
# Let's find it carefully

old_start = "const PersonDropdown: React.FC<PersonDropdownProps> = ({"
old_end = "};\n\n// ─── Event (syllabus) cascading dropdown"

start_idx = content.find(old_start)
end_idx = content.find(old_end)

if start_idx >= 0 and end_idx >= 0:
    old_full = content[start_idx:end_idx + len("};\n")]
    content = content[:start_idx] + new_person_component + "\n\n// ─── Event (syllabus) cascading dropdown" + content[end_idx + len(old_end):]
    print(f"✅ FIX 3: PersonDropdown rewritten with Portal (removed {len(old_full)} chars, added {len(new_person_component)} chars)")
else:
    print(f"❌ FIX 3: PersonDropdown boundaries not found (start={start_idx}, end={end_idx})")
    # Try alternate end marker
    old_end2 = "};\n\n// \u2500\u2500\u2500 Event"
    end_idx2 = content.find(old_end2, start_idx)
    print(f"  Alternate end search: {end_idx2}")
    if end_idx2 >= 0:
        print(repr(content[end_idx2:end_idx2+50]))

# ── Write result ──────────────────────────────────────────────────────────────
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone. File: {content.count(chr(10))} lines, {len(content)} bytes")