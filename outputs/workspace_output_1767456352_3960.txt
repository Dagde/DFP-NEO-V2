'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';

interface User {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'USER',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/select');
    } else {
      fetchUsers();
    }
  }, [status, session, router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowAddUser(false);
        setFormData({
          username: '',
          password: '',
          email: '',
          firstName: '',
          lastName: '',
          role: 'USER',
        });
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neo-silver text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <Image
              src="/images/logo.png"
              alt="DFP-NEO"
              width={200}
              height={80}
              className="h-16 w-auto"
            />
            <div className="h-8 w-px bg-gray-700" />
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/select')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Selection
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-8 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">User Management</h2>
          <button
            onClick={() => setShowAddUser(true)}
            className="metal-button"
          >
            + Add New User
          </button>
        </div>

        {/* Add User Modal */}
        {showAddUser && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="metal-plate max-w-md w-full">
              <h3 className="text-xl font-bold text-white mb-6">Create New User</h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="metal-input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="metal-input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="metal-input w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="metal-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="metal-input w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="metal-input w-full"
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                    {session?.user?.role === 'SUPER_ADMIN' && (
                      <option value="SUPER_ADMIN">Super Admin</option>
                    )}
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="metal-button flex-1">
                    Create User
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    className="metal-button flex-1 bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="metal-plate overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Username</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Name</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Email</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Role</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Status</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Last Login</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-900/30">
                  <td className="py-4 px-4 text-white">{user.username}</td>
                  <td className="py-4 px-4 text-gray-300">
                    {user.firstName || user.lastName
                      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                      : '-'}
                  </td>
                  <td className="py-4 px-4 text-gray-300">{user.email || '-'}</td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      user.role === 'SUPER_ADMIN' ? 'bg-purple-900/30 text-purple-400' :
                      user.role === 'ADMIN' ? 'bg-blue-900/30 text-blue-400' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      user.isActive ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-gray-400 text-sm">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                      className="text-sm text-neo-silver hover:text-white transition-colors"
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}