// Sync Debugger - tracks aircraft availability sync events
// Shows a floating debug panel in the app when SYNC_DEBUG=true

interface SyncEvent {
    time: string;
    source: string;
    value: number;
    message: string;
    type: 'info' | 'warn' | 'error' | 'success';
}

class SyncDebugger {
    private events: SyncEvent[] = [];
    private listeners: ((events: SyncEvent[]) => void)[] = [];
    public enabled: boolean = true;

    log(source: string, value: number, message: string, type: SyncEvent['type'] = 'info') {
        const event: SyncEvent = {
            time: new Date().toLocaleTimeString('en-AU', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            source,
            value,
            message,
            type
        };
        this.events.unshift(event); // newest first
        if (this.events.length > 30) this.events = this.events.slice(0, 30);
        
        // Also log to console with colour
        const style = type === 'error' ? 'color: red' : type === 'warn' ? 'color: orange' : type === 'success' ? 'color: lime' : 'color: cyan';
        console.log(`%c[SYNC ${source}] ${message} | value=${value}`, style);
        
        this.listeners.forEach(l => l([...this.events]));
    }

    subscribe(listener: (events: SyncEvent[]) => void) {
        this.listeners.push(listener);
        return () => { this.listeners = this.listeners.filter(l => l !== listener); };
    }

    getEvents() { return [...this.events]; }
    clear() { this.events = []; this.listeners.forEach(l => l([])); }
}

export const syncDebugger = new SyncDebugger();
export type { SyncEvent };