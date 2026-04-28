filepath = 'DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File: {content.count(chr(10))} lines, {len(content)} bytes")

# ── FIX 1: Add import for userPreferencesService ────────────────────────────────────────────────
old_import = "import React, { useState, useMemo, useEffect, useRef } from 'react';"
new_import = (
    "import React, { useState, useMemo, useEffect, useRef } from 'react';\n"
    "import { loadUserPreferences, saveUserPreference } from '../utils/userPreferencesService';"
)

if old_import in content:
    content = content.replace(old_import, new_import, 1)
    print("✅ FIX 1: import added")
else:
    print("❌ FIX 1: import line not found")

# ── FIX 2: Add userId to AddFlightTileModalProps ────────────────────────────────────────────────
old_props_end = "  formationCallsigns?: { name: string; code: string; unit: string; location: string; locationCode: string }[];\n}"
new_props_end = (
    "  formationCallsigns?: { name: string; code: string; unit: string; location: string; locationCode: string }[];\n"
    "  userId?: string;\n"
    "}"
)

if old_props_end in content:
    content = content.replace(old_props_end, new_props_end, 1)
    print("✅ FIX 2: userId prop added to AddFlightTileModalProps")
else:
    print("❌ FIX 2: props end not found")
    idx = content.find('formationCallsigns?: { name: string')
    if idx >= 0:
        print(repr(content[idx:idx+200]))

# ── FIX 3: Add userId to AddFlightTileModal destructuring ────────────────────────────────────────
old_destructure = (
    "const AddFlightTileModal: React.FC<AddFlightTileModalProps> = ({\n"
    "  onClose, onSave, instructors, trainees, syllabusDetails, school,\n"
    "  traineesData, instructorsData, courseColors, date, traineeLMPs, scores,\n"
    "  locationOpAreas = {},\n"
    "  formationCallsigns = [],\n"
    "}) => {"
)
new_destructure = (
    "const AddFlightTileModal: React.FC<AddFlightTileModalProps> = ({\n"
    "  onClose, onSave, instructors, trainees, syllabusDetails, school,\n"
    "  traineesData, instructorsData, courseColors, date, traineeLMPs, scores,\n"
    "  locationOpAreas = {},\n"
    "  formationCallsigns = [],\n"
    "  userId,\n"
    "}) => {"
)

if old_destructure in content:
    content = content.replace(old_destructure, new_destructure, 1)
    print("✅ FIX 3: userId destructured in AddFlightTileModal")
else:
    print("❌ FIX 3: destructure not found")

# ── FIX 4: Replace the entire localStorage block with DB-backed persistence ──────────────────────
# The localStorage block was added in the previous commit inside FlightTile.
# We need to replace it with a DB-based approach.
# The FlightTile component doesn't have access to userId directly — we need to
# lift the layout state UP to AddFlightTileModal and pass it down as props.
#
# Simpler approach: keep the state in FlightTile but pass userId down via TileProps
# and use useEffect to load/save.

# First: add userId to TileProps
old_tile_props_end = (
    "  formationCallsigns?: { name: string; code: string; unit: string; location: string; locationCode: string }[];\n"
    "  // cascading dropdown helpers"
)
new_tile_props_end = (
    "  formationCallsigns?: { name: string; code: string; unit: string; location: string; locationCode: string }[];\n"
    "  userId?: string;\n"
    "  // cascading dropdown helpers"
)

if old_tile_props_end in content:
    content = content.replace(old_tile_props_end, new_tile_props_end, 1)
    print("✅ FIX 4: userId added to TileProps")
else:
    print("❌ FIX 4: TileProps formationCallsigns line not found")

# Add userId to FlightTile destructuring
old_tile_destruct = (
    "  timeOptions, durationOptions, areaOptions, aircraftOptions, callsignOptions,\n"
    "  formationCallsigns,\n"
    "  allUnits, getLayer2, getNames,"
)
new_tile_destruct = (
    "  timeOptions, durationOptions, areaOptions, aircraftOptions, callsignOptions,\n"
    "  formationCallsigns,\n"
    "  userId: tileUserId,\n"
    "  allUnits, getLayer2, getNames,"
)

if old_tile_destruct in content:
    content = content.replace(old_tile_destruct, new_tile_destruct, 1)
    print("✅ FIX 5: userId destructured in FlightTile")
else:
    print("❌ FIX 5: tile destruct not found")

# ── FIX 5: Replace the localStorage block in FlightTile with DB persistence ──────────────────────
old_storage_block = (
    "  // \u2500\u2500 localStorage persistence \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
    "  const LAYOUT_STORAGE_KEY = 'flightTileLayout_v1';\n"
    "\n"
    "  const loadPersistedLayout = (): { pos: Record<ElemKey, { x: number; y: number }>; saved: boolean } => {\n"
    "    try {\n"
    "      const raw = localStorage.getItem('flightTileLayout_v1');\n"
    "      if (raw) {\n"
    "        const parsed = JSON.parse(raw);\n"
    "        if (parsed && typeof parsed === 'object' && 'positions' in parsed) {\n"
    "          // Validate all keys exist\n"
    "          const keys: ElemKey[] = ['startTime','picName','coPilot','duration','event','area','aircraft','callsign'];\n"
    "          const posData = parsed.positions as Record<ElemKey, { x: number; y: number }>;\n"
    "          if (keys.every(k => posData[k] && typeof posData[k].x === 'number')) {\n"
    "            return { pos: posData, saved: true };\n"
    "          }\n"
    "        }\n"
    "      }\n"
    "    } catch { /* ignore */ }\n"
    "    return { pos: DEFAULT_POSITIONS, saved: false };\n"
    "  };\n"
    "\n"
    "  const _persisted = loadPersistedLayout();\n"
    "\n"
    "  const [editMode,     setEditMode]     = useState(false);\n"
    "  const [layoutSaved,  setLayoutSaved]  = useState(_persisted.saved);\n"
    "  const [positions,    setPositions]    = useState<Record<ElemKey, { x: number; y: number }>>(_persisted.pos);\n"
    "  const [savedPositions, setSavedPositions] = useState<Record<ElemKey, { x: number; y: number }>>(_persisted.pos);"
)

new_storage_block = (
    "  // \u2500\u2500 Layout state (persisted to DB per-user) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
    "  const LAYOUT_PREF_KEY = 'flightTileLayout_v1';\n"
    "\n"
    "  const [editMode,     setEditMode]     = useState(false);\n"
    "  const [layoutSaved,  setLayoutSaved]  = useState(false);\n"
    "  const [positions,    setPositions]    = useState<Record<ElemKey, { x: number; y: number }>>(DEFAULT_POSITIONS);\n"
    "  const [savedPositions, setSavedPositions] = useState<Record<ElemKey, { x: number; y: number }>>(DEFAULT_POSITIONS);\n"
    "\n"
    "  // Load persisted layout from DB on mount (when userId is available)\n"
    "  useEffect(() => {\n"
    "    if (!tileUserId) return;\n"
    "    loadUserPreferences(tileUserId).then(prefs => {\n"
    "      const stored = prefs[LAYOUT_PREF_KEY];\n"
    "      if (stored && typeof stored === 'object' && 'positions' in stored) {\n"
    "        const keys: ElemKey[] = ['startTime','picName','coPilot','duration','event','area','aircraft','callsign'];\n"
    "        const posData = stored.positions as Record<ElemKey, { x: number; y: number }>;\n"
    "        if (keys.every(k => posData[k] && typeof posData[k].x === 'number')) {\n"
    "          setPositions(posData);\n"
    "          setSavedPositions(posData);\n"
    "          setLayoutSaved(true);\n"
    "        }\n"
    "      }\n"
    "    });\n"
    "  // eslint-disable-next-line react-hooks/exhaustive-deps\n"
    "  }, [tileUserId]);"
)

if old_storage_block in content:
    content = content.replace(old_storage_block, new_storage_block, 1)
    print("✅ FIX 6: localStorage replaced with DB-backed persistence in FlightTile")
else:
    print("❌ FIX 6: old_storage_block not found")
    idx = content.find('localStorage persistence')
    if idx >= 0:
        print(repr(content[idx:idx+400]))

# ── FIX 6: Replace localStorage.setItem in exitEditMode with DB save ────────────────────────────
old_exit = (
    "      // Persist to localStorage so layout survives navigation, refresh, and restarts\n"
    "      try {\n"
    "        localStorage.setItem('flightTileLayout_v1', JSON.stringify({ positions }));\n"
    "      } catch { /* ignore storage errors */ }\n"
)
new_exit = (
    "      // Persist to DB so layout survives navigation, refresh, and restarts for this user\n"
    "      if (tileUserId) {\n"
    "        saveUserPreference(tileUserId, 'flightTileLayout_v1', { positions });\n"
    "      }\n"
)

if old_exit in content:
    content = content.replace(old_exit, new_exit, 1)
    print("✅ FIX 7: exitEditMode save updated to use DB")
else:
    print("❌ FIX 7: old localStorage.setItem block not found")
    idx = content.find('localStorage.setItem')
    if idx >= 0:
        print(repr(content[idx-50:idx+200]))

# ── FIX 7: Pass userId to FlightTile in the JSX ─────────────────────────────────────────────────
old_tile_jsx = (
    "                  formationCallsigns={formationCallsigns}\n"
)
new_tile_jsx = (
    "                  formationCallsigns={formationCallsigns}\n"
    "                  userId={userId}\n"
)

if old_tile_jsx in content:
    content = content.replace(old_tile_jsx, new_tile_jsx, 1)
    print("✅ FIX 8: userId passed to FlightTile JSX")
else:
    print("❌ FIX 8: formationCallsigns JSX line not found")

# ── Write result ──────────────────────────────────────────────────────────────────────────────────
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone. File: {content.count(chr(10))} lines, {len(content)} bytes")