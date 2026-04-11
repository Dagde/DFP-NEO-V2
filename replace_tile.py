#!/usr/bin/env python3
"""Replace the FlightTile component in AddFlightTileModal.tsx with the new design."""

with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'r') as f:
    content = f.read()

# Find the start and end of FlightTile component
start_marker = 'const FlightTile: React.FC<TileProps> = ({'
end_marker = '\n};\n\n// ─── Main Modal'

start_idx = content.index(start_marker)
end_idx = content.index(end_marker) + len('\n};\n')

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
  const TILE_BG       = '#7a6a2a';          // olive/golden-brown background
  const TILE_BORDER   = '#1a2340';          // dark navy border
  const OVAL_STROKE   = 'rgba(220,200,60,0.85)'; // yellow oval outline colour
  const WHITE_FULL    = 'rgba(255,255,255,0.95)';
  const WHITE_DIM     = 'rgba(255,255,255,0.75)';
  const WHITE_GHOST   = 'rgba(255,255,255,0.35)';
  const TILE_H        = 110;                // tile height px
  const monoFamily    = 'ui-monospace, SFMono-Regular, "Courier New", monospace';

  // ── Oval wrapper component ─────────────────────────────────────────────
  // Renders content inside a yellow-outlined ellipse (like in the reference image)
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
      border: `2px solid ${OVAL_STROKE}`,
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

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: TILE_H,
        backgroundColor: TILE_BG,
        border: `3px solid ${TILE_BORDER}`,
        borderRadius: 10,
        boxShadow: '0 4px 18px rgba(0,0,0,0.55)',
        userSelect: 'none',
        overflow: 'visible',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      {/* ══ LEFT SECTION: Start Time oval + Names ══ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 14,
        paddingRight: 10,
        flex: 1,
        minWidth: 0,
        gap: 14,
      }}>
        {/* Start Time oval — clickable select overlay */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Oval px={12} py={6} minW={72}>
            <span style={{
              fontFamily: monoFamily,
              fontSize: 22,
              fontWeight: 600,
              color: WHITE_FULL,
              lineHeight: 1,
              letterSpacing: 1,
            }}>
              {formatTime(startTime)}
            </span>
          </Oval>
          {/* invisible select overlaid on oval */}
          <select
            value={String(startTime)}
            onChange={e => onStartTimeChange(parseFloat(e.target.value))}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              opacity: 0, cursor: 'pointer', zIndex: 10,
            }}
          >
            {timeOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
          </select>
        </div>

        {/* PIC + Co-pilot names column */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          {/* PIC name — large bold */}
          <PersonDropdown
            value={picName}
            onChange={onPicNameChange}
            allUnits={allUnits}
            getLayer2={getLayer2}
            getNames={getNames}
            placeholder="Surname, First (N)"
            fontSize={30}
            color={picName ? WHITE_FULL : WHITE_GHOST}
            bold
          />
          {/* Co-pilot / SOLO */}
          {flightType === 'Dual' ? (
            <PersonDropdown
              value={studentName}
              onChange={(name) => onStudentNameChange(name)}
              allUnits={allUnits}
              getLayer2={getLayer2}
              getNames={getNames}
              placeholder="Surname, First (N)"
              fontSize={22}
              color={studentName ? WHITE_DIM : WHITE_GHOST}
              allowSolo
              onSoloSelect={() => onFlightTypeChange('Solo')}
            />
          ) : (
            <span
              onClick={() => onFlightTypeChange('Dual')}
              style={{
                display: 'inline-block',
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: 1,
                color: 'rgba(255,220,60,0.95)',
                background: 'rgba(255,200,0,0.20)',
                padding: '3px 10px',
                borderRadius: 4,
                lineHeight: 1.25,
                cursor: 'pointer',
                userSelect: 'none',
              }}
              title="Click to switch to Dual"
            >
              SOLO
            </span>
          )}
        </div>
      </div>

      {/* ══ RIGHT SECTION: Duration oval, Event oval, Op Area oval ══ */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        paddingRight: 16,
        paddingLeft: 8,
        paddingTop: 10,
        paddingBottom: 10,
        flexShrink: 0,
        gap: 6,
      }}>
        {/* Top row: [duration] + Event side by side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Flight Duration oval */}
          <div style={{ position: 'relative' }}>
            <Oval px={10} py={5} minW={58}>
              <span style={{
                fontFamily: monoFamily,
                fontSize: 20,
                fontWeight: 700,
                color: WHITE_FULL,
                lineHeight: 1,
              }}>
                [{duration.toFixed(1)}]
              </span>
            </Oval>
            {/* invisible select */}
            <select
              value={String(duration)}
              onChange={e => onDurationChange(parseFloat(e.target.value))}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%',
                opacity: 0, cursor: 'pointer', zIndex: 10,
              }}
            >
              {durationOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
            </select>
          </div>

          {/* Event Number oval */}
          <div style={{ position: 'relative' }}>
            <Oval px={10} py={5} minW={58}>
              <EventDropdown
                value={flightNumber}
                onChange={onFlightNumberChange}
                courseOptions={courseOptions}
                getEventsForCourse={getEventsForCourse}
                nextLMPEvent={nextLMPEvent}
                fontSize={20}
                color={flightNumber ? WHITE_FULL : WHITE_GHOST}
                disabled={eventCategory === 'lmp_currency'}
              />
            </Oval>
          </div>
        </div>

        {/* Bottom row: Op Area oval */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Op Area oval */}
          <div style={{ position: 'relative' }}>
            <Oval px={10} py={5} minW={42}>
              <span style={{
                fontSize: 20,
                fontWeight: 600,
                color: /^[A-H]$/.test(area) ? WHITE_FULL : 'rgba(255,220,60,0.95)',
                lineHeight: 1,
              }}>
                {area || '-'}
              </span>
            </Oval>
            <select
              value={area}
              onChange={e => onAreaChange(e.target.value)}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%',
                opacity: 0, cursor: 'pointer', zIndex: 10,
              }}
            >
              {areaOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
            </select>
          </div>

          {/* Aircraft number (small, subtle) */}
          <div style={{ position: 'relative' }}>
            <span style={{
              fontFamily: monoFamily,
              fontSize: 14,
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 1,
            }}>#{aircraftNumber || '001'}</span>
            <select
              value={aircraftNumber}
              onChange={e => onAircraftChange(e.target.value)}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%',
                opacity: 0, cursor: 'pointer', zIndex: 10,
              }}
            >
              {aircraftOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
            </select>
          </div>

          {/* Callsign */}
          {callsignOptions.length > 1 ? (
            <div style={{ position: 'relative' }}>
              <span style={{
                fontFamily: monoFamily,
                fontSize: 14,
                fontStyle: 'italic',
                color: callsign ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.30)',
                lineHeight: 1,
              }}>
                {callsign || 'CALLSGN'}
              </span>
              <select
                value={callsign}
                onChange={e => onCallsignChange(e.target.value)}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%',
                  opacity: 0, cursor: 'pointer', zIndex: 10,
                }}
              >
                <option value="" style={{ background: '#1a2f4a' }}>—</option>
                {callsignOptions.map(cs => <option key={cs} value={cs} style={{ background: '#1a2f4a' }}>{cs}</option>)}
              </select>
            </div>
          ) : (
            <input
              type="text"
              value={callsign}
              onChange={e => onCallsignChange(e.target.value)}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                fontFamily: monoFamily,
                fontSize: 14, fontStyle: 'italic', lineHeight: 1,
                color: callsign ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.30)',
                width: 80, padding: 0, cursor: 'text',
              }}
              placeholder="CALLSGN"
            />
          )}
        </div>
      </div>
    </div>
  );
};'''

new_content = content[:start_idx] + new_tile + content[end_idx:]

with open('DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx', 'w') as f:
    f.write(new_content)

print("Done! Replaced FlightTile component.")
print(f"Original length: {len(content)}")
print(f"New length: {len(new_content)}")