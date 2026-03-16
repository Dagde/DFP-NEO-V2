import React, { useState } from 'react';

interface UnitSharingConfig {
  unitCode: string;
  allocationType: 'designated' | 'priority';
  designatedCount?: number; // Only if allocationType is 'designated'
}

interface OrganisationSettingsProps {
  units: string[];
}

const OrganisationSettings: React.FC<OrganisationSettingsProps> = ({ units }) => {
  // Available units to share assets with
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  
  // Configuration for each selected unit
  const [unitConfigs, setUnitConfigs] = useState<Record<string, UnitSharingConfig>>({});

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

  const handleAllocationTypeChange = (unitCode: string, type: 'designated' | 'priority') => {
    setUnitConfigs(prev => ({
      ...prev,
      [unitCode]: {
        unitCode,
        allocationType: type,
        designatedCount: type === 'designated' ? prev[unitCode]?.designedCount || 0 : undefined
      }
    }));
  };

  const handleDesignatedCountChange = (unitCode: string, count: number) => {
    setUnitConfigs(prev => ({
      ...prev,
      [unitCode]: {
        ...prev[unitCode],
        unitCode,
        allocationType: 'designated',
        designatedCount: count
      }
    }));
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

        {/* Allocation Configuration */}
        {selectedUnits.length > 0 && (
          <div>
            <h4 className="text-lg font-medium text-white mb-4">Allocation Configuration</h4>
            <p className="text-sm text-gray-400 mb-4">
              Define how each unit accesses shared assets. Choose between designated allocation (fixed number of resources) or priority allocation (first-come, first-served).
            </p>

            <div className="space-y-4">
              {selectedUnits.map(unit => {
                const config = unitConfigs[unit];
                const allocationType = config?.allocationType || 'priority';
                const designatedCount = config?.designatedCount || 0;

                return (
                  <div key={unit} className="bg-gray-700/50 rounded-lg border border-gray-600 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="text-white font-semibold">{unit}</h5>
                      <button
                        onClick={() => handleToggleUnit(unit)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Allocation Type Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Allocation Type
                        </label>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAllocationTypeChange(unit, 'priority')}
                            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                              allocationType === 'priority'
                                ? 'bg-sky-600 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            }`}
                          >
                            Priority
                          </button>
                          <button
                            onClick={() => handleAllocationTypeChange(unit, 'designated')}
                            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                              allocationType === 'designated'
                                ? 'bg-sky-600 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            }`}
                          >
                            Designated
                          </button>
                        </div>
                      </div>

                      {/* Designated Number Selection */}
                      {allocationType === 'designated' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Number of Allocations
                          </label>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleDesignatedCountChange(unit, Math.max(0, designatedCount - 1))}
                              className="w-8 h-8 rounded-md bg-gray-600 text-white hover:bg-gray-500 flex items-center justify-center font-medium"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={designatedCount}
                              onChange={(e) => handleDesignatedCountChange(unit, Math.max(0, parseInt(e.target.value) || 0))}
                              className="flex-1 bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            <button
                              onClick={() => handleDesignatedCountChange(unit, designatedCount + 1)}
                              className="w-8 h-8 rounded-md bg-gray-600 text-white hover:bg-gray-500 flex items-center justify-center font-medium"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Allocation Description */}
                    <div className="mt-4 text-sm">
                      {allocationType === 'priority' ? (
                        <p className="text-gray-400">
                          <span className="text-sky-400 font-medium">Priority Allocation:</span> This unit will have access to shared resources on a first-come, first-served basis alongside other units.
                        </p>
                      ) : (
                        <p className="text-gray-400">
                          <span className="text-sky-400 font-medium">Designated Allocation:</span> This unit is guaranteed <span className="text-white font-semibold">{designatedCount}</span> shared resource(s). Additional access depends on availability.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            {selectedUnits.length > 0 && (
              <div className="mt-6 p-4 bg-sky-500/10 border border-sky-500/30 rounded-lg">
                <h5 className="text-sky-400 font-semibold mb-2">Fleet Sharing Summary</h5>
                <div className="text-sm text-gray-300 space-y-1">
                  <p><strong>Active Units:</strong> {selectedUnits.length}</p>
                  <p><strong>Designated Allocations:</strong> {Object.values(unitConfigs).filter(c => c.allocationType === 'designated').length}</p>
                  <p><strong>Priority Allocations:</strong> {Object.values(unitConfigs).filter(c => c.allocationType === 'priority').length}</p>
                  <p><strong>Total Reserved Assets:</strong> {Object.values(unitConfigs).reduce((sum, c) => sum + (c.designatedCount || 0), 0)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganisationSettings;