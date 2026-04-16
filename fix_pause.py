with open('/workspace/DFP-NEO-V2/DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ── Fix 1: Replace handlePauseBuild ──────────────────────────────────────────
old_build = '''    const handlePauseBuild = async (config: PauseBuildConfig): Promise<ScheduleEvent[]> => {
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
    };'''

new_build = '''    const handlePauseBuild = async (config: PauseBuildConfig): Promise<ScheduleEvent[]> => {
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

        console.log('[PauseBuild] Starting pause build for', pauseDate, 'pauseEnd:', pauseEnd, 'dayEnd:', dayEnd);

        // 1. Determine which events are impacted by the pause
        const isImpacted = (e: ScheduleEvent): boolean => {
            if (e.isCancelled) return false;
            if (completedEventIds.has(e.id)) return false;
            const typeKey = e.type === 'ground' ? 'ground' : e.type;
            if (!(affectedTypes as string[]).includes(typeKey)) return false;
            const end = e.startTime + e.duration;
            if (pauseRule === 'no_start_during') {
                return e.startTime >= pauseStart && e.startTime < pauseEnd;
            } else {
                // conclude_by_start: any event overlapping pause start is impacted
                return e.startTime < pauseEnd && end > pauseStart;
            }
        };

        // 2. Build the set of cancelled events and the eventsAfterCancel array
        const cancelledIds = new Set<string>();
        const eventsAfterCancel: ScheduleEvent[] = existingEvents.map(e => {
            if (isImpacted(e)) {
                cancelledIds.add(e.id);
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

        console.log('[PauseBuild] Impacted/cancelled:', cancelledIds.size);

        // 3. For the NEO Build, lock ALL non-cancelled events as time-fixed
        //    so the algorithm preserves the entire pre-pause schedule
        const lockedEvents: ScheduleEvent[] = eventsAfterCancel
            .filter(e => !e.isCancelled)
            .map(e => ({ ...e, isTimeFixed: true }));

        console.log('[PauseBuild] Locked pre-pause events:', lockedEvents.length);

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
            dayStart: pauseEnd,      // Build only fills from pause end onward
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

                    console.log('[PauseBuild] generateDfpInternal returned', generated.length, 'events');

                    // Add date field and filter out STBY resource lines
                    const generatedWithDate: ScheduleEvent[] = generated
                        .filter((e: any) => {
                            const resId = ((e as any).resourceId || '').toLowerCase();
                            return !resId.includes('stby') && !resId.includes('standby');
                        })
                        .map((e: any) => ({ ...e, date: pauseDate } as ScheduleEvent));

                    // The build output already includes all locked pre-pause events.
                    // Now add back any originally-cancelled (OPS_PAUSE) events
                    // that may not appear in the build output (they were excluded from scheduling).
                    const builtIds = new Set(generatedWithDate.map(e => e.id));
                    const opsPauseCancelledEvents = eventsAfterCancel.filter(
                        e => e.isCancelled && cancelledIds.has(e.id) && !builtIds.has(e.id)
                    );

                    const final = [...generatedWithDate, ...opsPauseCancelledEvents];

                    console.log('[PauseBuild] Final staged events:', final.length,
                        '(built:', generatedWithDate.length,
                        'cancelled added back:', opsPauseCancelledEvents.length, ')');

                    resolve(final);
                } catch (err) {
                    console.error('[PauseBuild] generateDfpInternal error:', err);
                    // Fallback: just return the cancelled version with no rebuild
                    resolve(eventsAfterCancel);
                }
            }, 100);
        });
    };'''

if old_build in content:
    content = content.replace(old_build, new_build, 1)
    print("SUCCESS: handlePauseBuild replaced")
else:
    print("ERROR: could not find handlePauseBuild to replace")

# ── Fix 2: Replace handlePausePublish ─────────────────────────────────────────
old_publish = '''    const handlePausePublish = (updatedEvents: ScheduleEvent[]) => {
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
    };'''

new_publish = '''    const handlePausePublish = (updatedEvents: ScheduleEvent[]) => {
        const targetDate = date;

        // Deduplicate by ID (same guard as normal publish)
        const seenIds = new Set<string>();
        const dedupedEvents = updatedEvents.filter(e => {
            if (seenIds.has(e.id)) return false;
            seenIds.add(e.id);
            return true;
        });

        // Ensure every event has the correct date field
        const finalEvents: ScheduleEvent[] = dedupedEvents.map(e => ({ ...e, date: targetDate }));

        console.log('[PausePublish] Publishing', finalEvents.length, 'events for', targetDate);

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

        // 3. Sync PT-051s with the updated schedule
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

        console.log('[PausePublish] Done. Active:', activeCount, 'Cancelled:', cancelledCount);
    };'''

if old_publish in content:
    content = content.replace(old_publish, new_publish, 1)
    print("SUCCESS: handlePausePublish replaced")
else:
    print("ERROR: could not find handlePausePublish to replace")
    # Show what's there
    idx = content.find('handlePausePublish')
    print(repr(content[idx:idx+200]))

with open('/workspace/DFP-NEO-V2/DFP-NEO-V2-fresh/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("File written.")