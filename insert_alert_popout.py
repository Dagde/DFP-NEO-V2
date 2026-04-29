#!/usr/bin/env python3

with open('/workspace/components/FlightDetailModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the line with Delete Choice Modal comment
target = '            {showDeleteChoice && ('

alert_popout = '''            {/* ── Alert Popout ─────────────────────────────────────────────────────── */}
            {showAlertPopout && (
                <div className="fixed inset-0 bg-black/75 z-[85] flex items-center justify-center animate-fade-in" onClick={() => setShowAlertPopout(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm border border-amber-500/50" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-4 border-b border-gray-700 bg-amber-900/20 flex items-center space-x-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <h2 className="text-lg font-bold text-amber-400">Send Alert</h2>
                        </div>
                        {/* Body */}
                        <div className="p-5 space-y-4">
                            <p className="text-gray-300 text-sm">
                                Select the pilot(s) to notify about the schedule change for <span className="font-bold text-white">{event.flightNumber}</span>:
                            </p>
                            {/* Recipient checkboxes */}
                            <div className="space-y-2">
                                {(() => {
                                    const pilots: string[] = [];
                                    if (event.flightType === \'Solo\' && event.pilot) {
                                        pilots.push(event.pilot);
                                    } else {
                                        if (event.instructor) pilots.push(event.instructor);
                                        if (event.student) pilots.push(event.student);
                                    }
                                    return pilots.map(pilot => (
                                        <label key={pilot} className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 accent-amber-500"
                                                checked={alertSelectedRecipients.includes(pilot)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setAlertSelectedRecipients(prev => [...prev, pilot]);
                                                    } else {
                                                        setAlertSelectedRecipients(prev => prev.filter(p => p !== pilot));
                                                    }
                                                }}
                                            />
                                            <span className="text-white text-sm font-medium">{pilot}</span>
                                            {alertData?.responses?.[pilot] && (
                                                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
                                                    alertData.responses[pilot].status === \'accepted\' ? \'bg-green-800 text-green-200\' :
                                                    alertData.responses[pilot].status === \'rejected\' ? \'bg-red-800 text-red-200\' :
                                                    \'bg-amber-800 text-amber-200\'
                                                }`}>
                                                    {alertData.responses[pilot].status.toUpperCase()}
                                                </span>
                                            )}
                                        </label>
                                    ));
                                })()}
                            </div>
                            {/* Alert status summary if already sent */}
                            {alertData && (
                                <div className="p-3 bg-gray-700/30 rounded-lg border border-gray-600">
                                    <p className="text-xs text-gray-400">Previously sent: <span className="text-gray-200">{new Date(alertData.sentAt).toLocaleString()}</span></p>
                                </div>
                            )}
                        </div>
                        {/* Footer */}
                        <div className="p-4 border-t border-gray-700 flex gap-3 justify-end">
                            <button
                                onClick={() => setShowAlertPopout(false)}
                                className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md"
                            >
                                <span className="text-center leading-tight">Cancel</span>
                            </button>
                            <button
                                disabled={alertSelectedRecipients.length === 0}
                                onClick={() => {
                                    if (onSendAlert && alertSelectedRecipients.length > 0) {
                                        onSendAlert(event.id, alertSelectedRecipients);
                                        setShowAlertPopout(false);
                                    }
                                }}
                                className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${alertSelectedRecipients.length === 0 ? \'opacity-50 cursor-not-allowed\' : \'\'}`}
                            >
                                <span className="text-center leading-tight" style={{ color: \'#f59e0b\' }}>SEND<br/>ALERT</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

'''

idx = content.find(target)
if idx == -1:
    print("ERROR: target string not found")
    exit(1)

# Find the start of that line (go back to newline)
line_start = content.rfind('\n', 0, idx) + 1
new_content = content[:line_start] + alert_popout + content[line_start:]

with open('/workspace/components/FlightDetailModal.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("SUCCESS: Alert popout inserted")
print(f"File size: {len(new_content)} chars")