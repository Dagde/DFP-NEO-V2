import React, { useState, useEffect } from 'react';
import { syncDebugger, SyncEvent } from '../utils/syncDebugger';

const SyncDebugPanel: React.FC = () => {
    const [events, setEvents] = useState<SyncEvent[]>([]);
    const [visible, setVisible] = useState(true);
    const [minimized, setMinimized] = useState(false);

    useEffect(() => {
        const unsub = syncDebugger.subscribe(setEvents);
        setEvents(syncDebugger.getEvents());
        return unsub;
    }, []);

    const typeColor = (type: SyncEvent['type']) => {
        switch (type) {
            case 'success': return 'text-green-400';
            case 'warn':    return 'text-yellow-400';
            case 'error':   return 'text-red-400';
            default:        return 'text-cyan-400';
        }
    };

    if (!visible) return (
        <button
            onClick={() => setVisible(true)}
            className="fixed bottom-16 left-2 z-[9999] bg-gray-900 border border-cyan-500 text-cyan-400 text-[9px] font-mono px-2 py-1 rounded"
        >
            SYNC DBG
        </button>
    );

    return (
        <div
            className="fixed bottom-16 left-2 z-[9999] bg-gray-950 border border-cyan-600 rounded-lg shadow-2xl font-mono text-[9px]"
            style={{ width: 320, maxHeight: minimized ? 32 : 280 }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-2 py-1 bg-gray-900 rounded-t-lg border-b border-cyan-800">
                <span className="text-cyan-400 font-bold text-[10px]">
                    ⚡ SYNC DEBUG &nbsp;
                    <span className="text-gray-500 font-normal">
                        {typeof __COMMIT_HASH__ !== 'undefined' ? `commit: ${__COMMIT_HASH__}` : ''}
                    </span>
                </span>
                <div className="flex gap-1">
                    <button onClick={() => syncDebugger.clear()} className="text-gray-500 hover:text-yellow-400 px-1">CLR</button>
                    <button onClick={() => setMinimized(!minimized)} className="text-gray-500 hover:text-white px-1">{minimized ? '▲' : '▼'}</button>
                    <button onClick={() => setVisible(false)} className="text-gray-500 hover:text-red-400 px-1">✕</button>
                </div>
            </div>

            {/* Events */}
            {!minimized && (
                <div className="overflow-y-auto p-1" style={{ maxHeight: 248 }}>
                    {events.length === 0 ? (
                        <div className="text-gray-600 p-2 text-center">No sync events yet.<br/>Move the slider or drag the line.</div>
                    ) : (
                        events.map((e, i) => (
                            <div key={i} className={`flex gap-1 py-0.5 border-b border-gray-800 ${typeColor(e.type)}`}>
                                <span className="text-gray-600 shrink-0">{e.time}</span>
                                <span className="text-gray-400 shrink-0 w-16 truncate">[{e.source}]</span>
                                <span className="text-yellow-300 shrink-0 w-6 text-right">{e.value}</span>
                                <span className="truncate">{e.message}</span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default SyncDebugPanel;