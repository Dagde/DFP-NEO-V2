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
    school?: string;
    allTraineesData?: any[];
    canAccessView?: (view: string) => boolean;
    modelUnavailableViews?: string[];
    colourKeyItems?: Array<{ key: string; label: string; color: string }>;
    unreadMessageCount?: number;
}

const formatCourseName = (name: string): string => {
  return String(name || '').trim();
};

const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, courseColors, onAddCourse, onArchiveCourse, onNextDayBuildClick, onBuildDfpClick, isSupervisor, onPublish, currentUserName, currentUserRank, instructorsList, onUserChange, school, allTraineesData, canAccessView, modelUnavailableViews = [], colourKeyItems = [], unreadMessageCount = 0 }) => {
  const [showAddCourseFlyout, setShowAddCourseFlyout] = useState(false);
  const [showRemoveCourseFlyout, setShowRemoveCourseFlyout] = useState(false);

  // User selector state
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<{name: string; rank: string; unit?: string; pin?: string} | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');



  const handleSaveCourse = (data: NewCourseData) => {
    onAddCourse(data);
    setShowAddCourseFlyout(false);
  };

  const handleArchiveCourse = (courseNumber: string) => {
    onArchiveCourse(courseNumber);
    setShowRemoveCourseFlyout(false);
  };

  const darkenHexColor = (color: string) => {
    if (!color.startsWith('#') || color.length < 7) return color;
    const strength = 0.62;
    const r = Math.round(parseInt(color.slice(1, 3), 16) * strength);
    const g = Math.round(parseInt(color.slice(3, 5), 16) * strength);
    const b = Math.round(parseInt(color.slice(5, 7), 16) * strength);
    return `rgb(${r}, ${g}, ${b})`;
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

  const sortedUnits = Object.keys(groupedUsers).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  // Show courses represented in the already-scoped active trainee list.
  const filteredCourses = React.useMemo(() => {
    if (!allTraineesData || allTraineesData.length === 0) {
      return Object.entries(courseColors);
    }

    const activeCourses = new Set(
      allTraineesData
        .map(trainee => trainee.course)
        .filter(Boolean)
    );

    return Object.entries(courseColors).filter(([courseName]) =>
      activeCourses.has(courseName)
    );
  }, [allTraineesData, courseColors]);

  const allCourses = filteredCourses;
  const keyItems = colourKeyItems.length > 0
    ? colourKeyItems.slice(0, 12)
    : allCourses.map(([courseName, color]) => ({
        key: `course:${courseName}`,
        label: formatCourseName(courseName),
        color,
      }));

  const dashboardViews = ['MyDashboard', 'SupervisorDashboard'];
  const isAnyDashboardActive = dashboardViews.includes(activeView);
  const canOpen = (view: string) => canAccessView ? canAccessView(view) : true;
  const isModelUnavailable = (view: string) => modelUnavailableViews.includes(view);
  const accessButtonClass = (view: string) => {
    if (isModelUnavailable(view)) return 'cursor-not-allowed';
    return canOpen(view) ? '' : 'opacity-45 cursor-not-allowed';
  };
  const navigateIfAllowed = (view: string) => {
    if (isModelUnavailable(view)) return;
    if (canOpen(view)) onNavigate(view);
  };


  return (
    <>
      <aside className="w-[110px] bg-gray-900 flex-shrink-0 flex flex-col border-r border-gray-700">
        {/* My Home Button - Top Level */}
        <div className="flex items-center justify-center flex-shrink-0 px-2 pt-2 pb-0">
          <button
            onClick={() => navigateIfAllowed('MyDashboard')}
            className={`relative w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed ${activeView === 'MyDashboard' ? 'active' : ''}`}
          >
            {unreadMessageCount > 0 && (
              <span className="absolute -right-1.5 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white shadow-lg">
                <span className="translate-x-px">{Math.min(unreadMessageCount, 9)}</span>
              </span>
            )}
            <span className="leading-tight">My<br/>Home</span>
          </button>
        </div>

        {/* Scrollable Main Navigation - Centre Aligned */}
        <nav className="flex-1 overflow-y-auto px-2 pt-[15px] space-y-[1px] flex flex-col items-center">
          {/* DFP Button */}
          <button
            onClick={() => navigateIfAllowed('Program Schedule')}
            disabled={!canOpen('Program Schedule')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Program Schedule' && !isAnyDashboardActive ? 'active' : ''} ${accessButtonClass('Program Schedule')}`}
          >
            <span style={{color: activeView === 'Program Schedule' && !isAnyDashboardActive ? '#ffffff' : '#22c55e'}}>DFP</span>
          </button>

          {/* Staff Button */}
          <button
            onClick={() => navigateIfAllowed('Staff')}
            disabled={!canOpen('Staff')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Staff' ? 'active' : ''} ${accessButtonClass('Staff')}`}
          >
            <span>Staff</span>
          </button>

          {/* Trainee Button */}
          <button
            onClick={() => navigateIfAllowed('Trainee')}
            disabled={!canOpen('Trainee')}
            aria-disabled={isModelUnavailable('Trainee') || !canOpen('Trainee')}
            title={isModelUnavailable('Trainee') ? 'Trainee functions are not used by this operational model.' : undefined}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Trainee' ? 'active' : ''} ${accessButtonClass('Trainee')}`}
          >
            <span>Trainee</span>
          </button>

          {/* Syllabus - Square Button with Smaller Text */}
          <button
            onClick={() => navigateIfAllowed('Syllabus')}
            disabled={!canOpen('Syllabus')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Syllabus' && !isAnyDashboardActive ? 'active' : ''} ${accessButtonClass('Syllabus')}`}
          >
            <span className="text-center leading-tight">Syllabus</span>
          </button>

{/* Course Progress - Square Button with Smaller Text */}
          <button
            onClick={() => navigateIfAllowed('CourseProgress')}
            disabled={!canOpen('CourseProgress')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'CourseProgress' && !isAnyDashboardActive ? 'active' : ''} ${accessButtonClass('CourseProgress')}`}
          >
            <span className="text-center leading-tight">Course Progress</span>
          </button>

          {/* Training Records - Square Button with Smaller Text */}
          <button
            onClick={() => navigateIfAllowed('TrainingRecords')}
            disabled={!canOpen('TrainingRecords')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'TrainingRecords' && !isAnyDashboardActive ? 'active' : ''} ${accessButtonClass('TrainingRecords')}`}
          >
            <span className="text-center leading-tight">Training Records</span>
          </button>

          {/* Settings - Square Button */}
          <button
            onClick={() => navigateIfAllowed('Settings')}
            disabled={!canOpen('Settings')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Settings' ? 'active' : ''} ${accessButtonClass('Settings')}`}
          >
            <span className="text-center leading-tight">Settings</span>
          </button>

        </nav>

        {/* BOTTOM FIXED CONTAINER */}
        <div className="flex-shrink-0 border-t border-gray-700">
          {/* Colour Key */}
          <div data-sidebar-course-legend="true" className="border-t border-gray-700 flex-shrink-0">
            <div className="px-4 pt-4 mb-2">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Key</span>
            </div>
            <div className="px-4 pb-2">
              <div className="w-full min-w-0">
                {keyItems.map(item => (
                  <div key={item.key} className="py-1 flex items-center justify-start gap-2">
                    <span
                      data-course-color="true"
                      className={`h-3 w-3 rounded-full ${(item.color || '').startsWith('#') ? '' : item.color} flex-shrink-0`}
                      style={(item.color || '').startsWith('#') ? { backgroundColor: darkenHexColor(item.color) } : {}}
                    ></span>
                    <span className="min-w-0 truncate text-left text-[9px] text-gray-300">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div data-sidebar-user-footer="true" className="p-2 border-t border-gray-700 flex-shrink-0 flex justify-center items-center">
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
