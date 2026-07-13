import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { logAudit } from '../utils/auditLogger';
import { stopEditableKeyPropagation } from '../utils/editableKeyEvents';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';
import { showDarkAlert, showDarkPrompt } from './DarkMessageModal';

interface UnitDesiredAllocation {
  unitCode: string;
  desiredAllocation: number;
}

interface UnitActualAllocation {
  unitCode: string;
  actualAllocation: number;
}

type AllocationMode = 'combined' | 'fixed';

interface ResourceSharingGroup {
  id: string;
  name: string;
  selectedUnits: string[];
  allocationMode: AllocationMode;
  desiredAllocations: Record<string, number>;
  remainderUnitIndex: number;
  enabled?: boolean;
}

interface StaffSharingGroup {
  id: string;
  name: string;
  selectedUnits: string[];
  enabled?: boolean;
}

interface OrganisationSettingsSavedState {
  staffSharingEnabled: boolean;
  staffSharingUnits: string[];
  activeStaffSharingGroupId?: string;
  staffSharingGroups?: StaffSharingGroup[];
  fleetSharingEnabled: boolean;
  allocationMode: AllocationMode;
  selectedUnits: string[];
  desiredAllocations: Record<string, number>;
  remainderUnitIndex: number;
  activeResourceSharingGroupId?: string;
  resourceSharingGroups?: ResourceSharingGroup[];
}

interface OrganisationSettingsProps {
  units: string[];
  currentAircraftAvailable?: number;
  totalAircraft?: number;
  savedSettings?: OrganisationSettingsSavedState;
  onSettingsChange?: (settings: OrganisationSettingsSavedState) => void;
  settingsLoaded?: boolean;
}

const createEmptyResourceSharingGroup = (index: number): ResourceSharingGroup => ({
  id: `resource-sharing-${Date.now()}-${index}`,
  name: `Sharing Arrangement ${index}`,
  selectedUnits: [],
  allocationMode: 'combined',
  desiredAllocations: {},
  remainderUnitIndex: -1,
  enabled: true,
});

const createEmptyStaffSharingGroup = (index: number): StaffSharingGroup => ({
  id: `staff-sharing-${Date.now()}-${index}`,
  name: `Staff Sharing Arrangement ${index}`,
  selectedUnits: [],
  enabled: true,
});

const normaliseStaffSharingGroups = (savedSettings?: OrganisationSettingsSavedState): StaffSharingGroup[] => {
  const savedGroups = Array.isArray(savedSettings?.staffSharingGroups)
    ? savedSettings.staffSharingGroups
    : [];

  if (savedGroups.length > 0) {
    return savedGroups.map((group, index) => ({
      id: group.id || `staff-sharing-${index + 1}`,
      name: group.name || `Staff Sharing Arrangement ${index + 1}`,
      selectedUnits: Array.isArray(group.selectedUnits) ? group.selectedUnits : [],
      enabled: group.enabled !== false,
    }));
  }

  if ((savedSettings?.staffSharingUnits || []).length > 0) {
    return [{
      id: savedSettings?.activeStaffSharingGroupId || 'staff-sharing-1',
      name: `${(savedSettings?.staffSharingUnits || []).join('+')} Staff Sharing`,
      selectedUnits: savedSettings?.staffSharingUnits || [],
      enabled: true,
    }];
  }

  return [{
    id: 'staff-sharing-1',
    name: 'Staff Sharing Arrangement 1',
    selectedUnits: [],
    enabled: true,
  }];
};

const normaliseResourceSharingGroups = (savedSettings?: OrganisationSettingsSavedState): ResourceSharingGroup[] => {
  const savedGroups = Array.isArray(savedSettings?.resourceSharingGroups)
    ? savedSettings.resourceSharingGroups
    : [];

  if (savedGroups.length > 0) {
    return savedGroups.map((group, index) => ({
      id: group.id || `resource-sharing-${index + 1}`,
      name: group.name || `Sharing Arrangement ${index + 1}`,
      selectedUnits: Array.isArray(group.selectedUnits) ? group.selectedUnits : [],
      allocationMode: group.allocationMode || 'combined',
      desiredAllocations: group.desiredAllocations || {},
      remainderUnitIndex: typeof group.remainderUnitIndex === 'number' ? group.remainderUnitIndex : -1,
      enabled: group.enabled !== false,
    }));
  }

  if ((savedSettings?.selectedUnits || []).length > 0) {
    return [{
      id: savedSettings?.activeResourceSharingGroupId || 'resource-sharing-1',
      name: `${(savedSettings?.selectedUnits || []).join('+')} Shared Fleet`,
      selectedUnits: savedSettings?.selectedUnits || [],
      allocationMode: savedSettings?.allocationMode || 'combined',
      desiredAllocations: savedSettings?.desiredAllocations || {},
      remainderUnitIndex: typeof savedSettings?.remainderUnitIndex === 'number' ? savedSettings.remainderUnitIndex : -1,
      enabled: true,
    }];
  }

  return [{
    id: 'resource-sharing-1',
    name: 'Sharing Arrangement 1',
    selectedUnits: [],
    allocationMode: 'combined',
    desiredAllocations: {},
    remainderUnitIndex: -1,
    enabled: true,
  }];
};

const OrganisationSettings: React.FC<OrganisationSettingsProps> = ({ 
  units, 
  currentAircraftAvailable = 0,
  totalAircraft = 0,
  savedSettings,
  onSettingsChange,
  settingsLoaded = false,
}) => {
  const initialStaffSharingGroups = useMemo(() => normaliseStaffSharingGroups(savedSettings), []);
  const initialActiveStaffSharingGroupId = savedSettings?.activeStaffSharingGroupId || initialStaffSharingGroups[0]?.id || 'staff-sharing-1';
  const initialActiveStaffSharingGroup =
    initialStaffSharingGroups.find(group => group.id === initialActiveStaffSharingGroupId) ||
    initialStaffSharingGroups[0] ||
    createEmptyStaffSharingGroup(1);
  const initialResourceSharingGroups = useMemo(() => normaliseResourceSharingGroups(savedSettings), []);
  const initialActiveResourceSharingGroupId = savedSettings?.activeResourceSharingGroupId || initialResourceSharingGroups[0]?.id || 'resource-sharing-1';
  const initialActiveResourceSharingGroup =
    initialResourceSharingGroups.find(group => group.id === initialActiveResourceSharingGroupId) ||
    initialResourceSharingGroups[0] ||
    createEmptyResourceSharingGroup(1);

  // Staff Sharing enable/disable
  const [staffSharingEnabled, setStaffSharingEnabled] = useState(savedSettings?.staffSharingEnabled ?? false);
  // Selected units for staff sharing
  const [staffSharingGroups, setStaffSharingGroups] = useState<StaffSharingGroup[]>(initialStaffSharingGroups);
  const [activeStaffSharingGroupId, setActiveStaffSharingGroupId] = useState<string>(initialActiveStaffSharingGroup.id);
  const [staffSharingUnits, setStaffSharingUnits] = useState<string[]>(initialActiveStaffSharingGroup.selectedUnits);

  // Fleet Sharing enable/disable
  const [fleetSharingEnabled, setFleetSharingEnabled] = useState(savedSettings?.fleetSharingEnabled ?? false);

  // Selected units to share assets with
  const [resourceSharingGroups, setResourceSharingGroups] = useState<ResourceSharingGroup[]>(initialResourceSharingGroups);
  const [activeResourceSharingGroupId, setActiveResourceSharingGroupId] = useState<string>(initialActiveResourceSharingGroup.id);
  const [selectedUnits, setSelectedUnits] = useState<string[]>(initialActiveResourceSharingGroup.selectedUnits);
  
  // Allocation mode: combined (pool) or fixed (per-unit caps)
  const [allocationMode, setAllocationMode] = useState<AllocationMode>(initialActiveResourceSharingGroup.allocationMode);
  
  // Desired allocations for fixed mode (user-entered values)
  const [desiredAllocations, setDesiredAllocations] = useState<Record<string, number>>(initialActiveResourceSharingGroup.desiredAllocations);
  
  // Which unit is the auto-calculated remainder unit (index in selectedUnits array)
  const [remainderUnitIndex, setRemainderUnitIndex] = useState<number>(initialActiveResourceSharingGroup.remainderUnitIndex);
  const [isEditingSharingSettings, setIsEditingSharingSettings] = useState(false);

  // Ref to ensure we only sync from DB data once (prevent re-syncing on parent re-renders)
  const hasInitializedFromDB = useRef(false);

  // Sync internal state from savedSettings when DB load completes
  useEffect(() => {
    if (settingsLoaded && !hasInitializedFromDB.current && savedSettings) {
      hasInitializedFromDB.current = true;
      setStaffSharingEnabled(savedSettings.staffSharingEnabled ?? false);
      const loadedStaffGroups = normaliseStaffSharingGroups(savedSettings);
      const loadedActiveStaffId = savedSettings.activeStaffSharingGroupId || loadedStaffGroups[0]?.id || 'staff-sharing-1';
      const loadedActiveStaffGroup = loadedStaffGroups.find(group => group.id === loadedActiveStaffId) || loadedStaffGroups[0] || createEmptyStaffSharingGroup(1);
      setStaffSharingGroups(loadedStaffGroups);
      setActiveStaffSharingGroupId(loadedActiveStaffGroup.id);
      setStaffSharingUnits(loadedActiveStaffGroup.selectedUnits);
      setFleetSharingEnabled(savedSettings.fleetSharingEnabled ?? false);
      const loadedGroups = normaliseResourceSharingGroups(savedSettings);
      const loadedActiveId = savedSettings.activeResourceSharingGroupId || loadedGroups[0]?.id || 'resource-sharing-1';
      const loadedActiveGroup = loadedGroups.find(group => group.id === loadedActiveId) || loadedGroups[0] || createEmptyResourceSharingGroup(1);
      setResourceSharingGroups(loadedGroups);
      setActiveResourceSharingGroupId(loadedActiveGroup.id);
      setAllocationMode(loadedActiveGroup.allocationMode);
      setSelectedUnits(loadedActiveGroup.selectedUnits);
      setDesiredAllocations(loadedActiveGroup.desiredAllocations);
      setRemainderUnitIndex(loadedActiveGroup.remainderUnitIndex);
    }
  }, [settingsLoaded, savedSettings]);

  const activeStaffSharingGroup =
    staffSharingGroups.find(group => group.id === activeStaffSharingGroupId) ||
    staffSharingGroups[0] ||
    createEmptyStaffSharingGroup(1);

  const persistedStaffSharingGroups = useMemo(() => {
    return staffSharingGroups.map(group =>
      group.id === activeStaffSharingGroupId
        ? {
            ...group,
            selectedUnits: staffSharingUnits,
          }
        : group
    );
  }, [staffSharingGroups, activeStaffSharingGroupId, staffSharingUnits]);

  const allStaffSharingUnits = useMemo(() => {
    return Array.from(new Set(
      persistedStaffSharingGroups
        .filter(group => group.enabled !== false)
        .flatMap(group => group.selectedUnits || [])
    ));
  }, [persistedStaffSharingGroups]);

  useEffect(() => {
    setStaffSharingGroups(previous => previous.map(group =>
      group.id === activeStaffSharingGroupId
        ? {
            ...group,
            selectedUnits: staffSharingUnits,
          }
        : group
    ));
  }, [activeStaffSharingGroupId, staffSharingUnits]);

  const activeResourceSharingGroup =
    resourceSharingGroups.find(group => group.id === activeResourceSharingGroupId) ||
    resourceSharingGroups[0] ||
    createEmptyResourceSharingGroup(1);

  const persistedResourceSharingGroups = useMemo(() => {
    return resourceSharingGroups.map(group =>
      group.id === activeResourceSharingGroupId
        ? {
            ...group,
            selectedUnits,
            allocationMode,
            desiredAllocations,
            remainderUnitIndex,
          }
        : group
    );
  }, [resourceSharingGroups, activeResourceSharingGroupId, selectedUnits, allocationMode, desiredAllocations, remainderUnitIndex]);

  useEffect(() => {
    setResourceSharingGroups(previous => previous.map(group =>
      group.id === activeResourceSharingGroupId
        ? {
            ...group,
            selectedUnits,
            allocationMode,
            desiredAllocations,
            remainderUnitIndex,
          }
        : group
    ));
  }, [activeResourceSharingGroupId, selectedUnits, allocationMode, desiredAllocations, remainderUnitIndex]);

  const buildCurrentSettings = (): OrganisationSettingsSavedState => ({
    staffSharingEnabled,
    staffSharingUnits: allStaffSharingUnits,
    activeStaffSharingGroupId,
    staffSharingGroups: persistedStaffSharingGroups,
    fleetSharingEnabled,
    allocationMode,
    selectedUnits,
    desiredAllocations,
    remainderUnitIndex,
    activeResourceSharingGroupId,
    resourceSharingGroups: persistedResourceSharingGroups,
  });

  const saveSharingSettings = () => {
    if (!settingsLoaded && !hasInitializedFromDB.current) {
      return;
    }
    if (onSettingsChange) {
      onSettingsChange(buildCurrentSettings());
    }
    setIsEditingSharingSettings(false);
    logAudit('Settings - Organisation', 'Edit', 'Resource sharing settings saved');
  };
  
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
    logAudit('Settings - Organisation', 'Edit', `Unit ${unitCode} ${action} Staff Sharing arrangement ${activeStaffSharingGroup.name}`);
    setStaffSharingUnits(prev => {
      if (isCurrentlySelected) {
        return prev.filter(u => u !== unitCode);
      } else {
        return [...prev, unitCode];
      }
    });
  };

  const loadStaffSharingGroup = (group: StaffSharingGroup) => {
    setActiveStaffSharingGroupId(group.id);
    setStaffSharingUnits(group.selectedUnits || []);
  };

  const handleSelectStaffSharingGroup = (groupId: string) => {
    const group = persistedStaffSharingGroups.find(candidate => candidate.id === groupId);
    if (!group) return;
    loadStaffSharingGroup(group);
    logAudit('Settings - Organisation', 'Edit', `Active staff sharing arrangement changed to ${group.name}`);
  };

  const handleAddStaffSharingGroup = () => {
    const nextIndex = staffSharingGroups.length + 1;
    const newGroup = createEmptyStaffSharingGroup(nextIndex);
    const updatedGroups = [...persistedStaffSharingGroups, newGroup];
    setStaffSharingGroups(updatedGroups);
    loadStaffSharingGroup(newGroup);
    logAudit('Settings - Organisation', 'Edit', `Staff sharing arrangement ${newGroup.name} added`);
  };

  const handleDeleteStaffSharingGroup = () => {
    if (staffSharingGroups.length <= 1) return;
    const deletedGroup = activeStaffSharingGroup;
    const remainingGroups = persistedStaffSharingGroups.filter(group => group.id !== activeStaffSharingGroupId);
    const nextGroup = remainingGroups[0] || createEmptyStaffSharingGroup(1);
    setStaffSharingGroups(remainingGroups.length > 0 ? remainingGroups : [nextGroup]);
    loadStaffSharingGroup(nextGroup);
    logAudit('Settings - Organisation', 'Edit', `Staff sharing arrangement ${deletedGroup.name} deleted`);
  };

  const handleRenameStaffSharingGroup = (name: string) => {
    setStaffSharingGroups(previous => previous.map(group =>
      group.id === activeStaffSharingGroupId
        ? { ...group, name }
        : group
    ));
    logAudit('Settings - Organisation', 'Edit', `Staff sharing arrangement renamed to ${name || 'Unnamed arrangement'}`);
  };

  const loadResourceSharingGroup = (group: ResourceSharingGroup) => {
    setActiveResourceSharingGroupId(group.id);
    setSelectedUnits(group.selectedUnits || []);
    setAllocationMode(group.allocationMode || 'combined');
    setDesiredAllocations(group.desiredAllocations || {});
    setRemainderUnitIndex(typeof group.remainderUnitIndex === 'number' ? group.remainderUnitIndex : -1);
    setValidationMessage(null);
  };

  const handleSelectResourceSharingGroup = (groupId: string) => {
    const group = persistedResourceSharingGroups.find(candidate => candidate.id === groupId);
    if (!group) return;
    loadResourceSharingGroup(group);
    logAudit('Settings - Organisation', 'Edit', `Active aircraft resource sharing arrangement changed to ${group.name}`);
  };

  const handleAddResourceSharingGroup = () => {
    const nextIndex = resourceSharingGroups.length + 1;
    const newGroup = createEmptyResourceSharingGroup(nextIndex);
    const updatedGroups = [...persistedResourceSharingGroups, newGroup];
    setResourceSharingGroups(updatedGroups);
    loadResourceSharingGroup(newGroup);
    logAudit('Settings - Organisation', 'Edit', `Aircraft resource sharing arrangement ${newGroup.name} added`);
  };

  const handleDeleteResourceSharingGroup = () => {
    if (resourceSharingGroups.length <= 1) return;
    const deletedGroup = activeResourceSharingGroup;
    const remainingGroups = persistedResourceSharingGroups.filter(group => group.id !== activeResourceSharingGroupId);
    const nextGroup = remainingGroups[0] || createEmptyResourceSharingGroup(1);
    setResourceSharingGroups(remainingGroups.length > 0 ? remainingGroups : [nextGroup]);
    loadResourceSharingGroup(nextGroup);
    logAudit('Settings - Organisation', 'Edit', `Aircraft resource sharing arrangement ${deletedGroup.name} deleted`);
  };

  const handleRenameResourceSharingGroup = (name: string) => {
    setResourceSharingGroups(previous => previous.map(group =>
      group.id === activeResourceSharingGroupId
        ? { ...group, name }
        : group
    ));
    logAudit('Settings - Organisation', 'Edit', `Aircraft resource sharing arrangement renamed to ${name || 'Unnamed arrangement'}`);
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

  const unlockSharingSettings = async () => {
    const password = await showDarkPrompt({
      title: 'Edit Resource Sharing',
      message: 'Enter your password to edit staff and resource sharing settings.',
      inputLabel: 'Password',
      inputType: 'password',
      inputPlaceholder: 'Enter password',
      confirmText: 'Unlock',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (!password) return;
    try {
      const isValid = await verifyCurrentUserPassword(password);
      if (!isValid) {
        await showDarkAlert('The password was not accepted.', 'Resource Sharing Locked', 'warning');
        return;
      }
      setIsEditingSharingSettings(true);
    } catch (error) {
      await showDarkAlert('The app could not verify your password.', 'Password Check Failed', 'error');
    }
  };

  return (
    <div className="space-y-4" onKeyDownCapture={stopEditableKeyPropagation}>
      <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-sky-200 mb-2">Operational Sharing Controls</h3>
            <p className="text-sm text-gray-300">
              Fleet sharing controls whether selected units schedule against the same aircraft/resource pool on one shared DFP context. Staff sharing is separate: it controls whether instructors may be allocated across unit boundaries.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isEditingSharingSettings) {
                saveSharingSettings();
                return;
              }
              void unlockSharingSettings();
            }}
            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
          >
            {isEditingSharingSettings ? 'Save' : 'Edit'}
          </button>
        </div>
      </div>

      <div
        className={isEditingSharingSettings ? 'space-y-4' : 'pointer-events-none space-y-4 opacity-80'}
        aria-disabled={!isEditingSharingSettings}
      >

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
                      setStaffSharingUnits([]);
                      setStaffSharingGroups(previous => previous.map(group => ({ ...group, selectedUnits: [] })));
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
                <p className="text-xs text-gray-400">Total units participating across all staff-sharing arrangements</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-sky-400">{staffSharingEnabled ? allStaffSharingUnits.length : 0}</div>
                <div className="text-xs text-gray-400">Units</div>
              </div>
            </div>
          </div>
        </div>

        {staffSharingEnabled && (
          <>
            <div className="bg-sky-500/10 rounded-lg border border-sky-500/30 p-4 mb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-sky-200 mb-1">
                    Staff Sharing Arrangement
                  </label>
                  <select
                    value={activeStaffSharingGroupId}
                    onChange={(event) => handleSelectStaffSharingGroup(event.target.value)}
                    className="w-full bg-gray-950/80 border border-sky-500/40 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {persistedStaffSharingGroups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name || 'Unnamed arrangement'}{group.selectedUnits.length > 1 ? ` (${group.selectedUnits.join('+')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-sky-200 mb-1">
                    Arrangement Name
                  </label>
                  <input
                    type="text"
                    value={activeStaffSharingGroup.name || ''}
                    onChange={(event) => handleRenameStaffSharingGroup(event.target.value)}
                    placeholder="e.g. YMES 1FTS/CFS staff sharing"
                    className="w-full bg-gray-950/80 border border-sky-500/40 rounded-md py-2 px-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddStaffSharingGroup}
                    className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"
                  >
                    Add Arrangement
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteStaffSharingGroup}
                    disabled={staffSharingGroups.length <= 1}
                    className={`rounded-md px-3 py-2 text-xs font-semibold ${
                      staffSharingGroups.length <= 1
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-red-600/80 text-white hover:bg-red-600'
                    }`}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-300">
                Create one arrangement for each authorised staff-sharing group. NEO Build will only treat units as sharing staff when both the trainee and instructor belong to the same staff-sharing arrangement.
              </p>
              {persistedStaffSharingGroups.length > 1 && (
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {persistedStaffSharingGroups.map(group => (
                    <div
                      key={group.id}
                      className={`rounded border px-3 py-2 text-xs ${
                        group.id === activeStaffSharingGroupId
                          ? 'border-sky-500/50 bg-sky-500/10 text-sky-100'
                          : 'border-gray-700 bg-gray-900/60 text-gray-400'
                      }`}
                    >
                      <span className="font-semibold">{group.name || 'Unnamed arrangement'}:</span>{' '}
                      {group.selectedUnits.length > 0 ? group.selectedUnits.join(', ') : 'No units selected'}
                    </div>
                  ))}
                </div>
              )}
            </div>

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
            {allStaffSharingUnits.length > 0 && (
              <div className="mt-4 p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg">
                <h5 className="text-sky-400 font-semibold text-sm mb-2">Staff Sharing Summary</h5>
                <div className="text-xs text-gray-300 space-y-1">
                  <div className="flex">
                    <span><strong>Total Units:</strong> {allStaffSharingUnits.length}</span>
                  </div>
                  <div className="flex">
                    <span><strong>Active Arrangement:</strong> {activeStaffSharingGroup.name || 'Unnamed arrangement'} ({staffSharingUnits.length} units)</span>
                  </div>
                  <div className="flex">
                    <span><strong>All Participating Units:</strong> {allStaffSharingUnits.join(', ')}</span>
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

          {/* Persistent resource pool context */}
          <div className="bg-gray-700/50 rounded-lg border border-gray-600 p-4">
            <div className="flex h-full items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-medium text-white mb-1">Configured Resource Pool</h4>
                <p className="text-xs text-gray-400">
                  Aircraft rows defined in Aircraft & Resource Pools. Daily aircraft availability is entered in Build Priorities.
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-sky-400">{totalAircraft}</div>
                <div className="text-xs text-gray-400">Aircraft rows</div>
              </div>
            </div>
          </div>
        </div>

        {fleetSharingEnabled && (
          <>
            <div className="bg-sky-500/10 rounded-lg border border-sky-500/30 p-4 mb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-sky-200 mb-1">
                    Aircraft Sharing Arrangement
                  </label>
                  <select
                    value={activeResourceSharingGroupId}
                    onChange={(event) => handleSelectResourceSharingGroup(event.target.value)}
                    className="w-full bg-gray-950/80 border border-sky-500/40 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {persistedResourceSharingGroups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name || 'Unnamed arrangement'}{group.selectedUnits.length > 1 ? ` (${group.selectedUnits.join('+')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-sky-200 mb-1">
                    Arrangement Name
                  </label>
                  <input
                    type="text"
                    value={activeResourceSharingGroup.name || ''}
                    onChange={(event) => handleRenameResourceSharingGroup(event.target.value)}
                    placeholder="e.g. YMES 1FTS/CFS shared PC-21 pool"
                    className="w-full bg-gray-950/80 border border-sky-500/40 rounded-md py-2 px-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddResourceSharingGroup}
                    className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"
                  >
                    Add Arrangement
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteResourceSharingGroup}
                    disabled={resourceSharingGroups.length <= 1}
                    className={`rounded-md px-3 py-2 text-xs font-semibold ${
                      resourceSharingGroups.length <= 1
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-red-600/80 text-white hover:bg-red-600'
                    }`}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-300">
                Create one arrangement for each shared resource pool in the organisation. The top-left Location/Unit selector only shows an arrangement at locations where at least two selected units belong. This still does not share staff or trainees unless those settings are separately enabled.
              </p>
              {persistedResourceSharingGroups.length > 1 && (
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {persistedResourceSharingGroups.map(group => (
                    <div
                      key={group.id}
                      className={`rounded border px-3 py-2 text-xs ${
                        group.id === activeResourceSharingGroupId
                          ? 'border-sky-500/50 bg-sky-500/10 text-sky-100'
                          : 'border-gray-700 bg-gray-900/60 text-gray-400'
                      }`}
                    >
                      <span className="font-semibold">{group.name || 'Unnamed arrangement'}:</span>{' '}
                      {group.selectedUnits.length > 0 ? group.selectedUnits.join(', ') : 'No units selected'}
                    </div>
                  ))}
                </div>
              )}
            </div>

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
    </div>
  );
};

export default OrganisationSettings;
