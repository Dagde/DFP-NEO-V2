import React, { useState } from 'react';
import AuditButton from './AuditButton';
import AuditFlyout from './AuditFlyout';

interface HeaderProps {
    onAddTile: () => void;
    onAddGroundEvent: () => void;
    showValidation: boolean;
    setShowValidation: (show: boolean) => void;
    locations: string[];
    activeLocation: string;
    onLocationChange: (location: string) => void;
    isMagnifierEnabled: boolean;
    setIsMagnifierEnabled: (enabled: boolean) => void;
    isMultiSelectMode: boolean;
    setIsMultiSelectMode: (enabled: boolean) => void;
    isOracleMode: boolean;
    onToggleOracleMode: () => void;
    showAircraftAvailability?: boolean;
    onToggleAircraftAvailability?: () => void;
    showDepartureDensityOverlay: boolean;
    onToggleDepartureDensityOverlay: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    onAddTile, 
    onAddGroundEvent, 
    showValidation, 
    setShowValidation, 
    locations, 
    activeLocation, 
    onLocationChange, 
    isMagnifierEnabled, 
    setIsMagnifierEnabled, 
    isMultiSelectMode, 
    setIsMultiSelectMode, 
    isOracleMode, 
    onToggleOracleMode, 
    showAircraftAvailability, 
    onToggleAircraftAvailability, 
    showDepartureDensityOverlay, 
    onToggleDepartureDensityOverlay, 
}) => {
    const [showAuditFlyout, setShowAuditFlyout] = useState(false);

    return (
        <>
            <header className="bg-gray-800 h-16 flex-shrink-0 flex items-center justify-between px-4 z-20">
                {/* LEFT ALIGNED ITEMS */}
                <div className="flex items-center space-x-[1px]">
                    <div className="w-32" style={{ marginLeft: '-10px' }}>
                        <select
                            value={activeLocation}
                            onChange={(e) => onLocationChange(e.target.value)}
                            className="bg-gray-700 border-gray-600 rounded-md text-white py-1 px-2 text-sm focus:ring-sky-500 focus:border-sky-500 focus:outline-none w-full text-center"
                        >
                            {locations.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div style={{ marginLeft: '10px' }}>
                        {/* Audit Log Button */}
                        <button 
                            onClick={() => setShowAuditFlyout(true)}
                            className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md"
                            title="View Audit Log"
                        >
                            <span className="text-center leading-tight">Audit Log</span>
                        </button>
                    </div>
                    
                    {/* Multi Select Button */}
                    <button
                      onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                      className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${isMultiSelectMode ? 'active' : ''}`}
                      title="Toggle multi-select mode"
                    >
                        <span className="text-center leading-tight">Multi Select</span>
                    </button>
                    
                    {/* Magnifier Button */}
                    <button
                      onClick={() => setIsMagnifierEnabled(!isMagnifierEnabled)}
                      className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${isMagnifierEnabled ? 'active' : ''}`}
                      aria-label="Toggle Magnifier"
                      title="Toggle Magnifier"
                    >
                        <span className="text-center leading-tight">Magnifier</span>
                    </button>
                    
                    {/* Validation Check Button */}
                    <button
                      onClick={() => setShowValidation(!showValidation)}
                      className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${showValidation ? 'active' : ''}`}
                      title="Toggle validation"
                    >
                        <span className="text-center leading-tight">Validation Check</span>
                    </button>
                    
                    {/* Hourly Event Rate Button */}
                    <button
                      onClick={onToggleDepartureDensityOverlay}
                      className={`w-[75px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${showDepartureDensityOverlay ? 'active' : ''}`}
                      title="Hourly Event Rate - Shows flight density in 1-hour window"
                    >
                        <span className="text-center leading-tight">Hourly<br/>Event Rate</span>
                    </button>
                    
                    {/* Aircraft Available Button */}
                    {onToggleAircraftAvailability && (
                        <button
                          onClick={onToggleAircraftAvailability}
                          className={`w-[75px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${showAircraftAvailability ? 'active' : ''}`}
                          title="Toggle aircraft availability"
                        >
                            <span className="text-center leading-tight">Aircraft<br/>Available</span>
                        </button>
                    )}
                    
                    {/* Add Ground Tile Button */}
                    <button 
                        onClick={onAddGroundEvent}
                        className="w-[75px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                        title="Add Ground Tile"
                    >
                        <span className="text-center leading-tight">Add Ground<br/>Tile</span>
                    </button>
                    
                    {/* Add Flight Tile Button */}
                    <button 
                        onClick={onAddTile}
                        className="w-[75px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                        title="Add Flight Tile"
                    >
                        <span className="text-center leading-tight">Add Flight<br/>Tile</span>
                    </button>
                    
                    {/* NEO - Tile Button */}
                    <button
                        onClick={onToggleOracleMode}
                        className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${isOracleMode ? 'active' : ''}`}
                        title="NEO - Tile"
                    >
                        <span className="text-center leading-tight">NEO - Tile</span>
                    </button>
                </div>
            </header>
            
            {/* Audit Flyout */}
            {showAuditFlyout && (
                <AuditFlyout 
                    pageName="Program Schedule"
                    onClose={() => setShowAuditFlyout(false)}
                />
            )}
        </>
    );
};

export default Header;