'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function CreateUserForm({ roles }: { roles: string[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [showInviteLink, setShowInviteLink] = useState(false);

  const [formData, setFormData] = useState({
    userId: '',
    email: '',
    displayName: '',
    role: 'USER',
    method: 'invite', // 'invite' or 'temporary'
    temporaryPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create user');
        setLoading(false);
        return;
      }

      if (data.inviteLink) {
        setInviteLink(data.inviteLink);
        setShowInviteLink(true);
      } else {
        router.push('/admin/users');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    alert('Invite link copied to clipboard!');
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
          <h3 className="text-2xl font-bold text-white mb-2">User Created Successfully</h3>
          <p className="text-gray-400">Share this invite link with the user</p>
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

        <div className="flex space-x-3">
          <Link
            href="/admin/users"
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md transition-colors text-center"
          >
            Back to Users
          </Link>
          <button
            onClick={() => {
              setShowInviteLink(false);
              setInviteLink('');
              setFormData({
                userId: '',
                email: '',
                displayName: '',
                role: 'USER',
                method: 'invite',
                temporaryPassword: '',
              });
            }}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
          >
            Create Another User
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-8 border border-gray-700 space-y-6">
      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-md">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="userId" className="block text-sm font-medium text-gray-300 mb-2">
          User ID <span className="text-red-400">*</span>
        </label>
        <input
          id="userId"
          type="text"
          required
          value={formData.userId}
          onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., EMP001, PILOT123"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-400">
          This will be used for login (case-insensitive)
        </p>
      </div>

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
          placeholder="e.g., John Doe"
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
          placeholder="user@example.com"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-400">
          Optional. Used for password reset and notifications.
        </p>
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-2">
          Role <span className="text-red-400">*</span>
        </label>
        <select
          id="role"
          required
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          <option value="">Select a role...</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-gray-700 pt-6">
        <label className="block text-sm font-medium text-gray-300 mb-4">
          Password Setup Method <span className="text-red-400">*</span>
        </label>
        <div className="space-y-3">
          <label className="flex items-start p-4 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
            <input
              type="radio"
              name="method"
              value="invite"
              checked={formData.method === 'invite'}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              className="mt-1 mr-3"
              disabled={loading}
            />
            <div>
              <div className="text-white font-medium">Send Invite Link (Recommended)</div>
              <div className="text-sm text-gray-400 mt-1">
                User will receive a secure link to set their own password. Link expires in 72 hours.
              </div>
            </div>
          </label>

          <label className="flex items-start p-4 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors">
            <input
              type="radio"
              name="method"
              value="temporary"
              checked={formData.method === 'temporary'}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              className="mt-1 mr-3"
              disabled={loading}
            />
            <div>
              <div className="text-white font-medium">Set Temporary Password</div>
              <div className="text-sm text-gray-400 mt-1">
                You set a temporary password. User must change it on first login.
              </div>
            </div>
          </label>
        </div>
      </div>

      {formData.method === 'temporary' && (
        <div>
          <label htmlFor="temporaryPassword" className="block text-sm font-medium text-gray-300 mb-2">
            Temporary Password <span className="text-red-400">*</span>
          </label>
          <input
            id="temporaryPassword"
            type="password"
            required={formData.method === 'temporary'}
            value={formData.temporaryPassword}
            onChange={(e) => setFormData({ ...formData, temporaryPassword: e.target.value })}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter temporary password"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-400">
            Must be at least 12 characters with uppercase, lowercase, number, and special character
          </p>
        </div>
      )}

      <div className="flex space-x-3 pt-6">
        <Link
          href="/admin/users"
          className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md transition-colors text-center"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating User...' : 'Create User'}
        </button>
      </div>
    </form>
  );
}
