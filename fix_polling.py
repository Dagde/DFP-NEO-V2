with open('App.tsx', 'r') as f:
    content = f.read()

old = """    // Poll alert statuses for the current date every 15 seconds
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
    }, [date]);"""

new = """    // Poll alert statuses for the current date every 5 seconds
    useEffect(() => {
        const pollAlerts = async () => {
            try {
                const apiBase = window.location.origin.includes('railway.app') ? '/api' : 'https://dfp-neo-v2-production.up.railway.app/api';
                const res = await fetch(`${apiBase}/daily-snapshot/${date}`);
                if (!res.ok) return;
                const data = await res.json();
                const snap = data.snapshot;
                if (!snap) return;
                // Always update alertsData so responses (accept/reject) are reflected immediately
                if (snap.alertsData) {
                    setAlertsDataByDate(prev => ({
                        ...prev,
                        [date]: snap.alertsData,
                    }));
                }
            } catch (err) {
                // Silent fail - polling
            }
        };
        // Run immediately on mount/date change, then every 5 seconds
        pollAlerts();
        const interval = setInterval(pollAlerts, 5 * 1000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date]);"""

if old in content:
    content = content.replace(old, new)
    with open('App.tsx', 'w') as f:
        f.write(content)
    print("✅ Polling updated successfully!")
else:
    print("❌ Old string not found!")
    # Try to find partial match
    idx = content.find("Poll alert statuses for the current date every 15 seconds")
    if idx >= 0:
        print(f"Found at index {idx}, context:")
        print(content[idx-10:idx+500])