filepath = 'DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File: {content.count(chr(10))} lines, {len(content)} bytes")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 1: Make cascade dropdown panels solid (no transparency)
# ═══════════════════════════════════════════════════════════════════════════════

# Fix Col 2 background: rgba(0,0,0,0.1) -> #16293f (solid)
old_col2_bg = "{ width: 130, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 300, backgroundColor: 'rgba(0,0,0,0.1)' }"
new_col2_bg = "{ width: 130, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 300, backgroundColor: '#16293f' }"

if old_col2_bg in content:
    content = content.replace(old_col2_bg, new_col2_bg, 1)
    print("✅ FIX 1a: Col 2 background made solid")
else:
    print("❌ FIX 1a: Col 2 background not found")
    idx = content.find("rgba(0,0,0,0.1)")
    if idx >= 0:
        print(repr(content[idx-50:idx+100]))

# Fix Col 3 background: rgba(0,0,0,0.2) -> #122437 (solid, slightly darker)
old_col3_bg = "{ flex: 1, overflowY: 'auto', maxHeight: 300, backgroundColor: 'rgba(0,0,0,0.2)' }"
new_col3_bg = "{ flex: 1, overflowY: 'auto', maxHeight: 300, backgroundColor: '#122437' }"

if old_col3_bg in content:
    content = content.replace(old_col3_bg, new_col3_bg, 1)
    print("✅ FIX 1b: Col 3 background made solid")
else:
    print("❌ FIX 1b: Col 3 background not found")
    idx = content.find("rgba(0,0,0,0.2)")
    if idx >= 0:
        print(repr(content[idx-50:idx+100]))

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 2: Also check EventDropdown for transparency issues
# ═══════════════════════════════════════════════════════════════════════════════
# Check if EventDropdown has same issue
if "rgba(0,0,0,0." in content:
    import re
    matches = [(m.start(), m.group()) for m in re.finditer(r'rgba\(0,0,0,0\.[12]\)', content)]
    for idx, m in matches:
        print(f"  Still transparent at {idx}: {repr(content[idx-30:idx+50])}")
else:
    print("✅ No remaining rgba(0,0,0,0.x) backgrounds found")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 3: Make callsign ALWAYS show an editable input with dropdown overlay
#         regardless of whether callsignOptions has 0, 1, or many items.
#         - Always show editable text input
#         - If callsignOptions has items, overlay a transparent select on top
#           AND show a small dropdown arrow indicator
# ═══════════════════════════════════════════════════════════════════════════════
old_callsign_content = (
    "  const callsignContent = (zOverride?: number) => (\n"
    "    callsignOptions.length > 1 ? (\n"
    "      <div style={{ position: 'relative' }}>\n"
    "        <span style={{ fontFamily: monoFamily, fontSize: 14, fontStyle: 'italic', color: callsign ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.30)', lineHeight: 1 }}>\n"
    "          {callsign || 'CALLSGN'}\n"
    "        </span>\n"
    "        <select value={callsign} onChange={e => onCallsignChange(e.target.value)}\n"
    "          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: zOverride ?? 10 }}>\n"
    "          <option value=\"\" style={{ background: '#1a2f4a' }}>\u2014</option>\n"
    "          {callsignOptions.map(cs => <option key={cs} value={cs} style={{ background: '#1a2f4a' }}>{cs}</option>)}\n"
    "        </select>\n"
    "      </div>\n"
    "    ) : (\n"
    "      <input type=\"text\" value={callsign} onChange={e => onCallsignChange(e.target.value)}\n"
    "        style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: monoFamily, fontSize: 14, fontStyle: 'italic', lineHeight: 1,\n"
    "          color: callsign ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.30)', width: 80, padding: 0, cursor: 'text' }}\n"
    "        placeholder=\"CALLSGN\" />\n"
    "    )\n"
    "  );"
)

new_callsign_content = (
    "  const callsignContent = (zOverride?: number) => (\n"
    "    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 2 }}>\n"
    "      {/* Editable text input — always visible and typeable */}\n"
    "      <input\n"
    "        type=\"text\"\n"
    "        value={callsign}\n"
    "        onChange={e => onCallsignChange(e.target.value)}\n"
    "        placeholder=\"CALLSGN\"\n"
    "        style={{\n"
    "          background: 'transparent', border: 'none', outline: 'none',\n"
    "          fontFamily: monoFamily, fontSize: 14, fontStyle: 'italic', lineHeight: 1,\n"
    "          color: callsign ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.30)',\n"
    "          width: callsignOptions.length > 0 ? 70 : 80, padding: 0, cursor: 'text',\n"
    "        }}\n"
    "      />\n"
    "      {/* Dropdown arrow + overlay select — only when options are available */}\n"
    "      {callsignOptions.length > 0 && (\n"
    "        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>\n"
    "          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', pointerEvents: 'none', lineHeight: 1 }}>\u25bc</span>\n"
    "          <select\n"
    "            value={callsign}\n"
    "            onChange={e => onCallsignChange(e.target.value)}\n"
    "            style={{\n"
    "              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',\n"
    "              opacity: 0, cursor: 'pointer', zIndex: zOverride ?? 10,\n"
    "            }}\n"
    "          >\n"
    "            <option value=\"\" style={{ background: '#1a2f4a' }}>\u2014 select \u2014</option>\n"
    "            {callsignOptions.map(cs => (\n"
    "              <option key={cs} value={cs} style={{ background: '#1a2f4a' }}>{cs}</option>\n"
    "            ))}\n"
    "          </select>\n"
    "        </div>\n"
    "      )}\n"
    "    </div>\n"
    "  );"
)

if old_callsign_content in content:
    content = content.replace(old_callsign_content, new_callsign_content, 1)
    print("✅ FIX 3: callsignContent updated — always editable + dropdown when options exist")
else:
    print("❌ FIX 3: old callsignContent not found")
    idx = content.find("const callsignContent")
    if idx >= 0:
        print(repr(content[idx:idx+400]))

# ── Write result ──────────────────────────────────────────────────────────────
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone. File: {content.count(chr(10))} lines, {len(content)} bytes")