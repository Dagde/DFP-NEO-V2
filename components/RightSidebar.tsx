import React, { useState } from 'react';
import { useSystemFreeze } from '../hooks/useSystemFreeze';

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
    canAccessView?: (view: string) => boolean;
    canRunNeoBuild?: boolean;
    canPublishDfp?: boolean;
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
    currentUserUnit,
    canAccessView,
    canRunNeoBuild = true,
    canPublishDfp = true
}) => {
  const nextDayBuildSubViews = ['NextDayBuild', 'Priorities', 'ProgramData', 'BuildAnalysis', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'];
  const isNextDayBuildSectionActive = nextDayBuildSubViews.includes(activeView);

  const dashboardViews = ['MyDashboard', 'SupervisorDashboard'];
  const isAnyDashboardActive = dashboardViews.includes(activeView);

  const { isFrozen } = useSystemFreeze();
  const canOpen = (view: string) => canAccessView ? canAccessView(view) : true;
  const canBuild = canRunNeoBuild && canOpen('NextDayBuild');
  const canPublish = canPublishDfp && canOpen('NextDayBuild');
  const accessButtonClass = (view: string) => canOpen(view) ? '' : 'opacity-45 cursor-not-allowed';
  const actionButtonClass = (allowed: boolean) => allowed ? '' : 'opacity-45 cursor-not-allowed grayscale';
  const navigateIfAllowed = (view: string) => {
    if (canOpen(view)) onNavigate(view);
  };

  // Extract surname from currentUserName (format: "Bloggs, Joe")
  const userSurname = currentUserName.split(',')[0];

  return (
    <aside className="w-[110px] bg-gray-900 flex-shrink-0 flex flex-col border-l border-gray-700 relative">
      {/* Transparent freeze overlay — covers all buttons in right sidebar */}
      {isFrozen && (
        <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
      )}

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 pt-2 pb-4 flex flex-col items-center gap-px">
        {/* Duty Pilot Button */}
        <button
          onClick={() => isSupervisor && onNavigate('SupervisorDashboard')}
          disabled={!isSupervisor || !canOpen('SupervisorDashboard')}
          title={!isSupervisor ? 'Access denied: Requires Flying Supervisor role.' : 'View Supervisor Dashboard'}
          className={`w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed ${activeView === 'SupervisorDashboard' ? 'active' : ''} ${!isSupervisor || !canOpen('SupervisorDashboard') ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className="leading-tight">Duty<br/>Pilot</span>
        </button>

        <button
          onClick={onBuildDfpClick}
          disabled={!canBuild}
          title={canBuild ? 'Run NEO Build' : 'Access denied: NEO Build permission required'}
          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${actionButtonClass(canBuild)}`}
        >
          <span className="text-center leading-tight" style={{color: "#fb923c"}}>NEO Build</span>
        </button>

        <button
          onClick={() => navigateIfAllowed('NextDayBuild')}
          disabled={!canOpen('NextDayBuild')}
          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayBuild' ? 'active' : ''} ${accessButtonClass('NextDayBuild')}`}
        >
          <span className="text-center leading-tight">Program Schedule</span>
        </button>

        <button
          onClick={() => navigateIfAllowed('NextDayInstructorSchedule')}
          disabled={!canOpen('NextDayInstructorSchedule')}
          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayInstructorSchedule' ? 'active' : ''} ${accessButtonClass('NextDayInstructorSchedule')}`}
        >
          <span className="text-center leading-tight">Staff Schedule</span>
        </button>

        <button
          onClick={() => navigateIfAllowed('NextDayTraineeSchedule')}
          disabled={!canOpen('NextDayTraineeSchedule')}
          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayTraineeSchedule' ? 'active' : ''} ${accessButtonClass('NextDayTraineeSchedule')}`}
        >
          <span className="text-center leading-tight">Trainee Schedule</span>
        </button>

        <button
          onClick={onPublish}
          disabled={!canPublish}
          title={canPublish ? 'Publish DFP' : 'Access denied: Publish DFP permission required'}
          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${actionButtonClass(canPublish)}`}
        >
          <span className="text-center leading-tight" style={{color: "#22c55e"}}>Publish</span>
        </button>

        <button
          onClick={() => navigateIfAllowed('Priorities')}
          disabled={!canOpen('Priorities')}
          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Priorities' ? 'active' : ''} ${accessButtonClass('Priorities')}`}
        >
          <span className="text-center leading-tight">Priorities</span>
        </button>

        <button
          onClick={() => navigateIfAllowed('BuildIntelligence')}
          disabled={!canOpen('BuildIntelligence')}
          className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'BuildIntelligence' ? 'active' : ''} ${accessButtonClass('BuildIntelligence')}`}
        >
          <span className="text-center leading-tight">Build Intelligence</span>
        </button>
      </nav>

      {/* User Info Section - Bottom */}
      <div data-sidebar-user-footer="true" className="flex-shrink-0 border-t border-gray-700 p-4 flex flex-col items-center justify-center">
        <span className="text-[9px] text-gray-300 font-semibold">{currentUserRank}</span>
        <span className="text-[9px] text-gray-300">{userSurname}</span>
        <span className="text-[9px] text-gray-300">{currentUserLocation || 'N/A'}</span>
        <span className="text-[9px] text-gray-300">{currentUserUnit || 'N/A'}</span>
      </div>
    </aside>
  );
};

export default RightSidebar;
