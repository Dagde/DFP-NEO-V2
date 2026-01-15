'use client';

import { useState, useEffect } from 'react';
import { 
  Database, 
  Users, 
  UserCheck, 
  AlertTriangle, 
  Search, 
  RefreshCw,
  Trash2,
  Download,
  ArrowRight
} from 'lucide-react';

interface DatabaseStats {
  users: number;
  personnel: number;
  trainees: number;
  schedules: number;
  aircraft: number;
  scores: number;
  unlinkedPersonnel: number;
}

interface RecentItem {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  rank?: string;
  userId?: string | null;
  createdAt: string;
}

export default function DatabaseAdmin() {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentItem[]>([]);
  const [recentPersonnel, setRecentPersonnel] = useState<RecentItem[]>([]);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [queryResults, setQueryResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'query' | 'duplicates'>('overview');

  useEffect(() => {
    fetchDatabaseInfo();
  }, []);

  const fetchDatabaseInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/database');
      
      if (response.status === 403) {
        setError('Admin access required');
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch database info');
      
      const data = await response.json();
      setStats(data.statistics);
      setRecentUsers(data.recentUsers);
      setRecentPersonnel(data.recentPersonnel);
      setDuplicates(data.duplicates || []);
      setError('');
    } catch (err) {
      console.error('Error fetching database info:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch database info');
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/admin/database?query=${encodeURIComponent(query)}`);
      
      if (!response.ok) throw new Error('Failed to execute query');
      
      const data = await response.json();
      setQueryResults(data);
    } catch (err) {
      console.error('Error executing query:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  };

  const cleanupDuplicates = async () => {
    if (!confirm('This will delete all duplicate Personnel records. Continue?')) return;

    try {
      setLoading(true);
      const response = await fetch('/api/debug/cleanup-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to cleanup duplicates');

      const data = await response.json();
      alert(`✅ Cleanup complete!\n\nDeleted ${data.totalDeleted} duplicate records.\n\n${JSON.stringify(data.cleanupResults, null, 2)}`);
      
      await fetchDatabaseInfo();
    } catch (err) {
      console.error('Error cleaning up duplicates:', err);
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Failed to cleanup duplicates'}`);
    } finally {
      setLoading(false);
    }
  };

  if (error === 'Admin access required') {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-8 text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
          <p className="text-gray-300">You need ADMIN access to view this page.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-8 text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-500 mb-2">Error</h1>
          <p className="text-gray-300">{error}</p>
          <button
            onClick={fetchDatabaseInfo}
            className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Database className="w-10 h-10 text-blue-500" />
            Database Administration
          </h1>
          <p className="text-gray-400">Manage and monitor the DFP-NEO database</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('query')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'query'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            SQL Query
          </button>
          <button
            onClick={() => setActiveTab('duplicates')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'duplicates'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Duplicates
            {duplicates.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {duplicates.length}
              </span>
            )}
          </button>
        </div>

        {/* Refresh Button */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={fetchDatabaseInfo}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Statistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard
                icon={<Users className="w-8 h-8 text-blue-500" />}
                title="Total Users"
                value={stats.users}
                description="Registered users in the system"
              />
              <StatCard
                icon={<UserCheck className="w-8 h-8 text-green-500" />}
                title="Personnel"
                value={stats.personnel}
                description={`(${stats.unlinkedPersonnel} unlinked)`}
                warning={stats.unlinkedPersonnel > 0}
              />
              <StatCard
                icon={<Users className="w-8 h-8 text-yellow-500" />}
                title="Trainees"
                value={stats.trainees}
                description="Active training students"
              />
              <StatCard
                icon={<Database className="w-8 h-8 text-purple-500" />}
                title="Schedules"
                value={stats.schedules}
                description="Flight schedules created"
              />
              <StatCard
                icon={<Database className="w-8 h-8 text-orange-500" />}
                title="Aircraft"
                value={stats.aircraft}
                description="Aircraft in the fleet"
              />
              <StatCard
                icon={<Database className="w-8 h-8 text-pink-500" />}
                title="Scores"
                value={stats.scores}
                description="Training scores recorded"
              />
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Recent Users
                </h2>
                <div className="space-y-2">
                  {recentUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between bg-gray-700/50 rounded-lg p-3"
                    >
                      <div>
                        <div className="font-semibold">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-gray-400">
                          {user.userId} • {user.role}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-green-500" />
                  Recent Personnel
                </h2>
                <div className="space-y-2">
                  {recentPersonnel.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center justify-between bg-gray-700/50 rounded-lg p-3"
                    >
                      <div>
                        <div className="font-semibold">{person.name}</div>
                        <div className="text-sm text-gray-400">
                          {person.rank} • ID: {person.idNumber}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {person.userId ? (
                          <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                            Linked
                          </span>
                        ) : (
                          <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">
                            Unlinked
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Query Tab */}
        {activeTab === 'query' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-500" />
                SQL Query (READ-ONLY)
              </h2>
              <div className="space-y-4">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter SELECT query (e.g., SELECT * FROM 'Personnel' LIMIT 10)"
                  className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg p-4 font-mono text-sm text-green-400 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={executeQuery}
                  disabled={!query.trim() || loading}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  Execute Query
                </button>
              </div>
            </div>

            {queryResults && (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Query Results</h2>
                  <span className="text-sm text-gray-400">
                    {queryResults.rowCount} row(s)
                  </span>
                </div>
                <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
                  <code className="text-green-400">
                    {JSON.stringify(queryResults.results, null, 2)}
                  </code>
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Duplicates Tab */}
        {activeTab === 'duplicates' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Duplicate Personnel Records
                </h2>
                {duplicates.length > 0 && (
                  <button
                    onClick={cleanupDuplicates}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Cleanup All Duplicates
                  </button>
                )}
              </div>

              {duplicates.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <UserCheck className="w-16 h-16 mx-auto mb-4 text-green-500" />
                  <p className="text-lg">No duplicate records found!</p>
                  <p className="text-sm">All Personnel records are unique.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {duplicates.map((dup: any, index: number) => (
                    <div
                      key={index}
                      className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-yellow-400">
                            ID: {dup.idnumber}
                          </div>
                          <div className="text-sm text-gray-300">
                            {dup.names}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="bg-yellow-600 text-white text-xs px-3 py-1 rounded-full">
                            {dup.count} duplicates
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-6">
              <h3 className="font-bold text-blue-400 mb-2">About Duplicate Cleanup</h3>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>• Keeps records with <code className="bg-gray-800 px-1 rounded">userId</code> set (properly linked)</li>
                <li>• Falls back to most recently created record</li>
                <li>• Deletes all other duplicate records</li>
                <li>• Provides detailed cleanup report</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, description, warning }: {
  icon: React.ReactNode;
  title: string;
  value: number;
  description: string;
  warning?: boolean;
}) {
  return (
    <div className={`bg-gray-800 rounded-lg p-6 border-2 transition-colors ${
      warning ? 'border-yellow-600' : 'border-gray-700'
    }`}>
      <div className="flex items-start justify-between mb-4">
        {icon}
        {warning && (
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
        )}
      </div>
      <div className="text-3xl font-bold mb-2">{value}</div>
      <div className="text-sm text-gray-400 font-semibold mb-1">{title}</div>
      <div className="text-xs text-gray-500">{description}</div>
    </div>
  );
}