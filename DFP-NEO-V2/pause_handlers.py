# Insert pause handlers at line 7679 (after persistScheduleForDate closes at 7678)
# Using line-number based approach

with open('/workspace/DFP-NEO-V2/DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the line that has the long box-drawing separator after persistScheduleForDate
# Look for "    };" followed by a line containing many ─ characters
insert_after = None
for i in range(7670, 7690):
    line = lines[i]
    if line.strip() == '};' and i > 7675:
        # Check next line for the separator
        next_line = lines[i+1] if i+1 < len(lines) else ''
        if '\u2500' in next_line:
            insert_after = i  # insert after line i (0-indexed)
            print(f"Found closing brace at line {i+1} (1-indexed)")
            print(f"Next line (separator): {repr(next_line[:60])}")
            break

if insert_after is None:
    print("Could not find insertion point, searching more broadly...")
    # Manual fallback: insert at line 7679 (0-indexed: 7678)
    insert_after = 7677
    print(f"Using fallback insertion at line {insert_after+1}")

handlers = '''
    // ── Pause Flight Ops: handlePauseBuild ────────────────────────────────────
    const handlePauseBuild = async (config: PauseBuildConfig): Promise<ScheduleEvent[]> => {
        const {
            date: pauseDate,
            pauseStart,
            pauseEnd,
            pauseRule,
            affectedTypes,
            completedEventIds,
            flyingStartTime: dayStart,
            flyingEndTime: dayEnd,
            ftdStartTime: pFtdStart,
            ftdEndTime: pFtdEnd,
            existingEvents,
        } = config;

        console.log('[PauseBuild] Starting pause build for', pauseDate);

        // 1. Determine which events are impacted
        const isImpacted = (e: ScheduleEvent): boolean => {
            const typeKey = e.type === 'ground' ? 'ground' : e.type;
            if (!(affectedTypes as string[]).includes(typeKey)) return false;
            if (e.isCancelled) return false;
            if (completedEventIds.has(e.id)) return false;
            const end = e.startTime + e.duration;
            if (pauseRule === 'no_start_during') {
                return e.startTime >= pauseStart && e.startTime < pauseEnd;
            } else {
                return e.startTime < pauseEnd && end > pauseStart;
            }
        };

        // 2. Cancel impacted events
        const cancelledNow = new Set<string>();
        const eventsAfterCancel = existingEvents.map(e => {
            if (isImpacted(e)) {
                cancelledNow.add(e.id);
                return {
                    ...e,
                    isCancelled: true,
                    cancellationCode: 'OPS_PAUSE' as any,
                    cancelledBy: authUser?.displayName || 'Ops',
                    cancelledAt: new Date().toISOString(),
                };
            }
            return e;
        });

        console.log('[PauseBuild] Cancelled', cancelledNow.size, 'events');

        // 3. Lock all non-cancelled events as time-fixed (preserve pre-pause schedule)
        const lockedEvents: ScheduleEvent[] = eventsAfterCancel
            .filter(e => !e.isCancelled)
            .map(e => ({ ...e, isTimeFixed: true }));

        const activeTraineesForPause = allTraineesData.filter((t: any) =>
            !t.isPaused &&
            !isPersonStaticallyUnavailable(t, pauseEnd, ceaseNightFlying, pauseDate, 'flight')
        );

        const pauseBuildConfig = {
            instructors: instructorsData,
            trainees: activeTraineesForPause,
            syllabus: syllabusDetails,
            scores,
            coursePriorities,
            coursePercentages,
            availableAircraftCount,
            ftdCount: availableFtdCount,
            cptCount: availableCptCount,
            courseColors,
            school,
            dayStart: pauseEnd,
            dayEnd,
            ftdStart: pFtdStart,
            ftdEnd: pFtdEnd,
            allowNightFlying,
            commenceNightFlying,
            ceaseNightFlying,
            buildDate: pauseDate,
            highestPriorityEvents: lockedEvents,
            instructorPriority,
            traineeLMPs,
            flightTurnaround,
            ftdTurnaround,
            cptTurnaround,
            preferredDutyPeriod,
            maxCrewDutyPeriod,
            eventLimits,
            sctFtds,
            sctFlights,
            remedialRequests,
            sctEvents,
            getEventDayNightClassification,
            staffSharingEnabled: organisationSettings.staffSharingEnabled,
            staffSharingUnits: organisationSettings.staffSharingUnits,
        };

        return new Promise<ScheduleEvent[]>((resolve) => {
            setTimeout(() => {
                try {
                    const generated = generateDfpInternal(
                        pauseBuildConfig,
                        (progress: { message: string; percentage: number }) => {
                            console.log('[PauseBuild]', progress.message);
                        },
                        publishedSchedules
                    );

                    // Filter out STBY lines and add date field
                    const generatedWithDate: ScheduleEvent[] = generated
                        .filter((e: any) => {
                            const resId = ((e as any).resourceId || '').toLowerCase();
                            return !resId.includes('stby') && !resId.includes('standby');
                        })
                        .map((e: any) => ({ ...e, date: pauseDate } as ScheduleEvent));

                    // Merge: include cancelled events that may not be in the new build
                    const builtIds = new Set(generatedWithDate.map(e => e.id));
                    const cancelledNotInBuild = eventsAfterCancel.filter(e => e.isCancelled && !builtIds.has(e.id));
                    const final = [...generatedWithDate, ...cancelledNotInBuild];

                    console.log('[PauseBuild] Complete. Total events:', final.length);
                    resolve(final);
                } catch (err) {
                    console.error('[PauseBuild] Build error:', err);
                    resolve(eventsAfterCancel);
                }
            }, 100);
        });
    };

    // ── Pause Flight Ops: handlePausePublish ──────────────────────────────────
    const handlePausePublish = (updatedEvents: ScheduleEvent[]) => {
        const targetDate = date;

        setPublishedSchedules((prev: Record<string, ScheduleEvent[]>) => ({
            ...prev,
            [targetDate]: updatedEvents,
        }));

        persistScheduleForDate(targetDate, updatedEvents);

        const cancelledCount = updatedEvents.filter(e =>
            e.isCancelled && (e as any).cancellationCode === 'OPS_PAUSE'
        ).length;
        const activeCount = updatedEvents.filter(e => !e.isCancelled).length;

        logAudit(
            'Program Schedule',
            'Edit',
            `Pause Flight Ops committed for ${targetDate}`,
            `Cancelled: ${cancelledCount} (OPS PAUSE) | Active post-rebuild: ${activeCount} | By: ${authUser?.displayName || 'Unknown'}`
        );

        console.log('[PausePublish] Committed', updatedEvents.length, 'events for', targetDate);
    };

'''

# Insert handlers after line insert_after (0-indexed)
new_lines = lines[:insert_after+1] + [handlers] + lines[insert_after+1:]

with open('/workspace/DFP-NEO-V2/DFP-NEO-V2-fresh/App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"SUCCESS: Pause handlers inserted after line {insert_after+1}")
print(f"New file line count: {len(new_lines)}")