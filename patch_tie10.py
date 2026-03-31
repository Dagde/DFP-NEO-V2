import re

# ── TSX patch ──────────────────────────────────────────────────────────────
with open('DFP-NEO-V2-fresh/components/tabs/TrainingIntelligenceTab.tsx', 'r') as f:
    src = f.read()

# CHANGE 1: Fix hardest/easiest to use isFlightOrFTD filter
# The filter is defined AFTER hardest/easiest are calculated — move it before and use it
old_hardest = """  const hardest = events.reduce((h, ev) => safeN(ev.avgOverallGrade) < safeN(h.avgOverallGrade) ? ev : h, events[0]);
  const easiest = events.reduce((e, ev) => safeN(ev.avgOverallGrade) > safeN(e.avgOverallGrade) ? ev : e, events[0]);
  const mostAttempts = events.reduce((m, ev) => safeN(ev.totalAttempts) > safeN(m.totalAttempts) ? ev : m, events[0]);
  const mostVariable = events.reduce((m, ev) => safeN(ev.gradeVariance) > safeN(m.gradeVariance) ? ev : m, events[0]);

  // Exclude CPT, TUT, MB events from hardest/easiest analysis — only Flights and FTD count
  const isFlightOrFTD = (code: string) => {
    const c = code.toUpperCase();
    return !c.startsWith('CPT') && !c.startsWith('TUT') && !c.includes('MB') && !c.startsWith('MB');
  };"""

new_hardest = """  // Exclude CPT, TUT, MB events from hardest/easiest analysis — only Flights and FTD count
  const isFlightOrFTD = (code: string) => {
    const c = code.toUpperCase();
    return !c.startsWith('CPT') && !c.startsWith('TUT') && !c.includes('MB') && !c.startsWith('MB');
  };

  const flightFtdEvents = events.filter(ev => isFlightOrFTD(ev.eventCode) && safeN(ev.avgOverallGrade) > 0);
  const hardest = flightFtdEvents.length > 0
    ? flightFtdEvents.reduce((h, ev) => safeN(ev.avgOverallGrade) < safeN(h.avgOverallGrade) ? ev : h, flightFtdEvents[0])
    : events[0];
  const easiest = flightFtdEvents.length > 0
    ? flightFtdEvents.reduce((e, ev) => safeN(ev.avgOverallGrade) > safeN(e.avgOverallGrade) ? ev : e, flightFtdEvents[0])
    : events[0];
  const mostAttempts = events.reduce((m, ev) => safeN(ev.totalAttempts) > safeN(m.totalAttempts) ? ev : m, events[0]);
  const mostVariable = events.reduce((m, ev) => safeN(ev.gradeVariance) > safeN(m.gradeVariance) ? ev : m, events[0]);"""

assert old_hardest in src, "CHANGE 1: old_hardest not found"
src = src.replace(old_hardest, new_hardest, 1)
print("✓ CHANGE 1: hardest/easiest now use isFlightOrFTD filter")

# CHANGE 2: Remove ⚠️ icon from Top 5 Struggle heading
old_struggle_icon = """          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚠️</span>
            <div>
              <h3 className="text-white font-bold text-sm">Top 5 Events Trainees Struggle With</h3>
              <p className="text-gray-400 text-xs">Click an event for detailed analysis</p>
            </div>
          </div>"""

new_struggle_icon = """          <div className="flex items-center gap-2 mb-3">
            <div>
              <h3 className="text-white font-bold text-sm">Top 5 Events Trainees Struggle With</h3>
              <p className="text-gray-400 text-xs">Click an event for detailed analysis</p>
            </div>
          </div>"""

assert old_struggle_icon in src, "CHANGE 2: old_struggle_icon not found"
src = src.replace(old_struggle_icon, new_struggle_icon, 1)
print("✓ CHANGE 2: ⚠️ icon removed from Top 5 Struggle heading")

# CHANGE 3: Remove 🏆 icon from Top 5 Excel heading
old_excel_icon = """          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🏆</span>
            <div>
              <h3 className="text-white font-bold text-sm">Top 5 Events Trainees Excel At</h3>
              <p className="text-gray-400 text-xs">Click an event for detailed analysis</p>
            </div>
          </div>"""

new_excel_icon = """          <div className="flex items-center gap-2 mb-3">
            <div>
              <h3 className="text-white font-bold text-sm">Top 5 Events Trainees Excel At</h3>
              <p className="text-gray-400 text-xs">Click an event for detailed analysis</p>
            </div>
          </div>"""

assert old_excel_icon in src, "CHANGE 3: old_excel_icon not found"
src = src.replace(old_excel_icon, new_excel_icon, 1)
print("✓ CHANGE 3: 🏆 icon removed from Top 5 Excel heading")

with open('DFP-NEO-V2-fresh/components/tabs/TrainingIntelligenceTab.tsx', 'w') as f:
    f.write(src)

print()

# ── TIE engine patch ───────────────────────────────────────────────────────
with open('DFP-NEO-V2-fresh/tie-engine.cjs', 'r') as f:
    eng = f.read()

# CHANGE 4: Add passRate calculation and include in INSERT
# passRate = % of attempts with grade > CONCERN_THRESHOLD (i.e. grade > 3.0 = pass)
old_insert = """      const evtSumId = `esum-${runId}-${eventCode}-${courseName}`.substring(0, 200);
      await safeExec(db, `
        INSERT INTO "TIEEventSummary"
          ("id","runId","eventCode","courseName","totalAttempts","avgOverallGrade","gradeVariance",
           "weakElementsByAvg","strongElementsByAvg","dominantNegativeTags","dominantPositiveTags",
           "difficultyScore","bottleneckScore","overServiceIndicator","differentiationScore",
           "narrativeSummary")
        VALUES($1::text,$2::text,$3::text,$4::text,$5::int,$6::numeric,$7::numeric,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::numeric,$13::numeric,$14::boolean,$15::numeric,$16::text)
        ON CONFLICT DO NOTHING
      `, evtSumId, runId, eventCode, courseName, grades.length,
         Number(avgGrade), Number(variance),
         JSON.stringify(weakEls), JSON.stringify(strongEls),
         JSON.stringify(negTagsEvt), JSON.stringify(posTagsEvt),
         Number(difficultyScore), Number(bottleneckScore), Boolean(isOverService), Number(differentiationScore),
         narrative
      );"""

new_insert = """      // Pass rate: % of attempts with overall grade > CONCERN_THRESHOLD (i.e. a pass)
      const passCount = grades.filter(g => g > CONCERN_THRESHOLD).length;
      const passRate = grades.length > 0 ? (passCount / grades.length) * 100 : 0;

      const evtSumId = `esum-${runId}-${eventCode}-${courseName}`.substring(0, 200);
      await safeExec(db, `
        INSERT INTO "TIEEventSummary"
          ("id","runId","eventCode","courseName","totalAttempts","avgOverallGrade","gradeVariance",
           "weakElementsByAvg","strongElementsByAvg","dominantNegativeTags","dominantPositiveTags",
           "difficultyScore","bottleneckScore","overServiceIndicator","differentiationScore",
           "narrativeSummary","passRate")
        VALUES($1::text,$2::text,$3::text,$4::text,$5::int,$6::numeric,$7::numeric,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::numeric,$13::numeric,$14::boolean,$15::numeric,$16::text,$17::numeric)
        ON CONFLICT DO NOTHING
      `, evtSumId, runId, eventCode, courseName, grades.length,
         Number(avgGrade), Number(variance),
         JSON.stringify(weakEls), JSON.stringify(strongEls),
         JSON.stringify(negTagsEvt), JSON.stringify(posTagsEvt),
         Number(difficultyScore), Number(bottleneckScore), Boolean(isOverService), Number(differentiationScore),
         narrative, Number(passRate)
      );"""

assert old_insert in eng, "CHANGE 4: old_insert not found in tie-engine.cjs"
eng = eng.replace(old_insert, new_insert, 1)
print("✓ CHANGE 4: passRate calculated and included in TIEEventSummary INSERT")

with open('DFP-NEO-V2-fresh/tie-engine.cjs', 'w') as f:
    f.write(eng)

print("\n✅ All 4 changes applied successfully!")