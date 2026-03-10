
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ScheduleEvent, Instructor, Trainee } from '../types';
import FlightInfoFlyout from './FlightInfoFlyout';
// FIX: Corrected import path for the InstructorProfileFlyout component.
import { InstructorProfileFlyout } from './InstructorProfileFlyout';
import AddInstructorChoiceFlyout from './AddInstructorChoiceFlyout';
import BulkUpdateFlyout from './BulkUpdateFlyout';
import ArchiveConfirmationFlyout from './ArchiveConfirmationFlyout';
import ArchivedInstructorsFlyout from './ArchivedInstructorsFlyout';
import AuditButton from './AuditButton';

// Helper to generate a unique random ID for new instructors
const generateRandomIdNumber = (): number => {
    return Math.floor(Math.random() * (9999999 - 1000000 + 1)) + 1000000;
};

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
  school: 'ESL' | 'PEA';
  personnelData: Map<string, { callsignPrefix: string; callsignNumber: number }>;
  onUpdateInstructor: (data: Instructor) => void;
  onNavigateToCurrency: (person: Instructor) => void;
  onBulkUpdateInstructors: (instructors: Instructor[]) => void;
  onArchiveInstructor: (id: number) => void;
  onRestoreInstructor: (id: number) => void;
  locations: string[];
  units: string[];
  selectedPersonForProfile?: Instructor | null;
  onProfileOpened?: () => void;
  onViewLogbook?: (person: Instructor) => void;
  onRequestSct: (instructor: Instructor) => void;
}

const InstructorListView: React.FC<InstructorListViewProps> = ({ 
    onClose, 
    events, 
    traineesData,
    instructorsData, 
    archivedInstructorsData,
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
    onRequestSct
}) => {
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
        const matchingElement = document.getElementById(`instructor-row-${selectedPersonForProfile.idNumber}`);
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
        const updatedInstructor = instructorsData.find(i => i.idNumber === selectedInstructor.idNumber);
        if (updatedInstructor && JSON.stringify(updatedInstructor) !== JSON.stringify(selectedInstructor)) {
            setSelectedInstructor(updatedInstructor);
        }
    }
  }, [instructorsData, selectedInstructor]);

  const qfis = useMemo(() => {
      const rankOrder: { [key: string]: number } = {
          'WGCDR': 1,
          'SQNLDR': 2,
          'FLTLT': 3,
          'FLGOFF': 4,
          'PLTOFF': 5,
          'Mr': 6
      };

      return instructorsData
          .filter(i => {
              // Filter by role/flag
              const isQFI = i.role === 'QFI' || i.isQFI === true;
              if (!isQFI) return false;
              
              // Filter by location
              if (school === 'ESL') {
                  // ESL: Only 1FTS and CFS staff
                  return i.unit === '1FTS' || i.unit === 'CFS';
              } else {
                  // PEA: Only 2FTS staff
                  return i.unit === '2FTS';
              }
          })
          .sort((a, b) => {
              const rankA = rankOrder[a.rank] || 99;
              const rankB = rankOrder[b.rank] || 99;
              
              if (rankA !== rankB) {
                  return rankA - rankB;
              }
              return (a.name ?? 'Unknown').localeCompare(b.name ?? 'Unknown');
          });
  }, [instructorsData, school]);

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

  const sortedUnits = useMemo(() => Object.keys(qfisByUnit).sort(), [qfisByUnit]);

  const simIps = useMemo(() => {
        console.log('🔍 [SIM IP FILTER] instructorsData length:', instructorsData.length);
        const simIpCandidates = instructorsData.filter(i => {
            const isSimIp = i.role === 'SIM IP';
            if (!isSimIp) return false;
            
            // Filter by location
            if (school === 'ESL') {
                // ESL: Only 1FTS Sim IPs (CFS has NO Sim IPs)
                const isValid = i.unit === '1FTS';
                if (isSimIp && isValid) {
                    console.log(`🔍 [SIM IP FILTER] Found ESL SIM IP: ${i.name} (${i.rank}) - Unit: ${i.unit}`);
                }
                return isValid;
            } else {
                // PEA: Only 2FTS Sim IPs
                const isValid = i.unit === '2FTS';
                if (isSimIp && isValid) {
                    console.log(`🔍 [SIM IP FILTER] Found PEA SIM IP: ${i.name} (${i.rank}) - Unit: ${i.unit}`);
                }
                return isValid;
            }
        });
        console.log('🔍 [SIM IP FILTER] Total SIM IPs found:', simIpCandidates.length);
        
        const rankOrder: { [key: string]: number } = {
            'WGCDR': 1,
            'SQNLDR': 2,
            'FLTLT': 3,
            'FLGOFF': 4,
            'PLTOFF': 5,
            'Mr': 6
        };
        
        return simIpCandidates.sort((a, b) => {
            // First sort by Unit
            const unitA = a.unit || 'Unassigned';
            const unitB = b.unit || 'Unassigned';
            if (unitA !== unitB) {
                return unitA.localeCompare(unitB);
            }
            // Then by Rank
            const rankA = rankOrder[a.rank] || 99;
            const rankB = rankOrder[b.rank] || 99;
            if (rankA !== rankB) {
                return rankA - rankB;
            }
            // Finally by Name
            return (a.name ?? 'Unknown').localeCompare(b.name ?? 'Unknown');
        });
    }, [instructorsData, school]);

    const ofis = useMemo(() => {
        console.log('🔍 [OFI FILTER] instructorsData length:', instructorsData.length);
        console.log('🔍 [OFI FILTER] All instructors:', instructorsData.map(i => ({ id: i.idNumber, name: i.name, role: i.role, isOFI: i.isOFI })));
        
        const ofiCandidates = instructorsData.filter(i => {
            const isOfi = i.role === 'OFI' || i.isOFI === true;
            if (!isOfi) return false;
            
            // Filter by location
            if (school === 'ESL') {
                // ESL: Only 1FTS and CFS staff
                const isValid = i.unit === '1FTS' || i.unit === 'CFS';
                console.log(`🔍 [OFI FILTER] ESL - ${i.name}: role="${i.role}", isOFI=${i.isOFI}, unit=${i.unit}, isValid=${isValid}`);
                return isValid;
            } else {
                // PEA: Only 2FTS staff
                const isValid = i.unit === '2FTS';
                console.log(`🔍 [OFI FILTER] PEA - ${i.name}: role="${i.role}", isOFI=${i.isOFI}, unit=${i.unit}, isValid=${isValid}`);
                return isValid;
            }
        });
        
        console.log('🔍 [OFI FILTER] OFI candidates found:', ofiCandidates.length);
        console.log('🔍 [OFI FILTER] OFI candidates:', ofiCandidates.map(i => ({ id: i.idNumber, name: i.name, role: i.role, isOFI: i.isOFI })));
        
        const rankOrder: { [key: string]: number } = {
            'WGCDR': 1,
            'SQNLDR': 2,
            'FLTLT': 3,
            'FLGOFF': 4,
            'PLTOFF': 5,
            'Mr': 6
        };
        
        const sorted = ofiCandidates.sort((a, b) => {
            // First sort by Unit
            const unitA = a.unit || 'Unassigned';
            const unitB = b.unit || 'Unassigned';
            if (unitA !== unitB) {
                return unitA.localeCompare(unitB);
            }
            // Then by Rank
            const rankA = rankOrder[a.rank] || 99;
            const rankB = rankOrder[b.rank] || 99;
            if (rankA !== rankB) {
                return rankA - rankB;
            }
            // Finally by Name
            return (a.name ?? 'Unknown').localeCompare(b.name ?? 'Unknown');
        });
        console.log('🔍 [OFI FILTER] Final OFI list:', sorted.map(i => ({ id: i.idNumber, name: i.name, rank: i.rank })));
        return sorted;
    }, [instructorsData, school]);

    // NEW: All other staff members who don't fit into QFI, SIM IP, or OFI categories
    const otherStaff = useMemo(() => {
        console.log('🔍 [OTHER STAFF] instructorsData length:', instructorsData.length);
        
        const otherStaffCandidates = instructorsData.filter(i => {
            // Exclude QFIs, SIM IPs, and OFIs
            const isQfi = i.role === 'QFI' || i.isQFI === true;
            const isSimIp = i.role === 'SIM IP';
            const isOfi = i.role === 'OFI' || i.isOFI === true;
            
            // Include everyone else
            const isOther = !isQfi && !isSimIp && !isOfi;
            if (!isOther) return false;
            
            // Filter by location
            if (school === 'ESL') {
                // ESL: Only 1FTS and CFS staff
                const isValid = i.unit === '1FTS' || i.unit === 'CFS';
                if (isOther && isValid) {
                    console.log(`🔍 [OTHER STAFF] Found ESL other staff: ${i.name} (${i.rank}) - role: ${i.role}, unit: ${i.unit}`);
                }
                return isValid;
            } else {
                // PEA: Only 2FTS staff
                const isValid = i.unit === '2FTS';
                if (isOther && isValid) {
                    console.log(`🔍 [OTHER STAFF] Found PEA other staff: ${i.name} (${i.rank}) - role: ${i.role}, unit: ${i.unit}`);
                }
                return isValid;
            }
        });
        
        console.log('🔍 [OTHER STAFF] Total other staff found:', otherStaffCandidates.length);
        
        const rankOrder: { [key: string]: number } = {
            'WGCDR': 1,
            'SQNLDR': 2,
            'FLTLT': 3,
            'FLGOFF': 4,
            'PLTOFF': 5,
            'Mr': 6
        };
        
        return otherStaffCandidates.sort((a, b) => {
            // First sort by Unit
            const unitA = a.unit || 'Unassigned';
            const unitB = b.unit || 'Unassigned';
            if (unitA !== unitB) {
                return unitA.localeCompare(unitB);
            }
            // Then by Rank
            const rankA = rankOrder[a.rank] || 99;
            const rankB = rankOrder[b.rank] || 99;
            if (rankA !== rankB) {
                return rankA - rankB;
            }
            // Finally by Name
            return (a.name ?? 'Unknown').localeCompare(b.name ?? 'Unknown');
        });
    }, [instructorsData, school]);

  const simIpsByUnit = useMemo(() => {
      const groups: { [key: string]: Instructor[] } = {};
      simIps.forEach(instructor => {
          const unit = instructor.unit || 'Unassigned';
          if (!groups[unit]) {
              groups[unit] = [];
          }
          groups[unit].push(instructor);
      });
      return groups;
  }, [simIps]);

  const sortedSimIpUnits = useMemo(() => Object.keys(simIpsByUnit).sort(), [simIpsByUnit]);

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

  const sortedOfiUnits = useMemo(() => Object.keys(ofisByUnit).sort(), [ofisByUnit]);

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

  const sortedOtherStaffUnits = useMemo(() => Object.keys(otherStaffByUnit).sort(), [otherStaffByUnit]);

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
    if (selectedInstructor?.idNumber === instructor.idNumber) {
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
          id={`instructor-row-${instructor.idNumber}`}
          key={instructor.idNumber} 
          className={`group p-2 rounded-md transition-all duration-200 cursor-pointer flex items-center justify-between space-x-3 text-sm ${selectedInstructor?.idNumber === instructor.idNumber ? 'bg-sky-700 text-white' : 'bg-gray-700/30 text-gray-300'} ${isArchiveMode ? 'hover:bg-red-900/70' : 'hover:bg-sky-800 hover:text-white'}`}
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

  const locationFullName = school === 'ESL' ? 'East Sale' : 'Pearce';

  return (
    <>
      <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
              <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Staff</h1>
                    <p className="text-sm text-gray-400">{locationFullName} ({school})</p>
                </div>
              </div>
              <div className="flex-1"></div>
              <div className="flex items-center gap-[1px]">
                <AuditButton pageName="Staff" />
                <div className="w-[5px]"></div>
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
              </div>
            </div>

            {/* Grid Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-[1920px] mx-auto">
                    {/* QFI Units */}
                    {sortedUnits.map(unit => (
                        <div key={unit} className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
                            <div className="p-3 border-b border-gray-700 bg-gray-800/80 flex justify-between items-center sticky top-0 z-10 rounded-t-lg backdrop-blur-sm">
                                <h3 className="text-lg font-bold text-sky-400">{unit}</h3>
                                <span className="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{qfisByUnit[unit].length} QFIs</span>
                            </div>
                            <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                                {renderInstructorList(qfisByUnit[unit])}
                            </div>
                        </div>
                    ))}
                    
                    {/* SIM IPs */}
                    {sortedSimIpUnits.map(unit => (
                        <div key={`simip-${unit}`} className="bg-gray-800 border border-teal-900/50 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
                            <div className="p-3 border-b border-teal-900/50 bg-gray-800/80 flex justify-between items-center sticky top-0 z-10 rounded-t-lg backdrop-blur-sm">
                                <div>
                                    <h3 className="text-lg font-bold text-teal-400">SIM IPs</h3>
                                    <p className="text-xs text-gray-400">{unit}</p>
                                </div>
                                <span className="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{simIpsByUnit[unit].length}</span>
                            </div>
                            <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                                {renderInstructorList(simIpsByUnit[unit])}
                            </div>
                        </div>
                    ))}

                       {/* OFIs */}
                       {sortedOfiUnits.map(unit => (
                        <div key={`ofi-${unit}`} className="bg-gray-800 border border-purple-900/50 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
                           <div className="p-3 border-b border-purple-900/50 bg-gray-800/80 flex justify-between items-center sticky top-0 z-10 rounded-t-lg backdrop-blur-sm">
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

                       {/* Other Staff - All staff who don't fit into QFI, SIM IP, or OFI categories */}
                       {sortedOtherStaffUnits.map(unit => (
                        <div key={`other-${unit}`} className="bg-gray-800 border border-orange-900/50 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
                           <div className="p-3 border-b border-orange-900/50 bg-gray-800/80 flex justify-between items-center sticky top-0 z-10 rounded-t-lg backdrop-blur-sm">
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
                 </div>
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
                    onViewLogbook={onViewLogbook}
                    onRequestSct={() => {
                        if (onRequestSct) {
                            const instructorToPass = isAddingNew && newInstructorTemplate ? newInstructorTemplate : selectedInstructor!;
                            onRequestSct(instructorToPass);
                        }
                    }}
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
