with open('components/FlightDetailModal.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')

# New alert panel (lines 2374-2444 inclusive, 0-indexed)
new_panel = r"""            {/* ── Alert Panel Modal ────────────────────────────────────────── */}
            {showAlertPanel && canSendAlert && onSendAlert && (
                <div className="fixed inset-0 bg-black/75 z-[85] flex items-center justify-center animate-fade-in" onClick={() => setShowAlertPanel(false)}>
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
                            {/* Already-sent state: show details from alertData */}
                            {(alertSent || alertData) ? (
                                <div className="space-y-3">
                                    {/* Sent confirmation banner */}
                                    <div className="bg-green-900/30 border border-green-600/40 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-green-400 text-sm font-semibold">&#x2705; Alert Sent</span>
                                        </div>
                                        {alertData?.sentAt && (
                                            <p className="text-gray-400 text-xs">
                                                {new Date(alertData.sentAt).toLocaleString('en-AU', {
                                                    day: '2-digit', month: 'short', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit', hour12: false
                                                })}
                                            </p>
                                        )}
                                    </div>
                                    {/* Recipients with response status */}
                                    {alertData?.recipients && alertData.recipients.length > 0 && (
                                        <div>
                                            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Recipients</p>
                                            <div className="space-y-1">
                                                {alertData.recipients.map((r: string) => {
                                                    const response = alertData?.responses?.[r];
                                                    return (
                                                        <div key={r} className="flex items-center justify-between px-3 py-2 bg-gray-700/50 rounded-lg">
                                                            <span className="text-white text-sm">{r}</span>
                                                            {response ? (
                                                                <div className="text-right">
                                                                    <span className={`text-xs font-bold ${response.status === 'accepted' ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {response.status === 'accepted' ? '\u2713 Accepted' : '\u2717 Rejected'}
                                                                    </span>
                                                                    {response.respondedAt && (
                                                                        <p className="text-gray-400 text-[10px]">
                                                                            {new Date(response.respondedAt).toLocaleString('en-AU', {
                                                                                day: '2-digit', month: 'short',
                                                                                hour: '2-digit', minute: '2-digit', hour12: false
                                                                            })}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-amber-400 text-xs">Pending...</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {/* Show sent recipients from local state if alertData not yet refreshed */}
                                    {alertSent && !alertData && alertRecipients.length > 0 && (
                                        <div>
                                            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Recipients</p>
                                            <div className="space-y-1">
                                                {alertRecipients.map((r) => (
                                                    <div key={r} className="flex items-center justify-between px-3 py-2 bg-gray-700/50 rounded-lg">
                                                        <span className="text-white text-sm">{r}</span>
                                                        <span className="text-amber-400 text-xs">Pending...</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Not yet sent: show recipient selection */
                                <>
                                    <p className="text-gray-300 text-sm">
                                        Select recipients to notify about <span className="font-bold text-white">{event.flightNumber}</span>:
                                    </p>
                                    <div className="space-y-2">
                                        {(() => {
                                            const rawPeople: string[] = [];
                                            if (event.flightType === 'Solo' && event.pilot) {
                                                rawPeople.push(event.pilot);
                                            } else {
                                                if (event.instructor) rawPeople.push(event.instructor);
                                                if (event.student) rawPeople.push(event.student);
                                                if (event.pilot) rawPeople.push(event.pilot);
                                            }
                                            const uniquePeople = rawPeople.filter((p, i, arr) => arr.indexOf(p) === i);
                                            return uniquePeople.length > 0 ? uniquePeople.map((person) => (
                                                <label key={person} className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={alertRecipients.includes(person)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setAlertRecipients(prev => [...prev, person]);
                                                            } else {
                                                                setAlertRecipients(prev => prev.filter(r => r !== person));
                                                            }
                                                        }}
                                                        className="w-4 h-4 accent-amber-500"
                                                    />
                                                    <span className="text-white text-sm font-medium">{person}</span>
                                                    <span className="text-gray-400 text-xs ml-auto">
                                                        {person === event.instructor ? 'Instructor' : person === event.student ? 'Student' : 'Pilot'}
                                                    </span>
                                                </label>
                                            )) : (
                                                <p className="text-gray-400 text-sm text-center py-2">No personnel assigned to this event.</p>
                                            );
                                        })()}
                                    </div>
                                </>
                            )}
                        </div>
                        {/* Footer */}
                        <div className="p-4 border-t border-gray-700 flex gap-[1px] justify-end">
                            <button
                                onClick={() => setShowAlertPanel(false)}
                                className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md"
                            >
                                <span className="text-center leading-tight">Close</span>
                            </button>
                            {!(alertSent || alertData) && (
                                <button
                                    disabled={alertRecipients.length === 0}
                                    onClick={async () => {
                                        console.log('\ud83d\udd14 [Alert] Send button clicked - eventId:', event.id, 'recipients:', alertRecipients);
                                        await onSendAlert(event.id, alertRecipients);
                                        setAlertSent(true);
                                    }}
                                    className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${alertRecipients.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className="text-center leading-tight" style={{ color: '#000000' }}>SEND<br/>ALERT</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}"""

# Replace lines 2374-2444 (0-indexed)
new_lines = lines[:2374] + new_panel.split('\n') + lines[2445:]
new_content = '\n'.join(new_lines)

with open('components/FlightDetailModal.tsx', 'w') as f:
    f.write(new_content)

print(f"Done! Replaced lines 2374-2444 with new alert panel ({len(new_panel.split(chr(10)))} lines)")
print(f"File now has {len(new_content.split(chr(10)))} lines")