'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  userId: string;
  displayName: string | null;
  email: string | null;
  status: string;
  permissionsRole: {
    id: string;
    name: string;
  };
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

interface Role {
  id: string;
  name: string;
}

export function EditUserForm({ user, roles }: { user: User; roles: Role[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [showInviteLink, setShowInviteLink] = useState(false);

  const [formData, setFormData] = useState({
    displayName: user.displayName || '',
    email: user.email || '',
    permissionsRoleId: user.permissionsRole.id,
    status: user.status,
  });

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update user');
        setLoading(false);
        return;
      }

      setSuccess('User updated successfully');
      setLoading(false);
      setTimeout(() => router.refresh(), 1000);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleForcePasswordReset = async () => {
    if (!confirm('Force this user to change their password on next login?')) {
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/users/${user.id}/force-password-reset`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to force password reset');
        setLoading(false);
        return;
      }

      setSuccess('User will be required to change password on next login');
      setLoading(false);
      setTimeout(() => router.refresh(), 1000);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleGenerateInviteLink = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/users/${user.id}/generate-invite`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to generate invite link');
        setLoading(false);
        return;
      }

      setInviteLink(data.inviteLink);
      setShowInviteLink(true);
      setLoading(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete user ${user.userId}? This action cannot be undone.`)) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to delete user');
        setLoading(false);
        return;
      }

      router.push('/admin/users');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    alert('Invite link copied to clipboard!');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-900/30 text-green-400 border-green-700';
      case 'disabled':
        return 'bg-red-900/30 text-red-400 border-red-700';
      case 'pending':
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-700';
      default:
        return 'bg-gray-700 text-gray-400 border-gray-600';
    }
  };

  if (showInviteLink) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Invite Link Generated</h3>
          <p className="text-gray-400">Share this link with the user</p>
        </div>

        <div className="bg-gray-700 rounded-lg p-4 mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Invite Link (expires in 72 hours)
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={inviteLink}
              readOnly
              className="flex-1 px-4 py-2 bg-gray-600 border border-gray-500 rounded-md text-white text-sm"
            />
            <button
              onClick={copyInviteLink}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowInviteLink(false)}
          className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">User Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">User ID:</span>
            <span className="ml-2 text-white font-medium">{user.userId}</span>
          </div>
          <div>
            <span className="text-gray-400">Status:</span>
            <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-md border ${getStatusBadge(user.status)}`}>
              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Last Login:</span>
            <span className="ml-2 text-white">
              {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Created:</span>
            <span className="ml-2 text-white">{new Date(user.createdAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-400">Must Change Password:</span>
            <span className="ml-2 text-white">{user.mustChangePassword ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleUpdate} className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-6">
        <h3 className="text-lg font-semibold text-white mb-4">Edit Details</h3>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-700 rounded-md">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-900/50 border border-green-700 rounded-md">
            <p className="text-green-200 text-sm">{success}</p>
          </div>
        )}

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-2">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="permissionsRoleId" className="block text-sm font-medium text-gray-300 mb-2">
            Permissions Role
          </label>
          <select
            id="permissionsRoleId"
            value={formData.permissionsRoleId}
            onChange={(e) => setFormData({ ...formData, permissionsRoleId: e.target.value })}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-2">
            Status
          </label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Updating...' : 'Update User'}
        </button>
      </form>

      {/* Actions */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>

        <button
          onClick={handleForcePasswordReset}
          disabled={loading}
          className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Force Password Reset
        </button>

        <button
          onClick={handleGenerateInviteLink}
          disabled={loading}
          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate New Invite Link
        </button>

        <button
          onClick={handleDelete}
          disabled={loading}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Delete User
        </button>
      </div>

      <div className="flex space-x-3">
        <Link
          href="/admin/users"
          className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md transition-colors text-center"
        >
          Back to Users
        </Link>
      </div>
    </div>
  );
}
