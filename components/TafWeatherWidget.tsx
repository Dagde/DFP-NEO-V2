import React, { useState, useEffect } from 'react';

interface TafData {
    station: string;
    raw: string;
    time: string;
    error?: string;
    isCached?: boolean;
    cacheTimestamp?: string;
}

interface TafWeatherWidgetProps {
    onClose?: () => void;
}

const DEFAULT_LOCATIONS = ['YMES', 'YMEN', 'YMAY', 'YSCB', 'YLTV'];
const AVWX_API_TOKEN = 'STWJquK4I2XUtqN-Vpw1eCIpOqmq0CHpd4LChbc17MY';
const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

const TafWeatherWidget: React.FC<TafWeatherWidgetProps> = ({ onClose }) => {
    const [locations, setLocations] = useState<string[]>(() => {
        const saved = localStorage.getItem('tafLocations');
        return saved ? JSON.parse(saved) : DEFAULT_LOCATIONS;
    });
    const [tafData, setTafData] = useState<Map<string, TafData>>(new Map());
    const [isEditing, setIsEditing] = useState(false);
    const [editLocations, setEditLocations] = useState<string[]>([]);
    const [loading, setLoading] = useState<Set<string>>(new Set());
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    // Function to highlight INTER and TEMPO with their time periods in TAF text
    const highlightTafText = (text: string) => {
        // Match INTER or TEMPO followed by optional space and time period (e.g., INTER 2201/2203 or TEMPO 2103/2112)
        const regex = /(\b(?:INTER|TEMPO)\s+\d{4}\/\d{4})/g;
        const parts = text.split(regex);
        
        return parts.map((part, index) => {
            if (part.match(regex)) {
                return <span key={index} className="text-red-400 font-bold">{part}</span>;
            }
            return <span key={index}>{part}</span>;
        });
    };

    // Fetch TAF data for a specific location
    const fetchTaf = async (icao: string) => {
        setLoading(prev => new Set(prev).add(icao));
        try {
            const response = await fetch(
                `https://avwx.rest/api/taf/${icao.toUpperCase()}?token=${AVWX_API_TOKEN}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            // Check for warnings about cached/outdated data
            const warning = data.meta?.warning;
            const cacheTimestamp = data.meta?.['cache-timestamp'];
            const isCached = !!warning;
            
            setTafData(prev => {
                const newMap = new Map(prev);
                newMap.set(icao, {
                    station: icao.toUpperCase(),
                    raw: data.raw || 'No TAF available',
                    time: new Date().toLocaleTimeString(),
                    error: undefined,
                    isCached: isCached,
                    cacheTimestamp: cacheTimestamp
                });
                return newMap;
            });
        } catch (error) {
            console.error(`Error fetching TAF for ${icao}:`, error);
            setTafData(prev => {
                const newMap = new Map(prev);
                newMap.set(icao, {
                    station: icao.toUpperCase(),
                    raw: '',
                    time: new Date().toLocaleTimeString(),
                    error: 'Failed to fetch TAF'
                });
                return newMap;
            });
        } finally {
            setLoading(prev => {
                const newSet = new Set(prev);
                newSet.delete(icao);
                return newSet;
            });
        }
    };

    // Fetch all TAFs
    const fetchAllTafs = () => {
        setLastUpdate(new Date());
        locations.forEach(location => {
            if (location.trim()) {
                fetchTaf(location.trim());
            }
        });
    };

    // Initial fetch and auto-refresh setup
    useEffect(() => {
        fetchAllTafs();
        
        const interval = setInterval(() => {
            fetchAllTafs();
        }, REFRESH_INTERVAL);

        return () => clearInterval(interval);
    }, [locations]);

    // Save locations to localStorage
    const handleSaveLocations = () => {
        const validLocations = editLocations
            .map(loc => loc.trim().toUpperCase())
            .filter(loc => loc.length >= 4);
        
        setLocations(validLocations);
        localStorage.setItem('tafLocations', JSON.stringify(validLocations));
        setIsEditing(false);
        
        // Fetch TAFs for new locations
        validLocations.forEach(location => {
            if (!tafData.has(location)) {
                fetchTaf(location);
            }
        });
    };

    const handleEditLocations = () => {
        setEditLocations([...locations]);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
    };

    const handleLocationChange = (index: number, value: string) => {
        const updated = [...editLocations];
        updated[index] = value;
        setEditLocations(updated);
    };

    const handleRefresh = (icao: string) => {
        fetchTaf(icao);
    };

    const handleRefreshAll = () => {
        fetchAllTafs();
    };

    const formatTimeSince = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-sky-400">TAF Weather</h2>
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">
                        Updated {formatTimeSince(lastUpdate)}
                    </span>
                    {!isEditing && (
                        <>
                            <button
                                onClick={handleRefreshAll}
                                className="p-2 text-gray-400 hover:text-sky-400 transition-colors"
                                title="Refresh all"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <button
                                onClick={handleEditLocations}
                                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-semibold transition-colors"
                            >
                                Edit
                            </button>
                        </>
                    )}
                    {isEditing && (
                        <>
                            <button
                                onClick={handleSaveLocations}
                                className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold transition-colors"
                            >
                                Save
                            </button>
                            <button
                                onClick={handleCancelEdit}
                                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isEditing ? (
                <div className="space-y-3">
                    <p className="text-sm text-gray-400">Enter ICAO codes (e.g., YMES, YMEN)</p>
                    {editLocations.map((location, index) => (
                        <div key={index} className="flex items-center space-x-2">
                            <span className="text-gray-400 text-sm w-8">{index + 1}.</span>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => handleLocationChange(index, e.target.value)}
                                placeholder="ICAO code"
                                maxLength={4}
                                className="flex-1 bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 uppercase"
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                    {locations.map((location) => {
                        const data = tafData.get(location);
                        const isLoading = loading.has(location);

                        return (
                            <div key={location} className="bg-gray-700/50 rounded-lg p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="text-lg font-bold text-sky-300">{location.toUpperCase()}</h3>
                                        {data && !data.error && (
                                            <span className="text-xs text-gray-400">
                                                Retrieved at {data.time}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleRefresh(location)}
                                        disabled={isLoading}
                                        className={`p-1 rounded transition-colors ${
                                            isLoading 
                                                ? 'text-gray-500 cursor-not-allowed' 
                                                : 'text-gray-400 hover:text-sky-400'
                                        }`}
                                        title="Refresh this location"
                                    >
                                        <svg 
                                            xmlns="http://www.w3.org/2000/svg" 
                                            className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} 
                                            viewBox="0 0 20 20" 
                                            fill="currentColor"
                                        >
                                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                                
                                {isLoading && !data && (
                                    <div className="text-gray-400 text-sm">Loading...</div>
                                )}
                                
                                
                                   {data && !data.error && (
                                       <>
                                           <div className="bg-gray-900 rounded p-3 mt-2">
                                               <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-words">
                                                   {highlightTafText(data.raw)}
                                               </pre>
                                           </div>
                                           {data.isCached && (
                                               <div className="mt-2 text-xs text-yellow-500/70 italic">
                                                   ⚠️ Old cached data - provided for display purposes only
                                                   {data.cacheTimestamp && ` (Cached: ${new Date(data.cacheTimestamp).toLocaleDateString()})`}
                                               </div>
                                           )}
                                       </>
                                   )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500">
                    Auto-refreshes every 30 minutes • Data from AVWX
                </p>
            </div>
        </div>
    );
};

export default TafWeatherWidget;