with open('/workspace/DFP-NEO-V2/DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the start and end of handlePausePublish
start_line = None
end_line = None
for i, line in enumerate(lines):
    if 'handlePausePublish' in line and 'const handlePausePublish' in line:
        start_line = i - 1  # include the comment line before it
        print(f"Found handlePausePublish at line {i+1}")
    if start_line is not None and i > start_line + 5:
        # Look for the closing }; of the function
        if line.strip() == '};' and end_line is None:
            end_line = i
            print(f"Found end of handlePausePublish at line {i+1}")
            break

print(f"Replacing lines {start_line+1} to {end_line+1}")
print("Comment line:", repr(lines[start_line]))
print("End line:", repr(lines[end_line]))

new_function = '''    // ── Pause Flight Ops: handlePausePublish ──────────────────────────────────────────────
    const handlePausePublish = (stagedEvents: ScheduleEvent[]) => {
        const targetDate = date;

        // stagedEvents comes from handlePauseBuild which used the FULL raw publishedSchedules[date].
        // It already contains all events (including group/deployment events).
        // We just deduplicate by ID and ensure date fields are correct.

        const seenIds = new Set<string>();
        const dedupedEvents = stagedEvents.filter(e => {
            if (seenIds.has(e.id)) return false;
            seenIds.add(e.id);
            return true;
        });

        // Ensure every event has the correct date field
        const finalEvents: ScheduleEvent[] = dedupedEvents.map(e => ({ ...e, date: targetDate }));

        console.log('[PausePublish] Publishing', finalEvents.length, 'events for', targetDate,
            '(was:', (publishedSchedules[targetDate] || []).length, 'before)');

        // 1. Update publishedSchedules (triggers re-render of Program Schedule view)
        setPublishedSchedules((prev: Record<string, ScheduleEvent[]>) => ({
            ...prev,
            [targetDate]: finalEvents,
        }));

        // 2. Snapshot as new baseline (for change-detection highlighting)
        setBaselineSchedules((prev) => ({
            ...prev,
            [targetDate]: JSON.parse(JSON.stringify(finalEvents)),
        }));

        // 3. Sync PT-051s with the updated schedule (delayed to let state settle)
        setTimeout(() => {
            setPublishedSchedules(currentSchedules => {
                setPt051Assessments(currentAssessments => {
                    syncPt051WithActiveDfp(currentSchedules, currentAssessments);
                    return currentAssessments;
                });
                return currentSchedules;
            });
        }, 500);

        // 4. Persist to database
        persistScheduleForDate(targetDate, finalEvents);

        // 5. Audit log
        const cancelledCount = finalEvents.filter(e =>
            e.isCancelled && (e as any).cancellationCode === 'OPS_PAUSE'
        ).length;
        const activeCount = finalEvents.filter(e => !e.isCancelled).length;

        logAudit(
            'Program Schedule',
            'Edit',
            `Pause Flight Ops committed for ${targetDate}`,
            `Cancelled: ${cancelledCount} (OPS PAUSE) | Active post-rebuild: ${activeCount} | By: ${authUser?.displayName || 'Unknown'}`
        );

        console.log('[PausePublish] Done. Total:', finalEvents.length,
            'Active:', activeCount, 'Cancelled (OPS_PAUSE):', cancelledCount);
    };\n'''

lines[start_line:end_line+1] = [new_function]

with open('/workspace/DFP-NEO-V2/DFP-NEO-V2-fresh/App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("SUCCESS: handlePausePublish replaced")

# Verify
with open('/workspace/DFP-NEO-V2/DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
    
idx = content.find('const handlePausePublish')
print("Verification - first 200 chars of new function:")
print(content[idx:idx+200])