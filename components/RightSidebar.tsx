import React, { useState } from 'react';

interface RightSidebarProps {
    activeView: string;
    onNavigate: (view: string) => void;
    courseColors: { [key: string]: string };
    onBuildDfpClick: () => void;
    isSupervisor: boolean;
    onPublish: () => void;
}

const formatCourseName = (name: string): string => {
  if (name.startsWith('Course ')) {
    return name.replace('Course ', 'ADF');
  }
  return name.replace(/^CSE\s*/i, 'ADF').replace(' ', '');
};

const RightSidebar: React.FC<RightSidebarProps> = ({ 
    activeView, 
    onNavigate, 
    courseColors,
    onBuildDfpClick,
    isSupervisor,
    onPublish 
}) => {
  const nextDayBuildSubViews = ['NextDayBuild', 'Priorities', 'ProgramData', 'BuildAnalysis', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'];
  const isNextDayBuildSectionActive = nextDayBuildSubViews.includes(activeView);

  const dashboardViews = ['MyDashboard', 'SupervisorDashboard'];
  const isAnyDashboardActive = dashboardViews.includes(activeView);

  // Distribute courses - take second half for right sidebar
  const courses = Object.entries(courseColors);
  const halfPoint = Math.ceil(courses.length / 2);
  const rightCourses = courses.slice(halfPoint);

  return (
    <aside className="w-[12.71rem] bg-gray-900 flex-shrink-0 flex flex-col border-l border-gray-700">
      {/* Supervisor Dashboard Button */}
      <div className="h-16 flex items-center justify-center flex-shrink-0 px-4 border-b border-gray-800">
        <div className="flex w-full mt-2">
          <button
            onClick={() => isSupervisor && onNavigate('SupervisorDashboard')}
            disabled={!isSupervisor}
            title={!isSupervisor ? 'Access denied: Requires Flying Supervisor role.' : 'View Supervisor Dashboard'}
            className={`w-full flex items-center justify-center text-center px-1 py-1 text-sm font-semibold rounded-md btn-aluminium-brushed ${activeView === 'SupervisorDashboard' ? 'active' : ''} ${!isSupervisor ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="leading-tight">Supervisor Dashboard</span>
          </button>
        </div>
      </div>

      {/* Scrollable Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-[1px] flex flex-col items-center">
        {/* Next Day Build Buttons */}
        <button 
          onClick={() => onNavigate('NextDayBuild')} 
          className={`w-[55px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayBuild' ? 'active' : ''}`}
        >
          <span className="text-center leading-tight">Program Schedule</span>
        </button>

        <button 
          onClick={() => onNavigate('NextDayInstructorSchedule')} 
          className={`w-[55px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayInstructorSchedule' ? 'active' : ''}`}
        >
          <span className="text-center leading-tight">Staff Schedule</span>
        </button>

        <button 
          onClick={() => onNavigate('NextDayTraineeSchedule')} 
          className={`w-[55px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayTraineeSchedule' ? 'active' : ''}`}
        >
          <span className="text-center leading-tight">Trainee Schedule</span>
        </button>

        <button 
          onClick={() => onNavigate('Priorities')} 
          className={`w-[55px] h-[55px] flex items-center justify-center text-sm font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Priorities' ? 'active' : ''}`}
        >
          <span className="text-center leading-tight">Priorities</span>
        </button>

        <button 
          onClick={() => onNavigate('ProgramData')} 
          className={`w-[55px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'ProgramData' ? 'active' : ''}`}
        >
          <span className="text-center leading-tight">Program Data</span>
        </button>

        <button 
          onClick={() => onNavigate('BuildAnalysis')} 
          className={`w-[55px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'BuildAnalysis' ? 'active' : ''}`}
        >
          <span className="text-center leading-tight">Build Analysis</span>
        </button>

        <button 
          onClick={onBuildDfpClick} 
          className="w-[55px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-orange-brushed rounded-md"
        >
          <span className="text-center leading-tight">NEO Build</span>
        </button>

        <button 
          onClick={onPublish} 
          className="w-[55px] h-[55px] flex items-center justify-center text-sm font-semibold btn-green-brushed rounded-md"
        >
          <span className="text-center leading-tight">Publish</span>
        </button>
      </nav>

      {/* Courses Section */}
      <div className="flex-shrink-0 border-t border-gray-700">
        <div className="px-4 pt-4 mb-2 flex justify-center items-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Courses</span>
        </div>
        <div className="px-4 pb-2 flex justify-center">
          <div className="flex-1 min-w-0">
            {rightCourses.map(([courseName, color]) => (
              <div key={courseName} className="py-1 flex items-center justify-center">
                <span className={`h-3 w-3 rounded-full ${color} mr-2 flex-shrink-0`}></span>
                <span className="text-xs text-gray-300 truncate">{formatCourseName(courseName)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default RightSidebar;