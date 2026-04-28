with open('dfp-neo-deployment/App.tsx', 'r') as f:
    content = f.read()

polling_code = """
    // ── Mobile unavailability live-refresh polling ────────────────────────
    // Poll every 30 seconds so that unavailability submitted from the iOS app
    // appears in the browser without a hard refresh.
    useEffect(() => {
        const pollUnavailability = async () => {
            try {
                const [personnelRes, traineesRes] = await Promise.all([
                    fetch('/api/personnel', { credentials: 'include' }),
                    fetch('/api/trainees',  { credentials: 'include' }),
                ]);
                if (personnelRes.ok) {
                    const personnelData = await personnelRes.json();
                    const dbPersonnel = (personnelData.personnel || []).map((p: any) => ({
                        ...p,
                        currencyStatus: p.qualifications?.currencyStatus || p.currencyStatus || [],
                        _dataSource: 'database' as const,
                        unavailability: Array.isArray(p.unavailability)
                            ? p.unavailability.filter((u: any) => !u?.notes?.startsWith('__deploy__'))
                            : p.unavailability,
                    }));
                    setInstructorsData(prev => {
                        // Only update if unavailability counts changed (avoids needless re-renders)
                        const prevMap = new Map(prev.map(i => [(i as any).id, i]));
                        let changed = false;
                        for (const p of dbPersonnel) {
                            const existing = prevMap.get(p.id);
                            if (!existing) { changed = true; break; }
                            const prevLen = (existing.unavailability || []).length;
                            const newLen  = (p.unavailability   || []).length;
                            if (prevLen !== newLen) { changed = true; break; }
                        }
                        if (!changed) return prev;
                        console.log('\\u{1F504} [UnavailabilityPoll] Detected new unavailability \\u2013 updating state');
                        const nonDbInstructors = prev.filter(i => (i as any)._dataSource !== 'database');
                        return [...nonDbInstructors, ...dbPersonnel];
                    });
                }
                if (traineesRes.ok) {
                    const traineesData = await traineesRes.json();
                    const dbTrainees = (traineesData.trainees || []).map((t: any) => ({
                        ...t,
                        _dataSource: 'database' as const,
                        unavailability: Array.isArray(t.unavailability)
                            ? t.unavailability.filter((u: any) => !u?.notes?.startsWith('__deploy__'))
                            : t.unavailability,
                    }));
                    setTraineesData(prev => {
                        const prevMap = new Map(prev.map(t => [(t as any).id, t]));
                        let changed = false;
                        for (const t of dbTrainees) {
                            const existing = prevMap.get(t.id);
                            if (!existing) { changed = true; break; }
                            const prevLen = (existing.unavailability || []).length;
                            const newLen  = (t.unavailability   || []).length;
                            if (prevLen !== newLen) { changed = true; break; }
                        }
                        if (!changed) return prev;
                        const mockTrainees = prev.filter(t => (t as any)._dataSource === 'mockdata');
                        return [...mockTrainees, ...dbTrainees];
                    });
                }
            } catch (e) {
                // Silently ignore polling errors – network hiccup should not affect UX
            }
        };

        // Poll every 30 seconds
        const pollInterval = setInterval(pollUnavailability, 30 * 1000);
        return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // ── End mobile unavailability polling ─────────────────────────────────

"""

# Target: the second }, [handleDatabaseDataChanged]); followed by blank lines then handleUpdateSyllabus
target = '    }, [handleDatabaseDataChanged]);\n    \n    \n    const handleUpdateSyllabus'
replacement = '    }, [handleDatabaseDataChanged]);\n    \n    \n' + polling_code + '    const handleUpdateSyllabus'

if target in content:
    new_content = content.replace(target, replacement, 1)
    with open('dfp-neo-deployment/App.tsx', 'w') as f:
        f.write(new_content)
    print("SUCCESS: Polling code inserted")
else:
    print("ERROR: Target not found. Checking exact characters around handleUpdateSyllabus...")
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'const handleUpdateSyllabus = useCallback' in line:
            # Show raw bytes of surrounding lines
            for j in range(i-4, i+2):
                print(f"Line {j+1}: {repr(lines[j])}")
            break