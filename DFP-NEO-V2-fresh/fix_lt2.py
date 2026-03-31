#!/usr/bin/env python3
"""Fix specific lines in TrainingIntelligenceTab.tsx"""

with open("components/tabs/TrainingIntelligenceTab.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# Target lines (0-indexed): 903, 923, 1104, 1105, 1245, 1246
targets = {
    903: (
        "                    Avg grade < {local.atRiskAvgGrade.toFixed(1)}, OR a worsening trend with recent avg < 3.5.\n",
        "                    Avg grade < {local.atRiskAvgGrade.toFixed(1)}, OR a worsening trend with recent avg < 3.5.\n"
    ),
    923: (
        "                    Avg grade \u2265 3.5 and < {local.exceedingAvgGrade.toFixed(1)}.\n",
        "                    Avg grade \u2265 3.5 and < {local.exceedingAvgGrade.toFixed(1)}.\n"
    ),
    1104: (
        "                  Avg grade < <span className=\"text-white font-mono\">{local.atRiskAvgGrade.toFixed(1)}</span>,\n",
        "                  Avg grade < <span className=\"text-white font-mono\">{local.atRiskAvgGrade.toFixed(1)}</span>,\n"
    ),
    1245: (
        "                  Avg grade < <span className=\"text-white font-mono\">{thresholds.atRiskAvgGrade.toFixed(1)}</span>\n",
        "                  Avg grade < <span className=\"text-white font-mono\">{thresholds.atRiskAvgGrade.toFixed(1)}</span>\n"
    ),
}

for idx, (expected, replacement) in targets.items():
    actual = lines[idx]
    if actual == expected:
        lines[idx] = replacement
        print(f"✓ Fixed line {idx+1}")
    elif actual == replacement:
        print(f"  Already fixed line {idx+1}")
    else:
        print(f"✗ Line {idx+1} differs from expected:")
        print(f"  Expected: {expected!r}")
        print(f"  Actual:   {actual!r}")
        # Try to fix anyway
        if "< {local.atRiskAvgGrade" in actual:
            lines[idx] = actual.replace("< {local.atRiskAvgGrade", "< {local.atRiskAvgGrade")
            lines[idx] = lines[idx].replace("avg < 3.5", "avg < 3.5")
            print(f"  → Force-fixed")
        elif "< {local.exceedingAvgGrade" in actual:
            lines[idx] = actual.replace("< {local.exceedingAvgGrade", "< {local.exceedingAvgGrade")
            print(f"  → Force-fixed")
        elif "< <span" in actual and "atRiskAvgGrade" in actual:
            lines[idx] = actual.replace("< <span", "< <span")
            print(f"  → Force-fixed")
        elif "< <span" in actual and "thresholds" in actual:
            lines[idx] = actual.replace("< <span", "< <span")
            print(f"  → Force-fixed")

# Also fix any other remaining "< {" in JSX text by scanning all lines
also_fixed = 0
for i, line in enumerate(lines):
    if i in targets:
        continue
    new_line = line
    # Only fix if it's a JSX text context (contains common JSX patterns)
    # and has bare "< {" not in an attribute
    if " < {" in new_line and "className" not in new_line and "style=" not in new_line:
        new_line = new_line.replace(" < {", " < {")
        also_fixed += 1
    if " < <span" in new_line and "< <span" not in new_line:
        new_line = new_line.replace(" < <span", " < <span")
        also_fixed += 1
    if new_line != line:
        lines[i] = new_line
        print(f"  Also fixed line {i+1}: {line.strip()[:60]!r}")

with open("components/tabs/TrainingIntelligenceTab.tsx", "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"\nAlso fixed {also_fixed} additional lines")

# Final check
bad_lines = []
for i, line in enumerate(lines):
    # Check for bare " < {" that isn't preceded by &
    if " < {" in line and "< {" not in line.replace(" < {", " REPLACED {"):
        bad_lines.append((i+1, line.strip()[:80]))
    if " < <span" in line and "< <span" not in line:
        bad_lines.append((i+1, line.strip()[:80]))

if bad_lines:
    print(f"\n⚠ Still bad lines: {len(bad_lines)}")
    for ln, txt in bad_lines:
        print(f"  Line {ln}: {txt!r}")
else:
    print("\n✓ All bare '< {' and '< <span' patterns fixed!")