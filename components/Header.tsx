import React from 'react';
import AuditButton from './AuditButton';

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
}) => {

    return (
        <>
            <header className="bg-gray-800 h-16 flex-shrink-0 flex items-center justify-between px-4 z-20">
                {/* LEFT ALIGNED ITEMS */}
                <div className="flex items-center space-x-4">
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
                    <div className="flex items-center">
                        <AuditButton pageName="Program Schedule" className="" />
                    </div>
                    <button
                      onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                      className={`p-1.5 rounded-md transition-colors text-xs font-semibold shadow-sm ${isMultiSelectMode ? 'bg-sky-600 text-white' : 'bg-gray-600 text-white hover:bg-gray-500'}`}
                      title="Toggle multi-select mode"
                    >
                        <img src="./multi-select-icon.png" alt="Multi-select mode" style={{ height: '20px', width: '20px', display: 'block' }} />
                    </button>
                    <button
                      onClick={() => setIsMagnifierEnabled(!isMagnifierEnabled)}
                      className={`p-1.5 rounded-md transition-colors text-xs font-semibold shadow-sm ${isMagnifierEnabled ? 'bg-sky-600 text-white' : 'bg-gray-600 text-white hover:bg-gray-500'}`}
                      aria-label="Toggle Magnifier"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8zm6-3a1 1 0 011 1v2h2a1 1 0 110 2H9v2a1 1 0 11-2 0V9H5a1 1 0 110-2h2V6a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                    {/* Validation Button - replicates Validate checkbox functionality */}
                    <button
                      onClick={() => setShowValidation(!showValidation)}
                      className={`p-1.5 rounded-md transition-colors text-xs font-semibold shadow-sm ${showValidation ? 'bg-orange-600 text-white' : 'bg-gray-600 text-white hover:bg-gray-500'}`}
                      title="Toggle validation"
                    >
                        <img src="./warning-icon.png" alt="Validation mode" style={{ height: '20px', width: '20px', display: 'block' }} />
                    </button>
                    
                </div>

                {/* RIGHT ALIGNED ITEMS */}
                <div className="flex items-center space-x-2">
                    {/* ACTION BUTTONS */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={onToggleOracleMode}
                            className={`w-36 text-center py-1 rounded-md text-sm font-semibold transition-all duration-200 shadow-lg flex items-center justify-center space-x-2 ${
                                isOracleMode
                                    ? 'btn-gold-brushed active animate-pulse'
                                    : 'btn-gold-brushed'
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V5a1 1 0 00-1.447-.894l-4 2A1 1 0 0011 7v10zM4 17a1 1 0 001.447.894l4-2A1 1 0 0010 15V5a1 1 0 00-1.447-.894l-4 2A1 1 0 004 7v10z" />
                            </svg>
                            <span>Oracle</span>
                        </button>
                        <button 
                            onClick={onAddGroundEvent}
                            className="w-36 text-center py-1 rounded-md text-sm font-semibold btn-aluminium-brushed"
                        >
                            Add Ground Event
                        </button>
                        <button 
                            onClick={onAddTile}
                            className="w-36 text-center py-1 rounded-md text-sm font-semibold btn-aluminium-brushed"
                        >
                            Add Tile
                        </button>
                    </div>
                </div>
            </header>
        </>
    );
};

export default Header;