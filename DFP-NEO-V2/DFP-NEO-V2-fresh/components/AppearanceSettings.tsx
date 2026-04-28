import React from 'react';
import { useTheme, AppTheme } from '../context/ThemeContext';

const AppearanceSettings: React.FC = () => {
    const { theme, setTheme } = useTheme();

    const options: { value: AppTheme; label: string; description: string }[] = [
        {
            value: 'dark',
            label: 'Dark Mode',
            description: 'Dark backgrounds with light text. Optimised for low-light environments.',
        },
        {
            value: 'light',
            label: 'Light Mode',
            description: 'Light backgrounds with dark text. Optimised for bright environments.',
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-base font-semibold text-white mb-1">Theme</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Choose how DFP-NEO looks on your device. Your preference is saved locally.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                    {options.map((opt) => {
                        const isSelected = theme === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => setTheme(opt.value)}
                                className={`relative flex flex-col gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer
                                    ${isSelected
                                        ? 'border-sky-500 bg-sky-500/10'
                                        : 'border-gray-700 bg-gray-800 hover:border-gray-500 hover:bg-gray-700/60'
                                    }`}
                            >
                                {/* Theme preview card */}
                                <div
                                    className={`w-full h-24 rounded-lg overflow-hidden border ${isSelected ? 'border-sky-500/40' : 'border-gray-600'} flex-shrink-0`}
                                    style={{
                                        background: opt.value === 'dark'
                                            ? 'linear-gradient(135deg, #111827 0%, #1f2937 100%)'
                                            : 'linear-gradient(135deg, #f1f5f9 0%, #ffffff 100%)',
                                    }}
                                >
                                    {/* Mini app chrome preview */}
                                    <div className="flex h-full">
                                        {/* Sidebar */}
                                        <div
                                            className="w-8 h-full flex-shrink-0"
                                            style={{
                                                background: opt.value === 'dark' ? '#0f172a' : '#1e293b',
                                            }}
                                        >
                                            <div className="flex flex-col gap-1 pt-2 items-center">
                                                {[1,2,3,4].map(i => (
                                                    <div
                                                        key={i}
                                                        className="rounded"
                                                        style={{
                                                            width: 20,
                                                            height: 8,
                                                            background: i === 1
                                                                ? '#0ea5e9'
                                                                : opt.value === 'dark' ? '#374151' : '#334155',
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        {/* Main area */}
                                        <div className="flex-1 p-2 flex flex-col gap-1.5">
                                            {/* Header bar */}
                                            <div
                                                className="w-full rounded h-3"
                                                style={{
                                                    background: opt.value === 'dark' ? '#1f2937' : '#e2e8f0',
                                                }}
                                            />
                                            {/* Content rows */}
                                            <div className="flex gap-1.5">
                                                <div
                                                    className="rounded flex-1 h-2"
                                                    style={{
                                                        background: opt.value === 'dark' ? '#374151' : '#cbd5e1',
                                                    }}
                                                />
                                                <div
                                                    className="rounded h-2"
                                                    style={{
                                                        width: 30,
                                                        background: '#0ea5e9',
                                                    }}
                                                />
                                            </div>
                                            {[1,2,3].map(i => (
                                                <div
                                                    key={i}
                                                    className="w-full rounded h-2"
                                                    style={{
                                                        background: opt.value === 'dark'
                                                            ? (i % 2 === 0 ? '#374151' : '#1f2937')
                                                            : (i % 2 === 0 ? '#e2e8f0' : '#f1f5f9'),
                                                        opacity: 0.8,
                                                    }}
                                                />
                                            ))}
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
                                    <div>
                                        <p className="text-sm font-semibold text-white leading-tight">
                                            {opt.label}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5 leading-snug">
                                            {opt.description}
                                        </p>
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
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-700/30 border border-gray-700 rounded-lg px-3 py-2 max-w-2xl">
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