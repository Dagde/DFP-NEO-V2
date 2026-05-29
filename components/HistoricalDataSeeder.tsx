import React, { useState, useEffect } from 'react';
import { getAppApiBase } from '../utils/externalDataControls';

interface SeedingMetadata {
    seededAt?: string;
    traineeCount?: number;
    eventCount?: number;
    pt051Count?: number;
    scoresInserted?: number;
    scoresSkipped?: number;
    coursesSeeded?: string[];
    lastRefreshed?: string;
    daysDriftApplied?: number;
}

interface HistoricalDataSeederProps {
    onClose: () => void;
    onDataSeeded?: () => void;
}

const apiBase = () => getAppApiBase();

export const HistoricalDataSeeder: React.FC<HistoricalDataSeederProps> = ({ onClose, onDataSeeded }) => {
    const [status, setStatus] = useState<'idle' | 'loading' | 'seeding' | 'refreshing' | 'clearing' | 'done' | 'error'>('idle');
    const [metadata, setMetadata] = useState<SeedingMetadata | null>(null);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);

    useEffect(() => {
        loadStatus();
    }, []);

    const loadStatus = async () => {
        setStatus('loading');
        setError(null);
        try {
            const res = await fetch(`${apiBase()}/historical-data`);
            if (res.ok) {
                const data = await res.json();
                setMetadata(data.seedingMetadata || null);
            }
        } catch (e) {
            console.warn('Could not load historical data status');
        }
        setStatus('idle');
    };

    const handleSeed = async (force = false) => {
        setShowConfirm(false);
        setStatus('seeding');
        setError(null);
        setResult(null);
        try {
            const res = await fetch(`${apiBase()}/historical-data/seed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force }),
            });
            const data = await res.json();
            if (data.alreadySeeded && !force) {
                setMetadata(data);
                setStatus('idle');
                setError(`Data already seeded on ${new Date(data.seededAt).toLocaleDateString()}. Use "Force Reseed" to regenerate.`);
                return;
            }
            if (!data.success) {
                throw new Error(data.error || data.message || 'Seeding failed');
            }
            setResult(data);
            setMetadata(data);
            setStatus('done');
            if (onDataSeeded) {
                // Reload the page to pick up new historical data
                setTimeout(() => window.location.reload(), 2000);
            }
        } catch (e: any) {
            setError(e.message || 'Unknown error');
            setStatus('error');
        }
    };

    const handleRefreshDates = async () => {
        setShowRefreshConfirm(false);
        setStatus('refreshing');
        setError(null);
        setResult(null);
        try {
            const res = await fetch(`${apiBase()}/historical-data/refresh-dates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Refresh failed');
            }
            setResult(data);
            setStatus('done');
            setTimeout(() => window.location.reload(), 2000);
        } catch (e: any) {
            setError(e.message || 'Unknown error');
            setStatus('error');
        }
    };

    const handleClear = async () => {
        setShowClearConfirm(false);
        setStatus('clearing');
        setError(null);
        try {
            const res = await fetch(`${apiBase()}/historical-data`, { method: 'DELETE' });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Clear failed');
            setMetadata(null);
            setResult({ cleared: true, scoresDeleted: data.scoresDeleted });
            setStatus('done');
            setTimeout(() => window.location.reload(), 2000);
        } catch (e: any) {
            setError(e.message || 'Unknown error');
            setStatus('error');
        }
    };

    const isSeeded = !!metadata?.seededAt;
    const isProcessing = ['seeding', 'refreshing', 'clearing', 'loading'].includes(status);

    return (
        <div className="w-full">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-white text-xl font-bold">Historical Training Data</h2>
                        <p className="text-gray-400 text-sm mt-0.5">One-off seeding & date refresh controls</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded">← Back</button>
                </div>

                {/* Status Banner */}
                {isSeeded && (
                    <div className="bg-green-900/40 border border-green-700 rounded-lg p-3 mb-4 flex items-start gap-2">
                        <span className="text-green-400 text-lg">✓</span>
                        <div className="text-sm">
                            <p className="text-green-300 font-medium">Historical data is seeded</p>
                            <p className="text-green-400/70 mt-0.5">
                                Seeded {new Date(metadata!.seededAt!).toLocaleDateString()} · {metadata?.eventCount?.toLocaleString()} events · {metadata?.pt051Count?.toLocaleString()} PT-051s
                            </p>
                            {metadata?.lastRefreshed && (
                                <p className="text-green-400/70">Last refreshed: {new Date(metadata.lastRefreshed).toLocaleDateString()}</p>
                            )}
                            <p className="text-green-400/60 text-xs mt-1">
                                Courses: {(metadata?.coursesSeeded || []).join(', ')}
                            </p>
                        </div>
                    </div>
                )}

                {!isSeeded && status !== 'loading' && (
                    <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-3 mb-4 flex items-start gap-2">
                        <span className="text-amber-400 text-lg">⚠</span>
                        <div className="text-sm">
                            <p className="text-amber-300 font-medium">No historical data seeded yet</p>
                            <p className="text-amber-400/70 mt-0.5">Run the one-off seed to generate training history for all active trainees.</p>
                        </div>
                    </div>
                )}

                {/* Description */}
                <div className="bg-gray-800 rounded-lg p-4 mb-4 text-sm text-gray-300 space-y-2">
                    <p><span className="text-white font-medium">One-off Seed:</span> Generates completed training records, PT-051 assessments, and logbook entries for all active trainees across ADF301, ADF302, ADF303, FIC210, and FIC211 using real instructors and course start dates.</p>
                    <p><span className="text-white font-medium">Refresh Dates:</span> Shifts all historical event dates forward to keep the training history current-looking relative to today. Run periodically.</p>
                    <p className="text-amber-300/70 text-xs">⚠ Seeding affects real persistent data. Use with care.</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 mb-4 text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {/* Result */}
                {result && status === 'done' && (
                    <div className="bg-blue-900/40 border border-blue-700 rounded-lg p-3 mb-4 text-sm">
                        {result.cleared ? (
                            <p className="text-blue-300">✓ Historical data cleared. {result.scoresDeleted} scores deleted. Reloading…</p>
                        ) : result.daysDriftApplied !== undefined ? (
                            <p className="text-blue-300">✓ Dates shifted +{result.daysDriftApplied} days. {result.datesUpdated} dates updated, {result.scoresUpdated} scores updated. Reloading…</p>
                        ) : (
                            <div className="text-blue-300 space-y-1">
                                <p>✓ Seeding complete. Reloading…</p>
                                <p className="text-blue-400/70 text-xs">{result.eventCount?.toLocaleString()} events · {result.pt051Count?.toLocaleString()} PT-051s · {result.scoresInserted} scores saved</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Processing indicator */}
                {isProcessing && (
                    <div className="flex items-center gap-3 text-blue-300 text-sm mb-4">
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        {status === 'seeding' ? 'Generating historical data…' :
                         status === 'refreshing' ? 'Refreshing dates…' :
                         status === 'clearing' ? 'Clearing historical data…' :
                         'Loading…'}
                    </div>
                )}

                {/* Confirm dialogs */}
                {showConfirm && (
                    <div className="bg-amber-900/50 border border-amber-600 rounded-lg p-4 mb-4">
                        <p className="text-amber-200 text-sm font-medium mb-2">
                            {isSeeded ? '⚠ This will RESEED all historical data. Existing seeded records will be replaced.' : '⚠ This will seed historical training records for all active trainees.'}
                        </p>
                        <p className="text-amber-300/70 text-xs mb-3">This is a one-off action. Ensure no duplicate records exist before proceeding.</p>
                        <div className="flex gap-2">
                            <button onClick={() => handleSeed(isSeeded)} className="bg-amber-600 hover:bg-amber-500 text-white text-sm px-4 py-1.5 rounded font-medium">
                                Confirm {isSeeded ? 'Reseed' : 'Seed'}
                            </button>
                            <button onClick={() => setShowConfirm(false)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-4 py-1.5 rounded">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {showRefreshConfirm && (
                    <div className="bg-blue-900/50 border border-blue-600 rounded-lg p-4 mb-4">
                        <p className="text-blue-200 text-sm font-medium mb-2">Shift all historical event dates forward to keep the training history current?</p>
                        <p className="text-blue-300/70 text-xs mb-3">This preserves event sequence and spacing. Only past completed records are updated.</p>
                        <div className="flex gap-2">
                            <button onClick={handleRefreshDates} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-1.5 rounded font-medium">
                                Confirm Refresh
                            </button>
                            <button onClick={() => setShowRefreshConfirm(false)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-4 py-1.5 rounded">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {showClearConfirm && (
                    <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 mb-4">
                        <p className="text-red-200 text-sm font-medium mb-2">⚠ This will permanently delete ALL seeded historical data including scores from the database.</p>
                        <div className="flex gap-2">
                            <button onClick={handleClear} className="bg-red-700 hover:bg-red-600 text-white text-sm px-4 py-1.5 rounded font-medium">
                                Confirm Clear All
                            </button>
                            <button onClick={() => setShowClearConfirm(false)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-4 py-1.5 rounded">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                {!isProcessing && !showConfirm && !showRefreshConfirm && !showClearConfirm && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={isProcessing}
                            className="bg-green-700 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                        >
                            {isSeeded ? '↺ Reseed Historical Data' : '▶ Seed Historical Data'}
                        </button>
                        {isSeeded && (
                            <button
                                onClick={() => setShowRefreshConfirm(true)}
                                disabled={isProcessing}
                                className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                            >
                                📅 Refresh Dates
                            </button>
                        )}
                        {isSeeded && (
                            <button
                                onClick={() => setShowClearConfirm(true)}
                                disabled={isProcessing}
                                className="bg-red-800 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                            >
                                🗑 Clear All
                            </button>
                        )}
                        <button onClick={onClose} className="ml-auto bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-4 py-2 rounded-lg">
                            ← Back
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoricalDataSeeder;
