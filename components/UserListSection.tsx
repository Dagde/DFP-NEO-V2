import React, { useState, useEffect } from 'react';
import { TrashIcon, PencilIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    pmkeysId?: string;
    createdAt: string;
}

interface UserListSectionProps {
    currentUserPermission: string;
    onShowSuccess: (message: string) => void;
}

export const UserListSection: React.FC<UserListSectionProps> = ({ 
    currentUserPermission,
    onShowSuccess 
}) => {
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState<Partial<User>>({});
    const [editError, setEditError] = useState<string | null>(null);
    const [editSuccess, setEditSuccess] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');

    // Fetch users on component mount
    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter users based on search term
    useEffect(() => {
        if (!searchTerm) {
            setFilteredUsers(users);
        } else {
            const term = searchTerm.toLowerCase();
            const filtered = users.filter(user => 
                user.name.toLowerCase().includes(term) ||
                (user.pmkeysId && user.pmkeysId.toString().includes(term))
            );
            setFilteredUsers(filtered);
        }
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
                { id: '1', name: 'Dawe, John', email: 'john.dawe@example.com', role: 'Admin', pmkeysId: '4300401', createdAt: '2026-01-10' },
                { id: '2', name: 'Dawe, Mary', email: 'mary.dawe@example.com', role: 'Staff', pmkeysId: '4300402', createdAt: '2026-01-10' },
                { id: '3', name: 'Evans, Robert', email: 'robert.evans@example.com', role: 'Staff', pmkeysId: '4300403', createdAt: '2026-01-11' },
            ];
            setUsers(mockUsers);
            setFilteredUsers(mockUsers);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setEditFormData({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
        });
        setShowEditModal(true);
        setEditError(null);
        setEditSuccess(false);
    };

    const handleSaveEdit = async () => {
        if (!selectedUser) return;

        try {
            setIsSaving(true);
            setEditError(null);

            const response = await fetch(`/api/users/${selectedUser.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(editFormData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update user');
            }

            const updatedUser = await response.json();
            
            // Update the user in the list
            setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
            setFilteredUsers(filteredUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
            
            setEditSuccess(true);
            
            // Auto-close after success
            setTimeout(() => {
                setShowEditModal(false);
                setSelectedUser(null);
                setEditFormData({});
                setEditSuccess(false);
            }, 1500);
        } catch (error: any) {
            console.error('Error updating user:', error);
            setEditError(error.message || 'Failed to update user. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (user: User) => {
        setSelectedUser(user);
        setShowDeleteConfirm(true);
        setDeletePassword('');
        setDeleteError('');
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
                body: JSON.stringify({ password: deletePassword })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete user');
            }

            // Remove user from local state
            setUsers(users.filter(u => u.id !== selectedUser.id));
            setShowDeleteConfirm(false);
            setSelectedUser(null);
            setDeletePassword('');
            onShowSuccess(`User ${selectedUser.name} has been deleted successfully`);
        } catch (error: any) {
            setDeleteError(error.message || 'Failed to delete user');
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
                                Email
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                PMKeys/ID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                Role
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                Created
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
                                        <div className="text-sm text-gray-300">{user.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-300">{user.pmkeysId || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-sky-900 text-sky-200">
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-400">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleEdit(user)}
                                            className="text-sky-400 hover:text-sky-300 mr-3"
                                            title="Edit User"
                                        >
                                            <PencilIcon className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user)}
                                            className="text-red-400 hover:text-red-300"
                                            title="Delete User"
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
                            Are you sure you want to delete <span className="font-semibold text-white">{selectedUser.name}</span>?
                        </p>
                        <p className="text-gray-400 text-sm mb-4">
                            This action cannot be undone.
                        </p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Enter your password to confirm:
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

            {/* Edit User Modal */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
                        <h3 className="text-lg font-semibold text-white mb-4">
                            Edit User Profile
                        </h3>
                        
                        {editError && (
                            <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg">
                                <p className="text-sm text-red-200">{editError}</p>
                            </div>
                        )}

                        {editSuccess && (
                            <div className="mb-4 p-3 bg-green-900 border border-green-700 rounded-lg">
                                <p className="text-sm text-green-200">User updated successfully!</p>
                            </div>
                        )}
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    First Name
                                </label>
                                <input
                                    type="text"
                                    value={editFormData.firstName || ''}
                                    onChange={(e) => setEditFormData({...editFormData, firstName: e.target.value})}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Last Name
                                </label>
                                <input
                                    type="text"
                                    value={editFormData.lastName || ''}
                                    onChange={(e) => setEditFormData({...editFormData, lastName: e.target.value})}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={editFormData.email || ''}
                                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Role
                                </label>
                                <select
                                    value={editFormData.role || 'USER'}
                                    onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                >
                                    <option value="USER">User</option>
                                    <option value="INSTRUCTOR">Instructor</option>
                                    <option value="PILOT">Pilot</option>
                                    <option value="ADMIN">Admin</option>
                                    <option value="SUPER_ADMIN">Super Admin</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setSelectedUser(null);
                                    setEditFormData({});
                                    setEditError(null);
                                    setEditSuccess(false);
                                }}
                                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};