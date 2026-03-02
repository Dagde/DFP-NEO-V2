import React, { useState, useEffect } from 'react';

// Auth server URL - use empty string to use relative URLs
const AUTH_SERVER = '';
const API_USERS = '/api/admin/direct-users';
const API_RESET_PASSWORD = '/api/admin/direct-reset-password';
const API_CREATE_USER = '/api/admin/direct-create-user';

interface AdminUser {
  id: string;
  userId: string;
  username: string;
  email: string | null;
  role: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  isActive: number | boolean;
  mustChangePassword: number | boolean;
  lastLoginAt: string | null;
  createdAt: string | number;
  permissionsRoleId: string;
}

interface AdminPanelProps {
  sessionToken: string;
  currentUserId: string;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ sessionToken, currentUserId, onClose }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'create'>('users');

  // Reset password state
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetMustChange, setResetMustChange] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  // Create user state
  const [newUserId, setNewUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newRole, setNewRole] = useState('USER');
  const [newMustChange, setNewMustChange] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState('');
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${AUTH_SERVER}${API_USERS}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || !resetPassword) return;
    setResetLoading(true);
    setResetMessage('');
    try {
      const res = await fetch(`${AUTH_SERVER}${API_RESET_PASSWORD}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          targetUserId: resetTarget,
          newPassword: resetPassword,
          mustChangePassword: resetMustChange,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Reset failed');
      setResetMessage(`✅ Password reset for ${resetTarget}`);
      setResetPassword('');
      setTimeout(() => {
        setResetTarget(null);
        setResetMessage('');
      }, 2000);
    } catch (err: any) {
      setResetMessage(`❌ ${err.message}`);
    } finally {
      setResetLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateMessage('');
    setCreateError('');
    try {
      const res = await fetch(`${AUTH_SERVER}${API_CREATE_USER}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          userId: newUserId.trim(),
          password: newPassword,
          email: newEmail.trim() || undefined,
          firstName: newFirstName.trim() || undefined,
          lastName: newLastName.trim() || undefined,
          role: newRole,
          mustChangePassword: newMustChange,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Create failed');
      setCreateMessage(`✅ User ${newUserId} created successfully`);
      setNewUserId('');
      setNewPassword('');
      setNewEmail('');
      setNewFirstName('');
      setNewLastName('');
      setNewRole('USER');
      setNewMustChange(true);
      fetchUsers();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const formatDate = (val: string | number | null) => {
    if (!val) return 'Never';
    try {
      const d = typeof val === 'number' ? new Date(val) : new Date(val);
      return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(val);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: 'bg-red-900/40 text-red-300 border-red-700/40',
      ADMIN: 'bg-orange-900/40 text-orange-300 border-orange-700/40',
      INSTRUCTOR: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
      PILOT: 'bg-green-900/40 text-green-300 border-green-700/40',
      USER: 'bg-gray-700/40 text-gray-300 border-gray-600/40',
    };
    return colors[role] || colors.USER;
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[700px] max-h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col" style={{ background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3748 100%)' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Admin Panel</h2>
              <p className="text-xs text-gray-400">User Management</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-700/50 hover:bg-gray-600/50 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700/50">
          {(['users', 'create'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab === 'users' ? '👥 Users' : '➕ Create User'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Users Tab */}
          {activeTab === 'users' && (
            <div>
              {loading ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading users...</div>
              ) : error ? (
                <div className="text-center py-8 text-red-400 text-sm">{error}</div>
              ) : (
                <div className="space-y-3">
                  {users.map(user => (
                    <div key={user.id} className="rounded-lg border border-gray-700/50 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-white">{user.displayName || user.userId}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getRoleBadge(user.role)}`}>
                              {user.role}
                            </span>
                            {(user.isActive === 0 || user.isActive === false) && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-700/40 text-gray-400 border border-gray-600/40">
                                INACTIVE
                              </span>
                            )}
                            {(user.mustChangePassword === 1 || user.mustChangePassword === true) && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-900/40 text-amber-300 border border-amber-700/40">
                                MUST CHANGE PWD
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>ID: <span className="text-gray-300">{user.userId}</span></span>
                            {user.email && <span>Email: <span className="text-gray-300">{user.email}</span></span>}
                            <span>Last login: <span className="text-gray-300">{formatDate(user.lastLoginAt)}</span></span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setResetTarget(user.userId);
                            setResetPassword('');
                            setResetMessage('');
                          }}
                          className="ml-4 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 border border-amber-700/40 bg-amber-900/20 hover:bg-amber-900/40 transition-colors"
                        >
                          Reset Password
                        </button>
                      </div>

                      {/* Reset password form inline */}
                      {resetTarget === user.userId && (
                        <form onSubmit={handleResetPassword} className="mt-3 pt-3 border-t border-gray-700/50">
                          <div className="flex items-center gap-3">
                            <input
                              type="password"
                              value={resetPassword}
                              onChange={e => setResetPassword(e.target.value)}
                              placeholder="New password"
                              className="flex-1 px-3 py-2 rounded-lg text-xs text-white placeholder-gray-500 border border-gray-600 focus:border-blue-500 focus:outline-none"
                              style={{ background: 'rgba(255,255,255,0.05)' }}
                              autoFocus
                            />
                            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={resetMustChange}
                                onChange={e => setResetMustChange(e.target.checked)}
                                className="rounded"
                              />
                              Must change
                            </label>
                            <button
                              type="submit"
                              disabled={resetLoading || !resetPassword}
                              className="px-3 py-2 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {resetLoading ? '...' : 'Reset'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setResetTarget(null)}
                              className="px-3 py-2 rounded-lg text-xs font-medium text-gray-400 border border-gray-600 hover:border-gray-500 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                          {resetMessage && (
                            <p className={`text-xs mt-2 ${resetMessage.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                              {resetMessage}
                            </p>
                          )}
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create User Tab */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                    User ID *
                  </label>
                  <input
                    type="text"
                    value={newUserId}
                    onChange={e => setNewUserId(e.target.value)}
                    placeholder="e.g. john.smith"
                    className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 border border-gray-600 focus:border-blue-500 focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Initial password"
                    className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 border border-gray-600 focus:border-blue-500 focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={e => setNewFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 border border-gray-600 focus:border-blue-500 focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={e => setNewLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 border border-gray-600 focus:border-blue-500 focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="email@sample.com.au"
                    className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 border border-gray-600 focus:border-blue-500 focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                    Role
                  </label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                    style={{ background: '#2d3748' }}
                  >
                    <option value="USER">USER</option>
                    <option value="INSTRUCTOR">INSTRUCTOR</option>
                    <option value="PILOT">PILOT</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newMustChange}
                  onChange={e => setNewMustChange(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs text-gray-400">Require password change on first login</span>
              </label>

              {createError && (
                <div className="px-3 py-2 rounded-lg bg-red-900/40 border border-red-700/50">
                  <p className="text-xs text-red-300">{createError}</p>
                </div>
              )}
              {createMessage && (
                <div className="px-3 py-2 rounded-lg bg-green-900/40 border border-green-700/50">
                  <p className="text-xs text-green-300">{createMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={createLoading || !newUserId || !newPassword}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
              >
                {createLoading ? 'Creating...' : 'Create User'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;