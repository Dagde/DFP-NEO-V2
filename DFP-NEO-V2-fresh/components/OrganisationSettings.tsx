import React, { useState, useEffect, useMemo } from 'react';

interface UnitDesiredAllocation {
  unitCode: string;
  desiredAllocation: number;
}

interface UnitActualAllocation {
  unitCode: string;
  actualAllocation: number;
}

interface OrganisationSettingsSavedState {
  fleetSharingEnabled: boolean;
  allocationMode: 'combined' | 'fixed';
  selectedUnits: string[];
  desiredAllocations: Record<string, number>;
  remainderUnitIndex: number;
}

interface OrganisationSettingsProps {
  units: string[];
  currentAircraftAvailable?: number;
  savedSettings?: OrganisationSettingsSavedState;
  onSettingsChange?: (settings: OrganisationSettingsSavedState) => void;
}

type AllocationMode = 'combined' | 'fixed';

const OrganisationSettings: React.FC<OrganisationSettingsProps> = ({ 
  units, 
  currentAircraftAvailable = 0,
  savedSettings,
  onSettingsChange,
}) => {
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

  // Notify parent of changes for persistence
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange({
        fleetSharingEnabled,
        allocationMode,
        selectedUnits,
        desiredAllocations,
        remainderUnitIndex,
      });
    }
  }, [fleetSharingEnabled, allocationMode, selectedUnits, desiredAllocations, remainderUnitIndex]);
  
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

  // Handle adding/removing units
  const handleToggleUnit = (unitCode: string) => {
    setSelectedUnits(prev => {
      const isCurrentlySelected = prev.includes(unitCode);
      
      if (isCurrentlySelected) {
        // Removing a unit
        const newSelected = prev.filter(u => u !== unitCode);
        
        // Remove allocation data for removed unit
        setDesiredAllocations(prevAlloc => {
          const newAlloc = { ...prevAlloc };
          delete newAlloc[unitCode];
          return newAlloc;
        });
        
        // Adjust remainder unit index if needed
        const removedIndex = prev.indexOf(unitCode);
        setRemainderUnitIndex(prevIndex => {
          if (prevIndex === removedIndex) {
            // If we removed the remainder unit, set last unit as new remainder
            return newSelected.length > 0 ? newSelected.length - 1 : -1;
          } else if (prevIndex > removedIndex) {
            // Adjust index if remainder was after removed unit
            return prevIndex - 1;
          }
          return prevIndex;
        });
        
        return newSelected;
      } else {
        // Adding a unit
        const newSelected = [...prev, unitCode];
        
        // Initialize allocation for new unit to 0
        setDesiredAllocations(prevAlloc => ({
          ...prevAlloc,
          [unitCode]: 0
        }));
        
        // If this is the first unit being added, set it as remainder
        if (prev.length === 0) {
          setRemainderUnitIndex(0);
        }
        
        return newSelected;
      }
    });
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
  };

  // Handle remainder unit selection change
  const handleRemainderUnitChange = (newIndex: number) => {
    setRemainderUnitIndex(newIndex);
    setValidationMessage(null);
  };

  // Handle allocation mode change
  const handleAllocationModeChange = (newMode: AllocationMode) => {
    setAllocationMode(newMode);
    setValidationMessage(null);
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
    <div className="space-y-8">
      {/* Fleet Sharing Section */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white mb-2">Fleet Sharing</h3>
          <p className="text-sm text-gray-400">
            Configure asset sharing between organisational units. Units can share aircraft, simulators, and other operational resources.
          </p>
        </div>

        {/* Enable/Disable Fleet Sharing */}
        <div className="mb-8">
          <div className="flex items-center space-x-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={fleetSharingEnabled}
                onChange={(e) => setFleetSharingEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
              <span className="ml-3 text-sm font-medium text-white">
                Enable Fleet Sharing
              </span>
            </label>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Turn on to allow selected units to share assets from your fleet.
          </p>
        </div>

        {fleetSharingEnabled && (
          <>
            {/* Total Aircraft Display */}
            <div className="mb-8 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-medium text-white">Total Available Aircraft</h4>
                  <p className="text-sm text-gray-400">Current fleet size available for sharing</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-sky-400">{currentAircraftAvailable}</div>
                  <div className="text-sm text-gray-400">Aircraft</div>
                </div>
              </div>
            </div>

            {/* Select Units Sharing Asset */}
            <div className="mb-8">
              <h4 className="text-lg font-medium text-white mb-4">Select Units Sharing Asset</h4>
              <p className="text-sm text-gray-400 mb-4">
                Choose which units will have access to shared resources. Units can view and schedule assets from the shared pool.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {units.map(unit => (
                  <div
                    key={unit}
                    onClick={() => handleToggleUnit(unit)}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      selectedUnits.includes(unit)
                        ? 'border-sky-500 bg-sky-500/10'
                        : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${selectedUnits.includes(unit) ? 'text-sky-400' : 'text-gray-300'}`}>
                        {unit}
                      </span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedUnits.includes(unit) ? 'border-sky-500 bg-sky-500' : 'border-gray-500'
                      }`}>
                        {selectedUnits.includes(unit) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedUnits.length === 0 && (
                <p className="text-sm text-gray-500 mt-4 italic">
                  No units selected. Click on units above to add them to the sharing pool.
                </p>
              )}
            </div>

            {/* Allocation Mode Selection */}
            {selectedUnits.length > 0 && (
              <div className="mb-8">
                <h4 className="text-lg font-medium text-white mb-4">Allocation Mode</h4>
                <p className="text-sm text-gray-400 mb-4">
                  Choose how aircraft are allocated between participating units.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleAllocationModeChange('combined')}
                    className={`p-4 rounded-lg text-left transition-all ${
                      allocationMode === 'combined'
                        ? 'bg-sky-600 border-2 border-sky-500'
                        : 'bg-gray-700 border-2 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="font-semibold text-white">Combined Pool Mode</span>
                    </div>
                    <p className="text-sm text-gray-300">
                      All selected units share one common aircraft pool. No individual aircraft limits for each unit. Allocation is driven by normal combined scheduling priorities across all participating units.
                    </p>
                  </button>
                  
                  <button
                    onClick={() => handleAllocationModeChange('fixed')}
                    className={`p-4 rounded-lg text-left transition-all ${
                      allocationMode === 'fixed'
                        ? 'bg-sky-600 border-2 border-sky-500'
                        : 'bg-gray-700 border-2 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span className="font-semibold text-white">Fixed Allocation Mode</span>
                    </div>
                    <p className="text-sm text-gray-300">
                      Each unit has a fixed aircraft allocation. One unit is auto-calculated as the remainder. If insufficient aircraft are available, all units are reduced pro-rata.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Fixed Allocation Configuration */}
            {selectedUnits.length > 0 && allocationMode === 'fixed' && (
              <div className="mb-8">
                <h4 className="text-lg font-medium text-white mb-4">Fixed Allocation Configuration</h4>
                <p className="text-sm text-gray-400 mb-4">
                  Enter the desired aircraft allocation for each unit. One unit will be auto-calculated to fill the remainder.
                </p>

                {/* Validation Message */}
                {validationMessage && (
                  <div className={`mb-4 p-4 rounded-lg border ${
                    validationType === 'error' 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : validationType === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-sky-500/10 border-sky-500/30'
                  }`}>
                    <div className="flex items-start space-x-2">
                      {validationType === 'error' && (
                        <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                      {validationType === 'warning' && (
                        <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                      <p className={`text-sm ${validationType === 'error' ? 'text-red-300' : validationType === 'warning' ? 'text-amber-300' : 'text-sky-300'}`}>
                        {validationMessage}
                      </p>
                    </div>
                  </div>
                )}

                {/* Desired Allocations */}
                <div className="space-y-4 mb-6">
                  {selectedUnits.map((unitCode, index) => {
                    const isRemainder = index === remainderUnitIndex;
                    const desired = isRemainder ? remainderDesiredAllocation : (desiredAllocations[unitCode] || 0);
                    const actual = actualAllocations[unitCode] || 0;
                    
                    return (
                      <div key={unitCode} className="bg-gray-700/50 rounded-lg border border-gray-600 p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <h5 className="text-white font-semibold">{unitCode}</h5>
                            {isRemainder && (
                              <span className="text-xs bg-sky-500/20 text-sky-400 px-2 py-1 rounded-full border border-sky-500/30">
                                Auto-calculated
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleToggleUnit(unitCode)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Remainder Unit Selection */}
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
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
                              className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                              <option value="-1">Select remainder unit</option>
                              {selectedUnits.map((u, i) => (
                                <option key={u} value={i}>{u}</option>
                              ))}
                            </select>
                          </div>

                          {/* Desired Allocation Input */}
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Desired Allocation
                            </label>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => !isUnitReadOnly(unitCode) && handleDesiredAllocationChange(unitCode, Math.max(0, desired - 1))}
                                disabled={isUnitReadOnly(unitCode)}
                                className={`w-8 h-8 rounded-md flex items-center justify-center font-medium transition-all ${
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
                                className={`flex-1 bg-gray-700 border rounded-md py-2 px-3 text-white text-center focus:outline-none focus:ring-2 transition-all ${
                                  isUnitReadOnly(unitCode)
                                    ? 'border-gray-600 text-gray-500 cursor-not-allowed'
                                    : 'border-gray-600 focus:ring-sky-500'
                                }`}
                              />
                              <button
                                onClick={() => !isUnitReadOnly(unitCode) && handleDesiredAllocationChange(unitCode, desired + 1)}
                                disabled={isUnitReadOnly(unitCode)}
                                className={`w-8 h-8 rounded-md flex items-center justify-center font-medium transition-all ${
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
                              <div className="text-sm text-gray-400 mb-1">Actual Allocation</div>
                              <div className={`text-2xl font-bold ${
                                desiredExceedsAvailable ? 'text-amber-400' : 'text-sky-400'
                              }`}>
                                {actual}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <div className="mt-4 text-sm">
                          {isRemainder ? (
                            <p className="text-gray-400">
                              <span className="text-sky-400 font-medium">Auto-calculated:</span> This unit receives the remaining aircraft after all manual allocations. Desired: {desired}, Actual: {actual}
                            </p>
                          ) : (
                            <p className="text-gray-400">
                              <span className="text-sky-400 font-medium">Manual allocation:</span> This unit is guaranteed {desired} aircraft from the shared pool. Actual: {actual}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Summary */}
            {selectedUnits.length > 0 && (
              <div className="p-4 bg-sky-500/10 border border-sky-500/30 rounded-lg">
                <h5 className="text-sky-400 font-semibold mb-2">Fleet Sharing Summary</h5>
                <div className="text-sm text-gray-300 space-y-1">
                  <p><strong>Active Units:</strong> {selectedUnits.length}</p>
                  <p><strong>Allocation Mode:</strong> {allocationMode === 'combined' ? 'Combined Pool (No per-unit caps)' : 'Fixed Allocation (Per-unit caps)'}</p>
                  {allocationMode === 'fixed' && (
                    <>
                      <p className={desiredExceedsAvailable ? 'text-amber-400' : ''}>
                        <strong>Total Desired:</strong> {totalDesiredAllocation} / {currentAircraftAvailable} aircraft
                      </p>
                      <p><strong>Total Actual:</strong> {Object.values(actualAllocations).reduce((sum, val) => sum + val, 0)} aircraft</p>
                      {desiredExceedsAvailable && (
                        <p className="text-amber-400 text-xs">
                          ⚠️ Desired allocation exceeds available aircraft. Pro-rata reduction applied.
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