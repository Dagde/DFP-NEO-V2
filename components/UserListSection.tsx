import React, { useState, useEffect } from 'react';
import { PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    pmkeysId?: string;
    createdAt: string;
    rank?: string;
    service?: string;
    unit?: string;
    userType?: 'STAFF' | 'TRAINEE';
    personnelId?: string;
}

interface UserListSectionProps {
    showSection: boolean;
}

export const UserListSection: React.FC<UserListSectionProps> = ({ showSection }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = users.filter(user => 
            user.name.toLowerCase().includes(term) ||
            (user.pmkeysId && user.pmkeysId.toString().includes(term))
        );
        setFilteredUsers(filtered);
    }, [searchTerm, users]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/users', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }
            
            const data = await response.json();
            // Sort users alphabetically by name
            const sortedUsers = data.sort((a: User, b: User) => 
                a.name.localeCompare(b.name)
            );
            setUsers(sortedUsers);
            setFilteredUsers(sortedUsers);
        } catch (error) {
            console.error('Error fetching users:', error);
            // For development/demo, show mock data
            const mockUsers: User[] = [
                { id: '1', name: 'Dawe, Daniel', email: 'dawe@example.com', role: 'INSTRUCTOR', pmkeysId: '8207939', createdAt: '2026-01-10', rank: 'SQLDR', service: 'RAAF', unit: '1FTS', userType: 'STAFF' },
                { id: '2', name: 'Dawe, John', email: 'john.dawe@example.com', role: 'INSTRUCTOR', pmkeysId: '4300401', createdAt: '2026-01-10', rank: 'SQLDR', service: 'RAAF', unit: '1FTS', userType: 'STAFF' },
                { id: '3', name: 'Evans, Robert', email: 'robert.evans@example.com', role: 'INSTRUCTOR', pmkeysId: '4300403', createdAt: '2026-01-11', rank: 'FLT-LT', service: 'RAAF', unit: '1FTS', userType: 'STAFF' },
            ];
            setUsers(mockUsers);
            setFilteredUsers(mockUsers);
        } finally {
            setLoading(false);
        }
    };

    const handleEditProfile = (user: User) => {
        // Navigate to Staff or Trainee profile page
        // For now, log the navigation and show a dark-themed alert
        console.log('Navigate to Profile:', user);
        
        // Create a dark-themed notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-gray-800 border border-gray-600 rounded-lg p-4 shadow-lg z-50 max-w-md';
        notification.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-sky-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="text-sm font-medium text-white">
                        ${user.userType === 'STAFF' ? 'Staff' : user.userType === 'TRAINEE' ? 'Trainee' : 'User'} Profile
                    </p>
                    <p class="mt-1 text-sm text-gray-300">
                        ${user.name} (PMKeys ID: ${user.pmkeysId})
                    </p>
                    <p class="mt-2 text-xs text-gray-400">
                        Navigation to profile page will be implemented
                    </p>
                </div>
                <div class="ml-4 flex-shrink-0">
                    <button type="button" class="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none">
                        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    };

    const handleDelete = (user: User) => {
        setSelectedUser(user);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!selectedUser || !deletePassword) {
            setDeleteError('Please enter your password');
            return;
        }

        try {
            const response = await fetch(`/api/users/${selectedUser.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ password: deletePassword }),
            });

            if (!response.ok) {
                throw new Error('Failed to delete user');
            }

            // Remove user from list
            setUsers(users.filter(u => u.id !== selectedUser.id));
            setFilteredUsers(filteredUsers.filter(u => u.id !== selectedUser.id));
            
            // Close modal
            setShowDeleteConfirm(false);
            setSelectedUser(null);
            setDeletePassword('');
            setDeleteError('');
        } catch (error) {
            console.error('Error deleting user:', error);
            setDeleteError('Failed to delete user. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-400">Loading users...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">User List</h2>
                <span className="text-sm text-gray-400">
                    Total Users: {filteredUsers.length}
                </span>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by surname or PMKeys/ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
            </div>

            {/* User List Table */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-900">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                Rank/Service
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                Unit
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                PMKeys/ID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                Type
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                    No users found
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-750 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-white">{user.name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-300">
                                            {user.rank && user.service ? `${user.rank} - ${user.service}` : user.rank || user.service || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-300">{user.unit || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-300">{user.pmkeysId || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.userType === 'STAFF' ? 'bg-sky-900 text-sky-200' : user.userType === 'TRAINEE' ? 'bg-green-900 text-green-200' : 'bg-gray-900 text-gray-200'}`}>
                                            {user.userType || 'STAFF'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleEditProfile(user)}
                                            className="text-sky-400 hover:text-sky-300 mr-3"
                                            title="View Profile"
                                        >
                                            <PencilIcon className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user)}
                                            className="text-red-400 hover:text-red-300"
                                            title="Delete User Account"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
                        <h3 className="text-lg font-semibold text-white mb-4">
                            Confirm Delete User
                        </h3>
                        <p className="text-gray-300 mb-4">
                            Are you sure you want to delete <span className="font-semibold text-white">{selectedUser.name}</span>? This action cannot be undone.
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Enter your password to confirm
                            </label>
                            <input
                                type="password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                placeholder="Password"
                            />
                            {deleteError && (
                                <p className="text-red-400 text-sm mt-2">{deleteError}</p>
                            )}
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setSelectedUser(null);
                                    setDeletePassword('');
                                    setDeleteError('');
                                }}
                                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};