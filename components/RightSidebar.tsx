import React, { useState } from 'react';

interface RightSidebarProps {
    activeView: string;
    onNavigate: (view: string) => void;
    courseColors: { [key: string]: string };
    onBuildDfpClick: () => void;
    isSupervisor: boolean;
    onPublish: () => void;
    currentUserRank: string;
    currentUserName: string;
    currentUserLocation?: string;
    currentUserUnit?: string;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ 
    activeView, 
    onNavigate, 
    courseColors,
    onBuildDfpClick, 
    isSupervisor, 
    onPublish,
    currentUserRank,
    currentUserName,
    currentUserLocation,
    currentUserUnit
}) => {
  const nextDayBuildSubViews = ['NextDayBuild', 'Priorities', 'ProgramData', 'BuildAnalysis', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'];
  const isNextDayBuildSectionActive = nextDayBuildSubViews.includes(activeView);

  const dashboardViews = ['MyDashboard', 'SupervisorDashboard'];
  const isAnyDashboardActive = dashboardViews.includes(activeView);

  // Extract surname from currentUserName (format: "Bloggs, Joe")
  const userSurname = currentUserName.split(',')[0];

  return (
    <aside className="w-[110px] bg-gray-900 flex-shrink-0 flex flex-col border-l border-gray-700">
      {/* Duty Pilot Button - Half Width */}
      <div className="h-16 flex items-center justify-center flex-shrink-0 px-2 border-b border-gray-800">
        <div className="flex justify-center w-full mt-2">
          <button
            onClick={() => isSupervisor && onNavigate('SupervisorDashboard')}
            disabled={!isSupervisor}
            title={!isSupervisor ? 'Access denied: Requires Flying Supervisor role.' : 'View Supervisor Dashboard'}
            className={`w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed ${activeView === 'SupervisorDashboard' ? 'active' : ''} ${!isSupervisor ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="leading-tight">Duty<br/>Pilot</span>
          </button>
        </div>
      </div>

      {/* NEO Build and Program Schedule Buttons - Aligned with DFP button */}
      <div className="px-2 pt-[39px] space-y-[1px] flex flex-col items-center">
        <button 
          onClick={onBuildDfpClick} 
          className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-orange-brushed rounded-md"
        >
          <span className="text-center leading-tight">NEO Build</span>
        </button>

        <button 
          onClick={() => onNavigate('NextDayBuild')} 
          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayBuild' ? 'active' : ''}`}
        >
          <span className="text-center leading-tight">Program Schedule</span>
        </button>
      </div>

      {/* Scrollable Main Navigation */}
      <nav className="flex-1 overflow-y-auto pt-0 pb-4 px-2 space-y-[1px] flex flex-col items-center">
        {/* Next Day Build Buttons */}

        <button 
          onClick={() => onNavigate('NextDayInstructorSchedule')} 
          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayInstructorSchedule' ? 'active' : ''}`}
        >
          <span className="text-center leading-tight">Staff Schedule</span>
        </button>

        <button 
          onClick={() => onNavigate('NextDayTraineeSchedule')} 
          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayTraineeSchedule' ? 'active' : ''}`}
        >
          <span className="text-center leading-tight">Trainee Schedule</span>
        </button>

        <button 
          onClick={onPublish} 
          className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-green-brushed rounded-md"
        >
          <span className="text-center leading-tight">Publish</span>
        </button>

        <button 
          onClick={() => onNavigate('Priorities')} 
          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Priorities' ? 'active' : ''}`}
        >
          <span className="text-center leading-tight">Priorities</span>
        </button>

        <button 
          onClick={() => onNavigate('BuildIntelligence')} 
          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'BuildIntelligence' ? 'active' : ''}`}
        >
          <span className="text-center leading-tight">Build Intelligence</span>
        </button>
      </nav>

      {/* User Info Section - Bottom */}
      <div className="flex-shrink-0 border-t border-gray-700 p-4 flex flex-col items-center justify-center">
        <span className="text-[9px] text-gray-300 font-semibold">{currentUserRank}</span>
        <span className="text-[9px] text-gray-300">{userSurname}</span>
        <span className="text-[9px] text-gray-300">{currentUserLocation || 'N/A'}</span>
        <span className="text-[9px] text-gray-300">{currentUserUnit || 'N/A'}</span>
      </div>
    </aside>
  );
};

export default RightSidebar;