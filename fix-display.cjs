// Simple fix for the display issue
const fs = require('fs');

let content = fs.readFileSync('App.tsx', 'utf8');

// Add localStorage backup after setNextDayBuildEvents
content = content.replace(
    "setNextDayBuildEvents(generated);\n                console.log('\ud83d\ude80 [NEO-Build] setNextDayBuildEvents called with', generated.length, 'events');",
    `setNextDayBuildEvents(generated);
                console.log('\ud83d\ude80 [NEO-Build] setNextDayBuildEvents called with', generated.length, 'events');
                
                // FIX: Backup events to localStorage
                try {
                    localStorage.setItem('neo-build-events-backup', JSON.stringify(generated));
                    console.log('\ud83d\ude80 [NEO-Build] Events backed up to localStorage');
                } catch (error) {
                    console.warn('\ud83d\ude80 [NEO-Build] Failed to backup events:', error);
                }`
);

// Add restore logic in useMemo
content = content.replace(
    "console.log('\ud83d\ude80 [NEO-Build] nextDayBuildEvents.length:', nextDayBuildEvents.length);\n        \n        const segments: EventSegment[] = [];",
    `console.log('\ud83d\ude80 [NEO-Build] nextDayBuildEvents.length:', nextDayBuildEvents.length);
        
        // FIX: Restore from localStorage if state is empty
        let eventsToUse = nextDayBuildEvents;
        if (nextDayBuildEvents.length === 0) {
            try {
                const stored = localStorage.getItem('neo-build-events-backup');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    eventsToUse = parsed;
                    console.log('\ud83d\ude80 [NEO-Build] RESTORED:', parsed.length, 'events from localStorage');
                    setNextDayBuildEvents(parsed);
                }
            } catch (error) {
                console.warn('\ud83d\ude80 [NEO-Build] Could not restore events:', error);
            }
        }
        
        const segments: EventSegment[] = [];`
);

// Update the line that uses nextDayBuildEvents
content = content.replace(
    "const buildEventsWithDate: ScheduleEvent[] = nextDayBuildEvents.map(e => ({...e, date: buildDfpDate}));",
    "const buildEventsWithDate: ScheduleEvent[] = eventsToUse.map(e => ({...e, date: buildDfpDate}));"
);

fs.writeFileSync('App.tsx', content);
console.log('Fixed display issue in App.tsx');