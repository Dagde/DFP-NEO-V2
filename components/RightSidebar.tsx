import React, { useState } from 'react';
import { useSystemFreeze } from '../hooks/useSystemFreeze';
import { isFixedCrewLikeOperationalModel } from '../utils/platformConfigService';
import PermissionNotice from './PermissionNotice';

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
    onOpenNeoGuide?: () => void;
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
    onOpenNeoGuide,
}) => {
  const isFixedCrewModel = isFixedCrewLikeOperationalModel(operationalModel);

  const dashboardViews = ['MyDashboard', 'SupervisorDashboard'];
  const isAnyDashboardActive = dashboardViews.includes(activeView);

  const { isFrozen } = useSystemFreeze();
  const [permissionNoticeRect, setPermissionNoticeRect] = useState<DOMRect | null>(null);
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
  const canOpenNeoView = (view: string) => {
    const permissionId = neoNavigationPermissions[view];
    if (!permissionId) return canOpen(view);
    return canOpen(view) && canUsePermission(permissionId);
  };
  const isModelUnavailable = (view: string) => modelUnavailableViews.includes(view);
  const canBuild = canRunNeoBuild && canOpenNeoView('NextDayBuild');
  const canPublish = canPublishDfp && canOpenNeoView('Publish');
  const accessButtonClass = (view: string) => {
    if (isModelUnavailable(view)) return 'cursor-not-allowed';
    return canOpenNeoView(view) ? '' : 'cursor-not-allowed';
  };
  const actionButtonClass = (allowed: boolean) => allowed ? '' : 'cursor-not-allowed';
  const showPermissionNotice = (anchor: HTMLElement) => {
    setPermissionNoticeRect(anchor.getBoundingClientRect());
  };
  const navigateIfAllowed = (view: string, anchor: HTMLElement) => {
    if (isModelUnavailable(view)) {
      showPermissionNotice(anchor);
      return;
    }
    if (canOpenNeoView(view)) {
      onNavigate(view);
      return;
    }
    showPermissionNotice(anchor);
  };

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
          data-neo-guide="nav-duty-pilot"
          onClick={(event) => {
            if (isSupervisor && canOpen('SupervisorDashboard')) {
              onNavigate('SupervisorDashboard');
              return;
            }
            showPermissionNotice(event.currentTarget);
          }}
          aria-disabled={!isSupervisor || !canOpen('SupervisorDashboard')}
          title={!isSupervisor ? 'Access denied: Requires Flying Supervisor qualification.' : 'View Supervisor Dashboard'}
          className={`w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed ${activeView === 'SupervisorDashboard' ? 'active' : ''} ${!isSupervisor || !canOpen('SupervisorDashboard') ? 'cursor-not-allowed' : ''}`}
        >
          <span className="leading-tight">Duty<br/>Pilot</span>
        </button>

        <div className="relative mt-[14px]">
          <button
            data-neo-guide="nav-neo-build"
            onClick={(event) => canBuild ? onBuildDfpClick() : showPermissionNotice(event.currentTarget)}
            aria-disabled={!canBuild}
            title={canBuild ? 'Run NEO Build' : 'Access denied: NEO Build permission required'}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${actionButtonClass(canBuild)}`}
          >
            <span className="text-center leading-tight" style={{color: "#fb923c"}}>NEO Build</span>
          </button>
        </div>

        <div className="relative">
          <button
            data-neo-guide="nav-program-schedule"
            onClick={(event) => navigateIfAllowed('NextDayBuild', event.currentTarget)}
            aria-disabled={!canOpen('NextDayBuild')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayBuild' ? 'active' : ''} ${accessButtonClass('NextDayBuild')}`}
          >
            <span className="text-center leading-tight">Program Schedule</span>
          </button>
        </div>

        <div className="relative">
          <button
            data-neo-guide="nav-staff-schedule"
            onClick={(event) => navigateIfAllowed('NextDayInstructorSchedule', event.currentTarget)}
            aria-disabled={!canOpen('NextDayInstructorSchedule')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayInstructorSchedule' ? 'active' : ''} ${accessButtonClass('NextDayInstructorSchedule')}`}
          >
            <span className="text-center leading-tight">Staff Schedule</span>
          </button>
        </div>

        <div className="relative">
          <button
            data-neo-guide="nav-trainee-schedule"
            onClick={(event) => navigateIfAllowed('NextDayTraineeSchedule', event.currentTarget)}
            aria-disabled={isModelUnavailable('NextDayTraineeSchedule') || !canOpen('NextDayTraineeSchedule')}
            title={isModelUnavailable('NextDayTraineeSchedule') ? 'Trainee schedule functions are not used by this operational model.' : undefined}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'NextDayTraineeSchedule' ? 'active' : ''} ${accessButtonClass('NextDayTraineeSchedule')}`}
          >
            <span className="text-center leading-tight">Trainee Schedule</span>
          </button>
        </div>

        <div className="relative">
          <button
            data-neo-guide="action-publish-dfp"
            onClick={(event) => canPublish ? onPublish() : showPermissionNotice(event.currentTarget)}
            aria-disabled={!canPublish}
            title={canPublish ? 'Publish DFP' : 'Access denied: Publish DFP permission required'}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${actionButtonClass(canPublish)}`}
          >
            <span className="text-center leading-tight" style={{color: "#22c55e"}}>Publish</span>
          </button>
        </div>

        <div className="relative">
          <button
            data-neo-guide="nav-build-priorities"
            onClick={(event) => navigateIfAllowed('Priorities', event.currentTarget)}
            aria-disabled={!canOpen('Priorities')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'Priorities' ? 'active' : ''} ${accessButtonClass('Priorities')}`}
          >
            <span className="text-center leading-tight">{isFixedCrewModel ? <>Build<br/>Planner</> : 'Priorities'}</span>
          </button>
        </div>

        <div className="relative">
          <button
            data-neo-guide="nav-build-intelligence"
            onClick={(event) => navigateIfAllowed('BuildIntelligence', event.currentTarget)}
            aria-disabled={!canOpen('BuildIntelligence')}
            className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${activeView === 'BuildIntelligence' ? 'active' : ''} ${accessButtonClass('BuildIntelligence')}`}
          >
            <span className="text-center leading-tight">Build Intelligence</span>
          </button>
        </div>

      </nav>

      {/* Footer Icon Button */}
      <div data-sidebar-user-footer="true" className="flex-shrink-0 border-t border-gray-700 p-4 flex items-center justify-center">
        <button
          data-neo-guide="neo-guide-toggle"
          type="button"
          onClick={onOpenNeoGuide}
          title="Open NEO Guide"
          aria-label="Open NEO Guide"
          className="w-[75px] h-[55px] flex items-center justify-center rounded-md border border-slate-200/80 bg-[#030303] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.34),inset_0_-1px_0_rgba(0,0,0,0.7),0_0_0_1px_rgba(110,118,129,0.28)]"
        >
          <img
            src="/dfp-neo-sidebar-icon.jpg"
            alt=""
            aria-hidden="true"
            className="h-[44px] w-auto object-contain"
          />
        </button>
      </div>
      <PermissionNotice
        anchorRect={permissionNoticeRect}
        onClose={() => setPermissionNoticeRect(null)}
      />
    </aside>
  );
};

export default RightSidebar;
