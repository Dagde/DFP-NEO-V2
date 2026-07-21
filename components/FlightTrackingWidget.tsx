import React, { useMemo, useState } from 'react';
import { EXTERNAL_DATA_CONTROLS_EVENT, isExternalDataAllowed } from '../utils/externalDataControls';

interface FlightTrackingWidgetProps {
    school: string;
    locationName?: string;
    locationProfile?: {
        code?: string | null;
        name?: string | null;
        latitude?: number | null;
        longitude?: number | null;
    } | null;
}

interface TrackingLocation {
    label: string;
    shortCode: string;
    lat: number;
    lon: number;
    zoom: number;
}

const resolveTrackingLocation = (
    school: string,
    locationName?: string,
    locationProfile?: FlightTrackingWidgetProps['locationProfile'],
): TrackingLocation | null => {
    const lat = Number(locationProfile?.latitude);
    const lon = Number(locationProfile?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const label = String(locationProfile?.name || locationName || school || 'Selected location').trim();
    const shortCode = String(locationProfile?.code || school || label).trim();
    return {
        label,
        shortCode,
        lat,
        lon,
        zoom: 8,
    };
};

const buildTrackerUrl = (location: TrackingLocation, enlarged = false) => {
    const params = new URLSearchParams({
        lat: location.lat.toString(),
        lon: location.lon.toString(),
        zoom: (enlarged ? Math.max(location.zoom, 9) : location.zoom).toString(),
    });
    params.append('hideSidebar', '');
    if (!enlarged) params.append('hideButtons', '');
    return `https://globe.adsb.lol/?${params.toString()}`;
};

const FlightTrackingWidget: React.FC<FlightTrackingWidgetProps> = ({ school, locationName, locationProfile }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [trackingAllowed, setTrackingAllowed] = useState(() => isExternalDataAllowed('flightTrackingEnabled'));
    const trackingLocation = useMemo(() => resolveTrackingLocation(school, locationName, locationProfile), [school, locationName, locationProfile]);
    const compactTrackerUrl = useMemo(() => trackingLocation ? buildTrackerUrl(trackingLocation) : '', [trackingLocation]);
    const expandedTrackerUrl = useMemo(() => trackingLocation ? buildTrackerUrl(trackingLocation, true) : '', [trackingLocation]);

    React.useEffect(() => {
        const update = () => setTrackingAllowed(isExternalDataAllowed('flightTrackingEnabled'));
        window.addEventListener(EXTERNAL_DATA_CONTROLS_EVENT, update as EventListener);
        window.addEventListener('storage', update);
        return () => {
            window.removeEventListener(EXTERNAL_DATA_CONTROLS_EVENT, update as EventListener);
            window.removeEventListener('storage', update);
        };
    }, []);

    return (
        <>
            <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 flex flex-col flex-1">
                <div className="flex justify-between items-start gap-3 mb-4">
                    <div>
                        <h2 className="text-xl font-semibold text-sky-400">Flight Tracking</h2>
                        <p className="text-xs text-gray-400 mt-1">
                            {trackingLocation ? `${trackingLocation.label} (${trackingLocation.shortCode})` : 'Location coordinates not configured'}
                        </p>
                    </div>
                    {trackingAllowed && trackingLocation && (
                        <a
                            href={expandedTrackerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-semibold transition-colors whitespace-nowrap"
                        >
                            Open
                        </a>
                    )}
                </div>

                <div className="rounded-lg overflow-hidden border border-gray-700 bg-gray-900 h-64">
                    {trackingAllowed && trackingLocation ? (
                        <iframe
                            title={`Flight tracking map centered on ${trackingLocation.label}`}
                            src={compactTrackerUrl}
                            className="w-full h-full"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    ) : !trackingAllowed ? (
                        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                            <p className="text-sm font-semibold text-amber-300">External flight tracking disabled</p>
                            <p className="mt-2 text-xs text-amber-200/75">
                                Public ADS-B map embeds are blocked by Settings - Data Sources.
                            </p>
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                            <p className="text-sm font-semibold text-amber-300">Location coordinates required</p>
                            <p className="mt-2 text-xs text-amber-200/75">
                                Add latitude and longitude in Settings - Platform & Deployment - Locations.
                            </p>
                        </div>
                    )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(true)}
                        disabled={!trackingAllowed || !trackingLocation}
                        className="px-4 py-2 rounded-md transition-colors font-semibold btn-green-brushed text-sm"
                    >
                        Enlarge Map
                    </button>
                    {trackingAllowed && trackingLocation ? (
                        <a
                            href={expandedTrackerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-md transition-colors font-semibold btn-aluminium-brushed text-sm text-center"
                        >
                            ADS-B.lol
                        </a>
                    ) : (
                        <span className="px-4 py-2 rounded-md border border-gray-700 bg-gray-900 text-center text-sm font-semibold text-gray-500">
                            ADS-B.lol
                        </span>
                    )}
                </div>

                <p className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-500">
                    Free public ADS-B display centered on the active DFP location.
                </p>
            </div>

            {isExpanded && trackingAllowed && trackingLocation && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-6">
                    <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl w-full max-w-6xl h-[82vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-700">
                            <div>
                                <h2 className="text-xl font-bold text-white">Flight Tracking - {trackingLocation.label}</h2>
                                <p className="text-sm text-gray-400">Live ADS-B map centred on {trackingLocation.shortCode}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={expandedTrackerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm font-semibold transition-colors"
                                >
                                    Open Full Tracker
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setIsExpanded(false)}
                                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-semibold transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                        <iframe
                            title={`Expanded flight tracking map centered on ${trackingLocation.label}`}
                            src={expandedTrackerUrl}
                            className="w-full flex-1 bg-gray-900"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default FlightTrackingWidget;
