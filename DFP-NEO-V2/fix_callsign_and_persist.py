#!/usr/bin/env python3
"""
Two fixes:
1. localStorage persistence for tile layout positions
2. Full callsign functionality: PIC profile auto-fill + formation callsigns by unit
"""

# ─── Fix 1: AddFlightTileModal.tsx ────────────────────────────────────────────

with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'r') as f:
    modal = f.read()

# 1a. Add formationCallsigns to the interface
modal = modal.replace(
    "  locationOpAreas?: Record<string, string[]>;\n}",
    "  locationOpAreas?: Record<string, string[]>;\n  formationCallsigns?: { name: string; code: string; unit: string; location: string; locationCode: string; }[];\n}",
    1
)

# 1b. Add formationCallsigns to the destructured props in AddFlightTileModal
modal = modal.replace(
    "  locationOpAreas = {},\n}) => {",
    "  locationOpAreas = {},\n  formationCallsigns = [],\n}) => {",
    1
)

# 1c. Update the callsign auto-fill useEffect to also include formation callsigns filtered by PIC unit
old_callsign_effect = """  // ─── Auto-fill callsign from PIC profile ─────────────────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!picName) { setCallsign(''); setCallsignOptions([]); return; }
    // Check instructor first
    const inst = instructorsData.find(i => i.name === picName);
    if (inst) {
      const primary   = inst.callsign || '';
      const secondary = inst.secondaryCallsign || '';
      const opts = [primary, secondary].filter(Boolean);
      setCallsignOptions(opts);
      setCallsign(primary);
      return;
    }
    // Check trainee
    const trainee = traineesData.find(t => (t.fullName || t.name) === picName);
    if (trainee) {
      const cs = trainee.traineeCallsign || '';
      setCallsignOptions(cs ? [cs] : []);
      setCallsign(cs);
      return;
    }
    setCallsign('');
    setCallsignOptions([]);
  }, [picName, instructorsData, traineesData]);"""

new_callsign_effect = """  // ─── Auto-fill callsign from PIC profile + formation callsigns by unit ─────────────────────────────
  useEffect(() => {
    if (!picName) { setCallsign(''); setCallsignOptions([]); return; }

    // Determine PIC's unit
    let picUnit = '';
    const inst = instructorsData.find(i => i.name === picName);
    const trainee = traineesData.find(t => (t.fullName || t.name) === picName);

    // Personal callsigns from profile
    const personalOpts: string[] = [];
    if (inst) {
      picUnit = inst.unit || '';
      if (inst.callsign) personalOpts.push(inst.callsign);
      if (inst.secondaryCallsign) personalOpts.push(inst.secondaryCallsign);
    } else if (trainee) {
      picUnit = trainee.unit || '';
      if (trainee.traineeCallsign) personalOpts.push(trainee.traineeCallsign);
    }

    // Formation callsigns from Settings filtered by PIC's unit
    const formationOpts: string[] = formationCallsigns
      .filter(fc => !picUnit || fc.unit === picUnit)
      .map(fc => fc.code)
      .filter(Boolean);

    // Combine: personal first, then formation (deduplicated)
    const allOpts = [...new Set([...personalOpts, ...formationOpts])];

    setCallsignOptions(allOpts);
    // Auto-populate with first personal callsign if available, else first formation
    setCallsign(allOpts[0] || '');
  }, [picName, instructorsData, traineesData, formationCallsigns]);"""

# Find and replace the callsign effect
if old_callsign_effect in modal:
    modal = modal.replace(old_callsign_effect, new_callsign_effect)
    print("✅ Replaced callsign effect")
else:
    # Try a more flexible match
    import re
    pattern = r'  // .*Auto-fill callsign.*\n  useEffect\(\(\) => \{.*?\}, \[picName, instructorsData, traineesData\]\);'
    match = re.search(pattern, modal, re.DOTALL)
    if match:
        modal = modal[:match.start()] + new_callsign_effect + modal[match.end():]
        print("✅ Replaced callsign effect (regex)")
    else:
        print("❌ Could not find callsign effect - will patch manually")

# 1d. Pass formationCallsigns into FlightTile component in the JSX render
modal = modal.replace(
    """                  onCallsignChange={setCallsign}
                />""",
    """                  onCallsignChange={setCallsign}
                  formationCallsigns={formationCallsigns}
                />""",
    1
)

# 1e. Add formationCallsigns to TileProps interface
modal = modal.replace(
    "  callsignOptions: string[];",
    "  callsignOptions: string[];\n  formationCallsigns?: { name: string; code: string; unit: string; location: string; locationCode: string; }[];",
    1
)

# 1f. Add formationCallsigns to FlightTile destructured props
modal = modal.replace(
    "  onDurationChange, onFlightNumberChange, onAreaChange, onAircraftChange, onCallsignChange,\n}) => {",
    "  onDurationChange, onFlightNumberChange, onAreaChange, onAircraftChange, onCallsignChange,\n  formationCallsigns: _formationCallsigns,\n}) => {",
    1
)

# 1g. Add localStorage persistence for tile layout
# Find the DEFAULT_POSITIONS block and add localStorage load after it
old_defaults = """  // Default positions — used for first render and after Cancel
  const DEFAULT_POSITIONS: Record<ElemKey, { x: number; y: number }> = {
    startTime: { x: 14,  y: 12 },
    picName:   { x: 110, y: 14 },
    coPilot:   { x: 110, y: 58 },
    duration:  { x: 420, y: 10 },
    event:     { x: 490, y: 10 },
    area:      { x: 490, y: 62 },
    aircraft:  { x: 420, y: 62 },
    callsign:  { x: 530, y: 62 },
  };

  // ── State ──────────────────────────────────────────────────────────────
  const [editMode,     setEditMode]     = useState(false);
  const [layoutSaved,  setLayoutSaved]  = useState(false);  // true = use absolute positions in normal view
  const [positions,    setPositions]    = useState<Record<ElemKey, { x: number; y: number }>>(DEFAULT_POSITIONS);
  const [savedPositions, setSavedPositions] = useState<Record<ElemKey, { x: number; y: number }>>(DEFAULT_POSITIONS);"""

new_defaults = """  // Default positions — used for first render and after Cancel
  const DEFAULT_POSITIONS: Record<ElemKey, { x: number; y: number }> = {
    startTime: { x: 14,  y: 12 },
    picName:   { x: 110, y: 14 },
    coPilot:   { x: 110, y: 58 },
    duration:  { x: 420, y: 10 },
    event:     { x: 490, y: 10 },
    area:      { x: 490, y: 62 },
    aircraft:  { x: 420, y: 62 },
    callsign:  { x: 530, y: 62 },
  };

  const LS_KEY = 'flightTileLayout_v1';

  // Load persisted layout from localStorage on mount
  const loadPersistedLayout = (): { positions: Record<ElemKey, { x: number; y: number }>; saved: boolean } => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.positions && parsed.saved) {
          return { positions: parsed.positions, saved: true };
        }
      }
    } catch {}
    return { positions: DEFAULT_POSITIONS, saved: false };
  };

  const persisted = loadPersistedLayout();

  // ── State ──────────────────────────────────────────────────────────────
  const [editMode,     setEditMode]     = useState(false);
  const [layoutSaved,  setLayoutSaved]  = useState(persisted.saved);
  const [positions,    setPositions]    = useState<Record<ElemKey, { x: number; y: number }>>(persisted.positions);
  const [savedPositions, setSavedPositions] = useState<Record<ElemKey, { x: number; y: number }>>(persisted.positions);"""

if old_defaults in modal:
    modal = modal.replace(old_defaults, new_defaults)
    print("✅ Added localStorage load")
else:
    print("❌ Could not find defaults block")

# 1h. Save to localStorage when exitEditMode saves
old_exit = """  const exitEditMode = (save: boolean) => {
    if (save) {
      // Lock the current dragged positions as the saved layout
      setSavedPositions({ ...positions });
      setLayoutSaved(true);
    } else {
      // Revert to the last saved (or default) positions
      setPositions({ ...savedPositions });
    }
    setEditMode(false);
  };"""

new_exit = """  const exitEditMode = (save: boolean) => {
    if (save) {
      // Lock the current dragged positions as the saved layout
      setSavedPositions({ ...positions });
      setLayoutSaved(true);
      // Persist to localStorage so layout survives page navigation and refresh
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ positions, saved: true }));
      } catch {}
    } else {
      // Revert to the last saved (or default) positions
      setPositions({ ...savedPositions });
    }
    setEditMode(false);
  };"""

if old_exit in modal:
    modal = modal.replace(old_exit, new_exit)
    print("✅ Added localStorage save on exit")
else:
    print("❌ Could not find exitEditMode")

with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'w') as f:
    f.write(modal)

print(f"Modal length: {len(modal)}")

# ─── Fix 2: App.tsx — pass formationCallsigns to AddFlightTileModal ───────────

with open('DFP-NEO-V2-fresh/App.tsx', 'r') as f:
    app = f.read()

old_modal_call = """                    locationOpAreas={locationOpAreas}
                />"""

new_modal_call = """                    locationOpAreas={locationOpAreas}
                    formationCallsigns={formationCallsigns}
                />"""

if old_modal_call in app:
    app = app.replace(old_modal_call, new_modal_call, 1)
    print("✅ Added formationCallsigns to AddFlightTileModal in App.tsx")
else:
    print("❌ Could not find AddFlightTileModal call in App.tsx")

with open('DFP-NEO-V2-fresh/App.tsx', 'w') as f:
    f.write(app)

print(f"App.tsx length: {len(app)}")
print("\nAll done!")