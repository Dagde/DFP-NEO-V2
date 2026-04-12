#!/usr/bin/env python3
"""Replace the FlightTile component with drag-and-drop edit mode support."""

with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'r') as f:
    content = f.read()

start_marker = 'const FlightTile: React.FC<TileProps> = ({'

# Find FlightTile start
start_idx = content.index(start_marker)

# Find the end: the '};' that ends FlightTile, followed by '\n//'
# We search from start_idx forward for '\n};\n//'
search_from = start_idx + len(start_marker)
end_search = content.index('\n};\n//', search_from)
end_idx = end_search + len('\n};\n')

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
  const TILE_BG       = '#7a6a2a';
  const TILE_BORDER   = '#1a2340';
  const WHITE_FULL    = 'rgba(255,255,255,0.95)';
  const WHITE_DIM     = 'rgba(255,255,255,0.75)';
  const WHITE_GHOST   = 'rgba(255,255,255,0.35)';
  const TILE_H        = 110;
  const monoFamily    = 'ui-monospace, SFMono-Regular, "Courier New", monospace';

  // ── Edit mode state ───────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);

  // Per-element position offsets (x, y) from their default position
  // Stored as absolute positions inside the tile when in edit mode
  type ElemKey = 'startTime' | 'picName' | 'coPilot' | 'duration' | 'event' | 'area' | 'aircraft';

  const tileRef = useRef<HTMLDivElement>(null);

  // Default positions (set when entering edit mode by measuring actual DOM positions)
  const [positions, setPositions] = useState<Record<ElemKey, { x: number; y: number }>>({
    startTime: { x: 14, y: 30 },
    picName:   { x: 110, y: 18 },
    coPilot:   { x: 110, y: 62 },
    duration:  { x: 0, y: 10 },   // will be set from right edge
    event:     { x: 0, y: 10 },
    area:      { x: 0, y: 62 },
    aircraft:  { x: 0, y: 62 },
  });

  // Track which element is being dragged
  const dragging = useRef<{ key: ElemKey; startMouseX: number; startMouseY: number; startPosX: number; startPosY: number } | null>(null);

  // Measure actual element positions when entering edit mode
  const elemRefs = useRef<Partial<Record<ElemKey, HTMLDivElement | null>>>({});

  const enterEditMode = () => {
    if (!tileRef.current) { setEditMode(true); return; }
    const tileRect = tileRef.current.getBoundingClientRect();
    const newPos: Record<ElemKey, { x: number; y: number }> = { ...positions };
    (Object.keys(elemRefs.current) as ElemKey[]).forEach(key => {
      const el = elemRefs.current[key];
      if (el) {
        const r = el.getBoundingClientRect();
        newPos[key] = {
          x: r.left - tileRect.left,
          y: r.top - tileRect.top,
        };
      }
    });
    setPositions(newPos);
    setEditMode(true);
  };

  const exitEditMode = (save: boolean) => {
    if (!save) {
      // reset to defaults
      setPositions({
        startTime: { x: 14, y: 30 },
        picName:   { x: 110, y: 18 },
        coPilot:   { x: 110, y: 62 },
        duration:  { x: 0, y: 10 },
        event:     { x: 0, y: 10 },
        area:      { x: 0, y: 62 },
        aircraft:  { x: 0, y: 62 },
      });
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
      const newX = Math.max(0, Math.min(tileRect.width - 20, startPosX + dx));
      const newY = Math.max(0, Math.min(TILE_H - 20, startPosY + dy));
      setPositions(prev => ({ ...prev, [key]: { x: newX, y: newY } }));
    };
    const onMouseUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [editMode]);

  // ── Oval wrapper ──────────────────────────────────────────────────────
  const Oval: React.FC<{
    children: React.ReactNode;
    style?: React.CSSProperties;
    minW?: number;
    px?: number;
    py?: number;
  }> = ({ children, style, minW = 0, px = 10, py = 5 }) => (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 50,
      padding: `${py}px ${px}px`,
      minWidth: minW,
      boxSizing: 'border-box',
      lineHeight: 1,
      ...style,
    }}>
      {children}
    </div>
  );

  // ── Draggable wrapper for edit mode ──────────────────────────────────
  const Draggable: React.FC<{
    elemKey: ElemKey;
    children: React.ReactNode;
    defaultStyle?: React.CSSProperties;
  }> = ({ elemKey, children, defaultStyle }) => {
    if (!editMode) {
      return (
        <div
          ref={el => { elemRefs.current[elemKey] = el; }}
          style={{ display: 'inline-flex', ...defaultStyle }}
        >
          {children}
        </div>
      );
    }
    const pos = positions[elemKey];
    return (
      <div
        ref={el => { elemRefs.current[elemKey] = el; }}
        onMouseDown={onMouseDown(elemKey)}
        style={{
          position: 'absolute',
          left: pos.x,
          top: pos.y,
          cursor: 'grab',
          zIndex: 100,
          outline: '2px dashed rgba(255,220,60,0.9)',
          outlineOffset: 3,
          borderRadius: 4,
          padding: 2,
          userSelect: 'none',
          display: 'inline-flex',
          alignItems: 'center',
        }}
        title="Drag to reposition"
      >
        {children}
      </div>
    );
  };

  // ── Normal (non-edit) layout ──────────────────────────────────────────
  const normalLayout = (
    <>
      {/* LEFT SECTION */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 14,
        paddingRight: 10,
        flex: 1,
        minWidth: 0,
        gap: 14,
      }}>
        {/* Start Time */}
        <div
          ref={el => { elemRefs.current['startTime'] = el; }}
          style={{ position: 'relative', flexShrink: 0, marginTop: -15 }}
        >
          <Oval px={12} py={6} minW={72}>
            <span style={{ fontFamily: monoFamily, fontSize: 22, fontWeight: 600, color: WHITE_FULL, lineHeight: 1, letterSpacing: 1 }}>
              {formatTime(startTime)}
            </span>
          </Oval>
          <select value={String(startTime)} onChange={e => onStartTimeChange(parseFloat(e.target.value))}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}>
            {timeOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
          </select>
        </div>

        {/* Names column */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <div ref={el => { elemRefs.current['picName'] = el; }}>
            <PersonDropdown value={picName} onChange={onPicNameChange} allUnits={allUnits} getLayer2={getLayer2} getNames={getNames}
              placeholder="Surname, First (N)" fontSize={30} color={picName ? WHITE_FULL : WHITE_GHOST} bold />
          </div>
          <div ref={el => { elemRefs.current['coPilot'] = el; }}>
            {flightType === 'Dual' ? (
              <PersonDropdown value={studentName} onChange={(name) => onStudentNameChange(name)} allUnits={allUnits} getLayer2={getLayer2} getNames={getNames}
                placeholder="Surname, First (N)" fontSize={22} color={studentName ? WHITE_DIM : WHITE_GHOST} allowSolo onSoloSelect={() => onFlightTypeChange('Solo')} />
            ) : (
              <span onClick={() => onFlightTypeChange('Dual')}
                style={{ display: 'inline-block', fontSize: 18, fontWeight: 800, letterSpacing: 1, color: 'rgba(255,220,60,0.95)', background: 'rgba(255,200,0,0.20)', padding: '3px 10px', borderRadius: 4, lineHeight: 1.25, cursor: 'pointer' }}
                title="Click to switch to Dual">SOLO</span>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', paddingRight: 16, paddingLeft: 8, paddingTop: 10, paddingBottom: 10, flexShrink: 0, gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Duration */}
          <div ref={el => { elemRefs.current['duration'] = el; }} style={{ position: 'relative' }}>
            <Oval px={10} py={5} minW={58}>
              <span style={{ fontFamily: monoFamily, fontSize: 20, fontWeight: 700, color: WHITE_FULL, lineHeight: 1 }}>[{duration.toFixed(1)}]</span>
            </Oval>
            <select value={String(duration)} onChange={e => onDurationChange(parseFloat(e.target.value))}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}>
              {durationOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
            </select>
          </div>
          {/* Event */}
          <div ref={el => { elemRefs.current['event'] = el; }} style={{ position: 'relative' }}>
            <Oval px={10} py={5} minW={58}>
              <EventDropdown value={flightNumber} onChange={onFlightNumberChange} courseOptions={courseOptions} getEventsForCourse={getEventsForCourse}
                nextLMPEvent={nextLMPEvent} fontSize={20} color={flightNumber ? WHITE_FULL : WHITE_GHOST} disabled={eventCategory === 'lmp_currency'} />
            </Oval>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Area */}
          <div ref={el => { elemRefs.current['area'] = el; }} style={{ position: 'relative' }}>
            <Oval px={10} py={5} minW={42}>
              <span style={{ fontSize: 20, fontWeight: 600, color: /^[A-H]$/.test(area) ? WHITE_FULL : 'rgba(255,220,60,0.95)', lineHeight: 1 }}>{area || '-'}</span>
            </Oval>
            <select value={area} onChange={e => onAreaChange(e.target.value)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}>
              {areaOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
            </select>
          </div>
          {/* Aircraft */}
          <div ref={el => { elemRefs.current['aircraft'] = el; }} style={{ position: 'relative' }}>
            <span style={{ fontFamily: monoFamily, fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>#{aircraftNumber || '001'}</span>
            <select value={aircraftNumber} onChange={e => onAircraftChange(e.target.value)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}>
              {aircraftOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
            </select>
          </div>
          {/* Callsign */}
          {callsignOptions.length > 1 ? (
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
          )}
        </div>
      </div>
    </>
  );

  // ── Edit layout (all elements absolutely positioned + draggable) ──────
  const editLayout = (
    <>
      {/* Dim overlay hint */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', borderRadius: 8, zIndex: 1, pointerEvents: 'none' }} />

      {/* Start Time */}
      <Draggable elemKey="startTime">
        <div style={{ position: 'relative' }}>
          <Oval px={12} py={6} minW={72}>
            <span style={{ fontFamily: monoFamily, fontSize: 22, fontWeight: 600, color: WHITE_FULL, lineHeight: 1, letterSpacing: 1 }}>
              {formatTime(startTime)}
            </span>
          </Oval>
          <select value={String(startTime)} onChange={e => onStartTimeChange(parseFloat(e.target.value))}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 110 }}>
            {timeOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
          </select>
        </div>
      </Draggable>

      {/* PIC name */}
      <Draggable elemKey="picName">
        <PersonDropdown value={picName} onChange={onPicNameChange} allUnits={allUnits} getLayer2={getLayer2} getNames={getNames}
          placeholder="Surname, First (N)" fontSize={30} color={picName ? WHITE_FULL : WHITE_GHOST} bold />
      </Draggable>

      {/* Co-pilot */}
      <Draggable elemKey="coPilot">
        {flightType === 'Dual' ? (
          <PersonDropdown value={studentName} onChange={(name) => onStudentNameChange(name)} allUnits={allUnits} getLayer2={getLayer2} getNames={getNames}
            placeholder="Surname, First (N)" fontSize={22} color={studentName ? WHITE_DIM : WHITE_GHOST} allowSolo onSoloSelect={() => onFlightTypeChange('Solo')} />
        ) : (
          <span onClick={() => onFlightTypeChange('Dual')}
            style={{ display: 'inline-block', fontSize: 18, fontWeight: 800, letterSpacing: 1, color: 'rgba(255,220,60,0.95)', background: 'rgba(255,200,0,0.20)', padding: '3px 10px', borderRadius: 4, lineHeight: 1.25, cursor: 'pointer' }}
            title="Click to switch to Dual">SOLO</span>
        )}
      </Draggable>

      {/* Duration */}
      <Draggable elemKey="duration">
        <div style={{ position: 'relative' }}>
          <Oval px={10} py={5} minW={58}>
            <span style={{ fontFamily: monoFamily, fontSize: 20, fontWeight: 700, color: WHITE_FULL, lineHeight: 1 }}>[{duration.toFixed(1)}]</span>
          </Oval>
          <select value={String(duration)} onChange={e => onDurationChange(parseFloat(e.target.value))}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 110 }}>
            {durationOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
          </select>
        </div>
      </Draggable>

      {/* Event */}
      <Draggable elemKey="event">
        <div style={{ position: 'relative' }}>
          <Oval px={10} py={5} minW={58}>
            <EventDropdown value={flightNumber} onChange={onFlightNumberChange} courseOptions={courseOptions} getEventsForCourse={getEventsForCourse}
              nextLMPEvent={nextLMPEvent} fontSize={20} color={flightNumber ? WHITE_FULL : WHITE_GHOST} disabled={eventCategory === 'lmp_currency'} />
          </Oval>
        </div>
      </Draggable>

      {/* Area */}
      <Draggable elemKey="area">
        <div style={{ position: 'relative' }}>
          <Oval px={10} py={5} minW={42}>
            <span style={{ fontSize: 20, fontWeight: 600, color: /^[A-H]$/.test(area) ? WHITE_FULL : 'rgba(255,220,60,0.95)', lineHeight: 1 }}>{area || '-'}</span>
          </Oval>
          <select value={area} onChange={e => onAreaChange(e.target.value)}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 110 }}>
            {areaOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
          </select>
        </div>
      </Draggable>

      {/* Aircraft */}
      <Draggable elemKey="aircraft">
        <div style={{ position: 'relative' }}>
          <span style={{ fontFamily: monoFamily, fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>#{aircraftNumber || '001'}</span>
          <select value={aircraftNumber} onChange={e => onAircraftChange(e.target.value)}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 110 }}>
            {aircraftOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
          </select>
        </div>
      </Draggable>
    </>
  );

  return (
    <div style={{ width: '100%' }}>
      {/* ── EDIT / SAVE / CANCEL buttons above tile ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 6 }}>
        {!editMode ? (
          <button
            type="button"
            onClick={enterEditMode}
            style={{
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.85)',
              cursor: 'pointer',
              letterSpacing: 0.5,
            }}
          >
            ✎ EDIT LAYOUT
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => exitEditMode(false)}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: '1px solid rgba(255,100,100,0.5)',
                background: 'rgba(200,50,50,0.25)',
                color: 'rgba(255,180,180,0.95)',
                cursor: 'pointer',
              }}
            >
              ✕ CANCEL
            </button>
            <button
              type="button"
              onClick={() => exitEditMode(true)}
              style={{
                padding: '4px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: '1px solid rgba(60,200,100,0.5)',
                background: 'rgba(30,150,60,0.35)',
                color: 'rgba(120,255,160,0.95)',
                cursor: 'pointer',
              }}
            >
              ✔ SAVE LAYOUT
            </button>
          </>
        )}
      </div>

      {/* ── Tile ── */}
      <div
        ref={tileRef}
        style={{
          position: 'relative',
          width: '100%',
          height: TILE_H,
          backgroundColor: TILE_BG,
          border: editMode ? `3px solid rgba(255,220,60,0.7)` : `3px solid ${TILE_BORDER}`,
          borderRadius: 10,
          boxShadow: '0 4px 18px rgba(0,0,0,0.55)',
          userSelect: 'none',
          overflow: editMode ? 'visible' : 'visible',
          boxSizing: 'border-box',
          display: editMode ? 'block' : 'flex',
          alignItems: editMode ? undefined : 'stretch',
        }}
      >
        {editMode ? editLayout : normalLayout}
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