import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find _fbPrintSummary start and end
start_line = None
end_line = None
for i, line in enumerate(lines):
    if 'const _fbPrintSummary = () => {' in line:
        start_line = i
    if start_line is not None and i > start_line:
        # Find the closing }; of the function
        # Count braces
        if line.strip() == '};' and i > start_line + 2:
            end_line = i
            break

print(f"Found _fbPrintSummary: lines {start_line+1} to {end_line+1}")

# Also find the line where _flightListForScheduling is set (to add size tracking var)
pre_schedule_line = None
for i, line in enumerate(lines):
    if '_flightListForScheduling' in line and 'applyCoursePriority' in line:
        pre_schedule_line = i
        print(f"Found _flightListForScheduling at line {i+1}: {line.strip()[:80]}")
        break

new_function = '''    const _fbPrintSummary = () => {
        const postFirstTwo = [8 + 10/60, 8 + 15/60, 8 + 20/60, 8 + 25/60, 8 + 30/60];
        const topReason = Object.entries(_fbBuckets).sort((a,b) => b[1]-a[1])[0];
        const laterSlotData = postFirstTwo.map(t => _fbTimeSlotsAttempted.get(Math.round(t * 12) / 12));
        const laterSlotsTriedCount = laterSlotData.filter(Boolean).length;
        const instrTotal = (_fbBuckets.NO_INSTRUCTORS_LOADED||0)+(_fbBuckets.NO_QUALIFIED||0)+(_fbBuckets.NO_UNIT_MATCH||0)+(_fbBuckets.INSTRUCTOR_STATICALLY_UNAVAILABLE||0)+(_fbBuckets.INSTRUCTOR_SOFT_DUTY_LIMIT||0)+(_fbBuckets.INSTRUCTOR_FLIGHT_LIMIT_EXCEEDED||0)+(_fbBuckets.INSTRUCTOR_TOTAL_LIMIT_EXCEEDED||0)+(_fbBuckets.INSTRUCTOR_TIME_OVERLAP||0)+(_fbBuckets.INSTRUCTOR_CREW_DUTY_PERIOD_EXCEEDED||0);
        const acTotal = _fbBuckets.NO_AIRCRAFT_AVAILABLE||0;
        const areaTotal = _fbBuckets.NO_AREA_AVAILABLE||0;
        const sepTotal = (_fbBuckets.HOURLY_DISPATCH_LIMIT||0)+(_fbBuckets.TAKEOFF_SEPARATION_VIOLATION||0);
        const blockerType = instrTotal >= acTotal && instrTotal >= areaTotal && instrTotal >= sepTotal ? 'INSTRUCTOR' : acTotal >= areaTotal && acTotal >= sepTotal ? 'AIRCRAFT' : areaTotal >= sepTotal ? 'AREA' : 'SEPARATION';

        // Save to localStorage so it survives console scroll
        const _fbSummaryData = {
            timestamp: new Date().toISOString(),
            flightListSize: (window as any).__fbFlightListSize || 0,
            successCount: _fbSuccessCount,
            failCount: _fbFailCount,
            buckets: { ..._fbBuckets },
            timeSlots: Object.fromEntries(
                postFirstTwo.map(t => {
                    const key = Math.round(t * 12) / 12;
                    const data = _fbTimeSlotsAttempted.get(key);
                    return [_fmtT(t), data ? { attempts: data.attempts, reasons: data.reasons } : { attempts: 0, reasons: [] }];
                })
            ),
            conclusion: {
                topReason: topReason ? topReason[0] : 'NONE',
                topReasonCount: topReason ? topReason[1] : 0,
                laterSlotsTried: laterSlotsTriedCount,
                primaryBlocker: blockerType,
                instrTotal, acTotal, areaTotal, sepTotal
            }
        };
        try { localStorage.setItem('flight_diag_report', JSON.stringify(_fbSummaryData)); } catch(e) { /* ignore */ }

        console.log('\\n[FLIGHT-DIAG] BOTTLENECK SUMMARY');
        console.log('   Flight list size: ' + ((window as any).__fbFlightListSize || 0) + ' | Successes: ' + _fbSuccessCount + ' | Failures logged: ' + _fbFailCount);
        console.log('C. REJECTION BUCKET TOTALS:');
        const bucketsWithValues = Object.entries(_fbBuckets).filter(([,v]) => v > 0);
        if (bucketsWithValues.length === 0) console.log('   (ZERO rejections - flight list is likely empty)');
        else bucketsWithValues.forEach(([k,v]) => console.log('   ' + k + ': ' + v));
        console.log('D. TIME SLOTS AFTER 0805:');
        postFirstTwo.forEach(t => {
            const key = Math.round(t * 12) / 12;
            const data = _fbTimeSlotsAttempted.get(key);
            if (data) console.log('   ' + _fmtT(t) + ': ' + data.attempts + ' attempts | ' + data.reasons.join(', '));
            else console.log('   ' + _fmtT(t) + ': 0 attempts');
        });
        console.log('E. CONCLUSION:');
        console.log('   A. Top rejection: ' + (topReason ? topReason[0] : 'NONE') + ' (' + (topReason ? topReason[1] : 0) + ')');
        console.log('   B. Later slots tried: ' + (laterSlotsTriedCount > 0 ? 'YES - ' + laterSlotsTriedCount : 'NO'));
        console.log('   C. Primary blocker: ' + blockerType + ' (instr=' + instrTotal + ', ac=' + acTotal + ', area=' + areaTotal + ', sep=' + sepTotal + ')');
        console.log('[FLIGHT-DIAG] END - also in localStorage key "flight_diag_report"');
    };
'''

# Replace lines start_line to end_line (inclusive)
new_lines = lines[:start_line] + [new_function + '\n'] + lines[end_line+1:]

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Done! Replaced _fbPrintSummary function.")
print(f"Total lines before: {len(lines)}, after: {len(new_lines)}")