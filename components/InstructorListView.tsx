
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
import PermissionNotice from './PermissionNotice';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';
import { showDarkAlert, showDarkPrompt } from './DarkMessageModal';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import {
    comparePeopleByConfiguredRank,
    getSimIpDisplayLabel,
    getRankSortIndex,
    splitPersonName,
    type PersonnelDisplaySettings,
} from '../utils/personnelDisplaySettings';
import { isFixedCrewLikeOperationalModel, normaliseOperationalModel, type OperationalModelCode, type PlatformConfig } from '../utils/platformConfigService';
import { type InsertEventTypeConfig } from '../utils/insertEventTypes';
import { type AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import { findCrewPositionEntry, getCrewPositionOptions, type CrewPositionTerminology } from '../utils/crewPositionTerminology';
import { getStaffRoleDisplay } from '../utils/staffRoleColours';
import { scheduleEventIncludesPersonRecord } from '../utils/scheduleEventPersonnel';
import {
    getPersonAssignedQualificationIds,
    personHasInstructorQualification,
    type StaffQualificationCatalogue,
} from '../utils/staffQualifications';
import type { SctTerminology } from '../utils/sctTerminology';
import type { InsertLmpEventRequest } from './TraineeLmpView';
import { buildCompactPersonNameResolver, getPersonDomIdSuffix, getPersonStableKey, samePersonRecord } from '../utils/personIdentity';

const isPilotRole = (instructor: Instructor): boolean =>
    String(instructor.role || '').trim().toLowerCase() === 'pilot';
const isActiveStaffRecord = (instructor: Instructor): boolean =>
    (instructor as any)?.isActive !== false;
const getStaffArchiveIdentifier = (instructor: Instructor): string | number | null => {
    const dbId = String((instructor as any).id || '').trim();
    return dbId || instructor.idNumber || null;
};
const hasInstructorQualification = (
    instructor: Instructor,
    staffQualificationCatalogue?: StaffQualificationCatalogue,
): boolean =>
    personHasInstructorQualification(instructor, staffQualificationCatalogue);
const isContractorStaffRole = (
    instructor: Instructor,
    staffQualificationCatalogue?: StaffQualificationCatalogue,
): boolean =>
    getPersonAssignedQualificationIds(instructor, staffQualificationCatalogue, false).includes('contractor');
const isOfiSupportRole = (instructor: Instructor): boolean =>
    String(instructor.role || '').trim().toUpperCase() === 'OFI' || instructor.isOFI === true;
const getConfiguredQualificationLabel = (
    catalogue: StaffQualificationCatalogue | undefined,
    qualificationId: string,
    fallback: string,
): string => {
    const targetId = String(qualificationId || '').trim().toLowerCase();
    const match = catalogue?.qualifications?.find((qualification) =>
        String(qualification.id || '').trim().toLowerCase() === targetId
    );
    return String(match?.name || match?.code || fallback).trim() || fallback;
};
const isConfiguredCrewPositionRole = (
    instructor: Instructor,
    terminology?: CrewPositionTerminology,
): boolean => Boolean(findCrewPositionEntry(instructor.role, terminology));
const isSupportStaffRole = (
    instructor: Instructor,
    staffQualificationCatalogue?: StaffQualificationCatalogue,
): boolean => {
    return isContractorStaffRole(instructor, staffQualificationCatalogue) || isOfiSupportRole(instructor);
};
const isActiveStaffListRole = (
    instructor: Instructor,
    terminology: CrewPositionTerminology | undefined,
    isFixedCrewModel: boolean,
    staffQualificationCatalogue?: StaffQualificationCatalogue,
): boolean => {
    if (instructor.isAdminStaff || isSupportStaffRole(instructor, staffQualificationCatalogue)) return false;
    if (isFixedCrewModel) return true;
    return hasInstructorQualification(instructor, staffQualificationCatalogue) || isPilotRole(instructor) || isConfiguredCrewPositionRole(instructor, terminology);
};
const getInstructorCrewGroup = (instructor: Instructor): string => (
    String(instructor.crew || instructor.preferences?.crew || '').trim()
);
const getStaffRoleFilterOption = (
    role: string | undefined,
    terminology: CrewPositionTerminology | undefined,
    instructorLabel: string,
    simIpDisplayLabel: string,
): { value: string; label: string } => {
    const roleDisplay = getStaffRoleDisplay(role, terminology, instructorLabel, simIpDisplayLabel);
    return { value: `role:${roleDisplay.key}`, label: roleDisplay.label };
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const getDefaultNewStaffRole = (
    operationalModel: OperationalModelCode,
    terminology?: CrewPositionTerminology,
): string => {
    return getCrewPositionOptions(terminology, [], operationalModel)[0] || 'Pilot';
};

const generateNewInstructorTemplate = (defaultLocation = '', defaultUnit = '', defaultRole = 'Pilot', defaultIsQfi = false): Instructor => ({
    idNumber: 0,
    name: '',
    rank: '',
    role: defaultRole,
    callsignNumber: 0,
    category: 'C',
    isTestingOfficer: false,
    seatConfig: 'Normal',
    isExecutive: false,
    isFlyingSupervisor: false,
    isIRE: false,
    isQFI: defaultIsQfi,
    location: defaultLocation,
    unit: defaultUnit,
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
  onAddTrainingReport?: (staff: Instructor) => void;
  school: string;
  personnelData: Map<string, { callsignPrefix: string; callsignNumber: number; callsign?: string }>;
  onUpdateInstructor: (data: Instructor) => void | Promise<void>;
  onNavigateToCurrency: (person: Instructor) => void;
  onBulkUpdateInstructors: (instructors: Instructor[]) => void;
  onArchiveInstructor: (id: string | number | null) => Promise<void> | void;
  onRestoreInstructor: (id: string | number | null) => Promise<void> | void;
  locations: string[];
  units: string[];
  selectedPersonForProfile?: Instructor | null;
  onNavigateToTrainee?: (trainee: Trainee) => void;
  onProfileOpened?: () => void;
  onViewLogbook?: (person: Instructor) => void;
  onRequestSct: (instructor: Instructor) => void;
  masterCurrencies?: MasterCurrency[];
  currencyRequirements?: CurrencyRequirement[];
  profileInitialTab?: 'currency' | 'trainingReports' | null;
  onProfileTabConsumed?: () => void;
  currentUserId?: string;
  currentUserName?: string;
  currentUserRole?: string;
  resourceDisplayNames?: ResourceDisplayNames;
  personnelDisplaySettings?: PersonnelDisplaySettings;
  instructorLabel?: string;
  operationalModel?: string;
  platformConfig?: PlatformConfig | null;
  crewPositionTerminology?: CrewPositionTerminology;
  staffQualificationCatalogue?: StaffQualificationCatalogue;
  sctTerminology?: SctTerminology;
  trainingReportDisplayName?: string;
  trainingReportStatusFieldLabel?: string;
  defaultUnitCode?: string;
  defaultLocationName?: string;
  canUsePlatformPermission?: (permissionId: string) => boolean;
}

const InstructorListView: React.FC<InstructorListViewProps> = ({
    onClose,
    events,
    traineesData,
    instructorsData,
    archivedInstructorsData,
    scheduleHistoryEvents = [],
    syllabusDetails = [],
    insertEventTypes = [],
    aircraftConfigurations = [],
    onInsertAirCombatTrainingEvent,
    onUpdateAirCombatTrainingEvent,
    onGenerateAirCombatTrainingReport,
    onAddTrainingReport,
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
    currentUserRole,
    resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
    personnelDisplaySettings,
    instructorLabel = 'Instructor',
    operationalModel = 'flight_school',
    platformConfig = null,
    crewPositionTerminology,
    staffQualificationCatalogue,
    sctTerminology,
    trainingReportDisplayName = 'Training Report',
    trainingReportStatusFieldLabel = 'Mission Status',
    defaultUnitCode = '',
    defaultLocationName = '',
    canUsePlatformPermission,
}) => {
  const [hoveredInstructor, setHoveredInstructor] = useState<{ instructor: Instructor; events: ScheduleEvent[] } | null>(null);
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
  const [selectedStaffRoleFilter, setSelectedStaffRoleFilter] = useState('ALL');
  const [permissionNoticeRect, setPermissionNoticeRect] = useState<DOMRect | null>(null);
  const staffNameResolver = useMemo(() => buildCompactPersonNameResolver(instructorsData as any), [instructorsData]);
  const canUsePermission = canUsePlatformPermission || (() => true);
  const normaliseIdentityValue = (value?: string | number | null): string => (
    String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9@.]/g, '')
  );
  const isCurrentUserStaffRecord = (instructor: Instructor): boolean => {
    const userKeys = [
      currentUserId,
      currentUserName,
    ].map(normaliseIdentityValue).filter(Boolean);
    if (userKeys.length === 0) return false;
    const staffKeys = [
      (instructor as any).id,
      (instructor as any).userId,
      (instructor as any).personnelId,
      instructor.idNumber,
      instructor.email,
      instructor.name,
    ].map(normaliseIdentityValue).filter(Boolean);
    return userKeys.some(key => staffKeys.includes(key));
  };
  const canViewStaffProfile = (instructor: Instructor): boolean => (
    isCurrentUserStaffRecord(instructor) || canUsePermission('staff.profile.view')
  );
  const canEditStaffDetails = canUsePermission('staff.edit') || canUsePermission('staff.profile.edit');
  const canManageArchive = canEditStaffDetails;

  useEffect(() => {
    if (selectedPersonForProfile) {
        if (!canViewStaffProfile(selectedPersonForProfile)) {
            return;
        }
        // Try to find element, though in grid it might be scrolled out.
        // If not found, originRect is null, which flyout handles gracefully (fades in center)
        const matchingElement = document.getElementById(`instructor-row-${getPersonDomIdSuffix(selectedPersonForProfile as any, 'staff')}`);
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
        const updatedInstructor = instructorsData.find(i => samePersonRecord(i as any, selectedInstructor as any));
        if (updatedInstructor) {
            // Compare unavailability content specifically to detect iOS-submitted changes
            const prevUnavailHash = JSON.stringify((selectedInstructor.unavailability || []).map((u: any) => u.id).sort());
            const newUnavailHash  = JSON.stringify((updatedInstructor.unavailability  || []).map((u: any) => u.id).sort());
            const unavailChanged = prevUnavailHash !== newUnavailHash;
            const preferencesChanged = JSON.stringify(selectedInstructor.preferences || {}) !== JSON.stringify(updatedInstructor.preferences || {});

            // Also check other key fields
            const otherChanged = updatedInstructor.name !== selectedInstructor.name ||
                updatedInstructor.email !== selectedInstructor.email ||
                updatedInstructor.phoneNumber !== selectedInstructor.phoneNumber ||
                (updatedInstructor as any).userId !== (selectedInstructor as any).userId ||
                (updatedInstructor as any).isActive !== (selectedInstructor as any).isActive;

            if (unavailChanged || preferencesChanged || otherChanged) {
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

  const activeOperationalModel = normaliseOperationalModel(operationalModel);
  const isAirCombatModel = activeOperationalModel === 'air_combat';
  const isPooledCrewModel = activeOperationalModel === 'pooled_crew';
  const isFixedCrewModel = isFixedCrewLikeOperationalModel(activeOperationalModel);
  const useRoleColours = isAirCombatModel || isFixedCrewModel;
  const useOperationalStaffListBorder = isAirCombatModel || isFixedCrewModel;
  const simIpDisplayLabel = useMemo(
      () => getSimIpDisplayLabel(personnelDisplaySettings),
      [personnelDisplaySettings],
  );
  const contractorStaffEnabled = personnelDisplaySettings.simIpDisplayEnabled !== false;
  const contractorStaffGroupLabel = simIpDisplayLabel.trim() || 'Contractor Staff';
  const ofiGroupLabel = useMemo(
      () => getConfiguredQualificationLabel(staffQualificationCatalogue, 'ofi', 'OFI'),
      [staffQualificationCatalogue],
  );

  const getPooledCrewFlightRoleOrder = (instructor: Instructor): number => {
      const roleDisplay = getStaffRoleDisplay(instructor.role, crewPositionTerminology, instructorLabel, simIpDisplayLabel);
      const roleText = `${instructor.role || ''} ${roleDisplay.label || ''}`.trim().toLowerCase();
      if (/\bpilot\b/.test(roleText)) return 0;
      if (/\bload\s*master\b|\bloadmaster\b/.test(roleText)) return 1;
      return 2;
  };

  const comparePooledCrewFlightStaff = (a: Instructor, b: Instructor): number => {
      const rankCompare = getRankSortIndex(a.rank, personnelDisplaySettings, 'staff') - getRankSortIndex(b.rank, personnelDisplaySettings, 'staff');
      if (rankCompare) return rankCompare;
      const roleCompare = getPooledCrewFlightRoleOrder(a) - getPooledCrewFlightRoleOrder(b);
      if (roleCompare) return roleCompare;
      const aName = splitPersonName(a);
      const bName = splitPersonName(b);
      return collator.compare(aName.surname, bName.surname)
          || collator.compare(aName.given, bName.given)
          || collator.compare(aName.full, bName.full);
  };

  const qfis = useMemo(() => {
      return instructorsData
          .filter(isActiveStaffRecord)
          .filter(i => isActiveStaffListRole(i, crewPositionTerminology, isFixedCrewModel, staffQualificationCatalogue))
          .sort((a, b) => comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff'));
  }, [instructorsData, isFixedCrewModel, personnelDisplaySettings, crewPositionTerminology, staffQualificationCatalogue]);

  const staffRoleFilterOptions = useMemo(() => {
      const optionMap = new Map<string, string>();
      qfis.forEach(instructor => {
          const option = getStaffRoleFilterOption(instructor.role, crewPositionTerminology, instructorLabel, simIpDisplayLabel);
          optionMap.set(option.value, option.label);
      });

      const roleOptions = Array.from(optionMap.entries())
          .map(([value, label]) => ({ value, label }))
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

      return [{ value: 'ALL', label: 'All' }, ...roleOptions];
  }, [qfis, crewPositionTerminology, instructorLabel, simIpDisplayLabel]);

  useEffect(() => {
      if (selectedStaffRoleFilter !== 'ALL' && !staffRoleFilterOptions.some(option => option.value === selectedStaffRoleFilter)) {
          setSelectedStaffRoleFilter('ALL');
      }
  }, [selectedStaffRoleFilter, staffRoleFilterOptions]);

  const filteredQfis = useMemo(() => {
      if (selectedStaffRoleFilter === 'ALL') {
          return qfis;
      }
      return qfis.filter(instructor =>
          getStaffRoleFilterOption(instructor.role, crewPositionTerminology, instructorLabel, simIpDisplayLabel).value === selectedStaffRoleFilter
      );
  }, [qfis, selectedStaffRoleFilter, crewPositionTerminology, instructorLabel, simIpDisplayLabel]);

  const qfisByUnit = useMemo(() => {
      const groups: { [key: string]: Instructor[] } = {};
      filteredQfis.forEach(instructor => {
          const unit = instructor.unit || 'Unassigned';
          if (!groups[unit]) {
              groups[unit] = [];
          }
          groups[unit].push(instructor);
      });
      return groups;
  }, [filteredQfis]);

  const sortedUnits = useMemo(() =>
      Object.keys(qfisByUnit).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
  [qfisByUnit]);

  const qfisByFlight = useMemo(() => {
      if (!isAirCombatModel && !isPooledCrewModel) return {};
      const groups: { [key: string]: Instructor[] } = {};
      filteredQfis.forEach(instructor => {
          const flight = String(instructor.flight || '').trim().toUpperCase() || (isPooledCrewModel ? 'Unassigned' : '');
          if (!flight) return;
          if (!groups[flight]) {
              groups[flight] = [];
          }
          groups[flight].push(instructor);
      });
      if (isPooledCrewModel) {
          Object.values(groups).forEach(group => group.sort(comparePooledCrewFlightStaff));
      }
      return groups;
  }, [isAirCombatModel, isPooledCrewModel, filteredQfis, personnelDisplaySettings, crewPositionTerminology, instructorLabel]);

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
        const simIpCandidates = instructorsData
            .filter(isActiveStaffRecord)
            .filter(i => isContractorStaffRole(i, staffQualificationCatalogue));
        return simIpCandidates.sort((a, b) => {
            // First sort by Unit
            const unitA = a.unit || 'Unassigned';
            const unitB = b.unit || 'Unassigned';
            if (unitA !== unitB) {
                return unitA.localeCompare(unitB);
            }
            return comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff');
        });
    }, [instructorsData, personnelDisplaySettings, staffQualificationCatalogue]);

    const ofis = useMemo(() => {
        const ofiCandidates = instructorsData.filter(isActiveStaffRecord).filter(i => {
            const isOfi = isOfiSupportRole(i);
            return isOfi;
        });

        const sorted = ofiCandidates.sort((a, b) => {
            // First sort by Unit
            const unitA = a.unit || 'Unassigned';
            const unitB = b.unit || 'Unassigned';
            if (unitA !== unitB) {
                return unitA.localeCompare(unitB);
            }
            return comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff');
        });
        return sorted;
    }, [instructorsData, personnelDisplaySettings]);

    // NEW: All other staff members who don't fit into instructor, contractor staff, or OFI categories
    const otherStaff = useMemo(() => {
        const otherStaffCandidates = instructorsData.filter(isActiveStaffRecord).filter(i => {
            // Keep recognised active flying/crew staff in the main staff list.
            const isMainStaff = isActiveStaffListRole(i, crewPositionTerminology, isFixedCrewModel, staffQualificationCatalogue);
            const isSimIp = isContractorStaffRole(i, staffQualificationCatalogue);
            const isOfi = isOfiSupportRole(i);

            // Include everyone else
            const isOther = !isMainStaff && !isSimIp && !isOfi;
            return isOther;
        });

        return otherStaffCandidates.sort((a, b) => {
            // First sort by Unit
            const unitA = a.unit || 'Unassigned';
            const unitB = b.unit || 'Unassigned';
            if (unitA !== unitB) {
                return unitA.localeCompare(unitB);
            }
            return comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff');
        });
    }, [instructorsData, isFixedCrewModel, personnelDisplaySettings, crewPositionTerminology, staffQualificationCatalogue]);

  const fixedCrewGroups = useMemo(() => {
      if (!isFixedCrewModel) return {};
      const groups: { [key: string]: Instructor[] } = {};
      filteredQfis.forEach(instructor => {
          const crewName = getInstructorCrewGroup(instructor);
          if (!crewName) return;
          if (!groups[crewName]) {
              groups[crewName] = [];
          }
          groups[crewName].push(instructor);
      });
      return groups;
  }, [filteredQfis, isFixedCrewModel]);

  const sortedFixedCrewGroups = useMemo(() =>
      Object.keys(fixedCrewGroups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
  [fixedCrewGroups]);

  // Contractor staff are shown as a single combined section (not split by unit)
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
      Object.keys(ofisByUnit).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
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
      Object.keys(otherStaffByUnit).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
  [otherStaffByUnit]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLLIElement>, instructor: Instructor) => {
    if (selectedInstructor || isArchiveMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredInstructor({
      instructor,
      events: events.filter(event => scheduleEventIncludesPersonRecord(event, instructor as any, {
        personType: 'staff',
        allPeople: instructorsData as any,
      })),
    });
    setFlyoutPosition({ top: rect.top, left: rect.right + 10 });
  };

  const handleMouseLeave = () => {
    setHoveredInstructor(null);
    setFlyoutPosition(null);
  };

  const handleInstructorClick = (e: React.MouseEvent<HTMLLIElement>, instructor: Instructor) => {
    if (!canViewStaffProfile(instructor)) {
        setPermissionNoticeRect(e.currentTarget.getBoundingClientRect());
        return;
    }
    if (selectedInstructor && samePersonRecord(selectedInstructor as any, instructor as any)) {
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

  const handleShowAddChoice = (anchor: HTMLElement) => {
    if (!canEditStaffDetails) {
      setPermissionNoticeRect(anchor.getBoundingClientRect());
      return;
    }
    setIsArchiveMode(false);
    setShowAddChoice(true);
  }

  const handleAddIndividual = () => {
    setShowAddChoice(false);
    setIsArchiveMode(false);
    setSelectedInstructor(null);
    const newTemplate = generateNewInstructorTemplate(
        defaultLocationName || locations?.[0] || '',
        defaultUnitCode || units?.[0] || '',
        getDefaultNewStaffRole(activeOperationalModel, crewPositionTerminology),
        activeOperationalModel === 'flight_school',
    );
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

  const requestArchivePassword = async (message: string, title: string): Promise<boolean> => {
    const password = await showDarkPrompt({
        title,
        message,
        inputLabel: 'Password',
        inputType: 'password',
        inputPlaceholder: 'Enter password',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        variant: 'warning',
    });
    if (!password) return false;
    try {
        const isValid = await verifyCurrentUserPassword(password);
        if (!isValid) {
            await showDarkAlert('The password was not accepted.', title, 'warning');
            return false;
        }
        return true;
    } catch (error) {
        await showDarkAlert('The app could not verify your password.', 'Password Check Failed', 'error');
        return false;
    }
  };

  const toggleArchiveMode = (anchor: HTMLElement) => {
    if (!canManageArchive) {
      setPermissionNoticeRect(anchor.getBoundingClientRect());
      return;
    }
    setIsArchiveMode(!isArchiveMode);
    setSelectedInstructor(null);
  }

  const renderInstructorList = (instructors: Instructor[], muted = false) => (
    <ul className="space-y-2">
      {instructors.map((instructor, index) => {
        const roleDisplay = getStaffRoleDisplay(instructor.role, crewPositionTerminology, instructorLabel, simIpDisplayLabel);
        const roleTextClass = muted ? 'text-gray-500' : (useRoleColours ? roleDisplay.textClassName : 'text-gray-300');
        return (
          <li
            id={`instructor-row-${getPersonDomIdSuffix(instructor as any, 'staff')}`}
            key={getPersonStableKey(instructor as any, 'staff')}
            className={`group p-2 rounded-md transition-all duration-200 cursor-pointer flex items-center justify-between space-x-3 text-sm ${
                muted
                    ? 'bg-gray-800/25 text-gray-500 hover:bg-gray-800/40 hover:text-gray-400'
                    : `${selectedInstructor && samePersonRecord(selectedInstructor as any, instructor as any) ? 'bg-sky-700 text-white' : 'bg-gray-700/30 text-gray-300'} ${isArchiveMode ? 'hover:bg-red-900/70' : 'hover:bg-sky-800 hover:text-white'}`
            }`}
            onMouseEnter={(e) => handleMouseEnter(e, instructor)}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => {
                if (isArchiveMode) {
                    if (!canManageArchive) return;
                    setInstructorToArchive(instructor);
                } else {
                    handleInstructorClick(e, instructor);
                }
            }}
            title={useRoleColours ? `${instructor.name} - ${roleDisplay.label}` : instructor.name}
          >
            <div className="flex items-center space-x-3 flex-grow min-w-0">
               <span className={`font-mono w-6 flex-shrink-0 text-right text-xs ${muted ? 'text-gray-600' : 'text-gray-500'}`}>{index + 1}.</span>
              <span className={`font-mono w-12 flex-shrink-0 text-right text-xs ${muted ? 'text-gray-600' : 'text-gray-500'}`}>{instructor.rank}</span>
              <span className={`flex-grow truncate font-medium ${roleTextClass}`}>{staffNameResolver.formatList(instructor as any)}</span>
            </div>
            {useRoleColours && (
                <span className={`max-w-[6rem] flex-shrink-0 truncate text-[10px] font-semibold ${roleTextClass}`}>
                    {roleDisplay.label}
                </span>
            )}
            {isArchiveMode && (
                <div className="p-1 rounded-full text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  const renderStaffRoleFilterSelect = () => (
    <label className="flex items-center gap-2 min-w-0">
        <span className="sr-only">Filter staff by role</span>
        <select
            value={selectedStaffRoleFilter}
            onChange={(event) => setSelectedStaffRoleFilter(event.target.value)}
            className="w-[60px] max-w-[60px] bg-gray-900/45 border border-gray-700/70 text-gray-300 text-[10px] font-semibold rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500/70 focus:border-sky-500/70"
            title="Filter staff by role"
        >
            {staffRoleFilterOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    </label>
  );

  const renderInstructorUnitCard = (unit: string) => (
    <div key={unit} className={`bg-gray-800 border rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh] ${useOperationalStaffListBorder ? 'border-emerald-400/80 shadow-emerald-500/20' : 'border-gray-700'}`}>
        <div className={`p-3 border-b bg-gray-800/80 grid grid-cols-[60px_1fr_minmax(0,5rem)] gap-2 items-center rounded-t-lg backdrop-blur-sm ${useOperationalStaffListBorder ? 'border-emerald-400/40' : 'border-gray-700'}`}>
            {renderStaffRoleFilterSelect()}
            <h3 className="text-lg font-bold text-sky-400 text-center truncate">{unit}</h3>
            <span className="justify-self-end text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded-full whitespace-nowrap">{qfisByUnit[unit].length} Staff</span>
        </div>
        <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
            {renderInstructorList(qfisByUnit[unit])}
        </div>
    </div>
  );

  const renderFlightCard = (flight: string) => (
    <div key={`flight-${flight}`} className="bg-gray-800 border border-cyan-900/50 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
        <div className="p-3 border-b border-cyan-900/50 bg-gray-800/80 grid grid-cols-[3.5rem_1fr_3.5rem] items-center rounded-t-lg backdrop-blur-sm">
            <span aria-hidden="true" />
            <h3 className="text-lg font-bold text-cyan-400 text-center truncate">{flight} Flight</h3>
            <span className="justify-self-end text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{qfisByFlight[flight].length}</span>
        </div>
        <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
            {renderInstructorList(qfisByFlight[flight])}
        </div>
    </div>
  );

  const renderFixedCrewCard = (crewName: string) => (
    <div key={`fixed-crew-${crewName}`} className="bg-gray-800 border border-sky-900/50 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
        <div className="p-3 border-b border-sky-900/50 bg-gray-800/80 grid grid-cols-[3.5rem_1fr_3.5rem] items-center rounded-t-lg backdrop-blur-sm">
            <span aria-hidden="true" />
            <h3 className="text-lg font-bold text-sky-400 text-center truncate">Crew {crewName}</h3>
            <span className="justify-self-end text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{fixedCrewGroups[crewName].length}</span>
        </div>
        <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
            {renderInstructorList(fixedCrewGroups[crewName])}
        </div>
    </div>
  );

  const renderSupportStaffCards = () => (
    <>
        {simIps.length > 0 && (
            <div
                className={`bg-gray-800 border rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh] ${
                    contractorStaffEnabled ? 'border-teal-900/50' : 'border-gray-700/70 opacity-70'
                }`}
                title={contractorStaffEnabled ? contractorStaffGroupLabel : `${contractorStaffGroupLabel} is disabled in Settings`}
            >
                <div className={`p-3 border-b bg-gray-800/80 flex justify-between items-center rounded-t-lg backdrop-blur-sm ${contractorStaffEnabled ? 'border-teal-900/50' : 'border-gray-700/70'}`}>
                    <h3 className={`text-lg font-bold ${contractorStaffEnabled ? 'text-teal-400' : 'text-gray-500'}`}>{contractorStaffGroupLabel}</h3>
                    <span className={`text-xs font-mono px-2 py-1 rounded-full ${contractorStaffEnabled ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-500'}`}>{simIps.length}</span>
                </div>
                <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                    {renderInstructorList(simIps, !contractorStaffEnabled)}
                </div>
            </div>
        )}

        {/* OFIs */}
        {sortedOfiUnits.map(unit => (
            <div key={`ofi-${unit}`} className="bg-gray-800 border border-purple-900/50 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
                <div className="p-3 border-b border-purple-900/50 bg-gray-800/80 flex justify-between items-center rounded-t-lg backdrop-blur-sm">
                    <div>
                        <h3 className="text-lg font-bold text-purple-400">{ofiGroupLabel}</h3>
                        <p className="text-xs text-gray-400">{unit}</p>
                    </div>
                    <span className="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{ofisByUnit[unit].length}</span>
                </div>
                <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                    {renderInstructorList(ofisByUnit[unit])}
                </div>
            </div>
        ))}

        {/* Other Staff - All staff who don't fit into instructor, contractor staff, or OFI categories */}
        {sortedOtherStaffUnits.map(unit => (
            <div key={`other-${unit}`} className="bg-gray-800 border border-orange-900/50 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
                <div className="p-3 border-b border-orange-900/50 bg-gray-800/80 flex justify-between items-center rounded-t-lg backdrop-blur-sm">
                    <div>
                        <h3 className="text-lg font-bold text-orange-400">{unit}</h3>
                        <p className="text-xs text-gray-400">Other Staff</p>
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
                    onClick={(event) => toggleArchiveMode(event.currentTarget)}
                    aria-disabled={!canManageArchive}
                    className={`w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed ${isArchiveMode ? 'text-green-500' : 'text-black'} ${canManageArchive ? '' : 'cursor-not-allowed'}`}
                >
                    {isArchiveMode ? 'Done' : 'Archive'}
                </button>
                <button
                    onClick={(event) => handleShowAddChoice(event.currentTarget)}
                    aria-disabled={!canEditStaffDetails}
                    className={`w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-green-500 ${canEditStaffDetails ? '' : 'cursor-not-allowed'}`}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {sortedFlightGroups.map(renderFlightCard)}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderSupportStaffCards()}
                            </div>
                        </div>
                    </div>
                 ) : isFixedCrewModel ? (
                    <div className="flex flex-col xl:flex-row gap-6 max-w-[1920px] mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:block xl:w-[360px] xl:flex-shrink-0 gap-6 xl:space-y-6">
                            {sortedUnits.map(renderInstructorUnitCard)}
                        </div>
                        <div className="flex-1 space-y-6 min-w-0">
                            {isPooledCrewModel ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {sortedFlightGroups.map(renderFlightCard)}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {sortedFixedCrewGroups.map(renderFixedCrewCard)}
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    instructorsData={instructorsData}
                    traineesData={traineesData}
                    events={events}
                    scheduleHistoryEvents={scheduleHistoryEvents}
                    syllabusDetails={syllabusDetails}
                    insertEventTypes={insertEventTypes}
                    aircraftConfigurations={aircraftConfigurations}
                    onInsertAirCombatTrainingEvent={onInsertAirCombatTrainingEvent}
                    onUpdateAirCombatTrainingEvent={onUpdateAirCombatTrainingEvent}
                    onGenerateAirCombatTrainingReport={onGenerateAirCombatTrainingReport}
                    onAddTrainingReport={onAddTrainingReport}
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
                    currentUserRole={currentUserRole}
                    resourceDisplayNames={resourceDisplayNames}
                    personnelDisplaySettings={personnelDisplaySettings}
                    instructorLabel={instructorLabel}
                    operationalModel={operationalModel}
                    platformConfig={platformConfig}
                    crewPositionTerminology={crewPositionTerminology}
                    staffQualificationCatalogue={staffQualificationCatalogue}
                    sctTerminology={sctTerminology}
                    trainingReportDisplayName={trainingReportDisplayName}
                    trainingReportStatusFieldLabel={trainingReportStatusFieldLabel}
                    canUsePlatformPermission={canUsePlatformPermission}
                />
        )}

      {/* Hover Flyout */}
      {hoveredInstructor && flyoutPosition && (
        <FlightInfoFlyout
          events={hoveredInstructor.events}
          position={flyoutPosition}
          personName={hoveredInstructor.instructor.name}
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
            crewPositionTerminology={crewPositionTerminology}
            staffQualificationCatalogue={staffQualificationCatalogue}
            defaultUnitCode={defaultUnitCode}
        />
      )}
      {instructorToArchive && (
        <ArchiveConfirmationFlyout
          instructorName={instructorToArchive.name}
          onConfirm={async () => {
            const passwordAccepted = await requestArchivePassword(
              `Enter your password to archive ${instructorToArchive.name}.`,
              'Archive Password Required',
            );
            if (!passwordAccepted) return;
            await onArchiveInstructor(getStaffArchiveIdentifier(instructorToArchive));
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
            canRestore={canManageArchive}
            onRequestRestorePassword={(instructorName) => requestArchivePassword(
              `Enter your password to restore ${instructorName}.`,
              'Restore Password Required',
            )}
        />
      )}
      <PermissionNotice
        anchorRect={permissionNoticeRect}
        onClose={() => setPermissionNoticeRect(null)}
      />
    </>
  );
};

export default InstructorListView;
