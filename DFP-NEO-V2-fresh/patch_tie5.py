import re

with open('components/tabs/TrainingIntelligenceTab.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

original_len = len(src)

# ─────────────────────────────────────────────────────────────────
# PATCH 1: Fix trainee label extraction in GradeByTraineeModal
# traineeFullName = "Brown, John – ADF302"
# We want "Brown" (surname = first word before the comma)
# Split on " – " (em-dash with spaces) to get "Brown, John", then take part before comma
# ─────────────────────────────────────────────────────────────────

old_label_modal = """            // Use surname if name has spaces; if no spaces, use last underscore-segment
            const spaceParts = t.traineeFullName.trim().split(/\\s+/);
            const label = spaceParts.length >= 2
              ? spaceParts[spaceParts.length - 1]  // surname (last word)
              : t.traineeFullName.includes('_')
                ? t.traineeFullName.split('_').pop() || t.traineeFullName  // last underscore segment e.g. "1" from "ADF302_TRAINEE_1"
                : t.traineeFullName.length > 10 ? t.traineeFullName.slice(0, 10) : t.traineeFullName;"""

new_label_modal = """            // traineeFullName format: "Brown, John – ADF302"
            // Split on em-dash to get name part "Brown, John", then take surname before comma
            const namePart = t.traineeFullName.split(/\\s*[\\u2013\\u2014-]\\s*/)[0].trim(); // "Brown, John"
            const label = namePart.includes(',')
              ? namePart.split(',')[0].trim()  // "Brown" (surname)
              : namePart.split(/\\s+/)[0].trim(); // first word if no comma"""

if old_label_modal in src:
    src = src.replace(old_label_modal, new_label_modal)
    print("Patch 1 (trainee label modal) OK")
else:
    print("Patch 1 FAILED - string not found")
    idx = src.find("Use surname if name has spaces")
    if idx >= 0:
        print("  Context:", repr(src[idx:idx+400]))

# ─────────────────────────────────────────────────────────────────
# PATCH 2: Fix trainee label extraction in inline ColChart (same fix)
# ─────────────────────────────────────────────────────────────────

old_label_inline = """                        const spaceParts = t.traineeFullName.trim().split(/\\s+/);
                        const label = spaceParts.length >= 2
                          ? spaceParts[spaceParts.length - 1]
                          : t.traineeFullName.includes('_')
                            ? t.traineeFullName.split('_').pop() || t.traineeFullName
                            : t.traineeFullName.length > 10 ? t.traineeFullName.slice(0, 10) : t.traineeFullName;"""

new_label_inline = """                        // traineeFullName format: "Brown, John – ADF302"
                        const namePart2 = t.traineeFullName.split(/\\s*[\\u2013\\u2014-]\\s*/)[0].trim();
                        const label = namePart2.includes(',')
                          ? namePart2.split(',')[0].trim()
                          : namePart2.split(/\\s+/)[0].trim();"""

if old_label_inline in src:
    src = src.replace(old_label_inline, new_label_inline)
    print("Patch 2 (trainee label inline) OK")
else:
    print("Patch 2 FAILED - string not found")
    idx = src.find("spaceParts = t.traineeFullName.trim().split")
    if idx >= 0:
        print("  Context:", repr(src[idx:idx+400]))

# ─────────────────────────────────────────────────────────────────
# PATCH 3: Fix tooltip clipping - move SparkLine out of overflow-x-auto
# The ProgressionModal wraps SparkLine in <div className="flex-1 overflow-x-auto">
# which clips the absolutely-positioned tooltip.
# Fix: use overflow-x-visible on the SparkLine wrapper div specifically,
# and render the tooltip using a portal-style approach with fixed positioning
# based on the SVG element's getBoundingClientRect
# ─────────────────────────────────────────────────────────────────

# The real fix: change the tooltip from absolute-positioned (relative to SVG wrapper)
# to fixed-positioned (relative to viewport) using getBoundingClientRect
old_sparkline_tooltip = """  const [tooltip, setTooltip] = React.useState<{ i: number; svgX: number; svgY: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);"""

new_sparkline_tooltip = """  const [tooltip, setTooltip] = React.useState<{ i: number; pageX: number; pageY: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);"""

if old_sparkline_tooltip in src:
    src = src.replace(old_sparkline_tooltip, new_sparkline_tooltip)
    print("Patch 3a (tooltip state type) OK")
else:
    print("Patch 3a FAILED")
    idx = src.find("const [tooltip, setTooltip]")
    if idx >= 0:
        print("  Context:", repr(src[idx:idx+200]))

# Fix the onMouseEnter to store page coordinates instead of SVG coordinates
old_mouse_enter = """                  onMouseEnter={() => setTooltip({ i, svgX: x, svgY: y })}
                  onMouseLeave={() => setTooltip(null)}"""

new_mouse_enter = """                  onMouseEnter={(e) => {
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (rect) {
                      const scaleX = rect.width / (svgRef.current?.viewBox?.baseVal?.width || width);
                      setTooltip({ i, pageX: rect.left + x * (rect.width / width), pageY: rect.top + y * (rect.height / height) });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}"""

if old_mouse_enter in src:
    src = src.replace(old_mouse_enter, new_mouse_enter)
    print("Patch 3b (onMouseEnter pageXY) OK")
else:
    print("Patch 3b FAILED")
    idx = src.find("onMouseEnter={() => setTooltip")
    if idx >= 0:
        print("  Context:", repr(src[idx:idx+200]))

# Fix tooltip rendering to use fixed positioning
old_tooltip_render = """      {/* Floating tooltip — positioned relative to SVG container, never clipped */}
      {interactive && tooltip !== null && hoveredVal !== null && (() => {
        const label = labels?.[tooltip.i] ?? `Assessment #${tooltip.i + 1}`;
        const ttW = 130, ttH = 44;
        // Position: right of point if in left half, left of point if in right half
        const flipLeft = tooltip.svgX + ttW + 14 > width;
        const leftPos = flipLeft ? tooltip.svgX - ttW - 8 : tooltip.svgX + 10;
        const topPos = Math.max(0, tooltip.svgY - ttH / 2);
        return (
          <div
            style={{
              position: 'absolute',
              left: leftPos,
              top: topPos,
              width: ttW,
              pointerEvents: 'none',
              zIndex: 100,
            }}
            className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 shadow-xl"
          >"""

new_tooltip_render = """      {/* Floating tooltip — fixed position relative to viewport, never clipped */}
      {interactive && tooltip !== null && hoveredVal !== null && (() => {
        const label = labels?.[tooltip.i] ?? `Assessment #${tooltip.i + 1}`;
        const ttW = 140, ttH = 52;
        // Use fixed positioning based on page coordinates to escape any overflow:hidden parent
        const vpW = window.innerWidth;
        const leftPos = tooltip.pageX + ttW + 14 > vpW ? tooltip.pageX - ttW - 8 : tooltip.pageX + 12;
        const topPos = Math.max(8, tooltip.pageY - ttH / 2);
        return (
          <div
            style={{
              position: 'fixed',
              left: leftPos,
              top: topPos,
              width: ttW,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
            className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 shadow-xl"
          >"""

if old_tooltip_render in src:
    src = src.replace(old_tooltip_render, new_tooltip_render)
    print("Patch 3c (fixed tooltip positioning) OK")
else:
    print("Patch 3c FAILED")
    idx = src.find("Floating tooltip")
    if idx >= 0:
        print("  Context:", repr(src[idx:idx+500]))

print(f"\nOriginal length: {original_len}, New length: {len(src)}, Delta: {len(src)-original_len}")

with open('components/tabs/TrainingIntelligenceTab.tsx', 'w', encoding='utf-8') as f:
    f.write(src)
print("File written OK")