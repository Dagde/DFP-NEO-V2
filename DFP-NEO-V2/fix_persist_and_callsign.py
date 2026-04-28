import re

filepath = 'DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File length: {len(content)} chars, {content.count(chr(10))} lines")

# ── FIX 1: Add localStorage persistence (load on mount) ────────────────────────────────────────
# Find the state block after DEFAULT_POSITIONS
old_state_block = (
    '  const [editMode,     setEditMode]     = useState(false);\n'
    '  const [layoutSaved,  setLayoutSaved]  = useState(false);  // true = use absolute positions in normal view\n'
    '  const [positions,    setPositions]    = useState<Record<ElemKey, { x: number; y: number }>>(DEFAULT_POSITIONS);\n'
    '  const [savedPositions, setSavedPositions] = useState<Record<ElemKey, { x: number; y: number }>>(DEFAULT_POSITIONS);'
)

new_state_block = (
    '  // \u2500\u2500 localStorage persistence \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
    '  const LAYOUT_STORAGE_KEY = \'flightTileLayout_v1\';\n'
    '\n'
    '  const loadPersistedLayout = (): { pos: Record<ElemKey, { x: number; y: number }>; saved: boolean } => {\n'
    '    try {\n'
    '      const raw = localStorage.getItem(\'flightTileLayout_v1\');\n'
    '      if (raw) {\n'
    '        const parsed = JSON.parse(raw);\n'
    '        if (parsed && typeof parsed === \'object\' && \'positions\' in parsed) {\n'
    '          // Validate all keys exist\n'
    '          const keys: ElemKey[] = [\'startTime\',\'picName\',\'coPilot\',\'duration\',\'event\',\'area\',\'aircraft\',\'callsign\'];\n'
    '          const posData = parsed.positions as Record<ElemKey, { x: number; y: number }>;\n'
    '          if (keys.every(k => posData[k] && typeof posData[k].x === \'number\')) {\n'
    '            return { pos: posData, saved: true };\n'
    '          }\n'
    '        }\n'
    '      }\n'
    '    } catch { /* ignore */ }\n'
    '    return { pos: DEFAULT_POSITIONS, saved: false };\n'
    '  };\n'
    '\n'
    '  const _persisted = loadPersistedLayout();\n'
    '\n'
    '  const [editMode,     setEditMode]     = useState(false);\n'
    '  const [layoutSaved,  setLayoutSaved]  = useState(_persisted.saved);\n'
    '  const [positions,    setPositions]    = useState<Record<ElemKey, { x: number; y: number }>>(_persisted.pos);\n'
    '  const [savedPositions, setSavedPositions] = useState<Record<ElemKey, { x: number; y: number }>>(_persisted.pos);'
)

if old_state_block in content:
    content = content.replace(old_state_block, new_state_block, 1)
    print("✅ FIX 1: localStorage load on mount applied")
else:
    print("❌ FIX 1: old_state_block not found")
    # Debug: show what's around that area
    idx = content.find('useState(false);  // true = use absolute')
    if idx >= 0:
        print(f"  Found nearby text at index {idx}:")
        print(repr(content[idx-50:idx+200]))

# ── FIX 2: Save to localStorage in exitEditMode(true) ──────────────────────────────────────────
old_exit = (
    '  const exitEditMode = (save: boolean) => {\n'
    '    if (save) {\n'
    '      // Lock the current dragged positions as the saved layout\n'
    '      setSavedPositions({ ...positions });\n'
    '      setLayoutSaved(true);\n'
    '    } else {\n'
    '      // Revert to the last saved (or default) positions\n'
    '      setPositions({ ...savedPositions });\n'
    '    }\n'
    '    setEditMode(false);\n'
    '  };'
)

new_exit = (
    '  const exitEditMode = (save: boolean) => {\n'
    '    if (save) {\n'
    '      // Lock the current dragged positions as the saved layout\n'
    '      setSavedPositions({ ...positions });\n'
    '      setLayoutSaved(true);\n'
    '      // Persist to localStorage so layout survives navigation, refresh, and restarts\n'
    '      try {\n'
    '        localStorage.setItem(\'flightTileLayout_v1\', JSON.stringify({ positions }));\n'
    '      } catch { /* ignore storage errors */ }\n'
    '    } else {\n'
    '      // Revert to the last saved (or default) positions\n'
    '      setPositions({ ...savedPositions });\n'
    '    }\n'
    '    setEditMode(false);\n'
    '  };'
)

if old_exit in content:
    content = content.replace(old_exit, new_exit, 1)
    print("✅ FIX 2: localStorage save in exitEditMode applied")
else:
    print("❌ FIX 2: old_exit not found")
    idx = content.find('const exitEditMode = (save: boolean)')
    if idx >= 0:
        print(repr(content[idx:idx+400]))

# ── FIX 3: Update callsign useEffect to include formationCallsigns ─────────────────────────────
old_callsign_effect = (
    '  // \u2500\u2500 Auto-fill callsign from PIC profile \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
    '  useEffect(() => {\n'
    '    if (!picName) { setCallsign(\'\'); setCallsignOptions([]); return; }\n'
    '    // Check instructor first\n'
    '    const inst = instructorsData.find(i => i.name === picName);\n'
    '    if (inst) {\n'
    '      const primary   = inst.callsign || \'\';\n'
    '      const secondary = inst.secondaryCallsign || \'\';\n'
    '      const opts = [primary, secondary].filter(Boolean);\n'
    '      setCallsignOptions(opts);\n'
    '      setCallsign(primary);\n'
    '      return;\n'
    '    }\n'
    '    // Check trainee\n'
    '    const trainee = traineesData.find(t => (t.fullName || t.name) === picName);\n'
    '    if (trainee) {\n'
    '      const cs = trainee.traineeCallsign || \'\';\n'
    '      setCallsignOptions(cs ? [cs] : []);\n'
    '      setCallsign(cs);\n'
    '      return;\n'
    '    }\n'
    '    setCallsign(\'\');\n'
    '    setCallsignOptions([]);\n'
    '  }, [picName, instructorsData, traineesData]);'
)

new_callsign_effect = (
    '  // \u2500\u2500 Auto-fill callsign from PIC profile + formation callsigns for same unit \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
    '  useEffect(() => {\n'
    '    if (!picName) { setCallsign(\'\'); setCallsignOptions([]); return; }\n'
    '\n'
    '    // Determine PIC\'s unit (for filtering formation callsigns)\n'
    '    let picUnit: string | null = null;\n'
    '\n'
    '    // Check instructor first\n'
    '    const inst = instructorsData.find(i => i.name === picName);\n'
    '    if (inst) {\n'
    '      picUnit = inst.unit || null;\n'
    '      const primary   = inst.callsign || \'\';\n'
    '      const secondary = inst.secondaryCallsign || \'\';\n'
    '      const personal  = [primary, secondary].filter(Boolean);\n'
    '      // Add formation callsigns that belong to the same unit as the PIC\n'
    '      const formation = (formationCallsigns || []).filter(fc => fc.unit && picUnit && fc.unit === picUnit).map(fc => fc.name || fc.code).filter(Boolean);\n'
    '      const allOpts   = [...new Set([...personal, ...formation])];\n'
    '      setCallsignOptions(allOpts);\n'
    '      setCallsign(primary || (allOpts[0] || \'\'));\n'
    '      return;\n'
    '    }\n'
    '\n'
    '    // Check trainee\n'
    '    const trainee = traineesData.find(t => (t.fullName || t.name) === picName);\n'
    '    if (trainee) {\n'
    '      picUnit = (trainee as any).unit || null;\n'
    '      const cs = trainee.traineeCallsign || \'\';\n'
    '      const personal = cs ? [cs] : [];\n'
    '      // Add formation callsigns that belong to the same unit as the PIC\n'
    '      const formation = (formationCallsigns || []).filter(fc => fc.unit && picUnit && fc.unit === picUnit).map(fc => fc.name || fc.code).filter(Boolean);\n'
    '      const allOpts   = [...new Set([...personal, ...formation])];\n'
    '      setCallsignOptions(allOpts);\n'
    '      setCallsign(cs || (allOpts[0] || \'\'));\n'
    '      return;\n'
    '    }\n'
    '\n'
    '    setCallsign(\'\');\n'
    '    setCallsignOptions([]);\n'
    '  }, [picName, instructorsData, traineesData, formationCallsigns]);'
)

if old_callsign_effect in content:
    content = content.replace(old_callsign_effect, new_callsign_effect, 1)
    print("✅ FIX 3: callsign useEffect with formation callsigns applied")
else:
    print("❌ FIX 3: old_callsign_effect not found")
    idx = content.find('Auto-fill callsign from PIC profile')
    if idx >= 0:
        print(repr(content[idx:idx+600]))

# ── FIX 4: Pass formationCallsigns through AddFlightTileModal destructuring ──────────────────────
old_modal_destructure = (
    'const AddFlightTileModal: React.FC<AddFlightTileModalProps> = ({\n'
    '  onClose, onSave, instructors, trainees, syllabusDetails, school,\n'
    '  traineesData, instructorsData, courseColors, date, traineeLMPs, scores,\n'
    '  locationOpAreas = {},\n'
    '}) => {'
)

new_modal_destructure = (
    'const AddFlightTileModal: React.FC<AddFlightTileModalProps> = ({\n'
    '  onClose, onSave, instructors, trainees, syllabusDetails, school,\n'
    '  traineesData, instructorsData, courseColors, date, traineeLMPs, scores,\n'
    '  locationOpAreas = {},\n'
    '  formationCallsigns = [],\n'
    '}) => {'
)

if old_modal_destructure in content:
    content = content.replace(old_modal_destructure, new_modal_destructure, 1)
    print("✅ FIX 4: formationCallsigns destructured in AddFlightTileModal")
else:
    print("❌ FIX 4: old_modal_destructure not found")
    idx = content.find('const AddFlightTileModal: React.FC<AddFlightTileModalProps>')
    if idx >= 0:
        print(repr(content[idx:idx+300]))

# ── FIX 5: Pass formationCallsigns to FlightTile in the JSX ──────────────────────────────────────
# Find the FlightTile JSX call and add formationCallsigns prop
old_tile_jsx = '                  callsignOptions={callsignOptions}\n'
new_tile_jsx = '                  callsignOptions={callsignOptions}\n                  formationCallsigns={formationCallsigns}\n'

if old_tile_jsx in content:
    content = content.replace(old_tile_jsx, new_tile_jsx, 1)
    print("✅ FIX 5: formationCallsigns passed to FlightTile JSX")
else:
    print("❌ FIX 5: JSX callsignOptions line not found")
    idx = content.find('callsignOptions={callsignOptions}')
    if idx >= 0:
        print(repr(content[idx-50:idx+100]))

# ── Write result ──────────────────────────────────────────────────────────────────────────────────
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone. File: {content.count(chr(10))} lines, {len(content)} bytes")