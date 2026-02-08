'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AuditLog {
  id: string;
  actionType: string;
  actor: { userId: string; firstName: string | null; lastName: string | null } | null;
  target: { userId: string; firstName: string | null; lastName: string | null } | null;
  metadata: any;
  ipAddress: string | null;
  createdAt: Date;
}

export function AuditLogsList({
  logs,
  actionTypes,
  total,
  currentPage,
  totalPages,
  initialActionType,
  initialUserId,
}: {
  logs: AuditLog[];
  actionTypes: string[];
  total: number;
  currentPage: number;
  totalPages: number;
  initialActionType: string;
  initialUserId: string;
}) {
  const router = useRouter();
  const [actionTypeFilter, setActionTypeFilter] = useState(initialActionType);
  const [userIdFilter, setUserIdFilter] = useState(initialUserId);

  const handleFilter = () => {
    const params = new URLSearchParams();
    if (actionTypeFilter) params.set('actionType', actionTypeFilter);
    if (userIdFilter) params.set('userId', userIdFilter);
    params.set('page', '1');
    router.push(`/admin/audit?${params.toString()}`);
  };

  const handleReset = () => {
    setActionTypeFilter('');
    setUserIdFilter('');
    router.push('/admin/audit');
  };

  const getActionBadge = (actionType: string) => {
    if (actionType.includes('success') || actionType.includes('created')) {
      return 'bg-green-900/30 text-green-400 border-green-700';
    }
    if (actionType.includes('failure') || actionType.includes('deleted')) {
      return 'bg-red-900/30 text-red-400 border-red-700';
    }
    if (actionType.includes('updated') || actionType.includes('changed')) {
      return 'bg-blue-900/30 text-blue-400 border-blue-700';
    }
    return 'bg-gray-700 text-gray-400 border-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Action Type
            </label>
            <select
              value={actionTypeFilter}
              onChange={(e) => setActionTypeFilter(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Actions</option>
              {actionTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              User ID
            </label>
            <input
              type="text"
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
              placeholder="Search by User ID..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end space-x-2">
            <button
              onClick={handleFilter}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-md border ${getActionBadge(log.actionType)}`}>
                        {log.actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-white">
                      {log.actor ? (
                        <div>
                          <div>
                            {log.actor.firstName && log.actor.lastName 
                              ? `${log.actor.firstName} ${log.actor.lastName}` 
                              : log.actor.userId}
                          </div>
                          {log.actor.firstName && log.actor.lastName && (
                            <div className="text-xs text-gray-400">{log.actor.userId}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">System</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-white">
                      {log.target ? (
                        <div>
                          <div>
                            {log.target.firstName && log.target.lastName 
                              ? `${log.target.firstName} ${log.target.lastName}` 
                              : log.target.userId}
                          </div>
                          {log.target.firstName && log.target.lastName && (
                            <div className="text-xs text-gray-400">{log.target.userId}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {log.ipAddress || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-sm text-gray-400">
            Showing {(currentPage - 1) * 50 + 1} to {Math.min(currentPage * 50, total)} of {total} logs
          </div>
          <div className="flex space-x-2">
            {currentPage > 1 && (
              <Link
                href={`/admin/audit?page=${currentPage - 1}${actionTypeFilter ? `&actionType=${actionTypeFilter}` : ''}${userIdFilter ? `&userId=${userIdFilter}` : ''}`}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-md transition-colors"
              >
                Previous
              </Link>
            )}
            <span className="px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-md">
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages && (
              <Link
                href={`/admin/audit?page=${currentPage + 1}${actionTypeFilter ? `&actionType=${actionTypeFilter}` : ''}${userIdFilter ? `&userId=${userIdFilter}` : ''}`}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-md transition-colors"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
