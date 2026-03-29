import re

with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the handleConfirmPublish function and replace it
# Use a regex that matches the full function body
old_func_start = '    const handleConfirmPublish = () => {'
old_func_end = "        setSuccessMessage('DFP Successfully Published!');\n    };"

start_idx = content.find(old_func_start)
if start_idx == -1:
    print("ERROR: Could not find handleConfirmPublish start")
    exit(1)

end_idx = content.find(old_func_end, start_idx)
if end_idx == -1:
    print("ERROR: Could not find handleConfirmPublish end")
    exit(1)

end_idx += len(old_func_end)

old_func = content[start_idx:end_idx]
print(f"Found function at {start_idx}-{end_idx}, length={len(old_func)}")
print("First 200 chars:", repr(old_func[:200]))
print("Last 200 chars:", repr(old_func[-200:]))

new_func = '''    const handleConfirmPublish = () => {
        // Close the confirmation flyout immediately
        setShowPublishConfirm(false);
        
        const newEventsForDate = nextDayBuildEvents.map(e => ({ ...e, date: buildDfpDate }));
        
        setPublishedSchedules((prev: Record<string, ScheduleEvent[]>) => ({
            ...prev,
            [buildDfpDate]: newEventsForDate
        }));
        
        // NEW APPROACH: Sync PT-051s with Active DFP after publish
        console.log('\\u{1F4CB} Triggering PT-051 sync after publish...');
        setTimeout(() => {
            console.log('\\u{23F0} Executing delayed PT-051 sync after publish...');
            setPublishedSchedules(currentSchedules => {
                setPt051Assessments(currentAssessments => {
                    syncPt051WithActiveDfp(currentSchedules, currentAssessments);
                    return currentAssessments;
                });
                return currentSchedules;
            });
        }, 500);
        
        // Snapshot the schedule as the baseline for change detection
        setBaselineSchedules((prev) => ({
            ...prev,
           
            [buildDfpDate]: JSON.parse(JSON.stringify(newEventsForDate))
        }));
           
           // Log the publish action to audit trail
           logAudit(
               "Next Day Build",
               "Edit",
               `Published schedule for ${buildDfpDate}`,
               `Total events: ${newEventsForDate.length}, Flight: ${newEventsForDate.filter(e => e.type === "flight").length}, FTD: ${newEventsForDate.filter(e => e.type === "ftd").length}, Ground: ${newEventsForDate.filter(e => e.type === "ground").length}`
           );

        // ── SAVE DAILY SNAPSHOT TO DATABASE ──────────────────────────────────
        // Guard: skip if any event is seed data
        const hasSeedData = newEventsForDate.some(e => (e as any).isHistoricalSeed === true);
        if (!hasSeedData && newEventsForDate.length > 0) {
            // Build snapshot data from current state
            const staffEventsForDate = newEventsForDate.filter(e =>
                e.instructor && !e.student && e.type !== 'logbook'
            );
            const traineeEventsForDate = newEventsForDate.filter(e =>
                !!(e.student || (e as any).traineeId)
            );

            // Build per-instructor logbook map from all published schedules + new date
            const staffLogbookMap: Record<string, any[]> = {};
            const allPublishedForLogbook = {
                ...publishedSchedules,
                [buildDfpDate]: newEventsForDate
            };
            Object.entries(allPublishedForLogbook).forEach(([dateKey, events]) => {
                (events as ScheduleEvent[]).forEach(e => {
                    if ((e as any).isLogbook === true || e.type === 'logbook') {
                        const instName = e.instructor || '';
                        if (!staffLogbookMap[instName]) staffLogbookMap[instName] = [];
                        staffLogbookMap[instName].push({
                            date: dateKey,
                            eventCode: (e as any).eventCode || e.id,
                            flightNumber: (e as any).flightNumber,
                            duration: e.duration,
                            student: e.student,
                            flightType: (e as any).flightType || 'Dual',
                            locationType: (e as any).locationType || 'Local',
                            origin: (e as any).origin || '',
                            destination: (e as any).destination || '',
                        });
                    }
                });
            });

            // Build per-staff currency map
            const staffCurrencyMap: Record<string, any> = {};
            instructorsData.forEach((inst: any) => {
                if (inst.currencyStatus && inst.currencyStatus.length > 0) {
                    staffCurrencyMap[inst.name] = inst.currencyStatus;
                }
            });

            // Build trainee profiles snapshot
            const traineeProfilesSnapshot = traineesData.map((t: any) => ({
                idNumber: t.idNumber,
                fullName: t.fullName,
                name: t.name,
                rank: t.rank,
                course: t.course,
                lmpType: t.lmpType,
                service: t.service,
                unit: t.unit,
                primaryInstructor: t.primaryInstructor,
                currencyStatus: t.currencyStatus || [],
                isPaused: t.isPaused || false,
            }));

            // Build per-trainee LMP completedEventIds map
            const lmpCompletedIdsMap: Record<string, string[]> = {};
            traineesData.forEach((t: any) => {
                const individualLMP = traineeLMPs.get(t.fullName);
                if (individualLMP) {
                    const completedIds = (individualLMP as any[])
                        .filter((item: any) => item.completedAt || item.isComplete)
                        .map((item: any) => (item.id || item.code || '').replace('*', ''));
                    if (completedIds.length > 0) {
                        lmpCompletedIdsMap[t.fullName] = completedIds;
                    }
                }
            });

            // Convert pt051Assessments Map to plain object for serialization
            const pt051AssessmentsObj: Record<string, any> = {};
            pt051Assessments.forEach((assessment: any, key: string) => {
                pt051AssessmentsObj[key] = assessment;
            });

            const snapshotPayload = {
                date: buildDfpDate,
                scheduleEvents: newEventsForDate,
                staffEvents: staffEventsForDate,
                traineeEvents: traineeEventsForDate,
                pt051Assessments: pt051AssessmentsObj,
                traineeProfiles: traineeProfilesSnapshot,
                lmpCompletedIds: lmpCompletedIdsMap,
                staffCurrency: staffCurrencyMap,
                staffLogbook: staffLogbookMap,
                savedBy: authUser?.userId || (authUser as any)?.username || null,
            };

            const apiBase = getApiBaseUrl();
            fetch(`${apiBase}/daily-snapshot/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(snapshotPayload),
            })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    console.log(`\\u2705 [Snapshot] Saved daily snapshot for ${buildDfpDate}, ${newEventsForDate.length} events`);
                } else {
                    console.warn(`\\u26A0\\uFE0F [Snapshot] Save failed for ${buildDfpDate}:`, result.error);
                }
            })
            .catch(err => {
                console.warn(`\\u26A0\\uFE0F [Snapshot] Could not save daily snapshot for ${buildDfpDate}:`, err);
            });
        } else if (hasSeedData) {
            console.log(`\\u26A0\\uFE0F [Snapshot] Skipped saving seed data for ${buildDfpDate}`);
        }
        // ─────────────────────────────────────────────────────────────────────

        setDate(buildDfpDate);
        setNextDayBuildEvents([]);
        setActiveView('Program Schedule');
        setSuccessMessage('DFP Successfully Published!');
    };'''

new_content = content[:start_idx] + new_func + content[end_idx:]
print(f"Replacement done. New content length: {len(new_content)} vs old: {len(content)}")

with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/App.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("SUCCESS: handleConfirmPublish updated")