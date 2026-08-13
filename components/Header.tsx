import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import AuditButton from './AuditButton';
import AuditFlyout from './AuditFlyout';
import { isFixedCrewLikeOperationalModel } from '../utils/platformConfigService';

type HeaderContextUnitOption = string | {
    code: string;
    disabled?: boolean;
    disabledReason?: string;
};

interface HeaderProps {
    onAddTile: () => void;
    onAddGroundEvent: () => void;
    showValidation: boolean;
    setShowValidation: (show: boolean) => void;
    contextOptions: Array<{ location: string; units: HeaderContextUnitOption[] }>;
    activeLocation: string;
    activeUnit: string;
    onContextChange: (location: string, unit: string) => void;
    activeModelLabel?: string;
    isMagnifierEnabled: boolean;
    setIsMagnifierEnabled: (enabled: boolean) => void;
    isMultiSelectMode: boolean;
    setIsMultiSelectMode: (enabled: boolean) => void;
    isOracleMode: boolean;
    onToggleOracleMode: () => void;
    onQuickTile?: () => void;
    showAircraftAvailability?: boolean;
    onToggleAircraftAvailability?: () => void;
    onPauseFlightOps?: () => void;
    showDepartureDensityOverlay: boolean;
    onToggleDepartureDensityOverlay: () => void;
    canEditDfpTiles?: boolean;
    canOpenFlightLine?: boolean;
    canRunValidation?: boolean;
    canRunNeoBuild?: boolean;
    // Auth props
    authUser?: { userId: string; displayName: string; role: string; firstName: string | null; lastName: string | null } | null;
    onLogout?: () => void;
    onShowAdminPanel?: () => void;
    onShowChangePassword?: () => void;
    onStartStaffAvailabilityDiagnose?: () => void;
    isFlightLinePanelOpen?: boolean;
    onToggleFlightLinePanel?: () => void;
}

const stripCourseDetailsFromHeaderName = (value?: string | null): string => {
    return String(value || '')
        .replace(/\s*[-–—]\s*(?:ADF|FIC|IFF|CSE)\s*\d+\b.*$/gi, '')
        .replace(/\s+\b(?:ADF|FIC|IFF|CSE)\s*\d+\b.*$/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

const getHeaderDisplayName = (authUser: HeaderProps['authUser']): string => {
    if (!authUser) return '';
    const firstName = stripCourseDetailsFromHeaderName(authUser.firstName);
    const lastName = stripCourseDetailsFromHeaderName(authUser.lastName);
    if (firstName && lastName) return `${lastName}, ${firstName}`;
    return stripCourseDetailsFromHeaderName(authUser.displayName || authUser.userId) || authUser.userId;
};

const Header: React.FC<HeaderProps> = ({ 
    onAddTile, 
    onAddGroundEvent, 
    showValidation, 
    setShowValidation, 
    contextOptions,
    activeLocation,
    activeUnit,
    onContextChange,
    activeModelLabel,
    isMagnifierEnabled, 
    setIsMagnifierEnabled, 
    isMultiSelectMode, 
    setIsMultiSelectMode, 
    isOracleMode, 
    onToggleOracleMode, 
    onQuickTile,
    showAircraftAvailability, 
    onToggleAircraftAvailability, 
    onPauseFlightOps,
    showDepartureDensityOverlay, 
    onToggleDepartureDensityOverlay,
    canEditDfpTiles = true,
    canOpenFlightLine = true,
    canRunValidation = true,
    canRunNeoBuild = true,
    authUser,
    onLogout,
    onShowAdminPanel,
    onShowChangePassword,
    onStartStaffAvailabilityDiagnose,
    isFlightLinePanelOpen = false,
    onToggleFlightLinePanel,
}) => {
    const [showAuditFlyout, setShowAuditFlyout] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [hoveredContextLocation, setHoveredContextLocation] = useState(activeLocation);
    const userButtonRef = useRef<HTMLDivElement>(null);
    const dropdownMenuRef = useRef<HTMLDivElement>(null);
    const contextSelectorRef = useRef<HTMLDivElement>(null);
    const isSuperAdmin = authUser?.role === 'SUPER_ADMIN' || authUser?.role === 'ADMIN';
    const authDisplayName = getHeaderDisplayName(authUser);
    const disabledActionClass = 'cursor-not-allowed';
    const isFixedCrewModel = isFixedCrewLikeOperationalModel(activeModelLabel);
    const headerButtonClass = 'w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md';
    const unavailableActionClass = isFixedCrewModel ? '' : disabledActionClass;
    const activeContextLabel = `${activeLocation}${activeUnit ? ` - ${activeUnit}` : ''}`;
    const activeContextFontSize = activeContextLabel.length > 15 ? 9 : activeContextLabel.length > 12 ? 10 : 12;
    const hoveredContext = contextOptions.find(option => option.location === hoveredContextLocation) || contextOptions[0];
    const pushSetupTestHeaderDiag = (stage: string, details: Record<string, any> = {}) => {
        if (typeof window === 'undefined') return;
        const isSetupTest = new URLSearchParams(window.location.search).has('setupTest');
        if (!isSetupTest) return;
        const entry = {
            ts: new Date().toISOString(),
            stage,
            activeLocation,
            activeUnit,
            hoveredContextLocation,
            contextOptions: contextOptions.map(option => ({
                location: option.location,
                units: option.units.map(unit => typeof unit === 'string'
                    ? { code: unit, disabled: false }
                    : { code: unit.code, disabled: unit.disabled === true, disabledReason: unit.disabledReason || '' }
                ),
            })),
            hoveredContext: hoveredContext ? {
                location: hoveredContext.location,
                units: hoveredContext.units.map(unit => typeof unit === 'string'
                    ? { code: unit, disabled: false }
                    : { code: unit.code, disabled: unit.disabled === true, disabledReason: unit.disabledReason || '' }
                ),
            } : null,
            details,
        };
        try {
            console.log(`[SETUP-TEST-CONTEXT:HEADER] ${stage}`, entry);
            const existing = JSON.parse(window.localStorage.getItem('dfp_setup_test_context_diag') || '[]');
            const next = [...(Array.isArray(existing) ? existing : []), entry].slice(-120);
            window.localStorage.setItem('dfp_setup_test_context_diag', JSON.stringify(next));
            (window as any).neoSetupTestContextDiag = next;
        } catch (error) {
            console.log(`[SETUP-TEST-CONTEXT:HEADER] ${stage}`, entry, error);
        }
    };

    useEffect(() => {
        pushSetupTestHeaderDiag('header:render-options', {
            showContextMenu,
            activeContextLabel,
            activeContextFontSize,
        });
    }, [activeContextFontSize, activeContextLabel, activeLocation, activeUnit, contextOptions, hoveredContextLocation, showContextMenu]);

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

    useEffect(() => {
        if (!showContextMenu) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (contextSelectorRef.current && contextSelectorRef.current.contains(event.target as Node)) {
                return;
            }
            setShowContextMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showContextMenu]);

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
                  [140px context selector] [flex-1 centered buttons] [140px spacer]
                The 140px spacer on the right balances the context controls on the left,
                so the button group is perfectly centered in the header.
            */}
            <header className="bg-gray-800 h-16 flex-shrink-0 flex items-center z-[120] relative">

                {/* LEFT: Operational context - Location and Unit */}
                <div className="flex-shrink-0 flex items-center justify-center" style={{ width: '140px', paddingLeft: '8px', paddingRight: '8px' }}>
                  <div ref={contextSelectorRef} className="relative w-full">
                    <button
                        type="button"
                        onClick={() => {
                            setHoveredContextLocation(activeLocation);
                            setShowContextMenu(prev => !prev);
                            pushSetupTestHeaderDiag('header:toggle-menu', { nextShowContextMenu: !showContextMenu });
                        }}
                        className="flex h-8 w-full items-center justify-between rounded-md border border-gray-600 bg-gray-700 px-3 text-sm font-semibold text-white shadow-inner hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        title={`${activeContextLabel}${activeModelLabel ? ` | ${activeModelLabel}` : ''}`}
                        aria-haspopup="menu"
                        aria-expanded={showContextMenu}
                    >
                        <span
                            className="min-w-0 flex-1 whitespace-nowrap text-center leading-none"
                            style={{ fontSize: `${activeContextFontSize}px` }}
                        >
                            {activeContextLabel}
                        </span>
                        <span className="ml-2 text-[10px] text-gray-300">v</span>
                    </button>
                    {showContextMenu && (
                        <div className="absolute left-0 top-9 z-[130] flex overflow-visible rounded-md border border-gray-600 bg-gray-800 shadow-2xl" role="menu">
                            <div className="w-[96px] border-r border-gray-700 py-1">
                                {contextOptions.map(option => (
                                    <button
                                        key={option.location}
                                        type="button"
                                        onMouseEnter={() => setHoveredContextLocation(option.location)}
                                        onFocus={() => setHoveredContextLocation(option.location)}
                                        onClick={() => {
                                            setHoveredContextLocation(option.location);
                                            pushSetupTestHeaderDiag('header:hover-location-click', { location: option.location });
                                        }}
                                        className={`flex h-8 w-full items-center justify-between px-3 text-left text-sm font-semibold ${
                                            option.location === hoveredContextLocation ? 'bg-sky-700 text-white' : 'text-gray-200 hover:bg-gray-700'
                                        }`}
                                    >
                                        <span>{option.location}</span>
                                        <span className="text-[10px] text-gray-300">&gt;</span>
                                    </button>
                                ))}
                            </div>
                            <div className="w-[136px] py-1">
                                {(hoveredContext?.units || []).map(unit => {
                                    const unitCode = typeof unit === 'string' ? unit : unit.code;
                                    const isDisabledUnit = typeof unit === 'string' ? false : unit.disabled === true;
                                    const disabledReason = typeof unit === 'string' ? '' : unit.disabledReason;
                                    return (
                                        <button
                                            key={`${hoveredContext?.location}-${unitCode}`}
                                            type="button"
                                            disabled={isDisabledUnit}
                                            title={disabledReason || undefined}
                                            onClick={() => {
                                                if (isDisabledUnit) return;
                                                if (!hoveredContext?.location) return;
                                                pushSetupTestHeaderDiag('header:select-context', {
                                                    selectedLocation: hoveredContext.location,
                                                    selectedUnit: unitCode,
                                                });
                                                onContextChange(hoveredContext.location, unitCode);
                                                setShowContextMenu(false);
                                            }}
                                            className={`h-8 w-full px-3 text-left text-sm font-semibold ${
                                                hoveredContext?.location === activeLocation && unitCode === activeUnit
                                                    ? 'bg-sky-600 text-white'
                                                    : isDisabledUnit
                                                        ? 'cursor-not-allowed text-gray-500 opacity-60'
                                                        : 'text-gray-200 hover:bg-gray-700'
                                            }`}
                                        >
                                            {unitCode}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                  </div>
                </div>

                {/* CENTER: ALL BUTTONS - flex-1 centers them between the two 144px ends */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center" style={{ gap: '1px' }}>

                        {/* 1. Audit Log Button */}
                        <button 
                            onClick={() => setShowAuditFlyout(true)}
                            className={headerButtonClass}
                            title="View Audit Log"
                        >
                            <span className="text-center leading-tight">Audit Log</span>
                        </button>

                        {/* 2. Multi Select Button */}
                        <button
                          onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                          className={`${headerButtonClass} ${isMultiSelectMode ? 'active' : ''}`}
                          title="Toggle multi-select mode"
                        >
                            <span className="text-center leading-tight">Multi Select</span>
                        </button>

                        {/* 3. Magnifier Button */}
                        <button
                          onClick={() => setIsMagnifierEnabled(!isMagnifierEnabled)}
                          className={`${headerButtonClass} ${isMagnifierEnabled ? 'active' : ''}`}
                          aria-label="Toggle Magnifier"
                          title="Toggle Magnifier"
                        >
                            <span className="text-center leading-tight">Magnifier</span>
                        </button>

                        {/* 4. Validation Check Button */}
                        <button
                          onClick={() => {
                              if (!canRunValidation) return;
                              setShowValidation(!showValidation);
                          }}
                          disabled={!isFixedCrewModel && !canRunValidation}
                          aria-disabled={!canRunValidation}
                          className={`${headerButtonClass} ${showValidation ? 'active' : ''} ${!canRunValidation ? unavailableActionClass : ''}`}
                          title={canRunValidation ? 'Toggle validation' : 'Access denied: validation permission required'}
                        >
                            <span className="text-center leading-tight">Validation<br/>Check</span>
                        </button>

                        {/* 5. Hourly Event Rate Button */}
                        <button
                          onClick={onToggleDepartureDensityOverlay}
                          className={`${headerButtonClass} ${showDepartureDensityOverlay ? 'active' : ''}`}
                          title="Hourly Event Rate - Shows flight density in 1-hour window"
                        >
                            <span className="text-center leading-tight">Hourly<br/>Event Rate</span>
                        </button>

                        {/* 6. Aircraft Available Button */}
                        {(isFixedCrewModel || onToggleAircraftAvailability) && (
                            <button
                              onClick={() => {
                                  if (!onToggleAircraftAvailability) return;
                                  onToggleAircraftAvailability();
                              }}
                              disabled={!isFixedCrewModel && !onToggleAircraftAvailability}
                              aria-disabled={!onToggleAircraftAvailability}
                              className={`${headerButtonClass} ${!showAircraftAvailability ? 'active' : ''} ${!onToggleAircraftAvailability ? unavailableActionClass : ''}`}
                              title={onToggleAircraftAvailability ? 'Toggle aircraft availability' : 'Aircraft availability is not available in this context'}
                            >
                                <span className="text-center leading-tight">Aircraft<br/>Available</span>
                            </button>
                        )}

                        {/* 7. Pause Flight Ops Button */}
                        {(isFixedCrewModel || onPauseFlightOps) && (
                            <button
                                onClick={() => {
                                    if (!onPauseFlightOps || !canEditDfpTiles || !canRunNeoBuild) return;
                                    onPauseFlightOps();
                                }}
                                disabled={!isFixedCrewModel && (!onPauseFlightOps || !canEditDfpTiles || !canRunNeoBuild)}
                                aria-disabled={!onPauseFlightOps || !canEditDfpTiles || !canRunNeoBuild}
                                className={`${headerButtonClass} ${(!onPauseFlightOps || !canEditDfpTiles || !canRunNeoBuild) ? unavailableActionClass : ''}`}
                                title={(onPauseFlightOps && canEditDfpTiles && canRunNeoBuild) ? 'Pause Flight Ops' : 'Access denied: DFP edit and NEO Build permissions required'}
                            >
                                <span className="text-center leading-tight">Pause<br/>Flight Ops</span>
                            </button>
                        )}

                        {/* 8. Add Ground Tile Button */}
                        <button 
                            onClick={() => {
                                if (!canEditDfpTiles) return;
                                onAddGroundEvent();
                            }}
                            disabled={!isFixedCrewModel && !canEditDfpTiles}
                            aria-disabled={!canEditDfpTiles}
                            className={`${headerButtonClass} ${!canEditDfpTiles ? unavailableActionClass : ''}`}
                            title={canEditDfpTiles ? 'Add Ground Tile' : 'Access denied: DFP tile edit permission required'}
                        >
                            <span className="text-center leading-tight">Add Ground<br/>Tile</span>
                        </button>

                        {/* 8. Add Flight Tile Button */}
                        <button 
                            onClick={() => {
                                if (!canEditDfpTiles) return;
                                onAddTile();
                            }}
                            disabled={!isFixedCrewModel && !canEditDfpTiles}
                            aria-disabled={!canEditDfpTiles}
                            className={`${headerButtonClass} ${!canEditDfpTiles ? unavailableActionClass : ''}`}
                            title={canEditDfpTiles ? 'Add Flight Tile' : 'Access denied: DFP tile edit permission required'}
                        >
                            <span className="text-center leading-tight">Add Flight<br/>Tile</span>
                        </button>

                        {/* 9. NEO - Tile / Quick Tile Button */}
                        <button
                            onClick={() => {
                                if (isFixedCrewModel) {
                                    if (!canEditDfpTiles || !onQuickTile) return;
                                    onQuickTile();
                                    return;
                                }
                                if (!canRunNeoBuild) return;
                                onToggleOracleMode();
                            }}
                            disabled={!isFixedCrewModel && !canRunNeoBuild}
                            aria-disabled={isFixedCrewModel ? !canEditDfpTiles : !canRunNeoBuild}
                            className={`relative ${headerButtonClass} ${isOracleMode && !isFixedCrewModel ? 'active' : ''} ${isFixedCrewModel ? (!canEditDfpTiles ? unavailableActionClass : '') : (!canRunNeoBuild ? unavailableActionClass : '')}`}
                            title={isFixedCrewModel ? (canEditDfpTiles ? 'Quick Tile' : 'Access denied: DFP tile edit permission required') : canRunNeoBuild ? 'NEO - Tile' : 'Access denied: NEO Build permission required'}
                        >
                            <span className={`text-center leading-tight ${isOracleMode && !isFixedCrewModel ? 'animate-pulse-neo-text' : ''}`} style={{ color: isFixedCrewModel ? '#000000' : '#fb923c' }}>
                                {isFixedCrewModel ? <>Quick<br />Tile</> : 'NEO - Tile'}
                            </span>
                        </button>

                        {/* 10. Flight Line Button */}
                        <button
                            type="button"
                            onClick={() => {
                                if (!canOpenFlightLine || !onToggleFlightLinePanel) return;
                                onToggleFlightLinePanel();
                            }}
                            disabled={!canOpenFlightLine || !onToggleFlightLinePanel}
                            className={`${headerButtonClass} ${isFlightLinePanelOpen ? 'active' : ''} ${!canOpenFlightLine ? unavailableActionClass : ''}`}
                            title={canOpenFlightLine ? 'Open Flight Line' : 'Access denied: Flight Line permission required'}
                        >
                            <span className="text-center leading-tight">Flight<br />Line</span>
                        </button>

                    </div>
                </div>

                {/* RIGHT: spacer to balance the operational context selector on the left,
                    ensuring the button group is perfectly centered in the header */}
                <div className="flex-shrink-0" style={{ width: '140px' }}></div>

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
                        <p className="text-xs font-semibold text-white">{authDisplayName}</p>
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
                    {onStartStaffAvailabilityDiagnose && (
                        <button
                            onClick={() => { setShowUserMenu(false); onStartStaffAvailabilityDiagnose(); }}
                            className="w-full px-3 py-2 text-left text-xs text-cyan-200 hover:bg-cyan-900/20 flex items-center gap-2"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m4 6V7m4 10v-4M5 19h14M5 5h14" />
                            </svg>
                            Diagnose
                        </button>
                    )}
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
