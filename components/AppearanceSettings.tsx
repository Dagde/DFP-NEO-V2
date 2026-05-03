import React from 'react';
import { useTheme, AppTheme } from '../context/ThemeContext';

const AppearanceSettings: React.FC = () => {
    const { theme, setTheme } = useTheme();

    const options: { value: AppTheme; label: string; description: string; tags: string[] }[] = [
        {
            value: 'dark',
            label: 'Dark Mode',
            description: 'Dark backgrounds with light text. Optimised for low-light environments.',
            tags: ['Low light', 'High contrast', 'Default'],
        },
        {
            value: 'light',
            label: 'Light Mode',
            description: 'Clean daylight surfaces with dark text, navy chrome, and softer operational panels.',
            tags: ['Bright rooms', 'Readable tables', 'Daylight'],
        },
    ];

    return (
        <div className="space-y-6">
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-5">
                <h3 className="text-lg font-bold text-white mb-1">Appearance</h3>
                <p className="text-sm text-gray-400 max-w-3xl">
                    Choose the operational colour system for this device. Light mode now re-themes panels, tables,
                    controls, menus, overlays, and common status surfaces rather than only changing the background.
                </p>
            </div>

            <div>
                <div className="grid grid-cols-1 gap-4 max-w-5xl xl:grid-cols-2">
                    {options.map((opt) => {
                        const isSelected = theme === opt.value;
                        const isLight = opt.value === 'light';
                        return (
                            <button
                                key={opt.value}
                                onClick={() => setTheme(opt.value)}
                                className={`relative flex flex-col gap-4 p-4 rounded-lg border-2 text-left transition-all duration-200 cursor-pointer
                                    ${isSelected
                                        ? 'border-sky-500 bg-sky-500/10 shadow-lg'
                                        : 'border-gray-700 bg-gray-800 hover:border-gray-500 hover:bg-gray-700/60'
                                    }`}
                            >
                                {/* Theme preview card */}
                                <div
                                    className={`w-full h-40 rounded-lg overflow-hidden border ${isSelected ? 'border-sky-500/40' : 'border-gray-600'} flex-shrink-0`}
                                    style={{
                                        background: !isLight
                                            ? 'linear-gradient(135deg, #111827 0%, #1f2937 100%)'
                                            : 'linear-gradient(135deg, #eef4f8 0%, #ffffff 100%)',
                                    }}
                                >
                                    <div className="flex h-full">
                                        <div
                                            className="w-14 h-full flex-shrink-0"
                                            style={{
                                                background: !isLight ? '#0f172a' : '#142235',
                                            }}
                                        >
                                            <div className="flex flex-col gap-2 pt-3 items-center">
                                                {[1,2,3,4,5].map(i => (
                                                    <div
                                                        key={i}
                                                        className="rounded-sm"
                                                        style={{
                                                            width: i === 1 ? 32 : 26,
                                                            height: 8,
                                                            background: i === 1
                                                                ? '#0ea5e9'
                                                                : !isLight ? '#374151' : '#34465c',
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex-1 p-3 flex flex-col gap-3">
                                            <div
                                                className="w-full rounded h-5"
                                                style={{
                                                    background: !isLight ? '#1f2937' : '#ffffff',
                                                    border: !isLight ? '1px solid #374151' : '1px solid #c5d3e1',
                                                }}
                                            />
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    ['#0ea5e9', '#38bdf8'],
                                                    ['#8b5cf6', '#a78bfa'],
                                                    ['#d97706', '#f59e0b'],
                                                ].map(([accent, fill], index) => (
                                                    <div
                                                        key={index}
                                                        className="rounded"
                                                        style={{
                                                            height: 28,
                                                            background: !isLight ? '#1f2937' : '#ffffff',
                                                            border: `1px solid ${isLight ? '#c5d3e1' : '#374151'}`,
                                                            boxShadow: isLight ? '0 4px 12px rgba(15,23,42,0.08)' : 'none',
                                                        }}
                                                    >
                                                        <div style={{ height: 4, background: accent, borderRadius: '3px 3px 0 0' }} />
                                                        <div style={{ margin: 6, height: 7, background: fill, opacity: 0.55, borderRadius: 4 }} />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex gap-2">
                                                <div
                                                    className="rounded flex-1"
                                                    style={{
                                                        height: 48,
                                                        background: !isLight ? '#1f2937' : '#ffffff',
                                                        border: !isLight ? '1px solid #374151' : '1px solid #c5d3e1',
                                                    }}
                                                >
                                                    {[1,2,3].map(i => (
                                                        <div
                                                            key={i}
                                                            style={{
                                                                height: 6,
                                                                margin: '7px 8px',
                                                                borderRadius: 4,
                                                                background: !isLight
                                                                    ? (i === 1 ? '#64748b' : '#374151')
                                                                    : (i === 1 ? '#26384d' : '#dce6ef'),
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                <div
                                                    className="rounded"
                                                    style={{
                                                        width: 60,
                                                        height: 48,
                                                        background: !isLight ? '#0f172a' : '#e8f1f8',
                                                        border: !isLight ? '1px solid #334155' : '1px solid #c5d3e1',
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Label row */}
                                <div className="flex items-start gap-3">
                                    {/* Radio circle */}
                                    <div
                                        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center
                                            ${isSelected ? 'border-sky-500' : 'border-gray-500'}`}
                                    >
                                        {isSelected && (
                                            <div className="w-2 h-2 rounded-full bg-sky-500" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white leading-tight">
                                            {opt.label}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5 leading-snug">
                                            {opt.description}
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {opt.tags.map(tag => (
                                                <span key={tag} className="rounded border border-gray-700 bg-gray-900/40 px-2 py-1 text-[11px] font-semibold text-gray-400">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Selected checkmark */}
                                {isSelected && (
                                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center">
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Current status */}
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-700/30 border border-gray-700 rounded-lg px-3 py-2 max-w-5xl">
                <svg className="w-4 h-4 text-sky-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                    Currently using <strong className="text-gray-200">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</strong>. Your preference is saved in your browser.
                </span>
            </div>
        </div>
    );
};

export default AppearanceSettings;
