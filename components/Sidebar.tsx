import React, { useState, useEffect, useRef } from 'react';
import AddCourseFlyout, { NewCourseData } from './AddCourseFlyout';
import RemoveCourseFlyout from './RemoveCourseFlyout';

interface SidebarProps {
    activeView: string;
    onNavigate: (view: string) => void;
    courseColors: { [key: string]: string };
    onAddCourse: (data: NewCourseData) => void;
    onArchiveCourse: (courseNumber: string) => void;
    onNextDayBuildClick: () => void;
    onBuildDfpClick: () => void;
    isSupervisor: boolean;
    onPublish: () => void;
    currentUserName: string;
    currentUserRank: string;
    instructorsList: Array<{name: string; rank: string; unit?: string; pin?: string}>;
    onUserChange: (userName: string) => void;
}

const formatCourseName = (name: string): string => {
  if (name.startsWith('Course ')) {
    return name.replace('Course ', 'ADF');
  }
  return name.replace(/^CSE\s*/i, 'ADF').replace(' ', '');
};

const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, courseColors, onAddCourse, onArchiveCourse, onNextDayBuildClick, onBuildDfpClick, isSupervisor, onPublish, currentUserName, currentUserRank, instructorsList, onUserChange }) => {
  const [showAddCourseFlyout, setShowAddCourseFlyout] = useState(false);
  const [showRemoveCourseFlyout, setShowRemoveCourseFlyout] = useState(false);
  
  // User selector state
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<{name: string; rank: string; unit?: string; pin?: string} | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  
  // --- Staff Menu State & Logic ---
  const [isStaffMenuOpen, setIsStaffMenuOpen] = useState(false);
  const [isStaffMenuPinned, setIsStaffMenuPinned] = useState(false);
  const staffMenuRef = useRef<HTMLDivElement>(null);

  // --- Trainee Menu State & Logic ---
  const [isTraineeMenuOpen, setIsTraineeMenuOpen] = useState(false);
  const [isTraineeMenuPinned, setIsTraineeMenuPinned] = useState(false);
  const traineeMenuRef = useRef<HTMLDivElement>(null);

  // This effect handles clicks outside the menus to un-pin them.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (staffMenuRef.current && !staffMenuRef.current.contains(event.target as Node)) {
        setIsStaffMenuPinned(false);
        setIsStaffMenuOpen(false);
      }
      if (traineeMenuRef.current && !traineeMenuRef.current.contains(event.target as Node)) {
        setIsTraineeMenuPinned(false);
        setIsTraineeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  const handleSaveCourse = (data: NewCourseData) => {
    onAddCourse(data);
    setShowAddCourseFlyout(false);
  };

  const handleArchiveCourse = (courseNumber: string) => {
    onArchiveCourse(courseNumber);
    setShowRemoveCourseFlyout(false);
  };

  // User selector handlers
  const handleUserSelect = (user: {name: string; rank: string; unit?: string; pin?: string}) => {
    if (user.name === currentUserName) {
      setShowUserSelector(false);
      return;
    }
    setSelectedUser(user);
    setShowPinModal(true);
    setEnteredPin('');
    setPinError('');
  };

  const handlePinSubmit = () => {
    if (selectedUser && enteredPin === selectedUser.pin) {
      onUserChange(selectedUser.name);
      setShowPinModal(false);
      setShowUserSelector(false);
      setSelectedUser(null);
      setEnteredPin('');
      setPinError('');
    } else {
      setPinError('Invalid PIN');
    }
  };

  // Filter and group users
  const filteredUsers = instructorsList.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.rank.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.unit && user.unit.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedUsers = filteredUsers.reduce((acc, user) => {
    const unit = user.unit || 'Unassigned';
    if (!acc[unit]) acc[unit] = [];
    acc[unit].push(user);
    return acc;
  }, {} as Record<string, typeof filteredUsers>);

  const unitOrder = ['1FTS', 'CFS', '2FTS'];
  const sortedUnits = Object.keys(groupedUsers).sort((a, b) => {
    const aIndex = unitOrder.indexOf(a);
    const bIndex = unitOrder.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  // Distribute courses - take first half for left sidebar
  const courses = Object.entries(courseColors);
  const halfPoint = Math.ceil(courses.length / 2);
  const leftCourses = courses.slice(0, halfPoint);

  const dashboardViews = ['MyDashboard', 'SupervisorDashboard'];
  const isAnyDashboardActive = dashboardViews.includes(activeView);
  
  // --- Staff Menu ---
  const isStaffSectionActive = ['Instructors', 'InstructorSchedule'].includes(activeView);
  const handleStaffMenuEnter = () => setIsStaffMenuOpen(true);
  const handleStaffMenuLeave = () => { if (!isStaffMenuPinned) setIsStaffMenuOpen(false); };
  const handleStaffMenuClick = () => {
    const newPinnedState = !isStaffMenuPinned;
    setIsStaffMenuPinned(newPinnedState);
    if (newPinnedState) setIsStaffMenuOpen(true);
  };
  const handleStaffSubMenuItemClick = (view: string) => {
    onNavigate(view);
    setIsStaffMenuPinned(false);
    setIsStaffMenuOpen(false);
  };
  const showStaffMenu = isStaffMenuOpen || isStaffMenuPinned;

  // --- Trainee Menu ---
  const isTraineeSectionActive = ['CourseRoster', 'TraineeSchedule'].includes(activeView);
  const handleTraineeMenuEnter = () => setIsTraineeMenuOpen(true);
  const handleTraineeMenuLeave = () => { if (!isTraineeMenuPinned) setIsTraineeMenuOpen(false); };
  const handleTraineeMenuClick = () => {
    const newPinnedState = !isTraineeMenuPinned;
    setIsTraineeMenuPinned(newPinnedState);
    if (newPinnedState) setIsTraineeMenuOpen(true);
  };
  const handleTraineeSubMenuItemClick = (view: string) => {
    onNavigate(view);
    setIsTraineeMenuPinned(false);
    setIsTraineeMenuOpen(false);
  };
  const showTraineeMenu = isTraineeMenuOpen || isTraineeMenuPinned;


  return (
    <>
      <aside className="w-[110px] bg-gray-900 flex-shrink-0 flex flex-col border-r border-gray-700">
        {/* My Home Button - Top Level */}
        <div className="flex items-center justify-center flex-shrink-0 px-2 pt-2 pb-2">
          <button
            onClick={() => onNavigate('MyDashboard')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed ${activeView === 'MyDashboard' ? 'active' : ''}`}
          >
            <span className="leading-tight">My<br/>Home</span>
          </button>
        </div>
        
        {/* Scrollable Main Navigation - Centre Aligned */}
        <nav className="flex-1 overflow-y-auto px-2 pt-[27px] space-y-[1px] flex flex-col items-center">
          {/* DFP Button */}
          <button 
            onClick={() => onNavigate('Program Schedule')} 
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-green-brushed rounded-md ${activeView === 'Program Schedule' && !isAnyDashboardActive ? 'active' : ''}`}
          >
            <span>DFP</span>
          </button>
          
          {/* Staff Menu */}
          <div ref={staffMenuRef} onMouseLeave={handleStaffMenuLeave} className="flex flex-col items-center">
            <button 
              onClick={handleStaffMenuClick} 
              onMouseEnter={handleStaffMenuEnter} 
              className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${(isStaffSectionActive || showStaffMenu) && !isAnyDashboardActive ? 'active' : ''}`}
            >
              <span>Staff</span>
            </button>
            <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${showStaffMenu ? 'max-h-40' : 'max-h-0'}`}>
              <div className="pl-4 pr-2 pt-1 space-y-1 bg-black/10">
                <button 
                  onClick={() => handleStaffSubMenuItemClick('Instructors')} 
                  className={`w-full text-left px-4 py-1 text-sm font-medium btn-aluminium-brushed rounded-md ${activeView === 'Instructors' ? 'active' : ''}`}
                >
                  Staff Profile
                </button>
                <button 
                  onClick={() => handleStaffSubMenuItemClick('InstructorSchedule')} 
                  className={`w-full text-left px-4 py-1 text-sm font-medium btn-aluminium-brushed rounded-md ${activeView === 'InstructorSchedule' ? 'active' : ''}`}
                >
                  Staff Schedule
                </button>
              </div>
            </div>
          </div>

          {/* Trainee Menu */}
          <div ref={traineeMenuRef} onMouseLeave={handleTraineeMenuLeave} className="flex flex-col items-center">
            <button 
              onClick={handleTraineeMenuClick} 
              onMouseEnter={handleTraineeMenuEnter} 
              className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${(isTraineeSectionActive || showTraineeMenu) && !isAnyDashboardActive ? 'active' : ''}`}
            >
              <span>Trainee</span>
            </button>
            <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${showTraineeMenu ? 'max-h-40' : 'max-h-0'}`}>
              <div className="pl-4 pr-2 pt-1 space-y-1 bg-black/10">
                <button 
                  onClick={() => handleTraineeSubMenuItemClick('CourseRoster')} 
                  className={`w-full text-left px-4 py-1 text-sm font-medium btn-aluminium-brushed rounded-md ${activeView === 'CourseRoster' ? 'active' : ''}`}
                >
                  Trainee Profile
                </button>
                <button 
                  onClick={() => handleTraineeSubMenuItemClick('TraineeSchedule')} 
                  className={`w-full text-left px-4 py-1 text-sm font-medium btn-aluminium-brushed rounded-md ${activeView === 'TraineeSchedule' ? 'active' : ''}`}
                >
                  Trainee Schedule
                </button>
              </div>
            </div>
          </div>
          
          {/* Syllabus - Square Button with Smaller Text */}
          <button 
            onClick={() => onNavigate('Syllabus')} 
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Syllabus' && !isAnyDashboardActive ? 'active' : ''}`}
          >
            <span className="text-center leading-tight">Syllabus</span>
          </button>

          {/* Course Progress - Square Button with Smaller Text */}
          <button 
            onClick={() => onNavigate('CourseProgress')} 
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'CourseProgress' && !isAnyDashboardActive ? 'active' : ''}`}
          >
            <span className="text-center leading-tight">Course Progress</span>
          </button>

          {/* Training Records - Square Button with Smaller Text */}
          <button 
            onClick={() => onNavigate('TrainingRecords')} 
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'TrainingRecords' && !isAnyDashboardActive ? 'active' : ''}`}
          >
            <span className="text-center leading-tight">Training Records</span>
          </button>

          {/* Settings - Square Button */}
          <button 
            onClick={() => onNavigate('Settings')} 
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Settings' ? 'active' : ''}`}
          >
            <span className="text-center leading-tight">Settings</span>
          </button>
        </nav>

        {/* BOTTOM FIXED CONTAINER */}
        <div className="flex-shrink-0 border-t border-gray-700">
          {/* Courses Legend */}
          <div className="border-t border-gray-700 flex-shrink-0">
            <div className="px-4 pt-4 mb-2">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Courses</span>
            </div>
            <div className="px-4 pb-2 flex justify-center">
              <div className="flex-1 min-w-0">
                {leftCourses.map(([courseName, color]) => (
                  <div key={courseName} className="py-1 flex items-center justify-center">
                    <span className={`h-3 w-3 rounded-full ${color} mr-2 flex-shrink-0`}></span>
                    <span className="text-[10px] text-gray-300">{formatCourseName(courseName)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-gray-700 flex-shrink-0 flex justify-center items-center">
            <span className="text-[10px] text-gray-500 font-light">
              {currentUserRank} {currentUserName.split(',')[0]}
            </span>
          </div>
        </div>
      </aside>
      {showAddCourseFlyout && (
        <AddCourseFlyout
          onClose={() => setShowAddCourseFlyout(false)}
          onSave={handleSaveCourse}
          existingCourses={courseColors}
        />
      )}
      {showRemoveCourseFlyout && (
        <RemoveCourseFlyout
          onClose={() => setShowRemoveCourseFlyout(false)}
          onArchive={handleArchiveCourse}
          activeCourses={courseColors}
        />
      )}

      {/* PIN Confirmation Modal */}
      {showPinModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center" onClick={() => setShowPinModal(false)}>
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Confirm User Switch</h2>
              
              <div className="mb-6">
                <p className="text-gray-300 mb-2">
                  Switch from <span className="font-semibold text-sky-400">{currentUserRank} {currentUserName}</span> to:
                </p>
                <p className="font-semibold text-white text-lg">
                  {selectedUser.rank} {selectedUser.name}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Enter PIN for {selectedUser.name}:
                </label>
                <input
                  type="password"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handlePinSubmit()}
                  placeholder="Enter PIN"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  autoFocus
                />
                {pinError && <p className="mt-2 text-sm text-red-400">{pinError}</p>}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setSelectedUser(null);
                    setEnteredPin('');
                    setPinError('');
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePinSubmit}
                  className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700"
                >
                  Switch User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;