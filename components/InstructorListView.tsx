
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
          .filter(i => i.role === 'QFI' || i.isQFI === true)
          .sort((a, b) => {
              const rankA = rankOrder[a.rank] || 99;
              const rankB = rankOrder[b.rank] || 99;
              
              if (rankA !== rankB) {
                  return rankA - rankB;
              }
              return (a.name ?? 'Unknown').localeCompare(b.name ?? 'Unknown');
          });
  }, [instructorsData]);

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

  const simIps = useMemo(() => instructorsData.filter(i => i.role === 'SIM IP').sort((a, b) => (a.name ?? 'Unknown').localeCompare(b.name ?? 'Unknown')), [instructorsData]);

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
              <div className="flex items-center space-x-3">
                {isArchiveMode && <span className="text-red-400 font-bold text-sm animate-pulse">ARCHIVE MODE ACTIVE</span>}
                 <button
                    onClick={handleShowAddChoice}
                    className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold shadow-md flex items-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Staff
                </button>
                <button
                    onClick={toggleArchiveMode}
                    className={`px-4 py-2 rounded-md transition-colors text-sm font-semibold shadow-md flex items-center ${isArchiveMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                        <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    {isArchiveMode ? 'Done' : 'Archive'}
                </button>
                <button
                    onClick={() => setShowArchivedFlyout(true)}
                    className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 hover:text-white transition-colors text-sm font-semibold shadow-md"
                >
                    View Archived
                </button>
                   <AuditButton pageName="Staff" />
                <div className="w-px h-8 bg-gray-600 mx-2"></div>
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md"
                >
                    Back to Program
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
                    <div className="bg-gray-800 border border-teal-900/50 rounded-lg shadow-lg flex flex-col h-[fit-content] max-h-[80vh]">
                        <div className="p-3 border-b border-teal-900/50 bg-gray-800/80 flex justify-between items-center sticky top-0 z-10 rounded-t-lg backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-teal-400">SIM IPs</h3>
                             <span className="text-xs font-mono bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{simIps.length}</span>
                        </div>
                         <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                             {renderInstructorList(simIps)}
                        </div>
                    </div>
                 </div>
            </div>
      </div>
      
      {/* Profile Overlay - Fixed Position over Grid */}
      {(selectedInstructor || (isAddingNew && newInstructorTemplate)) && (
            <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-gray-900 shadow-2xl z-50 border-l border-gray-700 transform transition-transform duration-300 ease-in-out">
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
                            onRequestSct(isAddingNew && newInstructorTemplate ? newInstructorTemplate : selectedInstructor!);
                            handleCloseProfile();
                        }
                    }}
                />
            </div>
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
