import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { logAudit } from '../utils/auditLogger';

interface UnitDesiredAllocation {
  unitCode: string;
  desiredAllocation: number;
}

interface UnitActualAllocation {
  unitCode: string;
  actualAllocation: number;
}

interface OrganisationSettingsSavedState {
  staffSharingEnabled: boolean;
  staffSharingUnits: string[];
  fleetSharingEnabled: boolean;
  allocationMode: 'combined' | 'fixed';
  selectedUnits: string[];
  desiredAllocations: Record<string, number>;
  remainderUnitIndex: number;
}

interface OrganisationSettingsProps {
  units: string[];
  currentAircraftAvailable?: number;
  totalAircraft?: number;
  savedSettings?: OrganisationSettingsSavedState;
  onSettingsChange?: (settings: OrganisationSettingsSavedState) => void;
  settingsLoaded?: boolean;
}

type AllocationMode = 'combined' | 'fixed';

const OrganisationSettings: React.FC<OrganisationSettingsProps> = ({ 
  units, 
  currentAircraftAvailable = 0,
  totalAircraft = 0,
  savedSettings,
  onSettingsChange,
  settingsLoaded = false,
}) => {
  // Staff Sharing enable/disable
  const [staffSharingEnabled, setStaffSharingEnabled] = useState(savedSettings?.staffSharingEnabled ?? false);
  // Selected units for staff sharing
  const [staffSharingUnits, setStaffSharingUnits] = useState<string[]>(savedSettings?.staffSharingUnits ?? []);

  // Fleet Sharing enable/disable
  const [fleetSharingEnabled, setFleetSharingEnabled] = useState(savedSettings?.fleetSharingEnabled ?? false);

  // Selected units to share assets with
  const [selectedUnits, setSelectedUnits] = useState<string[]>(savedSettings?.selectedUnits ?? []);
  
  // Allocation mode: combined (pool) or fixed (per-unit caps)
  const [allocationMode, setAllocationMode] = useState<AllocationMode>(savedSettings?.allocationMode ?? 'combined');
  
  // Desired allocations for fixed mode (user-entered values)
  const [desiredAllocations, setDesiredAllocations] = useState<Record<string, number>>(savedSettings?.desiredAllocations ?? {});
  
  // Which unit is the auto-calculated remainder unit (index in selectedUnits array)
  const [remainderUnitIndex, setRemainderUnitIndex] = useState<number>(savedSettings?.remainderUnitIndex ?? -1);

  // Ref to ensure we only sync from DB data once (prevent re-syncing on parent re-renders)
  const hasInitializedFromDB = useRef(false);

  // Sync internal state from savedSettings when DB load completes
  useEffect(() => {
    if (settingsLoaded && !hasInitializedFromDB.current && savedSettings) {
      hasInitializedFromDB.current = true;
      setStaffSharingEnabled(savedSettings.staffSharingEnabled ?? false);
      setStaffSharingUnits(savedSettings.staffSharingUnits ?? []);
      setFleetSharingEnabled(savedSettings.fleetSharingEnabled ?? false);
      setAllocationMode(savedSettings.allocationMode ?? 'combined');
      setSelectedUnits(savedSettings.selectedUnits ?? []);
      setDesiredAllocations(savedSettings.desiredAllocations ?? {});
      setRemainderUnitIndex(savedSettings.remainderUnitIndex ?? -1);
    }
  }, [settingsLoaded, savedSettings]);

  // Notify parent of changes for persistence (skip before DB has loaded)
  useEffect(() => {
    if (!settingsLoaded && !hasInitializedFromDB.current) {
      return;
    }
    if (onSettingsChange) {
      onSettingsChange({
        staffSharingEnabled,
        staffSharingUnits,
        fleetSharingEnabled,
        allocationMode,
        selectedUnits,
        desiredAllocations,
        remainderUnitIndex,
      });
    }
  }, [staffSharingEnabled, staffSharingUnits, fleetSharingEnabled, allocationMode, selectedUnits, desiredAllocations, remainderUnitIndex]);
  
  // Actual allocations (after pro-rata adjustment if needed)
  const [actualAllocations, setActualAllocations] = useState<Record<string, number>>({});
  
  // Validation and feedback messages
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [validationType, setValidationType] = useState<'error' | 'warning' | 'info'>('info');

  // Calculate total desired allocation from manually entered units (excluding remainder)
  const totalManualDesired = useMemo(() => {
    if (allocationMode !== 'fixed') return 0;
    return selectedUnits.reduce((sum, unitCode, index) => {
      if (index === remainderUnitIndex) return sum; // Skip remainder unit
      return sum + (desiredAllocations[unitCode] || 0);
    }, 0);
  }, [selectedUnits, desiredAllocations, remainderUnitIndex, allocationMode]);

  // Calculate remainder unit's desired allocation
  const remainderDesiredAllocation = useMemo(() => {
    if (allocationMode !== 'fixed' || remainderUnitIndex === -1) return 0;
    return Math.max(0, currentAircraftAvailable - totalManualDesired);
  }, [allocationMode, remainderUnitIndex, totalManualDesired, currentAircraftAvailable]);

  // Calculate total desired allocation (all units)
  const totalDesiredAllocation = useMemo(() => {
    if (allocationMode !== 'fixed') return 0;
    return totalManualDesired + remainderDesiredAllocation;
  }, [allocationMode, totalManualDesired, remainderDesiredAllocation]);

  // Check if desired allocations exceed available aircraft
  const desiredExceedsAvailable = totalDesiredAllocation > currentAircraftAvailable;

  // Calculate actual allocations with pro-rata adjustment if needed
  useEffect(() => {
    if (allocationMode !== 'fixed' || selectedUnits.length === 0) {
      setActualAllocations({});
      return;
    }

    // Outcome 1: Enough aircraft available - use desired allocations
    if (currentAircraftAvailable >= totalDesiredAllocation) {
      const newActualAllocations: Record<string, number> = {};
      selectedUnits.forEach((unitCode, index) => {
        if (index === remainderUnitIndex) {
          newActualAllocations[unitCode] = remainderDesiredAllocation;
        } else {
          newActualAllocations[unitCode] = desiredAllocations[unitCode] || 0;
        }
      });
      setActualAllocations(newActualAllocations);
      setValidationMessage(null);
      return;
    }

    // Outcome 2: Not enough aircraft - apply pro-rata adjustment
    const ratio = currentAircraftAvailable / totalDesiredAllocation;
    const proportionalAllocations: { unitCode: string; allocation: number; fraction: number }[] = [];
    
    selectedUnits.forEach((unitCode, index) => {
      const desired = index === remainderUnitIndex ? remainderDesiredAllocation : (desiredAllocations[unitCode] || 0);
      const proportional = desired * ratio;
      proportionalAllocations.push({
        unitCode,
        allocation: Math.floor(proportional),
        fraction: proportional - Math.floor(proportional)
      });
    });

    // Distribute remaining aircraft based on largest fractions
    const totalFloored = proportionalAllocations.reduce((sum, p) => sum + p.allocation, 0);
    const remaining = currentAircraftAvailable - totalFloored;
    
    // Sort by fraction descending and allocate remaining aircraft
    const sortedByFraction = [...proportionalAllocations].sort((a, b) => b.fraction - a.fraction);
    for (let i = 0; i < remaining && i < sortedByFraction.length; i++) {
      sortedByFraction[i].allocation += 1;
    }

    // Create final actual allocations
    const newActualAllocations: Record<string, number> = {};
    proportionalAllocations.forEach(p => {
      newActualAllocations[p.unitCode] = p.allocation;
    });
    setActualAllocations(newActualAllocations);
    
    setValidationMessage(
      `Insufficient aircraft: desired ${totalDesiredAllocation}, available ${currentAircraftAvailable}. Applied pro-rata reduction.`
    );
    setValidationType('warning');

  }, [allocationMode, selectedUnits, desiredAllocations, remainderUnitIndex, remainderDesiredAllocation, totalDesiredAllocation, currentAircraftAvailable]);

  // Handle adding/removing units for staff sharing
  const handleToggleStaffSharingUnit = (unitCode: string) => {
    const isCurrentlySelected = staffSharingUnits.includes(unitCode);
    const action = isCurrentlySelected ? 'removed from' : 'added to';
    logAudit('Settings - Organisation', 'Edit', `Unit ${unitCode} ${action} Staff Sharing`);
    setStaffSharingUnits(prev => {
      if (isCurrentlySelected) {
        return prev.filter(u => u !== unitCode);
      } else {
        return [...prev, unitCode];
      }
    });
  };

  // Handle adding/removing units
  const handleToggleUnit = (unitCode: string) => {
    const isCurrentlySelected = selectedUnits.includes(unitCode);

    if (isCurrentlySelected) {
      logAudit('Settings - Organisation', 'Edit', `Unit ${unitCode} removed from Fleet Sharing`);
      // Removing a unit
      setSelectedUnits(prev => prev.filter(u => u !== unitCode));

      // Remove allocation data for removed unit
      setDesiredAllocations(prevAlloc => {
        const newAlloc = { ...prevAlloc };
        delete newAlloc[unitCode];
        return newAlloc;
      });

      // Adjust remainder unit index if needed
      const removedIndex = selectedUnits.indexOf(unitCode);
      setRemainderUnitIndex(prevIndex => {
        const newSelected = selectedUnits.filter(u => u !== unitCode);
        if (prevIndex === removedIndex) {
          return newSelected.length > 0 ? newSelected.length - 1 : -1;
        } else if (prevIndex > removedIndex) {
          return prevIndex - 1;
        }
        return prevIndex;
      });
    } else {
      logAudit('Settings - Organisation', 'Edit', `Unit ${unitCode} added to Fleet Sharing`);
      // Adding a unit
      setSelectedUnits(prev => [...prev, unitCode]);

      // Initialize allocation for new unit to 0
      setDesiredAllocations(prevAlloc => ({
        ...prevAlloc,
        [unitCode]: 0
      }));

      // If this is the first unit being added, set it as remainder
      if (selectedUnits.length === 0) {
        setRemainderUnitIndex(0);
      }
    }
  };

  // Handle desired allocation change
  const handleDesiredAllocationChange = (unitCode: string, value: number) => {
    // Validate: must be non-negative whole number
    if (value < 0) return;
    if (!Number.isInteger(value)) return;
    
    // Check if this would exceed total aircraft available
    const otherManualTotal = selectedUnits.reduce((sum, unit, index) => {
      if (unit === unitCode || index === remainderUnitIndex) return sum;
      return sum + (desiredAllocations[unit] || 0);
    }, 0);
    
    if (otherManualTotal + value > currentAircraftAvailable) {
      setValidationMessage(
        `Cannot allocate ${value}: Manual allocations (${otherManualTotal + value}) would exceed available aircraft (${currentAircraftAvailable}).`
      );
      setValidationType('error');
      setTimeout(() => setValidationMessage(null), 5000);
      return;
    }
    
    setValidationMessage(null);
    setDesiredAllocations(prev => ({
      ...prev,
      [unitCode]: value
    }));
    logAudit('Settings - Organisation', 'Edit', `Fleet Sharing fixed allocation for ${unitCode} set to ${value} aircraft`);
  };

  // Handle remainder unit selection change
  const handleRemainderUnitChange = (newIndex: number) => {
    setRemainderUnitIndex(newIndex);
    setValidationMessage(null);
    const unitName = selectedUnits[newIndex] ?? 'unknown';
    logAudit('Settings - Organisation', 'Edit', `Fleet Sharing remainder unit set to ${unitName}`);
  };

  // Handle allocation mode change
  const handleAllocationModeChange = (newMode: AllocationMode) => {
    setAllocationMode(newMode);
    setValidationMessage(null);
    logAudit('Settings - Organisation', 'Edit', `Fleet Sharing allocation mode changed to ${newMode}`);
  };

  // Check if a unit is the remainder unit
  const isRemainderUnit = (unitCode: string) => {
    const index = selectedUnits.indexOf(unitCode);
    return index === remainderUnitIndex;
  };

  // Check if a unit is read-only (remainder unit in fixed mode)
  const isUnitReadOnly = (unitCode: string) => {
    return allocationMode === 'fixed' && isRemainderUnit(unitCode);
  };

  return (
    <div className="space-y-4">
      <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-sky-200 mb-2">Operational Sharing Controls</h3>
        <p className="text-sm text-gray-300">
          Fleet sharing controls whether selected units schedule against the same aircraft/resource pool on one shared DFP context. Staff sharing is separate: it controls whether instructors may be allocated across unit boundaries.
        </p>
      </div>

      {/* Staff Sharing Section */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-5">
        <h3 className="text-xl font-semibold text-white mb-4">Staff Sharing</h3>
        
        {/* Header Section: Staff Sharing Info and Enable Toggle */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Staff Sharing Description and Enable Toggle */}
          <div className="bg-gray-700/50 rounded-lg border border-gray-600 p-4">
            <p className="text-sm text-gray-400 mb-4">
              Controls instructor eligibility between units. Enable this only when staff from the selected units may be used across those units during NEO Build.
            </p>
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={staffSharingEnabled}
                  onChange={(e) => {
                    const newVal = e.target.checked;
                    setStaffSharingEnabled(newVal);
                    if (!newVal) {
                      setStaffSharingUnits([]); // Clear units when disabled
                    }
                    logAudit('Settings - Organisation', 'Edit', `Staff Sharing ${newVal ? 'enabled' : 'disabled'}`);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                <span className="ml-3 text-sm font-medium text-white">
                  Enable Staff Sharing
                </span>
              </label>
            </div>
          </div>

          {/* Staff Sharing Units Count */}
          <div className="bg-gray-700/50 rounded-lg border border-gray-600 p-4">
            <div className="flex items-center justify-between h-full">
              <div>
                <h4 className="text-base font-medium text-white mb-1">Units Sharing Staff</h4>
                <p className="text-xs text-gray-400">Number of units participating in staff sharing</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-sky-400">{staffSharingEnabled ? staffSharingUnits.length : 0}</div>
                <div className="text-xs text-gray-400">Units</div>
              </div>
            </div>
          </div>
        </div>

        {staffSharingEnabled && (
          <>
            {/* Select Units Sharing Staff */}
            <div className="bg-gray-700/30 rounded-lg border border-gray-600 p-4">
              <h4 className="text-base font-medium text-white mb-2">Select Units Sharing Staff</h4>
              <p className="text-xs text-gray-400 mb-3">
                These units may use staff from each other. This does not control aircraft/resource sharing.
              </p>
              
              {/* Grid for units */}
              <div className="grid grid-cols-3 gap-2">
                {units.map(unit => (
                  <div
                    key={unit}
                    onClick={() => handleToggleStaffSharingUnit(unit)}
                    className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                      staffSharingUnits.includes(unit)
                        ? 'border-sky-500 bg-sky-500/10'
                        : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <span className={`text-sm font-medium ${staffSharingUnits.includes(unit) ? 'text-sky-400' : 'text-gray-300'}`}>
                        {unit}
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        staffSharingUnits.includes(unit) ? 'border-sky-500 bg-sky-500' : 'border-gray-500'
                      }`}>
                        {staffSharingUnits.includes(unit) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {staffSharingUnits.length === 0 && (
                <p className="text-xs text-gray-500 mt-2 italic">
                  No units selected. Click on units above to add them.
                </p>
              )}
            </div>

            {/* Staff Sharing Summary */}
            {staffSharingUnits.length > 0 && (
              <div className="mt-4 p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg">
                <h5 className="text-sky-400 font-semibold text-sm mb-2">Staff Sharing Summary</h5>
                <div className="text-xs text-gray-300 space-y-1">
                  <div className="flex">
                    <span><strong>Active Units:</strong> {staffSharingUnits.length}</span>
                  </div>
                  <div className="flex">
                    <span><strong>Participating Units:</strong> {staffSharingUnits.join(', ')}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fleet Sharing Section */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-5">
        <h3 className="text-xl font-semibold text-white mb-4">Aircraft & Resource Sharing</h3>
        
        {/* Header Section: Fleet Sharing Info and Total Aircraft - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Fleet Sharing Description and Enable Toggle */}
          <div className="bg-gray-700/50 rounded-lg border border-gray-600 p-4">
            <p className="text-sm text-gray-400 mb-4">
              Controls whether selected units operate from one shared aircraft/resource pool and one shared DFP context. This does not share staff unless Staff Sharing is also enabled.
            </p>
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={fleetSharingEnabled}
                  onChange={(e) => {
                    const newVal = e.target.checked;
                    setFleetSharingEnabled(newVal);
                    logAudit('Settings - Organisation', 'Edit', `Fleet Sharing ${newVal ? 'enabled' : 'disabled'}`);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                <span className="ml-3 text-sm font-medium text-white">
                  Enable Aircraft & Resource Sharing
                </span>
              </label>
            </div>
          </div>

          {/* Resource pool and daily availability distinction */}
          <div className="bg-gray-700/50 rounded-lg border border-gray-600 p-4">
            <div className="grid grid-cols-2 gap-4 h-full">
              <div>
                <h4 className="text-base font-medium text-white mb-1">Configured Resource Pool</h4>
                <p className="text-xs text-gray-400">Aircraft rows defined in Aircraft & Resource Pools</p>
                <div className="mt-2 text-3xl font-bold text-sky-400">{totalAircraft}</div>
                <div className="text-xs text-gray-400">Aircraft rows</div>
              </div>
              <div className="border-l border-gray-600 pl-4">
                <h4 className="text-base font-medium text-white mb-1">Daily Build Availability</h4>
                <p className="text-xs text-gray-400">Aircraft available for the selected schedule/build day</p>
                <div className="text-3xl font-bold text-sky-400">{currentAircraftAvailable}</div>
                <div className="text-xs text-gray-400">Available today</div>
              </div>
            </div>
          </div>
        </div>

        {fleetSharingEnabled && (
          <>
            {/* Select Units and Allocation Mode - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* Select Units Sharing Asset - Narrower Width */}
              <div className="bg-gray-700/30 rounded-lg border border-gray-600 p-4">
                <h4 className="text-base font-medium text-white mb-2">Select Units Sharing Aircraft / Resources</h4>
                <p className="text-xs text-gray-400 mb-3">
                  Choose units that will schedule aircraft/resources together. Selecting units here creates a shared fleet context in the top-left Location/Unit selector, e.g. 1FTS+CFS.
                </p>
                
                {/* Narrower grid for units */}
                <div className="grid grid-cols-3 gap-2">
                  {units.map(unit => (
                    <div
                      key={unit}
                      onClick={() => handleToggleUnit(unit)}
                      className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                        selectedUnits.includes(unit)
                          ? 'border-sky-500 bg-sky-500/10'
                          : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <span className={`text-sm font-medium ${selectedUnits.includes(unit) ? 'text-sky-400' : 'text-gray-300'}`}>
                          {unit}
                        </span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedUnits.includes(unit) ? 'border-sky-500 bg-sky-500' : 'border-gray-500'
                        }`}>
                          {selectedUnits.includes(unit) && (
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedUnits.length === 0 && (
                  <p className="text-xs text-gray-500 mt-2 italic">
                    No units selected. Click on units above to add them.
                  </p>
                )}
              </div>

              {/* Allocation Mode Selection - Stacked Vertical with matching height */}
              {selectedUnits.length > 0 && (
                <div className="bg-gray-700/30 rounded-lg border border-gray-600 p-4 flex flex-col">
                  <h4 className="text-base font-medium text-white mb-2">Allocation Mode</h4>
                  <p className="text-xs text-gray-400 mb-3">
                    Choose how aircraft are allocated between participating units.
                  </p>
                  
                  <div className="flex-1 flex flex-col space-y-3">
                    {/* Combined Pool Mode - Above */}
                    <button
                      onClick={() => handleAllocationModeChange('combined')}
                      className={`flex-1 p-3 rounded-lg text-left transition-all ${
                        allocationMode === 'combined'
                          ? 'bg-sky-600 border-2 border-sky-500'
                          : 'bg-gray-700 border-2 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="font-semibold text-white text-sm">Combined Pool Mode</span>
                      </div>
                      <p className="text-xs text-gray-300">
                        Selected units schedule against one aircraft/resource pool and one shared DFP. Staff still remains unit-restricted unless Staff Sharing is enabled.
                      </p>
                    </button>
                    
                    {/* Fixed Allocation Mode - Below */}
                    <button
                      onClick={() => handleAllocationModeChange('fixed')}
                      className={`flex-1 p-3 rounded-lg text-left transition-all ${
                        allocationMode === 'fixed'
                          ? 'bg-sky-600 border-2 border-sky-500'
                          : 'bg-gray-700 border-2 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span className="font-semibold text-white text-sm">Fixed Allocation Mode</span>
                      </div>
                      <p className="text-xs text-gray-300">
                        Selected units share one DFP, but each unit has a planning allocation from the daily available aircraft. One unit is auto-calculated as remainder.
                      </p>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Allocation Configuration - Compact */}
            {selectedUnits.length > 0 && allocationMode === 'fixed' && (
              <div>
                <h4 className="text-base font-medium text-white mb-2">Fixed Allocation Configuration</h4>
                <p className="text-xs text-gray-400 mb-3">
                  Enter desired aircraft allocation for each unit. One unit is auto-calculated.
                </p>

                {/* Validation Message */}
                {validationMessage && (
                  <div className={`mb-3 p-3 rounded-lg border ${
                    validationType === 'error' 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : validationType === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-sky-500/10 border-sky-500/30'
                  }`}>
                    <div className="flex items-start space-x-2">
                      {validationType === 'error' && (
                        <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                      {validationType === 'warning' && (
                        <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                      <p className={`text-xs ${validationType === 'error' ? 'text-red-300' : validationType === 'warning' ? 'text-amber-300' : 'text-sky-300'}`}>
                        {validationMessage}
                      </p>
                    </div>
                  </div>
                )}

                {/* Desired Allocations - Compact Cards */}
                <div className="space-y-3 mb-3">
                  {selectedUnits.map((unitCode, index) => {
                    const isRemainder = index === remainderUnitIndex;
                    const desired = isRemainder ? remainderDesiredAllocation : (desiredAllocations[unitCode] || 0);
                    const actual = actualAllocations[unitCode] || 0;
                    
                    return (
                      <div key={unitCode} className="bg-gray-700/50 rounded-lg border border-gray-600 p-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <h5 className="text-white font-semibold text-sm">{unitCode}</h5>
                            {isRemainder && (
                              <span className="text-xs bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/30">
                                Auto-calculated
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleToggleUnit(unitCode)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Remainder Unit Selection */}
                          <div>
                            <label className="block text-xs font-medium text-gray-300 mb-1">
                              Remainder Unit
                            </label>
                            <select
                              value={isRemainder ? index : -1}
                              onChange={(e) => {
                                const newIndex = parseInt(e.target.value);
                                if (newIndex !== -1) {
                                  handleRemainderUnitChange(newIndex);
                                }
                              }}
                              className="w-full bg-gray-700 border border-gray-600 rounded-md py-1.5 px-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                              <option value="-1">Select remainder unit</option>
                              {selectedUnits.map((u, i) => (
                                <option key={u} value={i}>{u}</option>
                              ))}
                            </select>
                          </div>

                          {/* Desired Allocation Input */}
                          <div>
                            <label className="block text-xs font-medium text-gray-300 mb-1">
                              Desired Allocation
                            </label>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => !isUnitReadOnly(unitCode) && handleDesiredAllocationChange(unitCode, Math.max(0, desired - 1))}
                                disabled={isUnitReadOnly(unitCode)}
                                className={`w-7 h-7 rounded-md flex items-center justify-center font-medium text-sm transition-all ${
                                  isUnitReadOnly(unitCode)
                                    ? 'bg-gray-600 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-600 text-white hover:bg-gray-500'
                                }`}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={desired}
                                disabled={isUnitReadOnly(unitCode)}
                                onChange={(e) => !isUnitReadOnly(unitCode) && handleDesiredAllocationChange(unitCode, Math.max(0, parseInt(e.target.value) || 0))}
                                className={`flex-1 bg-gray-700 border rounded-md py-1.5 px-2 text-white text-center text-sm focus:outline-none focus:ring-2 transition-all ${
                                  isUnitReadOnly(unitCode)
                                    ? 'border-gray-600 text-gray-500 cursor-not-allowed'
                                    : 'border-gray-600 focus:ring-sky-500'
                                }`}
                              />
                              <button
                                onClick={() => !isUnitReadOnly(unitCode) && handleDesiredAllocationChange(unitCode, desired + 1)}
                                disabled={isUnitReadOnly(unitCode)}
                                className={`w-7 h-7 rounded-md flex items-center justify-center font-medium text-sm transition-all ${
                                  isUnitReadOnly(unitCode)
                                    ? 'bg-gray-600 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-600 text-white hover:bg-gray-500'
                                }`}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Actual Allocation Display */}
                          <div className="flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-xs text-gray-400 mb-0.5">Actual</div>
                              <div className={`text-xl font-bold ${
                                desiredExceedsAvailable ? 'text-amber-400' : 'text-sky-400'
                              }`}>
                                {actual}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <div className="mt-2 text-xs">
                          {isRemainder ? (
                            <p className="text-gray-400">
                              <span className="text-sky-400 font-medium">Auto-calculated:</span> Receives remaining aircraft after manual allocations. Desired: {desired}, Actual: {actual}
                            </p>
                          ) : (
                            <p className="text-gray-400">
                              <span className="text-sky-400 font-medium">Manual allocation:</span> Guaranteed {desired} aircraft from shared pool. Actual: {actual}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Summary - Compact */}
            {selectedUnits.length > 0 && (
              <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg">
                <h5 className="text-sky-400 font-semibold text-sm mb-2">Fleet Sharing Summary</h5>
                <div className="text-xs text-gray-300 space-y-1">
                  <div className="flex">
                    <span><strong>Active Units:</strong> {selectedUnits.length}</span>
                  </div>
                  <div className="flex">
                    <span><strong>Allocation Mode:</strong> {allocationMode === 'combined' ? 'Combined Pool' : 'Fixed Allocation'}</span>
                  </div>
                  {allocationMode === 'fixed' && (
                    <>
                      <div className={`flex ${desiredExceedsAvailable ? 'text-amber-400' : ''}`}>
                        <span><strong>Total Desired:</strong> {totalDesiredAllocation} / {currentAircraftAvailable}</span>
                      </div>
                      <div className="flex">
                        <span><strong>Total Actual:</strong> {Object.values(actualAllocations).reduce((sum, val) => sum + val, 0)}</span>
                      </div>
                      {desiredExceedsAvailable && (
                        <p className="text-amber-400 text-xs mt-1">
                          ⚠️ Desired allocation exceeds available. Pro-rata reduction applied.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OrganisationSettings;
