import React, { useMemo, useState } from 'react';
import { EXTERNAL_DATA_CONTROLS_EVENT, isExternalDataAllowed } from '../utils/externalDataControls';

interface FlightTrackingWidgetProps {
    school: string;
    locationName?: string;
}

interface TrackingLocation {
    label: string;
    shortCode: string;
    lat: number;
    lon: number;
    zoom: number;
}

const TRACKING_LOCATIONS: Record<string, TrackingLocation> = {
    ESL: { label: 'East Sale', shortCode: 'ESL', lat: -38.0989, lon: 147.1494, zoom: 8 },
    'EAST SALE': { label: 'East Sale', shortCode: 'ESL', lat: -38.0989, lon: 147.1494, zoom: 8 },
    YMES: { label: 'East Sale', shortCode: 'YMES', lat: -38.0989, lon: 147.1494, zoom: 8 },
    PEA: { label: 'Pearce', shortCode: 'PEA', lat: -31.6678, lon: 116.015, zoom: 8 },
    PEARCE: { label: 'Pearce', shortCode: 'PEA', lat: -31.6678, lon: 116.015, zoom: 8 },
    YPEA: { label: 'Pearce', shortCode: 'YPEA', lat: -31.6678, lon: 116.015, zoom: 8 },
    WLM: { label: 'Williamtown', shortCode: 'WLM', lat: -32.7949, lon: 151.8344, zoom: 8 },
    WILLIAMTOWN: { label: 'Williamtown', shortCode: 'WLM', lat: -32.7949, lon: 151.8344, zoom: 8 },
    YWLM: { label: 'Williamtown', shortCode: 'YWLM', lat: -32.7949, lon: 151.8344, zoom: 8 },
    AMB: { label: 'Amberley', shortCode: 'AMB', lat: -27.6406, lon: 152.7122, zoom: 8 },
    AMBERLEY: { label: 'Amberley', shortCode: 'AMB', lat: -27.6406, lon: 152.7122, zoom: 8 },
    YAMB: { label: 'Amberley', shortCode: 'YAMB', lat: -27.6406, lon: 152.7122, zoom: 8 },
    TDL: { label: 'Tindal', shortCode: 'TDL', lat: -14.5211, lon: 132.3783, zoom: 8 },
    TINDAL: { label: 'Tindal', shortCode: 'TDL', lat: -14.5211, lon: 132.3783, zoom: 8 },
    YPTN: { label: 'Tindal', shortCode: 'YPTN', lat: -14.5211, lon: 132.3783, zoom: 8 },
    EDN: { label: 'Edinburgh', shortCode: 'EDN', lat: -34.7025, lon: 138.6208, zoom: 8 },
    EDINBURGH: { label: 'Edinburgh', shortCode: 'EDN', lat: -34.7025, lon: 138.6208, zoom: 8 },
    YPED: { label: 'Edinburgh', shortCode: 'YPED', lat: -34.7025, lon: 138.6208, zoom: 8 },
};

const DEFAULT_TRACKING_LOCATION = TRACKING_LOCATIONS.ESL;

const resolveTrackingLocation = (school: string, locationName?: string): TrackingLocation => {
    const keys = [school, locationName].filter(Boolean).map(value => String(value).trim().toUpperCase());
    for (const key of keys) {
        if (TRACKING_LOCATIONS[key]) return TRACKING_LOCATIONS[key];
    }
    return DEFAULT_TRACKING_LOCATION;
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

const FlightTrackingWidget: React.FC<FlightTrackingWidgetProps> = ({ school, locationName }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [trackingAllowed, setTrackingAllowed] = useState(() => isExternalDataAllowed('flightTrackingEnabled'));
    const trackingLocation = useMemo(() => resolveTrackingLocation(school, locationName), [school, locationName]);
    const compactTrackerUrl = useMemo(() => buildTrackerUrl(trackingLocation), [trackingLocation]);
    const expandedTrackerUrl = useMemo(() => buildTrackerUrl(trackingLocation, true), [trackingLocation]);

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
                        <p className="text-xs text-gray-400 mt-1">{trackingLocation.label} ({trackingLocation.shortCode})</p>
                    </div>
                    {trackingAllowed && (
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
                    {trackingAllowed ? (
                        <iframe
                            title={`Flight tracking map centered on ${trackingLocation.label}`}
                            src={compactTrackerUrl}
                            className="w-full h-full"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                            <p className="text-sm font-semibold text-amber-300">External flight tracking disabled</p>
                            <p className="mt-2 text-xs text-amber-200/75">
                                Public ADS-B map embeds are blocked by Settings - Data Sources.
                            </p>
                        </div>
                    )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(true)}
                        disabled={!trackingAllowed}
                        className="px-4 py-2 rounded-md transition-colors font-semibold btn-green-brushed text-sm"
                    >
                        Enlarge Map
                    </button>
                    {trackingAllowed ? (
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

            {isExpanded && trackingAllowed && (
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
