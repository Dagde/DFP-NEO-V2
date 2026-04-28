import re

filepath = "DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# ─── FIX 1: Callsign auto-population using callsignNumber + school prefix ───────────────────

old_callsign_effect = '''  useEffect(() => {
    if (!picName) { setCallsign(''); setCallsignOptions([]); return; }

    // Determine PIC's unit (for filtering formation callsigns)
    let picUnit: string | null = null;

    // Check instructor first
    const inst = instructorsData.find(i => i.name === picName);
    if (inst) {
      picUnit = inst.unit || null;
      const primary   = inst.callsign || '';
      const secondary = inst.secondaryCallsign || '';
      const personal  = [primary, secondary].filter(Boolean);
      // Add formation callsigns that belong to the same unit as the PIC
      const formation = (formationCallsigns || []).filter(fc => fc.unit && picUnit && fc.unit === picUnit).map(fc => fc.name || fc.code).filter(Boolean);
      const allOpts   = [...new Set([...personal, ...formation])];
      setCallsignOptions(allOpts);
      setCallsign(primary || (allOpts[0] || ''));
      return;
    }

    // Check trainee
    const trainee = traineesData.find(t => (t.fullName || t.name) === picName);
    if (trainee) {
      picUnit = (trainee as any).unit || null;
      const cs = trainee.traineeCallsign || '';
      const personal = cs ? [cs] : [];
      // Add formation callsigns that belong to the same unit as the PIC
      const formation = (formationCallsigns || []).filter(fc => fc.unit && picUnit && fc.unit === picUnit).map(fc => fc.name || fc.code).filter(Boolean);
      const allOpts   = [...new Set([...personal, ...formation])];
      setCallsignOptions(allOpts);
      setCallsign(cs || (allOpts[0] || ''));
      return;
    }

    setCallsign('');
    setCallsignOptions([]);
  }, [picName, instructorsData, traineesData, formationCallsigns]);'''

new_callsign_effect = '''  // Helper: build callsign string from callsignNumber + school prefix (ESL=ROLR, PEA=VIPR)
  const buildCallsignFromNumber = (num: number | undefined | null): string => {
    if (!num || num <= 0) return '';
    const prefix = school === 'ESL' ? 'ROLR' : 'VIPR';
    return `${prefix}${num}`;
  };

  useEffect(() => {
    if (!picName) { setCallsign(''); setCallsignOptions([]); return; }

    // Determine PIC's unit (for filtering formation callsigns)
    let picUnit: string | null = null;

    // Check instructor first
    const inst = instructorsData.find(i => i.name === picName);
    if (inst) {
      picUnit = inst.unit || null;
      // Build callsign: prefer explicit callsign string, fall back to callsignNumber + school prefix
      const primary   = inst.callsign || buildCallsignFromNumber((inst as any).callsignNumber) || '';
      const secondary = inst.secondaryCallsign || '';
      const personal  = [primary, secondary].filter(Boolean);
      // Add formation callsigns that belong to the same unit as the PIC
      const formation = (formationCallsigns || []).filter(fc => fc.unit && picUnit && fc.unit === picUnit).map(fc => fc.name || fc.code).filter(Boolean);
      const allOpts   = [...new Set([...personal, ...formation])];
      setCallsignOptions(allOpts);
      setCallsign(primary || (allOpts[0] || ''));
      return;
    }

    // Check trainee
    const trainee = traineesData.find(t => (t.fullName || t.name) === picName);
    if (trainee) {
      picUnit = (trainee as any).unit || null;
      const cs = trainee.traineeCallsign || buildCallsignFromNumber((trainee as any).callsignNumber) || '';
      const personal = cs ? [cs] : [];
      // Add formation callsigns that belong to the same unit as the PIC
      const formation = (formationCallsigns || []).filter(fc => fc.unit && picUnit && fc.unit === picUnit).map(fc => fc.name || fc.code).filter(Boolean);
      const allOpts   = [...new Set([...personal, ...formation])];
      setCallsignOptions(allOpts);
      setCallsign(cs || (allOpts[0] || ''));
      return;
    }

    setCallsign('');
    setCallsignOptions([]);
  }, [picName, instructorsData, traineesData, formationCallsigns, school]);'''

if old_callsign_effect in content:
    content = content.replace(old_callsign_effect, new_callsign_effect)
    print("✅ FIX 1: Callsign auto-population updated")
else:
    print("❌ FIX 1: Could not find callsign useEffect block")

# ─── FIX 2: Co-pilot label should show course number ────────────────────────────────────────
# In getNames(), trainee label should include course e.g. "Davies, Mary (ADF301)"
old_trainee_label = '''        return {
          name: t.fullName || t.name,
          label: `${t.rank ? t.rank + ' ' : ''}${t.fullName || t.name}`,
          color: textColor,
        };'''

new_trainee_label = '''        return {
          name: t.fullName || t.name,
          label: `${t.rank ? t.rank + ' ' : ''}${t.fullName || t.name}${t.course ? ' (' + t.course + ')' : ''}`,
          color: textColor,
        };'''

if old_trainee_label in content:
    content = content.replace(old_trainee_label, new_trainee_label)
    print("✅ FIX 2: Co-pilot label now includes course number")
else:
    print("❌ FIX 2: Could not find trainee label block")

# ─── FIX 3: Tile colour - grey for SCT/no trainee ───────────────────────────────────────────
# tileColor should return a grey class when eventCategory is 'sct' or when no trainee is involved
old_tile_color = '''  const tileColor = useMemo(() => {
    const name = flightType === 'Solo' ? picName : studentName;
    if (!name) return 'bg-sky-500';
    const t = traineesData.find(t => (t.fullName || t.name) === name);
    return (t?.course && courseColors[t.course]) || 'bg-sky-500';
  }, [picName, studentName, flightType, traineesData, courseColors]);'''

new_tile_color = '''  const tileColor = useMemo(() => {
    // SCT events are always grey
    if (eventCategory === 'sct') return 'bg-gray-500';
    // Staff CAT / TWR DI - no trainee involved, use grey
    if (eventCategory === 'staff_cat' || eventCategory === 'twr_di') return 'bg-gray-500';
    const name = flightType === 'Solo' ? picName : studentName;
    if (!name) return 'bg-gray-500';
    const t = traineesData.find(t => (t.fullName || t.name) === name);
    // If the person found is not a trainee (i.e. instructor in solo), use grey
    if (!t) return 'bg-gray-500';
    return (t.course && courseColors[t.course]) || 'bg-gray-500';
  }, [picName, studentName, flightType, traineesData, courseColors, eventCategory]);'''

if old_tile_color in content:
    content = content.replace(old_tile_color, new_tile_color)
    print("✅ FIX 3: Tile colour - grey for SCT/staff events and no trainee")
else:
    print("❌ FIX 3: Could not find tileColor useMemo block")

# ─── FIX 4: Aircraft number and callsign font size - make smaller than event number ─────────
# aircraftContent uses fontSize 14 - reduce to 13
# callsignContent uses fontSize 14 - reduce to 13
# eventContent uses fontSize 20 - keep as is

old_aircraft_content = '''  const aircraftContent = (zOverride?: number) => (
    <div style={{ position: 'relative' }}>
      <span style={{ fontFamily: monoFamily, fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>#{aircraftNumber || '001'}</span>'''

new_aircraft_content = '''  const aircraftContent = (zOverride?: number) => (
    <div style={{ position: 'relative' }}>
      <span style={{ fontFamily: monoFamily, fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>#{aircraftNumber || '001'}</span>'''

if old_aircraft_content in content:
    content = content.replace(old_aircraft_content, new_aircraft_content)
    print("✅ FIX 4a: Aircraft number font size reduced to 12px")
else:
    print("❌ FIX 4a: Could not find aircraftContent span")

old_callsign_font = '''        style={{
          background: 'transparent', border: 'none', outline: 'none',
          fontFamily: monoFamily, fontSize: 14, fontStyle: 'italic', lineHeight: 1,
          color: callsign ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.30)',
          width: callsignOptions.length > 0 ? 70 : 80, padding: 0, cursor: 'text',
        }}'''

new_callsign_font = '''        style={{
          background: 'transparent', border: 'none', outline: 'none',
          fontFamily: monoFamily, fontSize: 12, fontStyle: 'italic', lineHeight: 1,
          color: callsign ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.30)',
          width: callsignOptions.length > 0 ? 70 : 80, padding: 0, cursor: 'text',
        }}'''

if old_callsign_font in content:
    content = content.replace(old_callsign_font, new_callsign_font)
    print("✅ FIX 4b: Callsign font size reduced to 12px")
else:
    print("❌ FIX 4b: Could not find callsign input style")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nAll fixes applied. File saved.")