#!/usr/bin/env python3

with open('/workspace/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_str = '    // Visual Adjust handlers\n    const handleVisualAdjustStart = async (event: ScheduleEvent) => {\n        console.log(\'Visual Adjust Start - Event:\', event);'

new_str = '''    // handleSendAlert
    const handleSendAlert = async (eventId: string, recipients: string[]) => {
        try {
            const apiBase = window.location.origin.includes('railway.app') ? '/api' : 'https://dfp-neo-v2-production.up.railway.app/api';
            const userId = getCurrentUserId() || currentUserName;
            const eventForAlert = events.find(e => e.id === eventId) || selectedEvent;
            const res = await fetch(`${apiBase}/alerts/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    eventId,
                    sentBy: userId,
                    recipients,
                    eventDetails: eventForAlert ? {
                        flightNumber: eventForAlert.flightNumber,
                        startTime: eventForAlert.startTime,
                        duration: eventForAlert.duration,
                        resourceId: eventForAlert.resourceId,
                        instructor: eventForAlert.instructor,
                        student: eventForAlert.student,
                        pilot: eventForAlert.pilot,
                    } : {},
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setAlertsDataByDate(prev => ({
                    ...prev,
                    [date]: {
                        ...(prev[date] || {}),
                        [eventId]: data.alertEntry || data,
                    },
                }));
                console.log('[Alert] Alert sent for event', eventId);
            } else {
                console.warn('[Alert] Failed to send alert:', await res.text());
            }
        } catch (err) {
            console.error('[Alert] Error sending alert:', err);
        }
    };

    // Visual Adjust handlers
    const handleVisualAdjustStart = async (event: ScheduleEvent) => {
        console.log(\'Visual Adjust Start - Event:\', event);'''

if old_str in content:
    new_content = content.replace(old_str, new_str, 1)
    with open('/workspace/App.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS")
else:
    print("ERROR: target not found")