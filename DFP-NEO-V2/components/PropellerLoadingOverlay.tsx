import React from 'react';

interface PropellerLoadingOverlayProps {
    message?: string;
}

/**
 * Full-screen dark overlay shown while the Pause Build engine is running.
 * Features a spinning aircraft propeller SVG animation centred in a dark card.
 */
const PropellerLoadingOverlay: React.FC<PropellerLoadingOverlayProps> = ({
    message = 'Engine warming up — please wait…',
}) => {
    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
        >
            {/* Card */}
            <div
                className="flex flex-col items-center justify-center gap-6 rounded-xl border border-gray-700 shadow-2xl"
                style={{
                    background: 'linear-gradient(145deg, #1a1f2e 0%, #111827 60%, #0d1117 100%)',
                    width: '300px',
                    height: '300px',
                    minWidth: '260px',
                    minHeight: '260px',
                }}
            >
                {/* Propeller SVG */}
                <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
                    {/* Hub circle (static) */}
                    <div
                        className="absolute rounded-full z-10"
                        style={{
                            width: 22,
                            height: 22,
                            background: 'radial-gradient(circle at 35% 35%, #6b7280, #374151)',
                            border: '2px solid #4b5563',
                            boxShadow: '0 0 8px rgba(0,0,0,0.8)',
                        }}
                    />

                    {/* Spinning blades */}
                    <svg
                        viewBox="0 0 140 140"
                        width="140"
                        height="140"
                        style={{
                            animation: 'propeller-spin 0.7s linear infinite',
                            transformOrigin: '70px 70px',
                        }}
                    >
                        <defs>
                            <radialGradient id="blade-grad" cx="50%" cy="30%" r="70%">
                                <stop offset="0%" stopColor="#9ca3af" />
                                <stop offset="100%" stopColor="#374151" />
                            </radialGradient>
                            <filter id="blade-blur">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="0.4" />
                            </filter>
                        </defs>

                        {/* Blade 1 — top */}
                        <ellipse
                            cx="70" cy="32"
                            rx="9" ry="38"
                            fill="url(#blade-grad)"
                            opacity="0.92"
                            filter="url(#blade-blur)"
                        />
                        {/* Blade 2 — bottom-right */}
                        <ellipse
                            cx="70" cy="32"
                            rx="9" ry="38"
                            fill="url(#blade-grad)"
                            opacity="0.92"
                            filter="url(#blade-blur)"
                            transform="rotate(120 70 70)"
                        />
                        {/* Blade 3 — bottom-left */}
                        <ellipse
                            cx="70" cy="32"
                            rx="9" ry="38"
                            fill="url(#blade-grad)"
                            opacity="0.92"
                            filter="url(#blade-blur)"
                            transform="rotate(240 70 70)"
                        />

                        {/* Spinner / nose cone */}
                        <circle cx="70" cy="70" r="10"
                            fill="radial-gradient(circle, #6b7280, #1f2937)"
                            style={{ fill: '#4b5563' }}
                        />
                        <circle cx="70" cy="70" r="5"
                            style={{ fill: '#9ca3af' }}
                        />
                    </svg>
                </div>

                {/* Text */}
                <div className="flex flex-col items-center gap-1.5 px-6">
                    <span className="text-sm font-semibold text-sky-300 text-center leading-snug">
                        {message}
                    </span>
                    {/* Animated dots */}
                    <span className="text-xs text-gray-500" style={{ animation: 'none' }}>
                        <AnimatedDots />
                    </span>
                </div>
            </div>

            {/* Inline keyframes */}
            <style>{`
                @keyframes propeller-spin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
                @keyframes dot-blink {
                    0%, 80%, 100% { opacity: 0; }
                    40%           { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

/** Three animated dots to indicate progress */
const AnimatedDots: React.FC = () => (
    <span>
        {[0, 1, 2].map(i => (
            <span
                key={i}
                style={{
                    display: 'inline-block',
                    animation: `dot-blink 1.4s ease-in-out ${i * 0.32}s infinite`,
                    marginLeft: 1,
                }}
            >
                ●
            </span>
        ))}
    </span>
);

export default PropellerLoadingOverlay;