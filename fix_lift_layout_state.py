filepath = 'DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File: {content.count(chr(10))} lines, {len(content)} bytes")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 1: Add lifted layout props to TileProps interface
# ═══════════════════════════════════════════════════════════════════════════════
old_tileprops_handlers = (
    "  // change handlers\n"
    "  onFlightTypeChange: (v: 'Dual' | 'Solo') => void;\n"
    "  onStartTimeChange: (v: number) => void;\n"
    "  onPicNameChange: (name: string, callsigns: string[]) => void;\n"
    "  onStudentNameChange: (name: string) => void;\n"
    "  onDurationChange: (v: number) => void;\n"
    "  onFlightNumberChange: (code: string, durationHrs?: number) => void;\n"
    "  onAreaChange: (v: string) => void;\n"
    "  onAircraftChange: (v: string) => void;\n"
    "  onCallsignChange: (v: string) => void;\n"
    "}"
)
new_tileprops_handlers = (
    "  // change handlers\n"
    "  onFlightTypeChange: (v: 'Dual' | 'Solo') => void;\n"
    "  onStartTimeChange: (v: number) => void;\n"
    "  onPicNameChange: (name: string, callsigns: string[]) => void;\n"
    "  onStudentNameChange: (name: string) => void;\n"
    "  onDurationChange: (v: number) => void;\n"
    "  onFlightNumberChange: (code: string, durationHrs?: number) => void;\n"
    "  onAreaChange: (v: string) => void;\n"
    "  onAircraftChange: (v: string) => void;\n"
    "  onCallsignChange: (v: string) => void;\n"
    "  // lifted layout state (owned by AddFlightTileModal)\n"
    "  editMode: boolean;\n"
    "  layoutSaved: boolean;\n"
    "  positions: Record<string, { x: number; y: number }>;\n"
    "  savedPositions: Record<string, { x: number; y: number }>;\n"
    "  onEnterEditMode: () => void;\n"
    "  onExitEditMode: (save: boolean) => void;\n"
    "  onDragPosition: (key: string, pos: { x: number; y: number }) => void;\n"
    "}"
)
if old_tileprops_handlers in content:
    content = content.replace(old_tileprops_handlers, new_tileprops_handlers, 1)
    print("✅ FIX 1: Lifted layout props added to TileProps")
else:
    print("❌ FIX 1: TileProps handlers block not found")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 2: Update FlightTile destructuring to use lifted props
# ═══════════════════════════════════════════════════════════════════════════════
old_tile_destruct = (
    "  onFlightTypeChange, onStartTimeChange, onPicNameChange, onStudentNameChange,\n"
    "  onDurationChange, onFlightNumberChange, onAreaChange, onAircraftChange, onCallsignChange,\n"
    "}) => {"
)
new_tile_destruct = (
    "  onFlightTypeChange, onStartTimeChange, onPicNameChange, onStudentNameChange,\n"
    "  onDurationChange, onFlightNumberChange, onAreaChange, onAircraftChange, onCallsignChange,\n"
    "  editMode, layoutSaved, positions, savedPositions,\n"
    "  onEnterEditMode, onExitEditMode, onDragPosition,\n"
    "}) => {"
)
if old_tile_destruct in content:
    content = content.replace(old_tile_destruct, new_tile_destruct, 1)
    print("✅ FIX 2: FlightTile destructuring updated")
else:
    print("❌ FIX 2: tile destruct not found")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 3: Replace the entire layout state block + load effect + enterEditMode +
#         exitEditMode + drag state + mouse handlers in FlightTile
#         with versions that use the lifted props instead
# ═══════════════════════════════════════════════════════════════════════════════

# Remove the layout state block (everything from "// Layout state" to "}, [tileUserId]);")
old_layout_state = (
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
new_layout_state = (
    "  // Layout state is LIFTED to AddFlightTileModal — received via props:\n"
    "  //   editMode, layoutSaved, positions, savedPositions\n"
    "  //   onEnterEditMode, onExitEditMode, onDragPosition"
)
if old_layout_state in content:
    content = content.replace(old_layout_state, new_layout_state, 1)
    print("✅ FIX 3: Layout state block replaced with comment")
else:
    print("❌ FIX 3: layout state block not found")
    idx = content.find('Layout state (persisted to DB')
    if idx >= 0:
        print(repr(content[idx:idx+300]))

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 4: Replace enterEditMode (uses local state setters) with a version
#         that calls onEnterEditMode prop (which reads DOM positions and
#         calls back up to parent)
# ═══════════════════════════════════════════════════════════════════════════════
old_enter = (
    "  const enterEditMode = () => {\n"
    "    if (!tileRef.current) { setEditMode(true); return; }\n"
    "    const tileRect = tileRef.current.getBoundingClientRect();\n"
    "    // If layout was already saved, start from saved positions\n"
    "    if (layoutSaved) {\n"
    "      setPositions({ ...savedPositions });\n"
    "      setEditMode(true);\n"
    "      return;\n"
    "    }\n"
    "    // Otherwise measure from DOM\n"
    "    const newPos: Record<ElemKey, { x: number; y: number }> = { ...DEFAULT_POSITIONS };\n"
    "    (Object.keys(elemRefs.current) as ElemKey[]).forEach(key => {\n"
    "      const el = elemRefs.current[key];\n"
    "      if (el) {\n"
    "        const r = el.getBoundingClientRect();\n"
    "        newPos[key] = {\n"
    "          x: Math.round(r.left - tileRect.left),\n"
    "          y: Math.round(r.top  - tileRect.top),\n"
    "        };\n"
    "      }\n"
    "    });\n"
    "    setPositions(newPos);\n"
    "    setEditMode(true);\n"
    "  };"
)
new_enter = (
    "  const enterEditMode = () => {\n"
    "    // Capture current DOM positions if no layout saved yet, then delegate to parent\n"
    "    if (!layoutSaved && tileRef.current) {\n"
    "      const tileRect = tileRef.current.getBoundingClientRect();\n"
    "      const measuredPos: Record<string, { x: number; y: number }> = { ...DEFAULT_POSITIONS };\n"
    "      (Object.keys(elemRefs.current) as ElemKey[]).forEach(key => {\n"
    "        const el = elemRefs.current[key];\n"
    "        if (el) {\n"
    "          const r = el.getBoundingClientRect();\n"
    "          measuredPos[key] = {\n"
    "            x: Math.round(r.left - tileRect.left),\n"
    "            y: Math.round(r.top  - tileRect.top),\n"
    "          };\n"
    "        }\n"
    "      });\n"
    "      // Push measured positions to parent before entering edit mode\n"
    "      (Object.keys(measuredPos) as ElemKey[]).forEach(k =>\n"
    "        onDragPosition(k, measuredPos[k])\n"
    "      );\n"
    "    }\n"
    "    onEnterEditMode();\n"
    "  };"
)
if old_enter in content:
    content = content.replace(old_enter, new_enter, 1)
    print("✅ FIX 4: enterEditMode updated to use lifted callbacks")
else:
    print("❌ FIX 4: old enterEditMode not found")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 5: Replace exitEditMode (uses local setters + DB save) with delegate call
# ═══════════════════════════════════════════════════════════════════════════════
old_exit = (
    "  const exitEditMode = (save: boolean) => {\n"
    "    if (save) {\n"
    "      // Lock the current dragged positions as the saved layout\n"
    "      setSavedPositions({ ...positions });\n"
    "      setLayoutSaved(true);\n"
    "      // Persist to DB so layout survives navigation, refresh, and restarts for this user\n"
    "      if (tileUserId) {\n"
    "        saveUserPreference(tileUserId, 'flightTileLayout_v1', { positions });\n"
    "      }\n"
    "    } else {\n"
    "      // Revert to the last saved (or default) positions\n"
    "      setPositions({ ...savedPositions });\n"
    "    }\n"
    "    setEditMode(false);\n"
    "  };"
)
new_exit = (
    "  const exitEditMode = (save: boolean) => {\n"
    "    onExitEditMode(save);\n"
    "  };"
)
if old_exit in content:
    content = content.replace(old_exit, new_exit, 1)
    print("✅ FIX 5: exitEditMode delegates to onExitEditMode prop")
else:
    print("❌ FIX 5: old exitEditMode not found")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 6: Replace mouse move handler — it calls setPositions; replace with onDragPosition
# ═══════════════════════════════════════════════════════════════════════════════
old_mouse_move = (
    "      setPositions(prev => ({ ...prev, [key]: { x: Math.round(newX), y: Math.round(newY) } }));"
)
new_mouse_move = (
    "      onDragPosition(key, { x: Math.round(newX), y: Math.round(newY) });"
)
if old_mouse_move in content:
    content = content.replace(old_mouse_move, new_mouse_move, 1)
    print("✅ FIX 6: mousemove handler uses onDragPosition")
else:
    print("❌ FIX 6: setPositions in mouse move not found")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 7: Remove userId/tileUserId from FlightTile (no longer needed in child)
# ═══════════════════════════════════════════════════════════════════════════════
old_tile_userid = (
    "  timeOptions, durationOptions, areaOptions, aircraftOptions, callsignOptions,\n"
    "  formationCallsigns,\n"
    "  userId: tileUserId,\n"
    "  allUnits, getLayer2, getNames,"
)
new_tile_userid = (
    "  timeOptions, durationOptions, areaOptions, aircraftOptions, callsignOptions,\n"
    "  formationCallsigns,\n"
    "  allUnits, getLayer2, getNames,"
)
if old_tile_userid in content:
    content = content.replace(old_tile_userid, new_tile_userid, 1)
    print("✅ FIX 7: tileUserId removed from FlightTile destructuring")
else:
    print("❌ FIX 7: tileUserId destructuring not found")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 8: Remove userId from TileProps (no longer needed in child)
# ═══════════════════════════════════════════════════════════════════════════════
old_userid_tileprop = (
    "  formationCallsigns?: { name: string; code: string; unit: string; location: string; locationCode: string }[];\n"
    "  userId?: string;\n"
    "  // cascading dropdown helpers"
)
new_userid_tileprop = (
    "  formationCallsigns?: { name: string; code: string; unit: string; location: string; locationCode: string }[];\n"
    "  // cascading dropdown helpers"
)
if old_userid_tileprop in content:
    content = content.replace(old_userid_tileprop, new_userid_tileprop, 1)
    print("✅ FIX 8: userId removed from TileProps")
else:
    print("❌ FIX 8: userId in TileProps not found")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 9: Remove AbsElem helper that calls setPositions from dragging (already
#         replaced in FIX 6). Now update the AbsElem render helper to use
#         the `positions` prop (already done since we use the prop directly).
#         Just verify the AbsElem pos lookup uses `positions` prop correctly.
# ═══════════════════════════════════════════════════════════════════════════════
# The AbsElem uses: const pos = (editMode ? positions : savedPositions)[elemKey];
# This is already correct since positions/savedPositions are now props.
# Check it exists:
if "(editMode ? positions : savedPositions)[elemKey]" in content:
    print("✅ FIX 9: AbsElem pos lookup correct (using props)")
else:
    print("❌ FIX 9: AbsElem pos lookup not found")

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 10: Add layout state to AddFlightTileModal, DB load/save logic there
# ═══════════════════════════════════════════════════════════════════════════════
# Insert after the existing state declarations in AddFlightTileModal.
# Find the isDeploy state line as anchor.
old_modal_state_anchor = (
    "  const [isDeploy,      setIsDeploy]      = useState(false);\n"
    "  const [deploymentStartDate,  setDeploymentStartDate]  = useState(date);\n"
    "  const [deploymentStartTime,  setDeploymentStartTime]  = useState('08:00');\n"
    "  const [deploymentEndDate,    setDeploymentEndDate]    = useState(date);\n"
    "  const [deploymentEndTime,    setDeploymentEndTime]    = useState('08:00');\n"
    "  const [deploymentAircraftCount, setDeploymentAircraftCount] = useState(1);"
)
new_modal_state_anchor = (
    "  const [isDeploy,      setIsDeploy]      = useState(false);\n"
    "  const [deploymentStartDate,  setDeploymentStartDate]  = useState(date);\n"
    "  const [deploymentStartTime,  setDeploymentStartTime]  = useState('08:00');\n"
    "  const [deploymentEndDate,    setDeploymentEndDate]    = useState(date);\n"
    "  const [deploymentEndTime,    setDeploymentEndTime]    = useState('08:00');\n"
    "  const [deploymentAircraftCount, setDeploymentAircraftCount] = useState(1);\n"
    "\n"
    "  // \u2500\u2500 Tile Layout State (lifted here so it survives modal re-renders) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
    "  type ElemKey = 'startTime' | 'picName' | 'coPilot' | 'duration' | 'event' | 'area' | 'aircraft' | 'callsign';\n"
    "  const LAYOUT_ELEM_KEYS: ElemKey[] = ['startTime','picName','coPilot','duration','event','area','aircraft','callsign'];\n"
    "  const MODAL_DEFAULT_POSITIONS: Record<ElemKey, { x: number; y: number }> = {\n"
    "    startTime: { x: 14,  y: 12 },\n"
    "    picName:   { x: 110, y: 14 },\n"
    "    coPilot:   { x: 110, y: 58 },\n"
    "    duration:  { x: 420, y: 10 },\n"
    "    event:     { x: 490, y: 10 },\n"
    "    area:      { x: 490, y: 62 },\n"
    "    aircraft:  { x: 420, y: 62 },\n"
    "    callsign:  { x: 530, y: 62 },\n"
    "  };\n"
    "  const LAYOUT_PREF_KEY = 'flightTileLayout_v1';\n"
    "\n"
    "  const [tileEditMode,      setTileEditMode]      = useState(false);\n"
    "  const [tileLayoutSaved,   setTileLayoutSaved]   = useState(false);\n"
    "  const [tilePositions,     setTilePositions]     = useState<Record<ElemKey, { x: number; y: number }>>(MODAL_DEFAULT_POSITIONS);\n"
    "  const [tileSavedPositions,setTileSavedPositions]= useState<Record<ElemKey, { x: number; y: number }>>(MODAL_DEFAULT_POSITIONS);\n"
    "\n"
    "  // Load persisted layout from DB once when userId is available\n"
    "  useEffect(() => {\n"
    "    if (!userId) return;\n"
    "    loadUserPreferences(userId).then(prefs => {\n"
    "      const stored = prefs[LAYOUT_PREF_KEY];\n"
    "      if (stored && typeof stored === 'object' && 'positions' in stored) {\n"
    "        const posData = stored.positions as Record<ElemKey, { x: number; y: number }>;\n"
    "        if (LAYOUT_ELEM_KEYS.every(k => posData[k] && typeof posData[k].x === 'number')) {\n"
    "          setTilePositions(posData);\n"
    "          setTileSavedPositions(posData);\n"
    "          setTileLayoutSaved(true);\n"
    "        }\n"
    "      }\n"
    "    });\n"
    "  // eslint-disable-next-line react-hooks/exhaustive-deps\n"
    "  }, [userId]);\n"
    "\n"
    "  // Handlers passed down to FlightTile\n"
    "  const handleEnterEditMode = () => setTileEditMode(true);\n"
    "\n"
    "  const handleExitEditMode = (save: boolean) => {\n"
    "    if (save) {\n"
    "      setTileSavedPositions({ ...tilePositions });\n"
    "      setTileLayoutSaved(true);\n"
    "      if (userId) {\n"
    "        saveUserPreference(userId, LAYOUT_PREF_KEY, { positions: tilePositions });\n"
    "      }\n"
    "    } else {\n"
    "      setTilePositions({ ...tileSavedPositions });\n"
    "    }\n"
    "    setTileEditMode(false);\n"
    "  };\n"
    "\n"
    "  const handleDragPosition = (key: string, pos: { x: number; y: number }) => {\n"
    "    setTilePositions(prev => ({ ...prev, [key]: pos }));\n"
    "  };"
)
if old_modal_state_anchor in content:
    content = content.replace(old_modal_state_anchor, new_modal_state_anchor, 1)
    print("✅ FIX 10: Layout state + DB load/save added to AddFlightTileModal")
else:
    print("❌ FIX 10: modal state anchor not found")
    idx = content.find('const [isDeploy,')
    if idx >= 0:
        print(repr(content[idx:idx+300]))

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 11: Pass lifted layout state+handlers to FlightTile in JSX
# ═══════════════════════════════════════════════════════════════════════════════
old_tile_jsx_bottom = (
    "                  formationCallsigns={formationCallsigns}\n"
    "                  userId={userId}\n"
)
new_tile_jsx_bottom = (
    "                  formationCallsigns={formationCallsigns}\n"
    "                  editMode={tileEditMode}\n"
    "                  layoutSaved={tileLayoutSaved}\n"
    "                  positions={tilePositions}\n"
    "                  savedPositions={tileSavedPositions}\n"
    "                  onEnterEditMode={handleEnterEditMode}\n"
    "                  onExitEditMode={handleExitEditMode}\n"
    "                  onDragPosition={handleDragPosition}\n"
)
if old_tile_jsx_bottom in content:
    content = content.replace(old_tile_jsx_bottom, new_tile_jsx_bottom, 1)
    print("✅ FIX 11: Lifted layout props passed to FlightTile JSX")
else:
    print("❌ FIX 11: tile JSX footer not found")
    idx = content.find('formationCallsigns={formationCallsigns}')
    if idx >= 0:
        print(repr(content[idx:idx+200]))

# ── Write result ──────────────────────────────────────────────────────────────
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone. File: {content.count(chr(10))} lines, {len(content)} bytes")