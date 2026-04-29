#!/usr/bin/env python3

with open('/workspace/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_str = '    const handleUpdateSyllabus = useCallback((newSyllabus: SyllabusItemDetail[]) => {'

new_str = '''    // ── Alert response polling ──────────────────────────────────────────────
    // Poll alert statuses for the current date every 15 seconds
    useEffect(() => {
        const pollAlerts = async () => {
            try {
                const apiBase = window.location.origin.includes('railway.app') ? '/api' : 'https://dfp-neo-v2-production.up.railway.app/api';
                const res = await fetch(`${apiBase}/daily-snapshot/${date}`);
                if (!res.ok) return;
                const data = await res.json();
                const snap = data.snapshot;
                if (!snap) return;
                if (snap.alertsData && Object.keys(snap.alertsData).length > 0) {
                    setAlertsDataByDate(prev => ({
                        ...prev,
                        [date]: snap.alertsData,
                    }));
                }
            } catch (err) {
                // Silent fail - polling
            }
        };
        const interval = setInterval(pollAlerts, 15 * 1000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date]);

    const handleUpdateSyllabus = useCallback((newSyllabus: SyllabusItemDetail[]) => {'''

if old_str in content:
    new_content = content.replace(old_str, new_str, 1)
    with open('/workspace/App.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS")
else:
    print("ERROR: target not found")