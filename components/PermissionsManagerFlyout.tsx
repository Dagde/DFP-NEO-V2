import React, { useState, useEffect } from 'react';

interface PermissionLevel {
  name: string;
  color: string;
  description: string;
}

interface PagePermission {
  pageId: string;
  pageName: string;
  permissions: {
    'Super Admin': boolean;
    'Admin': boolean;
    'Staff': boolean;
    'Trainee': boolean;
    'Ops': boolean;
    'Scheduler': boolean;
    'Course Supervisor': boolean;
  };
  note?: string;
}

interface WindowPermission {
  windowId: string;
  windowName: string;
  parentPage: string;
  permissions: {
    'Super Admin': boolean;
    'Admin': boolean;
    'Staff': boolean;
    'Trainee': boolean;
    'Ops': boolean;
    'Scheduler': boolean;
    'Course Supervisor': boolean;
  };
}

interface PermissionsManagerFlyoutProps {
  onClose: () => void;
  onSave: (pagePermissions: PagePermission[], windowPermissions: WindowPermission[]) => void;
  currentPagePermissions?: PagePermission[];
  currentWindowPermissions?: WindowPermission[];
}

const PermissionsManagerFlyout: React.FC<PermissionsManagerFlyoutProps> = ({
  onClose,
  onSave,
  currentPagePermissions = [],
  currentWindowPermissions = []
}) => {
  const [activeTab, setActiveTab] = useState<'pages' | 'windows'>('pages');
  const [pagePermissions, setPagePermissions] = useState<PagePermission[]>([]);
  const [windowPermissions, setWindowPermissions] = useState<WindowPermission[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('All');
  const [bulkAction, setBulkAction] = useState<'allow' | 'deny' | ''>('');

  const permissionLevels: PermissionLevel[] = [
    { name: 'Super Admin', color: 'bg-purple-600', description: 'Full system access' },
    { name: 'Admin', color: 'bg-red-600', description: 'Administrative access' },
    { name: 'Staff', color: 'bg-blue-600', description: 'Staff level access' },
    { name: 'Trainee', color: 'bg-green-600', description: 'Trainee level access' },
    { name: 'Ops', color: 'bg-yellow-600', description: 'Operations access' },
    { name: 'Scheduler', color: 'bg-indigo-600', description: 'Scheduling access' },
    { name: 'Course Supervisor', color: 'bg-pink-600', description: 'Course supervision access' }
  ];

  useEffect(() => {
    // Initialize with default permissions if none provided
    if (currentPagePermissions.length === 0) {
      setPagePermissions([
        { pageId: 'program-schedule', pageName: 'Program Schedule', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': true, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'instructor-schedule', pageName: 'Instructor Schedule', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': true, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'trainee-schedule', pageName: 'Trainee Schedule', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': true, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'next-day-instructor-schedule', pageName: 'Next Day Instructor Schedule', permissions: { 'Super Admin': true, 'Admin': false, 'Staff': false, 'Trainee': false, 'Ops': false, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'next-day-trainee-schedule', pageName: 'Next Day Trainee Schedule', permissions: { 'Super Admin': true, 'Admin': false, 'Staff': false, 'Trainee': false, 'Ops': false, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'course-roster', pageName: 'Course Roster', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': true, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'hate-sheet', pageName: 'Hate Sheet', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': false, 'Ops': false, 'Scheduler': false, 'Course Supervisor': true }, note: 'Trainees can only view their own PT-051' },
        { pageId: 'score-detail', pageName: 'Score Detail', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': false, 'Ops': false, 'Scheduler': false, 'Course Supervisor': true }, note: 'Trainees can only view their own scores' },
        { pageId: 'next-day-build', pageName: 'Next Day Build', permissions: { 'Super Admin': true, 'Admin': false, 'Staff': false, 'Trainee': false, 'Ops': false, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'priorities', pageName: 'Priorities', permissions: { 'Super Admin': true, 'Admin': false, 'Staff': false, 'Trainee': false, 'Ops': false, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'course-progress', pageName: 'Course Progress', permissions: { 'Super Admin': true, 'Admin': false, 'Staff': false, 'Trainee': false, 'Ops': false, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'program-data', pageName: 'Program Data', permissions: { 'Super Admin': true, 'Admin': false, 'Staff': false, 'Trainee': false, 'Ops': false, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'my-dashboard', pageName: 'My Dashboard', permissions: { 'Super Admin': false, 'Admin': false, 'Staff': false, 'Trainee': true, 'Ops': false, 'Scheduler': false, 'Course Supervisor': false }, note: 'Only accessible by individual user' },
        { pageId: 'supervisor-dashboard', pageName: 'Supervisor Dashboard', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': false, 'Ops': false, 'Scheduler': false, 'Course Supervisor': false }, note: 'Staff only if Flying Supervisor role' },
        { pageId: 'instructors', pageName: 'Instructors', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': false, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'syllabus', pageName: 'Syllabus', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': true, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'trainee-lmp', pageName: 'Trainee LMP', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': true, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'currency', pageName: 'Currency', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': false, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'settings', pageName: 'Settings', permissions: { 'Super Admin': true, 'Admin': false, 'Staff': false, 'Trainee': false, 'Ops': false, 'Scheduler': true, 'Course Supervisor': false } },
        { pageId: 'currency-builder', pageName: 'Currency Builder', permissions: { 'Super Admin': true, 'Admin': false, 'Staff': false, 'Trainee': false, 'Ops': false, 'Scheduler': true, 'Course Supervisor': false } },
        { pageId: 'pt051', pageName: 'PT051', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': false, 'Ops': false, 'Scheduler': false, 'Course Supervisor': true } },
        { pageId: 'post-flight', pageName: 'Post Flight', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': true, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { pageId: 'logbook', pageName: 'Logbook', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': true, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } }
      ]);
    } else {
      setPagePermissions(currentPagePermissions);
    }

    if (currentWindowPermissions.length === 0) {
      setWindowPermissions([
        { windowId: 'event-detail-modal', windowName: 'Event Detail Modal', parentPage: 'All Schedule Pages', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': true, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { windowId: 'flight-detail-modal', windowName: 'Flight Detail Modal', parentPage: 'All Schedule Pages', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': true, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { windowId: 'audit-flyout', windowName: 'Audit Flyout', parentPage: 'All Pages', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': true, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { windowId: 'authorisation-flyout', windowName: 'Authorisation Flyout', parentPage: 'Schedule Pages', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': true, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { windowId: 'publish-confirmation', windowName: 'Publish Confirmation', parentPage: 'Program Schedule', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': false, 'Trainee': false, 'Ops': false, 'Scheduler': true, 'Course Supervisor': true } },
        { windowId: 'instructor-profile', windowName: 'Staff Profile', parentPage: 'Instructors', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': false, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { windowId: 'trainee-profile', windowName: 'Trainee Profile', parentPage: 'Course Roster', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': true, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } },
        { windowId: 'currency-setup', windowName: 'Currency Setup', parentPage: 'Course Roster', permissions: { 'Super Admin': true, 'Admin': true, 'Staff': true, 'Trainee': false, 'Ops': true, 'Scheduler': true, 'Course Supervisor': true } }
      ]);
    } else {
      setWindowPermissions(currentWindowPermissions);
    }
  }, [currentPagePermissions, currentWindowPermissions]);

  const togglePermission = (type: 'pages' | 'windows', index: number, level: string) => {
    const permissions = type === 'pages' ? [...pagePermissions] : [...windowPermissions];
    permissions[index].permissions[level as keyof typeof permissions[0]['permissions']] = !permissions[index].permissions[level as keyof typeof permissions[0]['permissions']];
    
    if (type === 'pages') {
      setPagePermissions(permissions);
    } else {
      setWindowPermissions(permissions);
    }
  };

  const applyBulkAction = (type: 'pages' | 'windows') => {
    const permissions = type === 'pages' ? [...pagePermissions] : [...windowPermissions];
    const newValue = bulkAction === 'allow';
    
    permissions.forEach(perm => {
      if (selectedLevel === 'All') {
        Object.keys(perm.permissions).forEach(level => {
          perm.permissions[level as keyof typeof perm.permissions] = newValue;
        });
      } else {
        perm.permissions[selectedLevel as keyof typeof perm.permissions] = newValue;
      }
    });
    
    if (type === 'pages') {
      setPagePermissions(permissions);
    } else {
      setWindowPermissions(permissions);
    }
    
    setBulkAction('');
  };

  const filteredPermissions = (type: 'pages' | 'windows') => {
    const permissions = type === 'pages' ? pagePermissions : windowPermissions;
    return permissions.filter(perm => 
      perm.pageName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.windowName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const currentPermissions = activeTab === 'pages' ? pagePermissions : windowPermissions;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-7xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Permissions Manager</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Search pages or windows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-sky-500"
            />
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
            >
              <option value="All">All Levels</option>
              {permissionLevels.map(level => (
                <option key={level.name} value={level.name}>{level.name}</option>
              ))}
            </select>
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value as 'allow' | 'deny' | '')}
              className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
            >
              <option value="">Bulk Action</option>
              <option value="allow">Allow All</option>
              <option value="deny">Deny All</option>
            </select>
            {bulkAction && (
              <button
                onClick={() => applyBulkAction(activeTab)}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
              >
                Apply
              </button>
            )}
          </div>
        </div>

        <div className="p-6 border-b border-gray-700">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('pages')}
              className={`px-4 py-2 rounded-t-lg font-medium ${
                activeTab === 'pages'
                  ? 'bg-gray-800 text-white border border-gray-600 border-b-0'
                  : 'bg-gray-700 text-gray-300 hover:text-white'
              }`}
            >
              Page Permissions ({pagePermissions.length})
            </button>
            <button
              onClick={() => setActiveTab('windows')}
              className={`px-4 py-2 rounded-t-lg font-medium ${
                activeTab === 'windows'
                  ? 'bg-gray-800 text-white border border-gray-600 border-b-0'
                  : 'bg-gray-700 text-gray-300 hover:text-white'
              }`}
            >
              Window Permissions ({windowPermissions.length})
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: '50vh' }}>
          <div className="mb-4 flex items-center space-x-4 text-sm">
            {permissionLevels.map(level => (
              <div key={level.name} className="flex items-center space-x-2">
                <div className={`w-4 h-4 ${level.color} rounded`}></div>
                <span className="text-gray-300">{level.name}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-white font-medium">
                    {activeTab === 'pages' ? 'Page Name' : 'Window Name'}
                  </th>
                  {activeTab === 'windows' && (
                    <th className="text-left py-3 px-4 text-white font-medium">Parent Page</th>
                  )}
                  {permissionLevels.map(level => (
                    <th key={level.name} className="text-center py-3 px-4 text-white font-medium">
                      {level.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPermissions(activeTab).map((item, index) => (
                  <tr key={activeTab === 'pages' ? item.pageId : item.windowId} className="border-b border-gray-700 hover:bg-gray-800">
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">
                        {activeTab === 'pages' ? item.pageName : item.windowName}
                      </div>
                      {item.note && (
                        <div className="text-gray-400 text-sm mt-1">
                          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {item.note}
                        </div>
                      )}
                    </td>
                    {activeTab === 'windows' && (
                      <td className="py-3 px-4 text-gray-300">
                        {item.parentPage}
                      </td>
                    )}
                    {permissionLevels.map(level => (
                      <td key={level.name} className="py-3 px-4 text-center">
                        <button
                          onClick={() => togglePermission(activeTab, index, level.name)}
                          className={`w-6 h-6 rounded-full border-2 transition-colors ${
                            item.permissions[level.name as keyof typeof item.permissions]
                              ? 'bg-green-500 border-green-500'
                              : 'bg-gray-700 border-gray-500 hover:border-gray-400'
                          }`}
                        >
                          {item.permissions[level.name as keyof typeof item.permissions] && (
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 border-t border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            <span className="font-medium">Quick Templates:</span>
            <button
              onClick={() => {
                const resetPermissions = type === 'pages' ? pagePermissions.map(p => ({...p, permissions: {...p.permissions, 'Trainee': true, 'Staff': true}})) : windowPermissions.map(w => ({...w, permissions: {...w.permissions, 'Trainee': true, 'Staff': true}}));
                if (activeTab === 'pages') setPagePermissions(resetPermissions); else setWindowPermissions(resetPermissions);
              }}
              className="ml-4 text-sky-400 hover:text-sky-300"
            >
              Standard Staff Access
            </button>
            <button
              onClick={() => {
                const resetPermissions = type === 'pages' ? pagePermissions.map(p => ({...p, permissions: {...p.permissions, 'Trainee': true, 'Staff': false, 'Ops': false}})) : windowPermissions.map(w => ({...w, permissions: {...w.permissions, 'Trainee': true, 'Staff': false, 'Ops': false}}));
                if (activeTab === 'pages') setPagePermissions(resetPermissions); else setWindowPermissions(resetPermissions);
              }}
              className="ml-4 text-sky-400 hover:text-sky-300"
            >
              Trainee Only Access
            </button>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(pagePermissions, windowPermissions)}
              className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionsManagerFlyout;