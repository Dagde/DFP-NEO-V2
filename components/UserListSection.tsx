import React, { useState, useEffect } from 'react';
import { PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';
import { showDarkAlert, showDarkPrompt } from './DarkMessageModal';
import type { Instructor, Trainee } from '../types';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    personnelId?: string;
    profileId?: string;
    createdAt: string;
    rank?: string;
    service?: string;
    unit?: string;
    userType?: 'STAFF' | 'TRAINEE';
}

interface UserListSectionProps {
    showSection: boolean;
    onNavigateToProfile?: (user: User) => void;
    currentUserPermission?: any;
    onShowSuccess?: (message: string) => void;
    instructorsData?: Instructor[];
    traineesData?: Trainee[];
}

export const UserListSection: React.FC<UserListSectionProps> = ({ 
    showSection, 
    onNavigateToProfile,
    currentUserPermission,
    onShowSuccess,
    instructorsData = [],
    traineesData = [],
}) => {
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');

    useEffect(() => {
        fetchUsers();
    }, [instructorsData, traineesData]);

    useEffect(() => {
        const term = searchTerm.toLowerCase();
        const filtered = users.filter(user => 
            user.name.toLowerCase().includes(term) ||
            (user.personnelId && user.personnelId.toString().includes(term))
        );
        setFilteredUsers(filtered);
    }, [searchTerm, users]);

    const fetchUsers = async () => {
        const configuredUsers = buildConfiguredUsers(instructorsData, traineesData);
        try {
            setLoading(true);
            setLoadError('');
            const response = await fetch('/api/users', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }
            
            const data = await response.json();
            // Sort users alphabetically by name
            const apiUsers = Array.isArray(data)
                ? data
                : Array.isArray(data?.users)
                    ? data.users
                    : Array.isArray(data?.data)
                        ? data.data
                        : [];
            const endpointFallbackUsers = apiUsers.length > 0 ? [] : await fetchDirectoryUsers();
            const sortedUsers = [...apiUsers, ...endpointFallbackUsers].sort((a: User, b: User) =>
                a.name.localeCompare(b.name)
            );
            const usersToShow = sortedUsers.length > 0 ? sortedUsers : configuredUsers.sort((a: User, b: User) => a.name.localeCompare(b.name));
            setUsers(usersToShow);
            setFilteredUsers(usersToShow);
        } catch (error) {
            console.error('Error fetching users:', error);
            const endpointFallbackUsers = await fetchDirectoryUsers();
            const sortedConfiguredUsers = [...endpointFallbackUsers, ...configuredUsers]
                .filter((user, index, allUsers) => allUsers.findIndex(candidate => candidate.id === user.id) === index)
                .sort((a: User, b: User) => a.name.localeCompare(b.name));
            setLoadError(sortedConfiguredUsers.length > 0 ? '' : 'The user list could not be loaded.');
            setUsers(sortedConfiguredUsers);
            setFilteredUsers(sortedConfiguredUsers);
        } finally {
            setLoading(false);
        }
    };

    const fetchDirectoryUsers = async (): Promise<User[]> => {
        try {
            const [personnelResponse, traineesResponse] = await Promise.all([
                fetch('/api/personnel', { credentials: 'include' }),
                fetch('/api/trainees', { credentials: 'include' }),
            ]);
            const [personnelData, traineeData] = await Promise.all([
                personnelResponse.ok ? personnelResponse.json() : [],
                traineesResponse.ok ? traineesResponse.json() : [],
            ]);
            const personnel = Array.isArray(personnelData)
                ? personnelData
                : Array.isArray(personnelData?.personnel)
                    ? personnelData.personnel
                    : Array.isArray(personnelData?.data)
                        ? personnelData.data
                        : [];
            const trainees = Array.isArray(traineeData)
                ? traineeData
                : Array.isArray(traineeData?.trainees)
                    ? traineeData.trainees
                    : Array.isArray(traineeData?.data)
                        ? traineeData.data
                        : [];
            return buildConfiguredUsers(personnel, trainees);
        } catch (error) {
            console.error('Error fetching directory users:', error);
            return [];
        }
    };

    const buildConfiguredUsers = (staffSource: any[] = [], traineeSource: any[] = []): User[] => {
        const staffUsers: User[] = (staffSource || []).map((person, index) => ({
            id: person.id || `staff-${person.idNumber || index}`,
            name: person.name || '',
            email: person.email || '',
            role: person.role || 'Staff',
            personnelId: person.idNumber ? String(person.idNumber) : '',
            createdAt: '',
            rank: person.rank,
            service: person.service,
            unit: person.unit,
            userType: 'STAFF',
            profileId: person.id,
        }));
        const traineeUsers: User[] = (traineeSource || []).map((person, index) => ({
            id: `trainee-${person.idNumber || index}`,
            name: person.fullName || person.name || '',
            email: person.email || '',
            role: person.role || 'Trainee',
            personnelId: person.idNumber ? String(person.idNumber) : '',
            createdAt: '',
            rank: person.rank,
            service: person.service,
            unit: person.unit,
            userType: 'TRAINEE',
        }));
        const seen = new Set<string>();
        return [...staffUsers, ...traineeUsers]
            .filter(user => user.name.trim())
            .filter(user => {
                const key = `${user.userType}:${user.personnelId || user.name}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    };

    const verifyEditPassword = async (userName: string) => {
        const password = await showDarkPrompt({
            title: 'Edit User Record',
            message: `Enter your password to edit ${userName}.`,
            inputLabel: 'Password',
            inputType: 'password',
            inputPlaceholder: 'Enter password',
            confirmText: 'Unlock',
            cancelText: 'Cancel',
            variant: 'warning',
        });
        if (!password) return false;
        try {
            const isValid = await verifyCurrentUserPassword(password);
            if (!isValid) {
                await showDarkAlert('The password was not accepted.', 'User List Locked', 'warning');
                return false;
            }
            return true;
        } catch (error) {
            await showDarkAlert('The app could not verify your password.', 'Password Check Failed', 'error');
            return false;
        }
    };

    const handleEditProfile = async (user: User) => {
        const unlocked = await verifyEditPassword(user.name);
        if (!unlocked) return;
        // Navigate to Staff or Trainee profile page
        
        // Check if there's a navigation callback provided
        if (onNavigateToProfile) {
            onNavigateToProfile(user);
            return;
        }
        
        // If no callback provided, show a dark-themed notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-gray-800 border border-gray-600 rounded-lg p-4 shadow-lg z-50 max-w-md';
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-start';

        const iconWrap = document.createElement('div');
        iconWrap.className = 'flex-shrink-0';
        const icon = document.createElement('span');
        icon.className = 'inline-flex h-5 w-5 items-center justify-center rounded-full border border-sky-400 text-xs font-bold text-sky-400';
        icon.textContent = 'i';
        iconWrap.appendChild(icon);

        const content = document.createElement('div');
        content.className = 'ml-3';
        const title = document.createElement('p');
        title.className = 'text-sm font-medium text-white';
        title.textContent = `${user.userType === 'STAFF' ? 'Staff' : user.userType === 'TRAINEE' ? 'Trainee' : 'User'} Profile`;
        const details = document.createElement('p');
        details.className = 'mt-1 text-sm text-gray-300';
        details.textContent = `${user.name} (Personnel ID: ${user.personnelId})`;
        const helper = document.createElement('p');
        helper.className = 'mt-2 text-xs text-gray-400';
        helper.textContent = 'Navigation to profile page will be implemented';
        content.append(title, details, helper);

        const closeWrap = document.createElement('div');
        closeWrap.className = 'ml-4 flex-shrink-0';
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'inline-flex text-gray-400 hover:text-gray-500 focus:outline-none';
        closeButton.textContent = 'x';
        closeButton.addEventListener('click', () => notification.remove());
        closeWrap.appendChild(closeButton);

        wrapper.append(iconWrap, content, closeWrap);
        notification.appendChild(wrapper);
        document.body.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
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
                    placeholder="Search by surname or Personnel ID..."
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
                                Personnel ID
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
                                    {loadError || 'No users found'}
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
                                        <div className="text-sm text-gray-300">{user.personnelId || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.userType === 'STAFF' ? 'bg-sky-900 text-sky-200' : user.userType === 'TRAINEE' ? 'bg-green-900 text-green-200' : 'bg-gray-900 text-gray-200'}`}>
                                            {user.userType || 'STAFF'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => void handleEditProfile(user)}
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
