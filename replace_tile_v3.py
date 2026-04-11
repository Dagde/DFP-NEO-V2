#!/usr/bin/env python3
"""Replace FlightTile - fix save: always use absolute positions after first save."""

with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'r') as f:
    content = f.read()

start_marker = 'const FlightTile: React.FC<TileProps> = ({'
start_idx = content.index(start_marker)
search_from = start_idx + len(start_marker)

# After v2 rewrite, FlightTile ends with "};\n// ─── Main Modal" or "};// ─── Main Modal"
# Find "const AddFlightTileModal" and go back to find the preceding "};"
main_modal_idx = content.index('\nconst AddFlightTileModal')
# Find the last "};" before main_modal_idx
end_of_tile = content.rfind('};', start_idx, main_modal_idx)
end_idx = end_of_tile + len('};')

new_tile = r'''const FlightTile: React.FC<TileProps> = ({
  flightType, startTime, picName, studentName, duration, flightNumber,
  area, aircraftNumber, callsign, color,
  timeOptions, durationOptions, areaOptions, aircraftOptions, callsignOptions,
  allUnits, getLayer2, getNames,
  courseOptions, getEventsForCourse, nextLMPEvent, eventCategory,
  onFlightTypeChange, onStartTimeChange, onPicNameChange, onStudentNameChange,
  onDurationChange, onFlightNumberChange, onAreaChange, onAircraftChange, onCallsignChange,
}) => {
  // ── Design constants ──────────────────────────────────────────────────
  const TILE_BG    = '#7a6a2a';
  const TILE_BORDER= '#1a2340';
  const WHITE_FULL = 'rgba(255,255,255,0.95)';
  const WHITE_DIM  = 'rgba(255,255,255,0.75)';
  const WHITE_GHOST= 'rgba(255,255,255,0.35)';
  const TILE_H     = 110;
  const monoFamily = 'ui-monospace, SFMono-Regular, "Courier New", monospace';

  type ElemKey = 'startTime' | 'picName' | 'coPilot' | 'duration' | 'event' | 'area' | 'aircraft';

  // Default positions — used for first render and after Cancel
  const DEFAULT_POSITIONS: Record<ElemKey, { x: number; y: number }> = {
    startTime: { x: 14,  y: 12 },
    picName:   { x: 110, y: 14 },
    coPilot:   { x: 110, y: 58 },
    duration:  { x: 420, y: 10 },
    event:     { x: 490, y: 10 },
    area:      { x: 490, y: 62 },
    aircraft:  { x: 420, y: 62 },
  };

  // ── State ──────────────────────────────────────────────────────────────
  const [editMode,     setEditMode]     = useState(false);
  const [layoutSaved,  setLayoutSaved]  = useState(false);  // true = use absolute positions in normal view
  const [positions,    setPositions]    = useState<Record<ElemKey, { x: number; y: number }>>(DEFAULT_POSITIONS);
  const [savedPositions, setSavedPositions] = useState<Record<ElemKey, { x: number; y: number }>>(DEFAULT_POSITIONS);

  const tileRef   = useRef<HTMLDivElement>(null);
  const elemRefs  = useRef<Partial<Record<ElemKey, HTMLDivElement | null>>>({});
  const dragging  = useRef<{ key: ElemKey; startMouseX: number; startMouseY: number; startPosX: number; startPosY: number } | null>(null);

  // When entering edit mode, capture the real DOM positions of each element
  const enterEditMode = () => {
    if (!tileRef.current) { setEditMode(true); return; }
    const tileRect = tileRef.current.getBoundingClientRect();
    // If layout was already saved, start from saved positions
    if (layoutSaved) {
      setPositions({ ...savedPositions });
      setEditMode(true);
      return;
    }
    // Otherwise measure from DOM
    const newPos: Record<ElemKey, { x: number; y: number }> = { ...DEFAULT_POSITIONS };
    (Object.keys(elemRefs.current) as ElemKey[]).forEach(key => {
      const el = elemRefs.current[key];
      if (el) {
        const r = el.getBoundingClientRect();
        newPos[key] = {
          x: Math.round(r.left - tileRect.left),
          y: Math.round(r.top  - tileRect.top),
        };
      }
    });
    setPositions(newPos);
    setEditMode(true);
  };

  const exitEditMode = (save: boolean) => {
    if (save) {
      // Lock the current dragged positions as the saved layout
      setSavedPositions({ ...positions });
      setLayoutSaved(true);
    } else {
      // Revert to the last saved (or default) positions
      setPositions({ ...savedPositions });
    }
    setEditMode(false);
  };

  // Mouse drag handlers
  const onMouseDown = (key: ElemKey) => (e: React.MouseEvent) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    dragging.current = {
      key,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: positions[key].x,
      startPosY: positions[key].y,
    };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !tileRef.current) return;
      const { key, startMouseX, startMouseY, startPosX, startPosY } = dragging.current;
      const tileRect = tileRef.current.getBoundingClientRect();
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      const newX = Math.max(0, Math.min(tileRect.width  - 20, startPosX + dx));
      const newY = Math.max(0, Math.min(TILE_H - 20, startPosY + dy));
      setPositions(prev => ({ ...prev, [key]: { x: Math.round(newX), y: Math.round(newY) } }));
    };
    const onMouseUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [editMode, positions]);

  // ── Oval wrapper ──────────────────────────────────────────────────────
  const Oval: React.FC<{
    children: React.ReactNode;
    style?: React.CSSProperties;
    minW?: number; px?: number; py?: number;
  }> = ({ children, style, minW = 0, px = 10, py = 5 }) => (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 50, padding: `${py}px ${px}px`,
      minWidth: minW, boxSizing: 'border-box', lineHeight: 1, ...style,
    }}>
      {children}
    </div>
  );

  // ── Absolutely-positioned element (used in both edit mode and saved layout) ──
  const AbsElem: React.FC<{
    elemKey: ElemKey;
    children: React.ReactNode;
    draggable?: boolean;
  }> = ({ elemKey, children, draggable: isDraggable = false }) => {
    const pos = (editMode ? positions : savedPositions)[elemKey];
    return (
      <div
        ref={el => { elemRefs.current[elemKey] = el; }}
        onMouseDown={isDraggable ? onMouseDown(elemKey) : undefined}
        style={{
          position: 'absolute',
          left: pos.x,
          top:  pos.y,
          cursor: isDraggable ? 'grab' : 'default',
          zIndex: isDraggable ? 100 : 5,
          outline: isDraggable ? '2px dashed rgba(255,220,60,0.9)' : 'none',
          outlineOffset: isDraggable ? 3 : 0,
          borderRadius: 4,
          padding: isDraggable ? 2 : 0,
          userSelect: 'none',
          display: 'inline-flex',
          alignItems: 'center',
        }}
        title={isDraggable ? 'Drag to reposition' : undefined}
      >
        {children}
      </div>
    );
  };

  // ── Flex ref wrapper (used in normal non-saved layout) ────────────────
  const FlexElem: React.FC<{ elemKey: ElemKey; children: React.ReactNode; style?: React.CSSProperties }> = ({ elemKey, children, style }) => (
    <div ref={el => { elemRefs.current[elemKey] = el; }} style={{ display: 'inline-flex', ...style }}>
      {children}
    </div>
  );

  // ── All element content definitions ──────────────────────────────────
  const startTimeContent = (zOverride?: number) => (
    <div style={{ position: 'relative' }}>
      <Oval px={12} py={6} minW={72}>
        <span style={{ fontFamily: monoFamily, fontSize: 22, fontWeight: 600, color: WHITE_FULL, lineHeight: 1, letterSpacing: 1 }}>
          {formatTime(startTime)}
        </span>
      </Oval>
      <select value={String(startTime)} onChange={e => onStartTimeChange(parseFloat(e.target.value))}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: zOverride ?? 10 }}>
        {timeOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
      </select>
    </div>
  );

  const picNameContent = () => (
    <PersonDropdown value={picName} onChange={onPicNameChange} allUnits={allUnits} getLayer2={getLayer2} getNames={getNames}
      placeholder="Surname, First (N)" fontSize={30} color={picName ? WHITE_FULL : WHITE_GHOST} bold />
  );

  const coPilotContent = () => (
    flightType === 'Dual' ? (
      <PersonDropdown value={studentName} onChange={(name) => onStudentNameChange(name)} allUnits={allUnits} getLayer2={getLayer2} getNames={getNames}
        placeholder="Surname, First (N)" fontSize={22} color={studentName ? WHITE_DIM : WHITE_GHOST} allowSolo onSoloSelect={() => onFlightTypeChange('Solo')} />
    ) : (
      <span onClick={() => onFlightTypeChange('Dual')}
        style={{ display: 'inline-block', fontSize: 18, fontWeight: 800, letterSpacing: 1, color: 'rgba(255,220,60,0.95)', background: 'rgba(255,200,0,0.20)', padding: '3px 10px', borderRadius: 4, lineHeight: 1.25, cursor: 'pointer' }}
        title="Click to switch to Dual">SOLO</span>
    )
  );

  const durationContent = (zOverride?: number) => (
    <div style={{ position: 'relative' }}>
      <Oval px={10} py={5} minW={58}>
        <span style={{ fontFamily: monoFamily, fontSize: 20, fontWeight: 700, color: WHITE_FULL, lineHeight: 1 }}>[{duration.toFixed(1)}]</span>
      </Oval>
      <select value={String(duration)} onChange={e => onDurationChange(parseFloat(e.target.value))}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: zOverride ?? 10 }}>
        {durationOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
      </select>
    </div>
  );

  const eventContent = () => (
    <div style={{ position: 'relative' }}>
      <Oval px={10} py={5} minW={58}>
        <EventDropdown value={flightNumber} onChange={onFlightNumberChange} courseOptions={courseOptions} getEventsForCourse={getEventsForCourse}
          nextLMPEvent={nextLMPEvent} fontSize={20} color={flightNumber ? WHITE_FULL : WHITE_GHOST} disabled={eventCategory === 'lmp_currency'} />
      </Oval>
    </div>
  );

  const areaContent = (zOverride?: number) => (
    <div style={{ position: 'relative' }}>
      <Oval px={10} py={5} minW={42}>
        <span style={{ fontSize: 20, fontWeight: 600, color: /^[A-H]$/.test(area) ? WHITE_FULL : 'rgba(255,220,60,0.95)', lineHeight: 1 }}>{area || '-'}</span>
      </Oval>
      <select value={area} onChange={e => onAreaChange(e.target.value)}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: zOverride ?? 10 }}>
        {areaOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
      </select>
    </div>
  );

  const aircraftContent = (zOverride?: number) => (
    <div style={{ position: 'relative' }}>
      <span style={{ fontFamily: monoFamily, fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>#{aircraftNumber || '001'}</span>
      <select value={aircraftNumber} onChange={e => onAircraftChange(e.target.value)}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: zOverride ?? 10 }}>
        {aircraftOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
      </select>
    </div>
  );

  const callsignContent = () => (
    callsignOptions.length > 1 ? (
      <div style={{ position: 'relative' }}>
        <span style={{ fontFamily: monoFamily, fontSize: 14, fontStyle: 'italic', color: callsign ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.30)', lineHeight: 1 }}>
          {callsign || 'CALLSGN'}
        </span>
        <select value={callsign} onChange={e => onCallsignChange(e.target.value)}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}>
          <option value="" style={{ background: '#1a2f4a' }}>—</option>
          {callsignOptions.map(cs => <option key={cs} value={cs} style={{ background: '#1a2f4a' }}>{cs}</option>)}
        </select>
      </div>
    ) : (
      <input type="text" value={callsign} onChange={e => onCallsignChange(e.target.value)}
        style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: monoFamily, fontSize: 14, fontStyle: 'italic', lineHeight: 1,
          color: callsign ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.30)', width: 80, padding: 0, cursor: 'text' }}
        placeholder="CALLSGN" />
    )
  );

  // ── Normal flex layout (before any save) ─────────────────────────────
  const normalFlexLayout = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 14, paddingRight: 10, flex: 1, minWidth: 0, gap: 14 }}>
        <FlexElem elemKey="startTime" style={{ position: 'relative', flexShrink: 0, marginTop: -15 }}>
          {startTimeContent()}
        </FlexElem>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <FlexElem elemKey="picName">{picNameContent()}</FlexElem>
          <FlexElem elemKey="coPilot">{coPilotContent()}</FlexElem>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', paddingRight: 16, paddingLeft: 8, paddingTop: 10, paddingBottom: 10, flexShrink: 0, gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlexElem elemKey="duration">{durationContent()}</FlexElem>
          <FlexElem elemKey="event">{eventContent()}</FlexElem>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlexElem elemKey="area">{areaContent()}</FlexElem>
          <FlexElem elemKey="aircraft">{aircraftContent()}</FlexElem>
          {callsignContent()}
        </div>
      </div>
    </>
  );

  // ── Saved layout (absolute, positions from savedPositions) ────────────
  const savedAbsLayout = (
    <>
      <AbsElem elemKey="startTime">{startTimeContent()}</AbsElem>
      <AbsElem elemKey="picName">{picNameContent()}</AbsElem>
      <AbsElem elemKey="coPilot">{coPilotContent()}</AbsElem>
      <AbsElem elemKey="duration">{durationContent()}</AbsElem>
      <AbsElem elemKey="event">{eventContent()}</AbsElem>
      <AbsElem elemKey="area">{areaContent()}</AbsElem>
      <AbsElem elemKey="aircraft">{aircraftContent()}</AbsElem>
      <div style={{ position: 'absolute', bottom: 8, right: 16 }}>{callsignContent()}</div>
    </>
  );

  // ── Edit layout (absolute, draggable, positions from positions state) ─
  const editAbsLayout = (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.12)', borderRadius: 8, zIndex: 1, pointerEvents: 'none' }} />
      <AbsElem elemKey="startTime" draggable>{startTimeContent(110)}</AbsElem>
      <AbsElem elemKey="picName"   draggable>{picNameContent()}</AbsElem>
      <AbsElem elemKey="coPilot"   draggable>{coPilotContent()}</AbsElem>
      <AbsElem elemKey="duration"  draggable>{durationContent(110)}</AbsElem>
      <AbsElem elemKey="event"     draggable>{eventContent()}</AbsElem>
      <AbsElem elemKey="area"      draggable>{areaContent(110)}</AbsElem>
      <AbsElem elemKey="aircraft"  draggable>{aircraftContent(110)}</AbsElem>
    </>
  );

  const showAbsolute = editMode || layoutSaved;

  return (
    <div style={{ width: '100%' }}>
      {/* EDIT / SAVE / CANCEL buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 6 }}>
        {!editMode ? (
          <button type="button" onClick={enterEditMode}
            style={{ padding: '4px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', letterSpacing: 0.5 }}>
            ✎ EDIT LAYOUT
          </button>
        ) : (
          <>
            <button type="button" onClick={() => exitEditMode(false)}
              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,100,100,0.5)', background: 'rgba(200,50,50,0.25)', color: 'rgba(255,180,180,0.95)', cursor: 'pointer' }}>
              ✕ CANCEL
            </button>
            <button type="button" onClick={() => exitEditMode(true)}
              style={{ padding: '4px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(60,200,100,0.5)', background: 'rgba(30,150,60,0.35)', color: 'rgba(120,255,160,0.95)', cursor: 'pointer' }}>
              ✔ SAVE LAYOUT
            </button>
          </>
        )}
      </div>

      {/* Tile */}
      <div ref={tileRef}
        style={{
          position: 'relative',
          width: '100%',
          height: TILE_H,
          backgroundColor: TILE_BG,
          border: editMode ? `3px solid rgba(255,220,60,0.7)` : `3px solid ${TILE_BORDER}`,
          borderRadius: 10,
          boxShadow: '0 4px 18px rgba(0,0,0,0.55)',
          userSelect: 'none',
          overflow: 'visible',
          boxSizing: 'border-box',
          display: showAbsolute ? 'block' : 'flex',
          alignItems: showAbsolute ? undefined : 'stretch',
        }}
      >
        {editMode ? editAbsLayout : layoutSaved ? savedAbsLayout : normalFlexLayout}
      </div>

      {editMode && (
        <p style={{ fontSize: 11, color: 'rgba(255,220,60,0.75)', marginTop: 6, textAlign: 'center', letterSpacing: 0.3 }}>
          Drag any element to reposition it · Click SAVE LAYOUT to lock positions
        </p>
      )}
    </div>
  );
};'''

new_content = content[:start_idx] + new_tile + content[end_idx:]

with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'w') as f:
    f.write(new_content)

print("Done!")
print(f"Original length: {len(content)}")
print(f"New length: {len(new_content)}")