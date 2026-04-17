import React from 'react';

/**
 * Full-screen dark overlay shown while the Pause Build engine is running.
 * Matches the exact same pattern as BuildDfpLoadingFlyout (fixed inset-0, z-[90]).
 * Contains a spinning propeller SVG animation centred in a dark card.
 */
const PropellerLoadingOverlay: React.FC = () => {
    return (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center animate-fade-in">
            <div className="bg-gray-800 rounded-lg shadow-xl border border-sky-500 p-8 flex flex-col items-center gap-6" style={{ width: 320, minHeight: 300 }}>

                {/* Spinning propeller */}
                <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="160"
                        height="160"
                        viewBox="0 0 160 160"
                        style={{ animation: 'propSpin 0.65s linear infinite', display: 'block' }}
                    >
                        {/* ── Blade 1 (pointing up) ── */}
                        <ellipse cx="80" cy="34" rx="12" ry="46" fill="#60a5fa" opacity="0.85" />
                        {/* ── Blade 2 (120° clockwise) ── */}
                        <ellipse cx="80" cy="34" rx="12" ry="46" fill="#60a5fa" opacity="0.85"
                            transform="rotate(120 80 80)" />
                        {/* ── Blade 3 (240° clockwise) ── */}
                        <ellipse cx="80" cy="34" rx="12" ry="46" fill="#60a5fa" opacity="0.85"
                            transform="rotate(240 80 80)" />
                        {/* ── Hub ── */}
                        <circle cx="80" cy="80" r="14" fill="#1e3a5f" stroke="#60a5fa" strokeWidth="2.5" />
                        <circle cx="80" cy="80" r="6" fill="#93c5fd" />
                    </svg>

                    {/* Keyframe injected via style tag */}
                    <style>{`
                        @keyframes propSpin {
                            from { transform: rotate(0deg); }
                            to   { transform: rotate(360deg); }
                        }
                        @keyframes dotFade {
                            0%, 80%, 100% { opacity: 0.2; }
                            40%           { opacity: 1; }
                        }
                    `}</style>
                </div>

                {/* Text */}
                <div className="flex flex-col items-center gap-2 text-center">
                    <p className="text-xl font-semibold text-white">Please wait</p>
                    <p className="text-sm text-sky-300 font-medium">Engine warming up…</p>
                    <p className="text-xs text-gray-400">Rebuilding schedule after ops pause</p>

                    {/* Animated dots */}
                    <div className="flex gap-1.5 mt-1">
                        {[0, 1, 2].map(i => (
                            <span
                                key={i}
                                className="w-2 h-2 rounded-full bg-sky-400 inline-block"
                                style={{ animation: `dotFade 1.4s ease-in-out ${i * 0.28}s infinite` }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PropellerLoadingOverlay;