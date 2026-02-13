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
      <aside className="w-[12.71rem] bg-gray-900 flex-shrink-0 flex flex-col border-r border-gray-700">
        {/* My Dashboard Button - Half Width at Top */}
        <div className="h-16 flex items-center justify-center flex-shrink-0 px-4 border-b border-gray-800">
          <div className="flex justify-center w-full mt-2">
            <button
              onClick={() => onNavigate('MyDashboard')}
              className={`w-[55px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed ${activeView === 'MyDashboard' ? 'active' : ''}`}
            >
              <span className="leading-tight">My<br/>Dashboard</span>
            </button>
          </div>
        </div>

        {/* Scrollable Main Navigation - Centre Aligned */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-[1px] flex flex-col items-center">
          {/* DFP Button */}
          <button 
            onClick={() => onNavigate('Program Schedule')} 
            className={`w-[55px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-green-brushed rounded-md ${activeView === 'Program Schedule' && !isAnyDashboardActive ? 'active' : ''}`}
          >
            <span>DFP</span>
          </button>
          
          {/* Staff Menu */}
          <div ref={staffMenuRef} onMouseLeave={handleStaffMenuLeave}>
            <button 
              onClick={handleStaffMenuClick} 
              onMouseEnter={handleStaffMenuEnter} 
              className={`w-[55px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${(isStaffSectionActive || showStaffMenu) && !isAnyDashboardActive ? 'active' : ''}`}
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
          <div ref={traineeMenuRef} onMouseLeave={handleTraineeMenuLeave}>
            <button 
              onClick={handleTraineeMenuClick} 
              onMouseEnter={handleTraineeMenuEnter} 
              className={`w-[55px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${(isTraineeSectionActive || showTraineeMenu) && !isAnyDashboardActive ? 'active' : ''}`}
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
            className={`w-[55px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Syllabus' && !isAnyDashboardActive ? 'active' : ''}`}
          >
            <span className="text-center leading-tight">Syllabus</span>
          </button>

          {/* Course Progress - Square Button with Smaller Text */}
          <button 
            onClick={() => onNavigate('CourseProgress')} 
            className={`w-[55px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'CourseProgress' && !isAnyDashboardActive ? 'active' : ''}`}
          >
            <span className="text-center leading-tight">Course Progress</span>
          </button>

          {/* Training Records - Square Button with Smaller Text */}
          <button 
            onClick={() => onNavigate('TrainingRecords')} 
            className={`w-[55px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'TrainingRecords' && !isAnyDashboardActive ? 'active' : ''}`}
          >
            <span className="text-center leading-tight">Training Records</span>
          </button>

          {/* Settings - Square Button */}
          <button 
            onClick={() => onNavigate('Settings')} 
            className={`w-[55px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Settings' ? 'active' : ''}`}
          >
            <span className="text-center leading-tight">Settings</span>
          </button>
        </nav>

        {/* BOTTOM FIXED CONTAINER */}
        <div className="flex-shrink-0 border-t border-gray-700">
          {/* Courses Legend */}
          <div className="border-t border-gray-700 flex-shrink-0">
            <div className="px-4 pt-4 mb-2 flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Courses</span>
              <div className="flex items-center space-x-1">
                <button onClick={() => setShowAddCourseFlyout(true)} className="p-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors" aria-label="Add course">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </button>
                <button onClick={() => setShowRemoveCourseFlyout(true)} className="p-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors" aria-label="Archive course">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-4 pb-2 flex justify-center">
              <div className="flex-1 min-w-0">
                {leftCourses.map(([courseName, color]) => (
                  <div key={courseName} className="py-1 flex items-center justify-center">
                    <span className={`h-3 w-3 rounded-full ${color} mr-2 flex-shrink-0`}></span>
                    <span className="text-xs text-gray-300 truncate">{formatCourseName(courseName)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-700 flex-shrink-0 flex justify-between items-center text-xs text-gray-500">
            {/* User Selector */}
            <div className="relative">
              <button 
                onClick={() => setShowUserSelector(!showUserSelector)}
                className="flex items-center space-x-1 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <span className="truncate">{currentUserRank} {currentUserName}</span>
                <svg 
                  className={`h-3 w-3 transform transition-transform ${showUserSelector ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {showUserSelector && (
                <div className="absolute bottom-full left-0 mb-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                  <div className="p-3 border-b border-gray-700">
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <svg className="absolute left-5 top-5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  <div className="max-h-60 overflow-y-auto">
                    {sortedUnits.map(unit => (
                      <div key={unit}>
                        <div className="px-3 py-2 bg-gray-900 border-b border-gray-700 sticky top-0">
                          <span className="text-xs font-semibold text-gray-400 uppercase">{unit}</span>
                        </div>
                        {groupedUsers[unit].map(user => (
                          <button
                            key={user.name}
                            onClick={() => handleUserSelect(user)}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors flex items-center justify-between ${
                              user.name === currentUserName ? 'bg-gray-700 text-sky-400' : 'text-gray-300'
                            }`}
                          >
                            <span>{user.rank} {user.name}</span>
                            {user.name === currentUserName && (
                              <svg className="h-4 w-4 text-sky-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="p-2 border-t border-gray-700">
                    <button onClick={() => setShowUserSelector(false)} className="w-full px-3 py-1 text-sm text-gray-400 hover:text-gray-300">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            <span>v1.0.0</span>
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