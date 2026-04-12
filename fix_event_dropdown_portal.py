filepath = 'DFP-NEO-V2-fresh/components/AddFlightTileModal.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File: {content.count(chr(10))} lines, {len(content)} bytes")

# Find EventDropdown component boundaries
start_marker = "const EventDropdown: React.FC<EventDropdownProps> = ({"
start_idx = content.find(start_marker)
# The EventDropdown ends just before the TileProps interface comment
# Find "};\n" after "Hover a course" which is the closing of the component
hover_idx = content.find("'Hover a course'", start_idx)
# Find the "};\n" after that closing
end_idx = content.find("};\n", hover_idx)
end_suffix = "};\n"

print(f"EventDropdown start: {start_idx}, end: {end_idx}")
if start_idx < 0 or end_idx < 0:
    # Try finding by what comes after
    after_marker = content.find("\nconst FlightTile:", start_idx if start_idx >= 0 else 0)
    print(f"FlightTile start: {after_marker}")
    if after_marker >= 0:
        print(repr(content[after_marker-10:after_marker+30]))

if start_idx >= 0 and end_idx >= 0:
    new_event_dropdown = (
        "const EventDropdown: React.FC<EventDropdownProps> = ({\n"
        "  value, onChange, courseOptions, getEventsForCourse, nextLMPEvent,\n"
        "  fontSize, color, disabled,\n"
        "}) => {\n"
        "  const [open, setOpen] = useState(false);\n"
        "  const [hovCourse, setHovCourse] = useState<string | null>(null);\n"
        "  const ref = useRef<HTMLDivElement>(null);\n"
        "  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });\n"
        "\n"
        "  useEffect(() => {\n"
        "    const handler = (e: MouseEvent) => {\n"
        "      if (ref.current && !ref.current.contains(e.target as Node)) {\n"
        "        const portalEl = document.getElementById('event-dropdown-portal');\n"
        "        if (portalEl && portalEl.contains(e.target as Node)) return;\n"
        "        setOpen(false);\n"
        "      }\n"
        "    };\n"
        "    document.addEventListener('mousedown', handler);\n"
        "    return () => document.removeEventListener('mousedown', handler);\n"
        "  }, []);\n"
        "\n"
        "  const handleOpen = () => {\n"
        "    if (disabled) return;\n"
        "    if (ref.current) {\n"
        "      const rect = ref.current.getBoundingClientRect();\n"
        "      // right-align the dropdown to the trigger element\n"
        "      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });\n"
        "    }\n"
        "    setOpen(o => !o);\n"
        "  };\n"
        "\n"
        "  const dropdownPanel = open && !disabled ? ReactDOM.createPortal(\n"
        "    <div\n"
        "      id=\"event-dropdown-portal\"\n"
        "      onClick={e => e.stopPropagation()}\n"
        "      style={{\n"
        "        position: 'fixed',\n"
        "        top: dropdownPos.top,\n"
        "        right: dropdownPos.right,\n"
        "        zIndex: 9000,\n"
        "        display: 'flex',\n"
        "        width: 400,\n"
        "        maxHeight: 320,\n"
        "        backgroundColor: '#1a2f4a',\n"
        "        borderRadius: 8,\n"
        "        boxShadow: '0 8px 32px rgba(0,0,0,0.85)',\n"
        "        overflow: 'hidden',\n"
        "        border: '1px solid rgba(255,255,255,0.18)',\n"
        "      }}\n"
        "    >\n"
        "      {/* Col 1: Courses */}\n"
        "      <div style={{ width: 130, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 320, backgroundColor: '#1a2f4a' }}>\n"
        "        {courseOptions.map(course => (\n"
        "          <div\n"
        "            key={course}\n"
        "            onMouseEnter={() => setHovCourse(course)}\n"
        "            onClick={() => {\n"
        "              if (course === 'SCT') {\n"
        "                onChange('SCT');\n"
        "                setOpen(false);\n"
        "              }\n"
        "            }}\n"
        "            style={{\n"
        "              padding: '9px 12px', fontSize: 13, cursor: 'pointer',\n"
        "              display: 'flex', justifyContent: 'space-between', alignItems: 'center',\n"
        "              color: hovCourse === course ? '#fff' : 'rgba(255,255,255,0.8)',\n"
        "              backgroundColor: hovCourse === course ? 'rgba(255,255,255,0.12)' : 'transparent',\n"
        "              fontWeight: course === 'SCT' ? 600 : 400,\n"
        "            }}\n"
        "          >\n"
        "            {course}\n"
        "            {course !== 'SCT' && <span style={{ fontSize: 9, opacity: 0.5 }}>\u25b6</span>}\n"
        "          </div>\n"
        "        ))}\n"
        "      </div>\n"
        "\n"
        "      {/* Col 2: Events */}\n"
        "      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 320, backgroundColor: '#16293f' }}>\n"
        "        {hovCourse && hovCourse !== 'SCT' ? (\n"
        "          getEventsForCourse(hovCourse).map(ev => {\n"
        "            const code = ev.code || ev.id || '';\n"
        "            const isNext = nextLMPEvent && (nextLMPEvent.code === code || nextLMPEvent.id === code);\n"
        "            return (\n"
        "              <div\n"
        "                key={code}\n"
        "                onClick={() => {\n"
        "                  onChange(code, ev.flightOrSimHours || ev.duration || undefined);\n"
        "                  setOpen(false);\n"
        "                  setHovCourse(null);\n"
        "                }}\n"
        "                style={{\n"
        "                  padding: '9px 12px', fontSize: 13, cursor: 'pointer',\n"
        "                  color: isNext ? '#22c55e' : '#fff',\n"
        "                  backgroundColor: isNext ? 'rgba(34,197,94,0.12)' : 'transparent',\n"
        "                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',\n"
        "                  whiteSpace: 'nowrap',\n"
        "                }}\n"
        "                onMouseEnter={e => (e.currentTarget.style.backgroundColor = isNext ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.1)')}\n"
        "                onMouseLeave={e => (e.currentTarget.style.backgroundColor = isNext ? 'rgba(34,197,94,0.12)' : 'transparent')}\n"
        "                title={ev.eventDescription || code}\n"
        "              >\n"
        "                <span>{code}</span>\n"
        "                {isNext && <span style={{ fontSize: 10, color: '#22c55e', marginLeft: 6 }}>NEXT</span>}\n"
        "              </div>\n"
        "            );\n"
        "          })\n"
        "        ) : (\n"
        "          <div style={{ padding: '20px 12px', color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center' }}>\n"
        "            {hovCourse === 'SCT' ? 'SCT selected' : 'Hover a course'}\n"
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
        "          fontStyle: 'italic',\n"
        "          fontFamily: 'ui-monospace, SFMono-Regular, \"Courier New\", monospace',\n"
        "          color,\n"
        "          cursor: disabled ? 'default' : 'pointer',\n"
        "          userSelect: 'none',\n"
        "          whiteSpace: 'nowrap',\n"
        "          minWidth: 80,\n"
        "          padding: '2px 4px',\n"
        "          borderRadius: 3,\n"
        "        }}\n"
        "        onMouseEnter={e => { if (!disabled) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}\n"
        "        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}\n"
        "      >\n"
        "        {value || 'EVENT'}\n"
        "      </div>\n"
        "      {dropdownPanel}\n"
        "    </div>\n"
        "  );\n"
        "};"
    )

    content = content[:start_idx] + new_event_dropdown + "\n\n" + content[end_idx + len(end_suffix):]
    print("✅ EventDropdown rewritten with Portal")
else:
    print("❌ Could not replace EventDropdown")
    if start_idx >= 0:
        # Show what comes after the component
        chunk = content[start_idx:start_idx+100]
        print(repr(chunk))

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone. File: {content.count(chr(10))} lines, {len(content)} bytes")