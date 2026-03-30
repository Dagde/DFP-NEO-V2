import re

with open('components/tabs/TrainingIntelligenceTab.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

original_len = len(src)

# ─────────────────────────────────────────────────────────────────
# PATCH 1: Fix tooltip flip logic in SparkLine
# The issue: tooltip.svgX + ttW + 10 > width never triggers correctly
# because for the ProgressionModal the SVG width is 820 but the 
# wrapper div is also ~820px wide — so tooltip at svgX=790 would be
# placed at left=800 and overflow right edge.
# Fix: flip if svgX > width/2 (i.e. right half → show tooltip to the left)
# ─────────────────────────────────────────────────────────────────

old_tooltip_pos = """        // Position: right of point, flip left if near right edge
        const leftPos = tooltip.svgX + ttW + 10 > width ? tooltip.svgX - ttW - 6 : tooltip.svgX + 10;
        const topPos = Math.max(0, tooltip.svgY - ttH / 2);"""

new_tooltip_pos = """        // Position: right of point if in left half, left of point if in right half
        const flipLeft = tooltip.svgX + ttW + 14 > width;
        const leftPos = flipLeft ? tooltip.svgX - ttW - 8 : tooltip.svgX + 10;
        const topPos = Math.max(0, tooltip.svgY - ttH / 2);"""

if old_tooltip_pos in src:
    src = src.replace(old_tooltip_pos, new_tooltip_pos)
    print("Patch 1 (tooltip flip) OK")
else:
    print("Patch 1 FAILED - string not found")
    # Show surrounding context
    idx = src.find("flipLeft")
    if idx >= 0:
        print("  (already patched?)")
    idx2 = src.find("leftPos = tooltip.svgX")
    if idx2 >= 0:
        print("  Context:", repr(src[idx2-50:idx2+150]))

# ─────────────────────────────────────────────────────────────────
# PATCH 2: Fix trainee label extraction — use underscore split as fallback
# When names are "ADF302_TRAINEE_1" (no spaces), split on _ and take last part
# ─────────────────────────────────────────────────────────────────

old_label_modal = """            // Use surname if name has spaces, otherwise truncate the full string
            const parts = t.traineeFullName.trim().split(/\\s+/);
            const label = parts.length >= 2
              ? parts[parts.length - 1]  // surname (last word)
              : t.traineeFullName.length > 10 ? t.traineeFullName.slice(0, 10) : t.traineeFullName;"""

new_label_modal = """            // Use surname if name has spaces; if no spaces, use last underscore-segment
            const spaceParts = t.traineeFullName.trim().split(/\\s+/);
            const label = spaceParts.length >= 2
              ? spaceParts[spaceParts.length - 1]  // surname (last word)
              : t.traineeFullName.includes('_')
                ? t.traineeFullName.split('_').pop() || t.traineeFullName  // last underscore segment e.g. "1" from "ADF302_TRAINEE_1"
                : t.traineeFullName.length > 10 ? t.traineeFullName.slice(0, 10) : t.traineeFullName;"""

if old_label_modal in src:
    src = src.replace(old_label_modal, new_label_modal)
    print("Patch 2 (trainee label modal) OK")
else:
    print("Patch 2 FAILED - string not found")
    idx = src.find("Use surname if name has spaces")
    if idx >= 0:
        print("  Context:", repr(src[idx:idx+400]))

# ─────────────────────────────────────────────────────────────────
# PATCH 3: Fix trainee label extraction in the inline ColChart (same fix)
# ─────────────────────────────────────────────────────────────────

old_label_inline = """                        const parts = t.traineeFullName.trim().split(/\\s+/);
                        const label = parts.length >= 2
                          ? parts[parts.length - 1]
                          : t.traineeFullName.length > 10 ? t.traineeFullName.slice(0, 10) : t.traineeFullName;"""

new_label_inline = """                        const spaceParts = t.traineeFullName.trim().split(/\\s+/);
                        const label = spaceParts.length >= 2
                          ? spaceParts[spaceParts.length - 1]
                          : t.traineeFullName.includes('_')
                            ? t.traineeFullName.split('_').pop() || t.traineeFullName
                            : t.traineeFullName.length > 10 ? t.traineeFullName.slice(0, 10) : t.traineeFullName;"""

if old_label_inline in src:
    src = src.replace(old_label_inline, new_label_inline)
    print("Patch 3 (trainee label inline) OK")
else:
    print("Patch 3 FAILED - string not found")
    idx = src.find("t.traineeFullName.trim().split")
    if idx >= 0:
        print("  Context:", repr(src[idx:idx+300]))

# ─────────────────────────────────────────────────────────────────
# PATCH 4: Make the SparkLine wrapper div overflow-visible so tooltip
# can escape the container bounds (the wrapper div clips absolutely 
# positioned children that go outside its bounds)
# ─────────────────────────────────────────────────────────────────

old_wrapper = """  return (
    <div className="relative" style={{ display: 'inline-block' }}>
      <svg"""

new_wrapper = """  return (
    <div className="relative" style={{ display: 'inline-block', overflow: 'visible' }}>
      <svg"""

if old_wrapper in src:
    src = src.replace(old_wrapper, new_wrapper)
    print("Patch 4 (wrapper overflow-visible) OK")
else:
    print("Patch 4 FAILED - string not found")
    idx = src.find('display: \'inline-block\'')
    if idx >= 0:
        print("  Context:", repr(src[idx-30:idx+100]))

print(f"\nOriginal length: {original_len}, New length: {len(src)}, Delta: {len(src)-original_len}")

with open('components/tabs/TrainingIntelligenceTab.tsx', 'w', encoding='utf-8') as f:
    f.write(src)
print("File written OK")