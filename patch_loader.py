with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_loader = '''    // Load persisted historical training data (publishedSchedules + pt051Assessments) from DB
    useEffect(() => {
        const loadHistoricalData = async () => {
            try {
                const apiBase = window.location.origin.includes(\'railway.app\') ? \'/api\' : \'https://dfp-neo-v2-production.up.railway.app/api\';
                const res = await fetch(`${apiBase}/historical-data`);
                if (!res.ok) return;
                const data = await res.json();

                if (data.publishedSchedules && Object.keys(data.publishedSchedules).length > 0) {
                    const schedules = data.publishedSchedules as Record<string, ScheduleEvent[]>;
                    const eventCount = Object.values(schedules).flat().length;
                    console.log(`[Historical] \u2705 Loaded ${eventCount} events across ${Object.keys(schedules).length} dates`);
                    setPublishedSchedules(prev => {
                        // Merge with existing (don\'t overwrite future/today\'s scheduled events)
                        const merged = { ...schedules };
                        Object.entries(prev).forEach(([date, events]) => {
                            if (events.some(e => !(e as any).isHistoricalSeed)) {
                                // Keep existing non-seed events for this date alongside historical
                                const existing = merged[date] || [];
                                const nonSeed = events.filter(e => !(e as any).isHistoricalSeed);
                                merged[date] = [...existing.filter((e: any) => e.isHistoricalSeed), ...nonSeed];
                            }
                        });
                        return merged;
                    });
                }

                if (data.pt051Assessments && Object.keys(data.pt051Assessments).length > 0) {
                    const assessments = data.pt051Assessments as Record<string, Pt051Assessment>;
                    console.log(`[Historical] \u2705 Loaded ${Object.keys(assessments).length} PT-051 assessments`);
                    setPt051Assessments(prev => {
                        const merged = new Map(prev);
                        Object.entries(assessments).forEach(([key, assessment]) => {
                            if (!merged.has(key)) {
                                merged.set(key, assessment);
                            }
                        });
                        return merged;
                    });
                }

                if (data.seedingMetadata) {
                    console.log(`[Historical] Seeded at: ${data.seedingMetadata.seededAt}, courses: ${(data.seedingMetadata.coursesSeeded || []).join(\', \')}`);
                }
            } catch (error) {
                console.warn(\'[Historical] Could not load historical data:\', error);
            }
        };
        loadHistoricalData();
    }, []);'''

if old_loader not in content:
    print("ERROR: Could not find old loader text")
    # Try to find the section manually
    idx = content.find('// Load persisted historical training data (publishedSchedules + pt051Assessments) from DB')
    print(f"Section starts at: {idx}")
    print(repr(content[idx:idx+500]))
    exit(1)

new_loader = '''    // Load persisted daily snapshots (last 5 days) + legacy historical data from DB
    useEffect(() => {
        const loadHistoricalData = async () => {
            try {
                const apiBase = window.location.origin.includes(\'railway.app\') ? \'/api\' : \'https://dfp-neo-v2-production.up.railway.app/api\';

                // ── PRIMARY: Load last 5 days of real DailySnapshots ──────────────
                try {
                    const snapRes = await fetch(`${apiBase}/daily-snapshot`);
                    if (snapRes.ok) {
                        const snapData = await snapRes.json();
                        const snapshots: any[] = snapData.snapshots || [];
                        if (snapshots.length > 0) {
                            console.log(`[Snapshot] \u2705 Loaded ${snapshots.length} daily snapshots`);
                            setPublishedSchedules(prev => {
                                const merged = { ...prev };
                                snapshots.forEach(snap => {
                                    const dateKey = snap.date;
                                    const events: ScheduleEvent[] = Array.isArray(snap.scheduleEvents) ? snap.scheduleEvents : [];
                                    // Only use snapshot events if there are no existing non-seed events for this date
                                    const existingNonSeed = (merged[dateKey] || []).filter(e => !(e as any).isHistoricalSeed);
                                    if (existingNonSeed.length === 0 && events.length > 0) {
                                        merged[dateKey] = events;
                                    }
                                });
                                return merged;
                            });

                            // Load PT-051 assessments from the most recent snapshot
                            const mostRecent = snapshots[0];
                            if (mostRecent && mostRecent.pt051Assessments && Object.keys(mostRecent.pt051Assessments).length > 0) {
                                const assessments = mostRecent.pt051Assessments as Record<string, Pt051Assessment>;
                                console.log(`[Snapshot] \u2705 Loaded ${Object.keys(assessments).length} PT-051 assessments from latest snapshot`);
                                setPt051Assessments(prev => {
                                    const merged = new Map(prev);
                                    Object.entries(assessments).forEach(([key, assessment]) => {
                                        if (!merged.has(key)) {
                                            merged.set(key, assessment as Pt051Assessment);
                                        }
                                    });
                                    return merged;
                                });
                            }
                        }
                    }
                } catch (snapErr) {
                    console.warn(\'[Snapshot] Could not load daily snapshots:\', snapErr);
                }

                // ── SECONDARY: Legacy DataBackup historical-data (seed data, fallback) ──
                const res = await fetch(`${apiBase}/historical-data`);
                if (!res.ok) return;
                const data = await res.json();

                if (data.publishedSchedules && Object.keys(data.publishedSchedules).length > 0) {
                    const schedules = data.publishedSchedules as Record<string, ScheduleEvent[]>;
                    const eventCount = Object.values(schedules).flat().length;
                    console.log(`[Historical] \u2705 Loaded ${eventCount} events across ${Object.keys(schedules).length} dates (legacy/seed)`);
                    setPublishedSchedules(prev => {
                        // Merge historical/seed data — real snapshot data takes priority
                        const merged = { ...schedules };
                        Object.entries(prev).forEach(([date, events]) => {
                            if (events.some(e => !(e as any).isHistoricalSeed)) {
                                // Keep existing non-seed events for this date (snapshot data wins)
                                const existing = merged[date] || [];
                                const nonSeed = events.filter(e => !(e as any).isHistoricalSeed);
                                merged[date] = [...existing.filter((e: any) => e.isHistoricalSeed), ...nonSeed];
                            }
                        });
                        return merged;
                    });
                }

                if (data.pt051Assessments && Object.keys(data.pt051Assessments).length > 0) {
                    const assessments = data.pt051Assessments as Record<string, Pt051Assessment>;
                    console.log(`[Historical] \u2705 Loaded ${Object.keys(assessments).length} PT-051 assessments (legacy)`);
                    setPt051Assessments(prev => {
                        const merged = new Map(prev);
                        Object.entries(assessments).forEach(([key, assessment]) => {
                            if (!merged.has(key)) {
                                merged.set(key, assessment);
                            }
                        });
                        return merged;
                    });
                }

                if (data.seedingMetadata) {
                    console.log(`[Historical] Seeded at: ${data.seedingMetadata.seededAt}, courses: ${(data.seedingMetadata.coursesSeeded || []).join(\', \')}`);
                }
            } catch (error) {
                console.warn(\'[Historical] Could not load historical data:\', error);
            }
        };
        loadHistoricalData();
    }, []);'''

new_content = content.replace(old_loader, new_loader, 1)
if new_content == content:
    print("ERROR: Replacement had no effect")
else:
    print(f"SUCCESS: loader replaced, new length={len(new_content)}")
    with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/App.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("File written successfully")