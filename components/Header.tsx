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
                    <div className="w-32">
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
                    
                    {/* Audit Button - 55x55px */}
                    <button 
                        onClick={() => setShowAuditFlyout(true)}
                        className="w-[55px] h-[55px] flex items-center justify-center btn-aluminium-brushed rounded-md"
                        title="View Audit Log"
                    >
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-6 w-6" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                            />
                        </svg>
                    </button>
                    
                    {/* Multi Select Button - 55x55px */}
                    <button
                      onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                      className={`w-[55px] h-[55px] flex items-center justify-center btn-aluminium-brushed rounded-md ${isMultiSelectMode ? 'active' : ''}`}
                      title="Toggle multi-select mode"
                    >
                        <img src="./multi-select-icon.png" alt="Multi-select mode" style={{ height: '24px', width: '24px', display: 'block' }} />
                    </button>
                    
                    {/* Magnify Glass Button - 55x55px */}
                    <button
                      onClick={() => setIsMagnifierEnabled(!isMagnifierEnabled)}
                      className={`w-[55px] h-[55px] flex items-center justify-center btn-aluminium-brushed rounded-md ${isMagnifierEnabled ? 'active' : ''}`}
                      aria-label="Toggle Magnifier"
                      title="Toggle Magnifier"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8zm6-3a1 1 0 011 1v2h2a1 1 0 110 2H9v2a1 1 0 11-2 0V9H5a1 1 0 110-2h2V6a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {/* Toggle Validation Button - 55x55px */}
                    <button
                      onClick={() => setShowValidation(!showValidation)}
                      className={`w-[55px] h-[55px] flex items-center justify-center btn-aluminium-brushed rounded-md ${showValidation ? 'active' : ''}`}
                      title="Toggle validation"
                    >
                        <img src="./warning-icon.png" alt="Validation mode" style={{ height: '24px', width: '24px', display: 'block' }} />
                    </button>
                    
                    {/* 1 Hour Flight Counter (Departure Density Overlay) - 55x55px */}
                    <button
                      onClick={onToggleDepartureDensityOverlay}
                      className={`w-[55px] h-[55px] flex items-center justify-center btn-aluminium-brushed rounded-md ${showDepartureDensityOverlay ? 'active' : ''}`}
                      title="1 Hour Flight Counter - Shows flight density in 1-hour window"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12,6 12,12 16,14"/>
                        </svg>
                    </button>
                    
                    {/* Aircraft Availability Toggle Button - 55x55px */}
                    {onToggleAircraftAvailability && (
                        <button
                          onClick={onToggleAircraftAvailability}
                          className={`w-[55px] h-[55px] flex items-center justify-center btn-aluminium-brushed rounded-md ${showAircraftAvailability ? 'active' : ''}`}
                          title="Toggle aircraft availability"
                        >
                            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2 L12 8 M12 8 L4 10 L4 12 L12 10 M12 8 L20 10 L20 12 L12 10 M12 10 L12 18 M10 18 L10 20 L14 20 L14 18" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    )}
                    
                </div>

                {/* RIGHT ALIGNED ITEMS */}
                <div className="flex items-center space-x-[1px]">
                    {/* Oracle Button - 55x55px */}
                    <button
                        onClick={onToggleOracleMode}
                        className={`w-[55px] h-[55px] flex items-center justify-center btn-gold-brushed rounded-md ${isOracleMode ? 'active' : ''}`}
                        title="Oracle"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V5a1 1 0 00-1.447-.894l-4 2A1 1 0 0011 7v10zM4 17a1 1 0 001.447.894l4-2A1 1 0 0010 15V5a1 1 0 00-1.447-.894l-4 2A1 1 0 004 7v10z" />
                        </svg>
                    </button>
                    
                    {/* Add Ground Event Button - 55x55px */}
                    <button 
                        onClick={onAddGroundEvent}
                        className="w-[55px] h-[55px] flex items-center justify-center btn-aluminium-brushed rounded-md"
                        title="Add Ground Event"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                    
                    {/* Add Tile Button - 55x55px */}
                    <button 
                        onClick={onAddTile}
                        className="w-[55px] h-[55px] flex items-center justify-center btn-aluminium-brushed rounded-md"
                        title="Add Tile"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
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