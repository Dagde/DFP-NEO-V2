import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
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
    units: string[];
    activeUnit: string;
    onUnitChange: (unit: string) => void;
    activeModelLabel?: string;
    isMagnifierEnabled: boolean;
    setIsMagnifierEnabled: (enabled: boolean) => void;
    isMultiSelectMode: boolean;
    setIsMultiSelectMode: (enabled: boolean) => void;
    isOracleMode: boolean;
    onToggleOracleMode: () => void;
    showAircraftAvailability?: boolean;
    onToggleAircraftAvailability?: () => void;
    onPauseFlightOps?: () => void;
    showDepartureDensityOverlay: boolean;
    onToggleDepartureDensityOverlay: () => void;
    canEditDfpTiles?: boolean;
    canRunValidation?: boolean;
    canRunNeoBuild?: boolean;
    // Auth props
    authUser?: { userId: string; displayName: string; role: string; firstName: string | null; lastName: string | null } | null;
    onLogout?: () => void;
    onShowAdminPanel?: () => void;
    onShowChangePassword?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    onAddTile, 
    onAddGroundEvent, 
    showValidation, 
    setShowValidation, 
    locations,
    activeLocation,
    onLocationChange,
    units,
    activeUnit,
    onUnitChange,
    activeModelLabel,
    isMagnifierEnabled, 
    setIsMagnifierEnabled, 
    isMultiSelectMode, 
    setIsMultiSelectMode, 
    isOracleMode, 
    onToggleOracleMode, 
    showAircraftAvailability, 
    onToggleAircraftAvailability, 
    onPauseFlightOps,
    showDepartureDensityOverlay, 
    onToggleDepartureDensityOverlay,
    canEditDfpTiles = true,
    canRunValidation = true,
    canRunNeoBuild = true,
    authUser,
    onLogout,
    onShowAdminPanel,
    onShowChangePassword,
}) => {
    const [showAuditFlyout, setShowAuditFlyout] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const userButtonRef = useRef<HTMLDivElement>(null);
    const dropdownMenuRef = useRef<HTMLDivElement>(null);
    const isSuperAdmin = authUser?.role === 'SUPER_ADMIN' || authUser?.role === 'ADMIN';
    const disabledActionClass = 'opacity-45 cursor-not-allowed grayscale';

    // Close user menu when clicking outside - must check BOTH the trigger and the portal dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Don't close if clicking inside the trigger button wrapper
            if (userButtonRef.current && userButtonRef.current.contains(event.target as Node)) {
                return;
            }
            // Don't close if clicking inside the portal dropdown (it's in document.body, outside userButtonRef)
            if (dropdownMenuRef.current && dropdownMenuRef.current.contains(event.target as Node)) {
                return;
            }
            setShowUserMenu(false);
        };
        if (showUserMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showUserMenu]);

    // Fetch the active commit hash from the server at runtime.
    // /api/version reads RAILWAY_GIT_COMMIT_SHA from the live process environment,
    // so it always reflects the ACTUAL running deployment - not a build-time baked value.
    const [activeCommit, setActiveCommit] = useState<string>('...');
    useEffect(() => {
        fetch('/api/version')
            .then(r => r.json())
            .then(data => {
                if (data.commit) setActiveCommit(data.commit);
            })
            .catch(() => setActiveCommit('err'));
    }, []);

    return (
        <>
            {/*
                LAYOUT:
                The header sits between left sidebar (110px) and right sidebar (110px).
                Header uses a 3-column flex layout:
                  [250px context selector] [flex-1 centered buttons] [250px spacer]
                The 250px spacer on the right balances the context controls on the left,
                so the button group is perfectly centered in the header.
            */}
            <header className="bg-gray-800 h-16 flex-shrink-0 flex items-center z-[60] relative">

                {/* LEFT: Operational context - Location then Unit */}
                <div className="flex-shrink-0 flex items-center justify-center" style={{ width: '250px', paddingLeft: '8px', paddingRight: '8px' }}>
                  <div
                    className="flex h-8 w-full items-center overflow-hidden rounded-md border border-gray-600 bg-gray-700 shadow-inner"
                    title={`${activeLocation}${activeUnit ? ` - ${activeUnit}` : ''}${activeModelLabel ? ` | ${activeModelLabel}` : ''}`}
                  >
                    <select
                        value={activeLocation}
                        onChange={(e) => onLocationChange(e.target.value)}
                        className="h-full w-[86px] border-0 bg-transparent px-2 text-center text-sm font-semibold text-white focus:outline-none focus:ring-0"
                    >
                        {locations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                    <span className="flex h-full items-center border-x border-gray-600 px-2 text-xs font-bold text-gray-300">-</span>
                    <select
                        value={activeUnit}
                        onChange={(e) => onUnitChange(e.target.value)}
                        disabled={units.length <= 1}
                        className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-center text-sm font-semibold text-white focus:outline-none focus:ring-0 disabled:opacity-80"
                    >
                        {units.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* CENTER: ALL BUTTONS - flex-1 centers them between the two 144px ends */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center" style={{ gap: '1px' }}>

                        {/* 1. Audit Log Button */}
                        <button 
                            onClick={() => setShowAuditFlyout(true)}
                            className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md"
                            title="View Audit Log"
                        >
                            <span className="text-center leading-tight">Audit Log</span>
                        </button>

                        {/* 2. Multi Select Button */}
                        <button
                          onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${isMultiSelectMode ? 'active' : ''}`}
                          title="Toggle multi-select mode"
                        >
                            <span className="text-center leading-tight">Multi Select</span>
                        </button>

                        {/* 3. Magnifier Button */}
                        <button
                          onClick={() => setIsMagnifierEnabled(!isMagnifierEnabled)}
                          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${isMagnifierEnabled ? 'active' : ''}`}
                          aria-label="Toggle Magnifier"
                          title="Toggle Magnifier"
                        >
                            <span className="text-center leading-tight">Magnifier</span>
                        </button>

                        {/* 4. Validation Check Button */}
                        <button
                          onClick={() => setShowValidation(!showValidation)}
                          disabled={!canRunValidation}
                          className={`w-[75px] h-[55px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md ${showValidation ? 'active' : ''} ${!canRunValidation ? disabledActionClass : ''}`}
                          title={canRunValidation ? 'Toggle validation' : 'Access denied: validation permission required'}
                        >
                            <span className="text-center leading-tight">Validation<br/>Check</span>
                        </button>

                        {/* 5. Hourly Event Rate Button */}
                        <button
                          onClick={onToggleDepartureDensityOverlay}
                          className={`w-[75px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${showDepartureDensityOverlay ? 'active' : ''}`}
                          title="Hourly Event Rate - Shows flight density in 1-hour window"
                        >
                            <span className="text-center leading-tight">Hourly<br/>Event Rate</span>
                        </button>

                        {/* 6. Aircraft Available Button */}
                        {onToggleAircraftAvailability && (
                            <button
                              onClick={onToggleAircraftAvailability}
                              className={`w-[75px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${!showAircraftAvailability ? 'active' : ''}`}
                              title="Toggle aircraft availability"
                            >
                                <span className="text-center leading-tight">Aircraft<br/>Available</span>
                            </button>
                        )}

                        {/* 7. Pause Flight Ops Button */}
                        {onPauseFlightOps && (
                            <button
                                onClick={onPauseFlightOps}
                                disabled={!canEditDfpTiles || !canRunNeoBuild}
                                className={`w-[75px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${(!canEditDfpTiles || !canRunNeoBuild) ? disabledActionClass : ''}`}
                                title={(canEditDfpTiles && canRunNeoBuild) ? 'Pause Flight Ops' : 'Access denied: DFP edit and NEO Build permissions required'}
                            >
                                <span className="text-center leading-tight">Pause<br/>Flight Ops</span>
                            </button>
                        )}

                        {/* 8. Add Ground Tile Button */}
                        <button 
                            onClick={onAddGroundEvent}
                            disabled={!canEditDfpTiles}
                            className={`w-[75px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${!canEditDfpTiles ? disabledActionClass : ''}`}
                            title={canEditDfpTiles ? 'Add Ground Tile' : 'Access denied: DFP tile edit permission required'}
                        >
                            <span className="text-center leading-tight">Add Ground<br/>Tile</span>
                        </button>

                        {/* 8. Add Flight Tile Button */}
                        <button 
                            onClick={onAddTile}
                            disabled={!canEditDfpTiles}
                            className={`w-[75px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${!canEditDfpTiles ? disabledActionClass : ''}`}
                            title={canEditDfpTiles ? 'Add Flight Tile' : 'Access denied: DFP tile edit permission required'}
                        >
                            <span className="text-center leading-tight">Add Flight<br/>Tile</span>
                        </button>

                        {/* 9. NEO - Tile Button */}
                        <button
                            onClick={onToggleOracleMode}
                            disabled={!canRunNeoBuild}
                            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${isOracleMode ? 'active' : ''} ${!canRunNeoBuild ? disabledActionClass : ''}`}
                            title={canRunNeoBuild ? 'NEO - Tile' : 'Access denied: NEO Build permission required'}
                        >
                            <span className={`text-center leading-tight ${isOracleMode ? 'animate-pulse-neo-text' : ''}`} style={{color: "#fb923c"}}>NEO - Tile</span>
                        </button>

                        {/* 10. Logged In As / User Button - shows active commit fetched from server */}
                        {authUser && (
                            <div ref={userButtonRef} className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="w-[75px] h-[55px] flex flex-col items-center justify-center text-[9px] font-semibold btn-aluminium-brushed rounded-md"
                                    title={`Logged in as ${authUser.displayName} | Active commit: ${activeCommit}`}
                                >
                                    <svg className="w-4 h-4 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span className="text-center leading-tight truncate w-full px-1">
                                        {authUser.lastName || authUser.displayName || authUser.userId}
                                    </span>
                                    <span className="text-center leading-tight text-[7px] text-gray-400 font-mono">
                                        {activeCommit}
                                    </span>
                                </button>
                            </div>
                        )}

                    </div>
                </div>

                {/* RIGHT: spacer to balance the operational context selector on the left,
                    ensuring the button group is perfectly centered in the header */}
                <div className="flex-shrink-0" style={{ width: '250px' }}></div>

            </header>
            
            {/* User Menu Dropdown - rendered via portal to escape overflow-hidden containers */}
            {showUserMenu && authUser && userButtonRef.current && ReactDOM.createPortal(
                <div 
                    ref={dropdownMenuRef}
                    className="fixed rounded-lg shadow-xl border border-gray-700 z-[100] overflow-hidden"
                    style={{ 
                        background: '#1a1f2e',
                        top: userButtonRef.current!.getBoundingClientRect().bottom + 4,
                        right: window.innerWidth - userButtonRef.current!.getBoundingClientRect().right,
                        width: '192px'
                    }}
                >
                    <div className="px-3 py-2 border-b border-gray-700">
                        <p className="text-xs font-semibold text-white">{authUser.displayName}</p>
                        <p className="text-[10px] text-gray-400">{authUser.userId}</p>
                        <p className="text-[10px] text-blue-400">{authUser.role}</p>
                        <p className="text-[10px] text-gray-500 font-mono">commit: {activeCommit}</p>
                    </div>
                    <button
                        onClick={() => { setShowUserMenu(false); onShowChangePassword?.(); }}
                        className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700/50 flex items-center gap-2"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        Change Password
                    </button>
                    {isSuperAdmin && (
                        <button
                            onClick={() => { setShowUserMenu(false); onShowAdminPanel?.(); }}
                            className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700/50 flex items-center gap-2"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            Admin Panel
                        </button>
                    )}
                    <div className="border-t border-gray-700">
                        <button
                            onClick={() => { setShowUserMenu(false); onLogout?.(); }}
                            className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-900/20 flex items-center gap-2"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign Out
                        </button>
                    </div>
                </div>,
                document.body
            )}
            
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
