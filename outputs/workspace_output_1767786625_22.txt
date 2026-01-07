import { PrismaClient } from '@prisma/client';
import Link from 'next/link';

const prisma = new PrismaClient();

export default async function AdminDashboard() {
  // Get statistics
  const [totalUsers, activeUsers, pendingUsers, totalRoles, recentAuditLogs] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'active' } }),
    prisma.user.count({ where: { status: 'pending' } }),
    prisma.permissionsRole.count(),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { userId: true, displayName: true } },
        target: { select: { userId: true, displayName: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Dashboard</h2>
        <p className="text-gray-400">Overview of system statistics and recent activity</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Total Users</p>
              <p className="text-3xl font-bold text-white">{totalUsers}</p>
            </div>
            <div className="w-12 h-12 bg-blue-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Active Users</p>
              <p className="text-3xl font-bold text-green-400">{activeUsers}</p>
            </div>
            <div className="w-12 h-12 bg-green-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Pending Users</p>
              <p className="text-3xl font-bold text-yellow-400">{pendingUsers}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Permissions Roles</p>
              <p className="text-3xl font-bold text-purple-400">{totalRoles}</p>
            </div>
            <div className="w-12 h-12 bg-purple-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/users/create"
            className="flex items-center p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">Create User</p>
              <p className="text-sm text-gray-400">Add a new user</p>
            </div>
          </Link>

          <Link
            href="/admin/users"
            className="flex items-center p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">Manage Users</p>
              <p className="text-sm text-gray-400">View and edit users</p>
            </div>
          </Link>

          <Link
            href="/admin/audit"
            className="flex items-center p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <div className="w-10 h-10 bg-purple-900/30 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">View Audit Logs</p>
              <p className="text-sm text-gray-400">Review system activity</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {recentAuditLogs.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No recent activity</p>
          ) : (
            recentAuditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <div>
                    <p className="text-white text-sm">
                      {log.actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-xs text-gray-400">
                      {log.actor ? `${log.actor.displayName || log.actor.userId}` : 'System'}
                      {log.target && ` → ${log.target.displayName || log.target.userId}`}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
        {recentAuditLogs.length > 0 && (
          <div className="mt-4 text-center">
            <Link
              href="/admin/audit"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              View All Logs →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
