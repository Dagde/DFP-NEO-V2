
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ScheduleEvent, Instructor, Trainee, MasterCurrency, CurrencyRequirement, SyllabusItemDetail, AirCombatTrainingAssignment } from '../types';
import FlightInfoFlyout from './FlightInfoFlyout';
// FIX: Corrected import path for the InstructorProfileFlyout component.
import { InstructorProfileFlyout } from './InstructorProfileFlyout';
import AddInstructorChoiceFlyout from './AddInstructorChoiceFlyout';
import BulkUpdateFlyout from './BulkUpdateFlyout';
import ArchiveConfirmationFlyout from './ArchiveConfirmationFlyout';
import ArchivedInstructorsFlyout from './ArchivedInstructorsFlyout';
import AuditButton from './AuditButton';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import { comparePeopleByConfiguredRank, type PersonnelDisplaySettings } from '../utils/personnelDisplaySettings';
import { normaliseOperationalModel } from '../utils/platformConfigService';
import { DEFAULT_INSERT_EVENT_TYPES, type InsertEventTypeConfig } from '../utils/insertEventTypes';
import { type AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import type { InsertLmpEventRequest } from './TraineeLmpView';

// Helper to generate a unique random ID for new instructors
const generateRandomIdNumber = (): number => {
    return Math.floor(Math.random() * (9999999 - 1000000 + 1)) + 1000000;
};

// Unit display sort order in Staff Profile
const UNIT_SORT_ORDER: Record<string, number> = { '1FTS': 1, 'CFS': 2, '2FTS': 3 };
const isPilotRole = (instructor: Instructor): boolean =>
    String(instructor.role || '').trim().toLowerCase() === 'pilot';

const generateNewInstructorTemplate = (): Instructor => ({
    idNumber: generateRandomIdNumber(),
    name: '',
    rank: 'FLTLT',
    role: 'QFI',
    callsignNumber: 0,
    category: 'C',
    isTestingOfficer: false,
    seatConfig: 'Normal',
    isExecutive: false,
    isFlyingSupervisor: false,
    isIRE: false,
    location: 'East Sale',
    unit: '1FTS',
    phoneNumber: '',
    email: '',
    unavailability: [],
});

interface InstructorListViewProps {
  onClose: () => void;
  events: ScheduleEvent[];
  traineesData: Trainee[];
  instructorsData: Instructor[];
  archivedInstructorsData: Instructor[];
  scheduleHistoryEvents?: ScheduleEvent[];
  syllabusDetails?: SyllabusItemDetail[];
  insertEventTypes?: InsertEventTypeConfig[];
  aircraftConfigurations?: AircraftConfigurationDefinition[];
  onInsertAirCombatTrainingEvent?: (
    staff: Instructor,
    assignment: AirCombatTrainingAssignment,
    sequenceItems: SyllabusItemDetail[],
    request: InsertLmpEventRequest,
  ) => Promise<boolean> | boolean;
  onUpdateAirCombatTrainingEvent?: (
    staff: Instructor,
    assignment: AirCombatTrainingAssignment,
    originalItem: SyllabusItemDetail,
    updatedItem: SyllabusItemDetail,
  ) => Promise<boolean> | boolean;
  onGenerateAirCombatTrainingReport?: (
    staff: Instructor,
    assignment: AirCombatTrainingAssignment,
    item: SyllabusItemDetail,
  ) => Promise<void> | void;
  school: string;
  personnelData: Map<string, { callsignPrefix: string; callsignNumber: number; callsign?: string }>;
  onUpdateInstructor: (data: Instructor) => void;
  onNavigateToCurrency: (person: Instructor) => void;
  onBulkUpdateInstructors: (instructors: Instructor[]) => void;
  onArchiveInstructor: (id: number) => void;
  onRestoreInstructor: (id: number) => void;
  locations: string[];
  units: string[];
  selectedPersonForProfile?: Instructor | null;
  onNavigateToTrainee?: (trainee: Trainee) => void;
  onProfileOpened?: () => void;
  onViewLogbook?: (person: Instructor) => void;
  onRequestSct: (instructor: Instructor) => void;
  masterCurrencies?: MasterCurrency[];
  currencyRequirements?: CurrencyRequirement[];
  profileInitialTab?: 'currency' | null;
  onProfileTabConsumed?: () => void;
  currentUserId?: string;
  currentUserName?: string;
  resourceDisplayNames?: ResourceDisplayNames;
  personnelDisplaySettings?: PersonnelDisplaySettings;
  instructorLabel?: string;
  operationalModel?: string;
}

const InstructorListView: React.FC<InstructorListViewProps> = ({
    onClose,
    events,
    traineesData,
    instructorsData,
    archivedInstructorsData,
    scheduleHistoryEvents = [],
    syllabusDetails = [],
    insertEventTypes = DEFAULT_INSERT_EVENT_TYPES,
    aircraftConfigurations = [],
    onInsertAirCombatTrainingEvent,
    onUpdateAirCombatTrainingEvent,
    onGenerateAirCombatTrainingReport,
    school,
    personnelData,
    onUpdateInstructor,
    onNavigateToCurrency,
    onBulkUpdateInstructors,
    onArchiveInstructor,
    onRestoreInstructor,
    locations,
    units,
    selectedPersonForProfile,
    onProfileOpened,
    onViewLogbook,
    onRequestSct,
    onNavigateToTrainee,
    masterCurrencies = [],
    currencyRequirements = [],
    profileInitialTab,
    onProfileTabConsumed,
    currentUserId,
    currentUserName,
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
    personnelDisplaySettings,
    instructorLabel = 'QFI',
    operationalModel = 'flight_school',
}) => {
  // Track which prop changed to diagnose render loop
  const prevPropsRef = React.useRef<any>({});
  const renderCountRef = React.useRef(0);
  renderCountRef.current++;
  const changedProps: string[] = [];
  const currentProps = { onClose, events, traineesData, instructorsData, archivedInstructorsData, scheduleHistoryEvents, syllabusDetails, insertEventTypes, aircraftConfigurations, onInsertAirCombatTrainingEvent, onUpdateAirCombatTrainingEvent, onGenerateAirCombatTrainingReport, school, personnelData, onUpdateInstructor, onNavigateToCurrency, onBulkUpdateInstructors, onArchiveInstructor, onRestoreInstructor, locations, units, selectedPersonForProfile, onProfileOpened, onViewLogbook, onRequestSct, masterCurrencies, currencyRequirements, profileInitialTab, onProfileTabConsumed, currentUserId, currentUserName, resourceDisplayNames, personnelDisplaySettings, instructorLabel, operationalModel };
  Object.keys(currentProps).forEach(key => {
    if (prevPropsRef.current[key] !== (currentProps as any)[key]) {
      changedProps.push(key);
    }
  });
  prevPropsRef.current = currentProps;
  if (changedProps.length > 0) {
    console.log(`🏫 [INSTRUCTORLISTVIEW RENDER #${renderCountRef.current}] Changed props:`, changedProps.join(', '));
  }
  const [hoveredInstructor, setHoveredInstructor] = useState<string | null>(null);
  const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // State for adding new instructors
  const [showAddChoice, setShowAddChoice] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [newInstructorTemplate, setNewInstructorTemplate] = useState<Instructor | null>(null);

  // State for archiving
  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [instructorToArchive, setInstructorToArchive] = useState<Instructor | null>(null);
  const [showArchivedFlyout, setShowArchivedFlyout] = useState(false);

  useEffect(() => {
    if (selectedPersonForProfile) {
        // Try to find element, though in grid it might be scrolled out.
        // If not found, originRect is null, which flyout handles gracefully (fades in center)
        const matchingElement = document.getElementById(`instructor-row-${selectedPersonForProfile.name}`);
        if (matchingElement) {
            setOriginRect(matchingElement.getBoundingClientRect());
        }
        setSelectedInstructor(selectedPersonForProfile);
        if (onProfileOpened) {
            onProfileOpened();
        }
    }
  }, [selectedPersonForProfile, onProfileOpened]);

  useEffect(() => {
    if (selectedInstructor) {
        const updatedInstructor = instructorsData.find(i => (i as any).id
            ? (i as any).id === (selectedInstructor as any).id
            : i.name === selectedInstructor.name);
        if (updatedInstructor) {
            // Compare unavailability content specifically to detect iOS-submitted changes
            const prevUnavailHash = JSON.stringify((selectedInstructor.unavailability || []).map((u: any) => u.id).sort());
            const newUnavailHash  = JSON.stringify((updatedInstructor.unavailability  || []).map((u: any) => u.id).sort());
            const unavailChanged = prevUnavailHash !== newUnavailHash;
            const preferencesChanged = JSON.stringify(selectedInstructor.preferences || {}) !== JSON.stringify(updatedInstructor.preferences || {});

            // Also check other key fields
            const otherChanged = updatedInstructor.name !== selectedInstructor.name ||
                (updatedInstructor as any).isActive !== (selectedInstructor as any).isActive;

            if (unavailChanged || preferencesChanged || otherChanged) {
                console.log('[InstructorListView] Syncing selectedInstructor from updated instructorsData - unavailChanged:', unavailChanged);
                // Preserve any locally-edited currencyStatus so a background instructorsData refresh
                // doesn't overwrite currency saves that haven't propagated back to the master array yet
                setSelectedInstructor({
                    ...updatedInstructor,
                    currencyStatus: selectedInstructor.currencyStatus ?? updatedInstructor.currencyStatus,
                });
            }
        }
    }
  }, [instructorsData]);

  const isAirCombatModel = normaliseOperationalModel(operationalModel) === 'air_combat';

  const qfis = useMemo(() => {
      return instructorsData
          .filter(i => {
              const isQFI = i.role === 'QFI' || i.isQFI === true || i.role === 'INSTRUCTOR';
              return isQFI || (isAirCombatModel && isPilotRole(i));
          })
          .sort((a, b) => comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff'));
  }, [instructorsData, isAirCombatModel, personnelDisplaySettings]);

  const qfisByUnit = useMemo(() => {
      const groups: { [key: string]: Instructor[] } = {};
      qfis.forEach(instructor => {
          const unit = instructor.unit || 'Unassigned';
          if (!groups[unit]) {
              groups[unit] = [];
          }
          groups[unit].push(instructor);
      });
      return groups;
  }, [qfis]);

  const sortedUnits = useMemo(() =>
      Object.keys(qfisByUnit).sort((a, b) => {
          const orderA = UNIT_SORT_ORDER[a] ?? 99;
          const orderB = UNIT_SORT_ORDER[b] ?? 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.localeCompare(b);
      }),
  [qfisByUnit]);

  const qfisByFlight = useMemo(() => {
      if (!isAirCombatModel) return {};
      const groups: { [key: string]: Instructor[] } = {};
      qfis.forEach(instructor => {
          const flight = String(instructor.flight || '').trim().toUpperCase();
          if (!flight) return;
          if (!groups[flight]) {
              groups[flight] = [];
          }
          groups[flight].push(instructor);
      });
      return groups;
  }, [isAirCombatModel, qfis]);

  const sortedFlightGroups = useMemo(() =>
      Object.keys(qfisByFlight).sort((a, b) => {
          const simpleFlightPattern = /^[A-Z]$/;
          if (simpleFlightPattern.test(a) && simpleFlightPattern.test(b)) return a.localeCompare(b);
          if (simpleFlightPattern.test(a)) return -1;
          if (simpleFlightPattern.test(b)) return 1;
          return a.localeCompare(b, undefined, { numeric: true });
      }),
  [qfisByFlight]);

  const simIps = useMemo(() => {
        console.log('🔍 [SIM IP FILTER] instructorsData length:', instructorsData.length);
        const simIpCandidates = instructorsData.filter(i => {
            const isSimIp = i.role === 'SIM IP';
            if (!isSimIp) return false;
            console.log(`🔍 [SIM IP FILTER] Found active-context SIM IP: ${i.name} (${i.rank}) - Location: ${i.location}`);
            return true;
        });
        console.log('🔍 [SIM IP FILTER] Total SIM IPs found:', simIpCandidates.length);

        return simIpCandidates.sort((a, b) => {
            // First sort by Unit
            const unitA = a.unit || 'Unassigned';
            const unitB = b.unit || 'Unassigned';
            if (unitA !== unitB) {
                return unitA.localeCompare(unitB);
            }
            return comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff');
        });
    }, [instructorsData, personnelDisplaySettings]);

    const ofis = useMemo(() => {
        console.log('🔍 [OFI FILTER] instructorsData length:', instructorsData.length);
        console.log('🔍 [OFI FILTER] All instructors:', instructorsData.map(i => ({ id: i.idNumber, name: i.name, role: i.role, isOFI: i.isOFI })));

        const ofiCandidates = instructorsData.filter(i => {
            const isOfi = i.role === 'OFI' || i.isOFI === true;
            if (!isOfi) return false;
            console.log(`🔍 [OFI FILTER] ${school} - ${i.name}: role="${i.role}", isOFI=${i.isOFI}, location=${i.location}`);
            return true;
        });

        console.log('🔍 [OFI FILTER] OFI candidates found:', ofiCandidates.length);
        console.log('🔍 [OFI FILTER] OFI candidates:', ofiCandidates.map(i => ({ id: i.idNumber, name: i.name, role: i.role, isOFI: i.isOFI })));

        const sorted = ofiCandidates.sort((a, b) => {
            // First sort by Unit
            const unitA = a.unit || 'Unassigned';
            const unitB = b.unit || 'Unassigned';
            if (unitA !== unitB) {
                return unitA.localeCompare(unitB);
            }
            return comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff');
        });
        console.log('🔍 [OFI FILTER] Final OFI list:', sorted.map(i => ({ id: i.idNumber, name: i.name, rank: i.rank })));
        return sorted;
    }, [instructorsData, school, personnelDisplaySettings]);

    // NEW: All other staff members who don't fit into instructor, SIM IP, or OFI categories
    const otherStaff = useMemo(() => {
        console.log('🔍 [OTHER STAFF] instructorsData length:', instructorsData.length);

        const otherStaffCandidates = instructorsData.filter(i => {
            // Exclude QFIs, INSTRUCTORs, SIM IPs, and OFIs
            const isQfi = i.role === 'QFI' || i.isQFI === true || i.role === 'INSTRUCTOR' || (isAirCombatModel && isPilotRole(i));
            const isSimIp = i.role === 'SIM IP';
            const isOfi = i.role === 'OFI' || i.isOFI === true;

            // Include everyone else
            const isOther = !isQfi && !isSimIp && !isOfi;
            if (!isOther) return false;
            console.log(`🔍 [OTHER STAFF] Found active-context other staff: ${i.name} (${i.rank}) - role: ${i.role}, location: ${i.location}`);
            return true;
        });

        console.log('🔍 [OTHER STAFF] Total other staff found:', otherStaffCandidates.length);

        return otherStaffCandidates.sort((a, b) => {
            // First sort by Unit
            const unitA = a.unit || 'Unassigned';
            const unitB = b.unit || 'Unassigned';
            if (unitA !== unitB) {
                return unitA.localeCompare(unitB);
            }
            return comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff');
        });
    }, [instructorsData, personnelDisplaySettings]);

  // SIM IPs are shown as a single combined section (not split by unit)
  // simIps is already sorted by unit → rank → name from the simIps useMemo above

  const ofisByUnit = useMemo(() => {
      const groups: { [key: string]: Instructor[] } = {};
      ofis.forEach(instructor => {
          const unit = instructor.unit || 'Unassigned';
          if (!groups[unit]) {
              groups[unit] = [];
          }
          groups[unit].push(instructor);
      });
      return groups;
  }, [ofis]);

  const sortedOfiUnits = useMemo(() =>
      Object.keys(ofisByUnit).sort((a, b) => {
          const orderA = UNIT_SORT_ORDER[a] ?? 99;
          const orderB = UNIT_SORT_ORDER[b] ?? 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.localeCompare(b);
      }),
  [ofisByUnit]);

  const otherStaffByUnit = useMemo(() => {
      const groups: { [key: string]: Instructor[] } = {};
      otherStaff.forEach(instructor => {
          const unit = instructor.unit || 'Unassigned';
          if (!groups[unit]) {
              groups[unit] = [];
          }
          groups[unit].push(instructor);
      });
      return groups;
  }, [otherStaff]);

  const sortedOtherStaffUnits = useMemo(() =>
      Object.keys(otherStaffByUnit).sort((a, b) => {
          const orderA = UNIT_SORT_ORDER[a] ?? 99;
          const orderB = UNIT_SORT_ORDER[b] ?? 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.localeCompare(b);
      }),
  [otherStaffByUnit]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLLIElement>, instructorName: string) => {
    if (selectedInstructor || isArchiveMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredInstructor(instructorName);
    setFlyoutPosition({ top: rect.top, left: rect.right + 10 });
  };

  const handleMouseLeave = () => {
    setHoveredInstructor(null);
    setFlyoutPosition(null);
  };

  const handleInstructorClick = (e: React.MouseEvent<HTMLLIElement>, instructor: Instructor) => {
    if (selectedInstructor?.name === instructor.name) {
        handleCloseProfile();
    } else {
        setIsArchiveMode(false);
        setIsAddingNew(false);
        setOriginRect(e.currentTarget.getBoundingClientRect());
        setSelectedInstructor(instructor);
        setIsClosing(false);
    }
  };

  const handleCloseProfile = () => {
    setIsClosing(true);
    setTimeout(() => {
      setSelectedInstructor(null);
      setIsAddingNew(false);
      setNewInstructorTemplate(null);
    }, 300);
  };

  const handleShowAddChoice = () => {
    setIsArchiveMode(false);
    setShowAddChoice(true);
  }

  const handleAddIndividual = () => {
    console.log('🔍 [DATA TRACKING] Add Staff button clicked');
    console.log('🔍 [DATA TRACKING] Current instructors count:', instructorsData.length);
    setShowAddChoice(false);
    setIsArchiveMode(false);
    setSelectedInstructor(null);
    const newTemplate = generateNewInstructorTemplate();
    console.log('🔍 [DATA TRACKING] New instructor template created:', newTemplate);
    setNewInstructorTemplate(newTemplate);
    setIsAddingNew(true);
    setIsClosing(false);
    setOriginRect(null); // Center animation for new
  };

  const handleBulkUpload = () => {
      setShowAddChoice(false);
      setIsArchiveMode(false);
      setShowBulkUpdate(true);
  };

  const toggleArchiveMode = () => {
    setIsArchiveMode(!isArchiveMode);
    setSelectedInstructor(null);
  }

  const renderInstructorList = (instructors: Instructor[]) => (
    <ul className="space-y-2">
      {instructors.map((instructor, index) => (
        <li
          id={`instructor-row-${instructor.name}`}
          key={instructor.name}
          className={`group p-2 rounded-md transition-all duration-200 cursor-pointer flex items-center justify-between space-x-3 text-sm ${selectedInstructor?.name === instructor.name ? 'bg-sky-700 text-white' : 'bg-gray-700/30 text-gray-300'} ${isArchiveMode ? 'hover:bg-red-900/70' : 'hover:bg-sky-800 hover:text-white'}`}
          onMouseEnter={(e) => handleMouseEnter(e, instructor.name)}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => {
              if (isArchiveMode) {
                  setInstructorToArchive(instructor);
              } else {
                  handleInstructorClick(e, instructor);
              }
          }}
        >
          <div className="flex items-center space-x-3 flex-grow min-w-0">
             <span className="font-mono text-gray-500 w-6 flex-shrink-0 text-right text-xs">{index + 1}.</span>
            <span className="font-mono text-gray-500 w-12 flex-shrink-0 text-right text-xs">{instructor.rank}</span>
            <span className="flex-grow truncate font-medium">{instructor.name}</span>
          </div>
          {isArchiveMode && (
              <div className="p-1 rounded-full text-red-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
              </div>
          )}
        </li>
      ))}
    </ul>
  );

  const renderInstructorUnitCard = (unit: string) => (
    <div key={unit} className={`bg-gray-800 border rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh] ${isAirCombatModel ? 'border-emerald-400/80 shadow-emerald-500/20' : 'border-gray-700'}`}>
        <div className={`p-3 border-b bg-gray-800/80 flex justify-between items-center rounded-t-lg backdrop-blur-sm ${isAirCombatModel ? 'border-emerald-400/40' : 'border-gray-700'}`}>
            <h3 className="text-lg font-bold text-sky-400">{unit}</h3>
            <span className="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{qfisByUnit[unit].length} Staff</span>
        </div>
        <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
            {renderInstructorList(qfisByUnit[unit])}
        </div>
    </div>
  );

  const renderFlightCard = (flight: string) => (
    <div key={`flight-${flight}`} className="bg-gray-800 border border-cyan-900/50 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
        <div className="p-3 border-b border-cyan-900/50 bg-gray-800/80 flex justify-between items-center rounded-t-lg backdrop-blur-sm">
            <div>
                <h3 className="text-lg font-bold text-cyan-400">{flight} Flight</h3>
                <p className="text-xs text-gray-400">Flight staff</p>
            </div>
            <span className="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{qfisByFlight[flight].length}</span>
        </div>
        <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
            {renderInstructorList(qfisByFlight[flight])}
        </div>
    </div>
  );

  const renderSupportStaffCards = () => (
    <>
        {/* SIM IPs - single combined card regardless of unit */}
        {simIps.length > 0 && (
            <div className="bg-gray-800 border border-teal-900/50 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
                <div className="p-3 border-b border-teal-900/50 bg-gray-800/80 flex justify-between items-center rounded-t-lg backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-teal-400">SIM IP</h3>
                    <span className="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{simIps.length}</span>
                </div>
                <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                    {renderInstructorList(simIps)}
                </div>
            </div>
        )}

        {/* OFIs */}
        {sortedOfiUnits.map(unit => (
            <div key={`ofi-${unit}`} className="bg-gray-800 border border-purple-900/50 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
                <div className="p-3 border-b border-purple-900/50 bg-gray-800/80 flex justify-between items-center rounded-t-lg backdrop-blur-sm">
                    <div>
                        <h3 className="text-lg font-bold text-purple-400">OFIs</h3>
                        <p className="text-xs text-gray-400">{unit}</p>
                    </div>
                    <span className="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{ofisByUnit[unit].length}</span>
                </div>
                <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                    {renderInstructorList(ofisByUnit[unit])}
                </div>
            </div>
        ))}

        {/* Other Staff - All staff who don't fit into instructor, SIM IP, or OFI categories */}
        {sortedOtherStaffUnits.map(unit => (
            <div key={`other-${unit}`} className="bg-gray-800 border border-orange-900/50 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
                <div className="p-3 border-b border-orange-900/50 bg-gray-800/80 flex justify-between items-center rounded-t-lg backdrop-blur-sm">
                    <div>
                        <h3 className="text-lg font-bold text-orange-400">Other Staff</h3>
                        <p className="text-xs text-gray-400">{unit}</p>
                    </div>
                    <span className="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{otherStaffByUnit[unit].length}</span>
                </div>
                <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                    {renderInstructorList(otherStaffByUnit[unit])}
                </div>
            </div>
        ))}
    </>
  );

  return (
    <>
      <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-white">Staff</h1>
              </div>
              <div className="flex-1"></div>
              <div className="flex items-center gap-[1px]">
                <button
                    onClick={() => setShowArchivedFlyout(true)}
                    className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed"
                >
                    View Archived
                </button>
                <button
                    onClick={toggleArchiveMode}
                    className={`w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed ${isArchiveMode ? 'text-green-500' : 'text-black'}`}
                >
                    {isArchiveMode ? 'Done' : 'Archive'}
                </button>
                <button
                    onClick={handleShowAddChoice}
                    className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-green-500"
                >
                    Add Staff
                </button>
                <div className="w-[8px]"></div>
                <AuditButton pageName="Staff" />
              </div>
            </div>

            {/* Grid Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                 {isAirCombatModel ? (
                    <div className="flex flex-col xl:flex-row gap-6 max-w-[1920px] mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:block xl:w-[360px] xl:flex-shrink-0 gap-6 xl:space-y-6">
                            {sortedUnits.map(renderInstructorUnitCard)}
                        </div>
                        <div className="flex-1 space-y-6 min-w-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {sortedFlightGroups.map(renderFlightCard)}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {renderSupportStaffCards()}
                            </div>
                        </div>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-[1920px] mx-auto">
                        {sortedUnits.map(renderInstructorUnitCard)}
                        {renderSupportStaffCards()}
                    </div>
                 )}
            </div>
      </div>

      {/* Profile Overlay - Centred Modal (same as Trainee profile) */}
      {(selectedInstructor || (isAddingNew && newInstructorTemplate)) && (
                <InstructorProfileFlyout
                    instructor={isAddingNew && newInstructorTemplate ? newInstructorTemplate : selectedInstructor!}
                    onClose={handleCloseProfile}
                    school={school}
                    personnelData={personnelData}
                    onUpdateInstructor={onUpdateInstructor}
                    onNavigateToCurrency={onNavigateToCurrency}
                    originRect={originRect}
                    isClosing={isClosing}
                    isCreating={isAddingNew}
                    locations={locations}
                    units={units}
                    traineesData={traineesData}
                    events={events}
                    scheduleHistoryEvents={scheduleHistoryEvents}
                    syllabusDetails={syllabusDetails}
                    insertEventTypes={insertEventTypes}
                    aircraftConfigurations={aircraftConfigurations}
                    onInsertAirCombatTrainingEvent={onInsertAirCombatTrainingEvent}
                    onUpdateAirCombatTrainingEvent={onUpdateAirCombatTrainingEvent}
                    onGenerateAirCombatTrainingReport={onGenerateAirCombatTrainingReport}
                    onViewLogbook={onViewLogbook}
                    onRequestSct={() => {
                        if (onRequestSct) {
                            const instructorToPass = isAddingNew && newInstructorTemplate ? newInstructorTemplate : selectedInstructor!;
                            onRequestSct(instructorToPass);
                        }
                    }}
                    onNavigateToTrainee={onNavigateToTrainee}
                    masterCurrencies={masterCurrencies}
                    currencyRequirements={currencyRequirements}
                    profileInitialTab={profileInitialTab}
                    onProfileTabConsumed={onProfileTabConsumed}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    resourceDisplayNames={resourceDisplayNames}
                    personnelDisplaySettings={personnelDisplaySettings}
                    instructorLabel={instructorLabel}
                    operationalModel={operationalModel}
                />
        )}

      {/* Hover Flyout */}
      {hoveredInstructor && flyoutPosition && (
        <FlightInfoFlyout
          events={events.filter(f => f.instructor === hoveredInstructor)}
          position={flyoutPosition}
          personName={hoveredInstructor}
          personType="Instructor"
        />
      )}
      {showAddChoice && (
        <AddInstructorChoiceFlyout
          onClose={() => setShowAddChoice(false)}
          onIndividual={handleAddIndividual}
          onBulk={handleBulkUpload}
        />
      )}
      {showBulkUpdate && (
        <BulkUpdateFlyout
            onClose={() => setShowBulkUpdate(false)}
            onBulkUpdateInstructors={onBulkUpdateInstructors}
            instructorsData={instructorsData}
        />
      )}
      {instructorToArchive && (
        <ArchiveConfirmationFlyout
          instructorName={instructorToArchive.name}
          onConfirm={() => {
            onArchiveInstructor(instructorToArchive.idNumber);
            setInstructorToArchive(null);
            setIsArchiveMode(false);
          }}
          onClose={() => setInstructorToArchive(null)}
        />
      )}
      {showArchivedFlyout && (
        <ArchivedInstructorsFlyout
            archivedInstructors={archivedInstructorsData}
            onClose={() => setShowArchivedFlyout(false)}
            onRestore={onRestoreInstructor}
        />
      )}
    </>
  );
};

export default InstructorListView;
