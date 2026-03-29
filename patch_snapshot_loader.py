with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_text = '''        loadHistoricalData();
    }, []);

       // Show commit alert on app mount - DISABLED'''

new_text = '''        loadHistoricalData();
    }, []);

    // Load snapshot dates for calendar dropdown
    useEffect(() => {
        const loadSnapshotDates = async () => {
            try {
                const apiBase = window.location.origin.includes('railway.app') ? '/api' : 'https://dfp-neo-v2-production.up.railway.app/api';
                const res = await fetch(`${apiBase}/daily-snapshot/dates`);
                if (!res.ok) return;
                const data = await res.json();
                const dates: string[] = (data.dates || []).map((d: any) => d.date);
                console.log(`[Snapshot] \u2705 Loaded ${dates.length} snapshot dates for calendar`);
                setSnapshotDates(dates);
                // Mark the last 5 (already loaded on startup) as loaded
                dates.slice(0, 5).forEach(d => loadedSnapshotDates.current.add(d));
            } catch (err) {
                console.warn('[Snapshot] Could not load snapshot dates:', err);
            }
        };
        loadSnapshotDates();
    }, []);

    // Load a single day snapshot on demand (when user navigates to a date not yet loaded)
    const loadSnapshotForDate = React.useCallback(async (targetDate: string) => {
        if (loadedSnapshotDates.current.has(targetDate)) return; // already loaded
        loadedSnapshotDates.current.add(targetDate); // mark as attempted
        try {
            const apiBase = window.location.origin.includes('railway.app') ? '/api' : 'https://dfp-neo-v2-production.up.railway.app/api';
            const res = await fetch(`${apiBase}/daily-snapshot/${targetDate}`);
            if (!res.ok) return; // 404 = no snapshot for that date, that's fine
            const data = await res.json();
            const snap = data.snapshot;
            if (!snap) return;
            const events: ScheduleEvent[] = Array.isArray(snap.scheduleEvents) ? snap.scheduleEvents : [];
            if (events.length > 0) {
                setPublishedSchedules(prev => {
                    // Only load if no existing non-seed events for this date
                    const existingNonSeed = (prev[targetDate] || []).filter(e => !(e as any).isHistoricalSeed);
                    if (existingNonSeed.length > 0) return prev;
                    return { ...prev, [targetDate]: events };
                });
                console.log(`[Snapshot] \u2705 Loaded on-demand snapshot for ${targetDate}, ${events.length} events`);
            }
            // Also merge PT-051 assessments from this snapshot
            if (snap.pt051Assessments && Object.keys(snap.pt051Assessments).length > 0) {
                setPt051Assessments(prev => {
                    const merged = new Map(prev);
                    Object.entries(snap.pt051Assessments as Record<string, Pt051Assessment>).forEach(([key, assessment]) => {
                        if (!merged.has(key)) merged.set(key, assessment);
                    });
                    return merged;
                });
            }
        } catch (err) {
            console.warn(`[Snapshot] Could not load snapshot for ${targetDate}:`, err);
        }
    }, []);

       // Show commit alert on app mount - DISABLED'''

if old_text not in content:
    print("ERROR: Could not find target text")
    idx = content.find('        loadHistoricalData();')
    print(f"Found loadHistoricalData at: {idx}")
    print(repr(content[idx:idx+200]))
    exit(1)

new_content = content.replace(old_text, new_text, 1)
print(f"SUCCESS: Replaced. New length={len(new_content)}")

with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/App.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("File written successfully")