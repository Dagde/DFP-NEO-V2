with open('DFP-NEO-V2-fresh/components/tabs/TrainingIntelligenceTab.tsx', 'r') as f:
    src = f.read()

old_filter = """  // Exclude CPT, TUT, MB events from hardest/easiest analysis — only Flights and FTD count
  const isFlightOrFTD = (code: string) => {
    const c = code.toUpperCase();
    return !c.startsWith('CPT') && !c.startsWith('TUT') && !c.includes('MB') && !c.startsWith('MB');
  };"""

new_filter = """  // Exclude CPT, TUT, MB events — only Flights and FTD count
  // Event codes are prefixed e.g. "BGF TUT1B", "BGF CPT1", "BGF MB1"
  // so we must split on spaces and check each token, not just startsWith on the whole code
  const isFlightOrFTD = (code: string) => {
    const tokens = code.toUpperCase().split(/[\\s_\\-]+/);
    return !tokens.some(t =>
      t === 'TUT' || t.startsWith('TUT') ||
      t === 'CPT' || t.startsWith('CPT') ||
      t === 'MB'  || t.startsWith('MB')
    );
  };"""

assert old_filter in src, "old_filter not found"
src = src.replace(old_filter, new_filter, 1)
print("✓ isFlightOrFTD fixed to split on spaces and check tokens")

with open('DFP-NEO-V2-fresh/components/tabs/TrainingIntelligenceTab.tsx', 'w') as f:
    f.write(src)

print("✅ Done!")