import React, { useState } from 'react';
import { useSystemFreeze } from '../hooks/useSystemFreeze';
import { isFixedCrewLikeOperationalModel } from '../utils/platformConfigService';

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
    canUsePlatformPermission?: (permissionId: string) => boolean;
    modelUnavailableViews?: string[];
    operationalModel?: string;
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
    canPublishDfp = true,
    canUsePlatformPermission,
    modelUnavailableViews = [],
    operationalModel,
}) => {
  const nextDayBuildSubViews = ['NextDayBuild', 'Priorities', 'ProgramData', 'BuildAnalysis', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'];
  const isNextDayBuildSectionActive = nextDayBuildSubViews.includes(activeView);
  const isFixedCrewModel = isFixedCrewLikeOperationalModel(operationalModel);

  const dashboardViews = ['MyDashboard', 'SupervisorDashboard'];
  const isAnyDashboardActive = dashboardViews.includes(activeView);

  const { isFrozen } = useSystemFreeze();
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const canOpen = (view: string) => canAccessView ? canAccessView(view) : true;
  const canUsePermission = canUsePlatformPermission || (() => true);
  const neoNavigationPermissions: Record<string, string> = {
    NextDayBuild: 'neo.programSchedule.view',
    NextDayInstructorSchedule: 'neo.staffSchedule.view',
    NextDayTraineeSchedule: 'neo.traineeSchedule.view',
    Publish: 'neo.publish.view',
    Priorities: 'neo.priorities',
    BuildIntelligence: 'neo.intelligence',
  };
  const hasSpecificNeoNavigationPermission = Object.values(neoNavigationPermissions).some(permissionId => canUsePermission(permissionId));
  const canOpenNeoView = (view: string) => {
    const permissionId = neoNavigationPermissions[view];
    if (!permissionId) return canOpen(view);
    return canOpen(view) && (
      canUsePermission(permissionId)
      || (!hasSpecificNeoNavigationPermission && canOpen(view))
    );
  };
  const isModelUnavailable = (view: string) => modelUnavailableViews.includes(view);
  const canBuild = canRunNeoBuild && canOpenNeoView('NextDayBuild');
  const canPublish = canPublishDfp && canOpenNeoView('Publish');
  const accessButtonClass = (view: string) => {
    if (isModelUnavailable(view)) return 'cursor-not-allowed';
    return canOpenNeoView(view) ? '' : 'cursor-not-allowed';
  };
  const actionButtonClass = (allowed: boolean) => allowed ? '' : 'cursor-not-allowed';
  const showPermissionNotice = (key: string) => {
    setPermissionNotice(key);
    window.setTimeout(() => {
      setPermissionNotice(current => current === key ? null : current);
    }, 1800);
  };
  const permissionNoticeBubble = (key: string) => (
    permissionNotice === key ? (
      <span className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-md border border-red-400/40 bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-red-200 shadow-lg">
        Permissions: Not Allowed
      </span>
    ) : null
  );
  const navigateIfAllowed = (view: string) => {
    if (isModelUnavailable(view)) {
      showPermissionNotice(view);
      return;
    }
    if (canOpenNeoView(view)) {
      onNavigate(view);
      return;
    }
    showPermissionNotice(view);
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
          title={!isSupervisor ? 'Access denied: Requires Flying Supervisor qualification.' : 'View Supervisor Dashboard'}
          className={`w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed ${activeView === 'SupervisorDashboard' ? 'active' : ''} ${!isSupervisor || !canOpen('SupervisorDashboard') ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className="leading-tight">Duty<br/>Pilot</span>
        </button>

        <div className="relative mt-[14px]">
          {permissionNoticeBubble('NEO Build')}
          <button
            onClick={() => canBuild ? onBuildDfpClick() : showPermissionNotice('NEO Build')}
            aria-disabled={!canBuild}
            title={canBuild ? 'Run NEO Build' : 'Access denied: NEO Build permission required'}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${actionButtonClass(canBuild)}`}
          >
            <span className="text-center leading-tight" style={{color: "#fb923c"}}>NEO Build</span>
          </button>
        </div>

        <div className="relative">
          {permissionNoticeBubble('NextDayBuild')}
          <button
            onClick={() => navigateIfAllowed('NextDayBuild')}
            aria-disabled={!canOpen('NextDayBuild')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayBuild' ? 'active' : ''} ${accessButtonClass('NextDayBuild')}`}
          >
            <span className="text-center leading-tight">Program Schedule</span>
          </button>
        </div>

        <div className="relative">
          {permissionNoticeBubble('NextDayInstructorSchedule')}
          <button
            onClick={() => navigateIfAllowed('NextDayInstructorSchedule')}
            aria-disabled={!canOpen('NextDayInstructorSchedule')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayInstructorSchedule' ? 'active' : ''} ${accessButtonClass('NextDayInstructorSchedule')}`}
          >
            <span className="text-center leading-tight">Staff Schedule</span>
          </button>
        </div>

        <div className="relative">
          {permissionNoticeBubble('NextDayTraineeSchedule')}
          <button
            onClick={() => navigateIfAllowed('NextDayTraineeSchedule')}
            aria-disabled={isModelUnavailable('NextDayTraineeSchedule') || !canOpen('NextDayTraineeSchedule')}
            title={isModelUnavailable('NextDayTraineeSchedule') ? 'Trainee schedule functions are not used by this operational model.' : undefined}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayTraineeSchedule' ? 'active' : ''} ${accessButtonClass('NextDayTraineeSchedule')}`}
          >
            <span className="text-center leading-tight">Trainee Schedule</span>
          </button>
        </div>

        <div className="relative">
          {permissionNoticeBubble('Publish')}
          <button
            onClick={() => canPublish ? onPublish() : showPermissionNotice('Publish')}
            aria-disabled={!canPublish}
            title={canPublish ? 'Publish DFP' : 'Access denied: Publish DFP permission required'}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${actionButtonClass(canPublish)}`}
          >
            <span className="text-center leading-tight" style={{color: "#22c55e"}}>Publish</span>
          </button>
        </div>

        <div className="relative">
          {permissionNoticeBubble('Priorities')}
          <button
            onClick={() => navigateIfAllowed('Priorities')}
            aria-disabled={!canOpen('Priorities')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Priorities' ? 'active' : ''} ${accessButtonClass('Priorities')}`}
          >
            <span className="text-center leading-tight">{isFixedCrewModel ? <>Build<br/>Planner</> : 'Priorities'}</span>
          </button>
        </div>

        <div className="relative">
          {permissionNoticeBubble('BuildIntelligence')}
          <button
            onClick={() => navigateIfAllowed('BuildIntelligence')}
            aria-disabled={!canOpen('BuildIntelligence')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'BuildIntelligence' ? 'active' : ''} ${accessButtonClass('BuildIntelligence')}`}
          >
            <span className="text-center leading-tight">Build Intelligence</span>
          </button>
        </div>
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
