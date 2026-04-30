with open('App.tsx', 'r') as f:
    content = f.read()

old = """        console.log('🔔 [Alert] ========== SEND ALERT END ==========');
    };

    // Visual Adjust handlers"""

new = """        console.log('🔔 [Alert] ========== SEND ALERT END ==========');
    };

    // handleClearAlert - Clear alert history for an event to allow re-sending
    const handleClearAlert = async (eventId: string) => {
        const apiBase = '/api';
        try {
            const res = await fetch(`${apiBase}/alerts/clear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, date, clearedBy: getCurrentUserId() || currentUserName }),
            });
            if (res.ok) {
                // Remove from local state immediately
                setAlertsDataByDate(prev => {
                    const dateData = { ...(prev[date] || {}) };
                    delete dateData[eventId];
                    return { ...prev, [date]: dateData };
                });
                console.log('🔔 [Alert] Alert cleared for event:', eventId);
            } else {
                console.warn('🔔 [Alert] Failed to clear alert:', res.status);
            }
        } catch (err) {
            console.error('🔔 [Alert] Exception clearing alert:', err);
        }
    };

    // Visual Adjust handlers"""

if old in content:
    content = content.replace(old, new, 1)
    print("Added handleClearAlert: OK")
else:
    print("ERROR: old string not found")
    # debug
    idx = content.find('SEND ALERT END')
    print(f"Found SEND ALERT END at index: {idx}")
    print(content[idx-10:idx+200])

with open('App.tsx', 'w') as f:
    f.write(content)