'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PrismaClient } from '@prisma/client';

interface User {
  id: string;
  username: string;
  email: string | null;
  role: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export default function UsersManagement() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [message, setMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'USER',
    firstName: '',
    lastName: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated' || (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'SUPER_ADMIN')) {
      router.push('/login');
      return;
    }
    fetchUsers();
  }, [status, session, router]);

  const fetchUsers = async () => {
    try {
      // For now, we'll use mock data since we don't have the API endpoint yet
      const mockUsers: User[] = [
        {
          id: '1',
          username: 'admin',
          email: 'admin@dfp-neo.com',
          role: 'ADMIN',
          firstName: 'System',
          lastName: 'Administrator',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          lastLogin: new Date().toISOString(),
        },
        {
          id: '2',
          username: 'john.pilot',
          email: 'john.pilot@dfp-neo.com',
          role: 'PILOT',
          firstName: 'John',
          lastName: 'Smith',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          lastLogin: null,
        },
        {
          id: '3',
          username: 'jane.instructor',
          email: 'jane.instructor@dfp-neo.com',
          role: 'INSTRUCTOR',
          firstName: 'Jane',
          lastName: 'Wilson',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          lastLogin: null,
        }
      ];
      setUsers(mockUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setMessage('Error loading users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      // Mock user creation
      const newUser: User = {
        id: Date.now().toString(),
        username: formData.username,
        email: formData.email,
        role: formData.role,
        firstName: formData.firstName,
        lastName: formData.lastName,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: null,
      };

      setUsers([...users, newUser]);
      setShowAddForm(false);
      setFormData({
        username: '',
        email: '',
        password: '',
        role: 'USER',
        firstName: '',
        lastName: '',
      });
      setMessage('User added successfully!');
    } catch (error) {
      setMessage('Error adding user');
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email || '',
      password: '',
      role: user.role,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
    });
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      setUsers(users.filter(u => u.id !== userId));
      setMessage('User deleted successfully!');
    } catch (error) {
      setMessage('Error deleting user');
    }
  };

  const toggleUserStatus = async (userId: string) => {
    try {
      setUsers(users.map(u => 
        u.id === userId ? { ...u, isActive: !u.isActive } : u
      ));
      setMessage('User status updated!');
    } catch (error) {
      setMessage('Error updating user status');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-neutral-300 text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
            <p className="text-neutral-400">Manage DFP-NEO system users</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            + Add New User
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('Error') ? 'bg-red-900/30 border border-red-500 text-red-200' : 
            'bg-green-900/30 border border-green-500 text-green-200'
          }`}>
            {message}
          </div>
        )}

        {/* Add User Form */}
        {(showAddForm || editingUser) && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-8">
            <h3 className="text-xl font-semibold text-white mb-4">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-neutral-300 mb-2">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                  required
                  disabled={!!editingUser}
                />
              </div>
              <div>
                <label className="block text-neutral-300 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-neutral-300 mb-2">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-neutral-300 mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  <option value="USER">User</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="PILOT">Pilot</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-neutral-300 mb-2">First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-neutral-300 mb-2">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div className="col-span-2 flex gap-4">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded transition-colors"
                >
                  {editingUser ? 'Update User' : 'Add User'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingUser(null);
                    setFormData({
                      username: '',
                      email: '',
                      password: '',
                      role: 'USER',
                      firstName: '',
                      lastName: '',
                    });
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="text-left p-4 text-neutral-300">User</th>
                  <th className="text-left p-4 text-neutral-300">Email</th>
                  <th className="text-left p-4 text-neutral-300">Role</th>
                  <th className="text-left p-4 text-neutral-300">Status</th>
                  <th className="text-left p-4 text-neutral-300">Last Login</th>
                  <th className="text-left p-4 text-neutral-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-gray-700">
                    <td className="p-4">
                      <div className="text-white font-medium">{user.username}</div>
                      <div className="text-neutral-400 text-sm">
                        {user.firstName} {user.lastName}
                      </div>
                    </td>
                    <td className="p-4 text-neutral-300">{user.email}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        user.role === 'SUPER_ADMIN' ? 'bg-purple-900/30 text-purple-400 border border-purple-600' :
                        user.role === 'ADMIN' ? 'bg-blue-900/30 text-blue-400 border border-blue-600' :
                        user.role === 'PILOT' ? 'bg-green-900/30 text-green-400 border border-green-600' :
                        user.role === 'INSTRUCTOR' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-600' :
                        'bg-gray-800 text-gray-400 border border-gray-600'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        user.isActive ? 'bg-green-900/30 text-green-400 border border-green-600' :
                        'bg-red-900/30 text-red-400 border border-red-600'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-neutral-400 text-sm">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user.id)}
                          className={`text-sm ${
                            user.isActive ? 'text-orange-400 hover:text-orange-300' : 
                            'text-green-400 hover:text-green-300'
                          }`}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}