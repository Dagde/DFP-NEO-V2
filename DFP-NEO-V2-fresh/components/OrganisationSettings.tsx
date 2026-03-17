import React, { useState, useEffect, useMemo } from 'react';

interface UnitSharingConfig {
  unitCode: string;
  designatedCount: number;
}

interface OrganisationSettingsProps {
  units: string[];
  currentAircraftAvailable: number;
}

const OrganisationSettings: React.FC<OrganisationSettingsProps> = ({ 
  units, 
  currentAircraftAvailable 
}) => {
  // Fleet Sharing enable/disable
  const [fleetSharingEnabled, setFleetSharingEnabled] = useState(false);
  
  // Selected units to share assets with
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  
  // Global allocation type for all units
  const [allocationType, setAllocationType] = useState<'designated' | 'priority'>('priority');
  
  // Designated counts for each unit
  const [unitConfigs, setUnitConfigs] = useState<Record<string, UnitSharingConfig>>({});
  
  // Pro-rata adjustment message
  const [adjustmentMessage, setAdjustmentMessage] = useState<string | null>(null);

  // Calculate total designated allocations
  const totalDesignated = useMemo(() => {
    return Object.values(unitConfigs).reduce((sum, config) => sum + config.designatedCount, 0);
  }, [unitConfigs]);

  // Check if allocation exceeds total aircraft
  const allocationExceedsTotal = totalDesignated > currentAircraftAvailable;

  // Auto-calculate last unit's allocation to match total
  useEffect(() => {
    if (selectedUnits.length > 1 && allocationType === 'designated') {
      setUnitConfigs(prev => {
        const totalManual = selectedUnits
          .slice(0, -1)
          .reduce((sum, unit) => sum + (prev[unit]?.designatedCount || 0), 0);
        
        const lastUnit = selectedUnits[selectedUnits.length - 1];
        const autoCalculated = Math.max(0, currentAircraftAvailable - totalManual);
        
        // Only update if the value actually changed to prevent infinite loop
        if ((prev[lastUnit]?.designatedCount || 0) !== autoCalculated) {
          return {
            ...prev,
            [lastUnit]: {
              unitCode: lastUnit,
              designatedCount: autoCalculated
            }
          };
        }
        return prev;
      });
    }
  }, [selectedUnits, allocationType, currentAircraftAvailable]);

  // Pro-rata adjustment when exceeding total
  useEffect(() => {
    setUnitConfigs(prev => {
      // Calculate total from current state
      const currentTotal = selectedUnits.reduce((sum, unit) => sum + (prev[unit]?.designatedCount || 0), 0);
      
      // Only adjust if exceeding total
      if (currentTotal > currentAircraftAvailable && allocationType === 'designated' && selectedUnits.length > 1) {
        const excess = currentTotal - currentAircraftAvailable;
        const adjustmentRatio = currentAircraftAvailable / currentTotal;
        
        const newConfigs: Record<string, UnitSharingConfig> = {};
        let adjustedUnits: string[] = [];
        let hasChanges = false;
        
        selectedUnits.forEach((unit, index) => {
          const originalCount = prev[unit]?.designatedCount || 0;
          // Apply proportional reduction
          const adjustedCount = Math.round(originalCount * adjustmentRatio);
          
          newConfigs[unit] = {
            unitCode: unit,
            designatedCount: adjustedCount
          };
          
          if (adjustedCount !== originalCount) {
            adjustedUnits.push(unit);
            hasChanges = true;
          }
        });
        
        // Only update if there are actual changes
        if (hasChanges) {
          setAdjustmentMessage(
            `Allocation exceeded total by ${excess} aircraft. Applied pro-rata adjustment to ${adjustedUnits.length} unit(s).`
          );
          
          // Clear message after 5 seconds
          setTimeout(() => {
            setAdjustmentMessage(null);
          }, 5000);
          
          return newConfigs;
        }
      } else {
        setAdjustmentMessage(null);
      }
      
      return prev;
    });
  }, [selectedUnits, allocationType, currentAircraftAvailable]);

  const handleToggleUnit = (unitCode: string) => {
    setSelectedUnits(prev => {
      const newSelected = prev.includes(unitCode)
        ? prev.filter(u => u !== unitCode)
        : [...prev, unitCode];
      
      // If removing a unit, also remove its config
      if (!newSelected.includes(unitCode)) {
        setUnitConfigs(prev => {
          const newConfigs = { ...prev };
          delete newConfigs[unitCode];
          return newConfigs;
        });
      }
      
      return newSelected;
    });
  };

  const handleDesignatedCountChange = (unitCode: string, count: number) => {
    setUnitConfigs(prev => ({
      ...prev,
      [unitCode]: {
        unitCode: unitCode,
        designatedCount: Math.max(0, count)
      }
    }));
  };

  const isLastUnit = (unitCode: string) => {
    return selectedUnits.length > 0 && selectedUnits[selectedUnits.length - 1] === unitCode;
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

            {/* Global Allocation Type Selection */}
            {selectedUnits.length > 0 && (
              <div className="mb-8">
                <h4 className="text-lg font-medium text-white mb-4">Allocation Type</h4>
                <p className="text-sm text-gray-400 mb-4">
                  Choose the allocation type for ALL selected units. When one unit is set to Designated, all units must use Designated allocation.
                </p>
                
                <div className="flex space-x-4">
                  <button
                    onClick={() => setAllocationType('priority')}
                    className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      allocationType === 'priority'
                        ? 'bg-sky-600 text-white border-2 border-sky-500'
                        : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Priority Allocation</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setAllocationType('designated')}
                    className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      allocationType === 'designated'
                        ? 'bg-sky-600 text-white border-2 border-sky-500'
                        : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>Designated Allocation</span>
                    </div>
                  </button>
                </div>

                <div className="mt-4 text-sm">
                  {allocationType === 'priority' ? (
                    <p className="text-gray-400">
                      <span className="text-sky-400 font-medium">Priority Allocation:</span> All units will have access to shared resources on a first-come, first-served basis.
                    </p>
                  ) : (
                    <p className="text-gray-400">
                      <span className="text-sky-400 font-medium">Designated Allocation:</span> Each unit will be allocated a specific number of aircraft from the shared pool.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Allocation Configuration */}
            {selectedUnits.length > 0 && allocationType === 'designated' && (
              <div className="mb-8">
                <h4 className="text-lg font-medium text-white mb-4">Allocation Configuration</h4>
                <p className="text-sm text-gray-400 mb-4">
                  Enter the number of aircraft allocated to each unit. The last unit will be automatically calculated to ensure the total matches available aircraft.
                </p>

                {/* Adjustment Message */}
                {adjustmentMessage && (
                  <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm text-amber-300">{adjustmentMessage}</p>
                    </div>
                  </div>
                )}

                {/* Allocation Exceeded Warning */}
                {allocationExceedsTotal && !adjustmentMessage && (
                  <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm text-red-300">
                        Total allocation ({totalDesignated}) exceeds available aircraft ({currentAircraftAvailable}). Pro-rata adjustment will be applied.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {selectedUnits.map(unit => {
                    const config = unitConfigs[unit];
                    const designatedCount = config?.designatedCount || 0;
                    const isAutoCalculated = isLastUnit(unit);

                    return (
                      <div key={unit} className="bg-gray-700/50 rounded-lg border border-gray-600 p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="text-white font-semibold">{unit}</h5>
                          <div className="flex items-center space-x-2">
                            {isAutoCalculated && (
                              <span className="text-xs bg-sky-500/20 text-sky-400 px-2 py-1 rounded-full border border-sky-500/30">
                                Auto-calculated
                              </span>
                            )}
                            <button
                              onClick={() => handleToggleUnit(unit)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Designated Number Selection */}
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Number of Allocations
                            </label>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => !isAutoCalculated && handleDesignatedCountChange(unit, Math.max(0, designatedCount - 1))}
                                disabled={isAutoCalculated}
                                className={`w-8 h-8 rounded-md flex items-center justify-center font-medium transition-all ${
                                  isAutoCalculated
                                    ? 'bg-gray-600 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-600 text-white hover:bg-gray-500'
                                }`}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={designatedCount}
                                disabled={isAutoCalculated}
                                onChange={(e) => !isAutoCalculated && handleDesignatedCountChange(unit, Math.max(0, parseInt(e.target.value) || 0))}
                                className={`flex-1 bg-gray-700 border rounded-md py-2 px-3 text-white text-center focus:outline-none focus:ring-2 transition-all ${
                                  isAutoCalculated
                                    ? 'border-gray-600 text-gray-500 cursor-not-allowed'
                                    : 'border-gray-600 focus:ring-sky-500'
                                }`}
                              />
                              <button
                                onClick={() => !isAutoCalculated && handleDesignatedCountChange(unit, designatedCount + 1)}
                                disabled={isAutoCalculated}
                                className={`w-8 h-8 rounded-md flex items-center justify-center font-medium transition-all ${
                                  isAutoCalculated
                                    ? 'bg-gray-600 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-600 text-white hover:bg-gray-500'
                                }`}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Remaining Aircraft */}
                          <div className="flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-sm text-gray-400 mb-1">Allocated</div>
                              <div className={`text-2xl font-bold ${
                                allocationExceedsTotal ? 'text-red-400' : 'text-sky-400'
                              }`}>
                                {designatedCount}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Allocation Description */}
                        <div className="mt-4 text-sm">
                          <p className="text-gray-400">
                            <span className="text-sky-400 font-medium">Designated Allocation:</span> This unit is guaranteed <span className="text-white font-semibold">{designatedCount}</span> aircraft from the shared pool.
                            {isAutoCalculated && (
                              <span className="text-sky-300"> (Automatically calculated to match total)</span>
                            )}
                          </p>
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
                  <p><strong>Allocation Type:</strong> {allocationType === 'priority' ? 'Priority (First-come, First-served)' : 'Designated (Fixed Allocation)'}</p>
                  {allocationType === 'designated' && (
                    <>
                      <p className={allocationExceedsTotal ? 'text-red-400' : ''}>
                        <strong>Total Allocated:</strong> {totalDesignated} / {currentAircraftAvailable} aircraft
                      </p>
                      {allocationExceedsTotal && (
                        <p className="text-red-400 text-xs">
                          ⚠️ Allocation exceeds available aircraft. Pro-rata adjustment will be applied.
                        </p>
                      )}
                      {!allocationExceedsTotal && currentAircraftAvailable - totalDesignated > 0 && (
                        <p className="text-green-400 text-xs">
                          ✓ {currentAircraftAvailable - totalDesignated} aircraft available for shared pool
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