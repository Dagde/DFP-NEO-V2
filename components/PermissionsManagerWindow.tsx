import React, { useState, useMemo } from 'react';
import { Instructor, Trainee } from '../types';

export type PermissionLevel = 'Super Admin' | 'Admin' | 'Staff' | 'Trainee' | 'Ops' | 'Scheduler' | 'Course Supervisor';

interface UserPermissionEntry {
    id: number;
    name: string;
    type: 'Instructor' | 'Trainee';
    currentRole?: string; // For instructors: their role, for trainees: their course
    permissionLevel: PermissionLevel;
}

interface PermissionsManagerWindowProps {
    instructors: Instructor[];
    trainees: Trainee[];
    onUpdateInstructorPermission: (idNumber: number, permissionLevel: PermissionLevel) => void;
    onUpdateTraineePermission: (idNumber: number, permissionLevel: PermissionLevel) => void;
    onShowSuccess: (message: string) => void;
    currentUserPermission?: PermissionLevel; // To check if user is Super Admin
}

export const PermissionsManagerWindow: React.FC<PermissionsManagerWindowProps> = ({
    instructors,
    trainees,
    onUpdateInstructorPermission,
    onUpdateTraineePermission,
    onShowSuccess,
    currentUserPermission = 'Super Admin' // Default to Super Admin for now
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPermission, setFilterPermission] = useState<PermissionLevel | 'All'>('All');
    const [filterType, setFilterType] = useState<'All' | 'Instructor' | 'Trainee'>('All');
    const [tempPermissions, setTempPermissions] = useState<Map<string, PermissionLevel>>(new Map());

    const isSuperAdmin = currentUserPermission === 'Super Admin';

    // Combine all users into a single list
    const allUsers = useMemo((): UserPermissionEntry[] => {
        const instructorEntries: UserPermissionEntry[] = instructors.map(inst => ({
            id: inst.idNumber,
            name: inst.name,
            type: 'Instructor' as const,
            currentRole: [
                inst.isExecutive && 'Executive',
                inst.isFlyingSupervisor && 'Flying Supervisor',
                inst.isTestingOfficer && 'Testing Officer',
                inst.isIRE && 'IRE'
            ].filter(Boolean).join(', ') || 'Instructor',
            permissionLevel: (inst.permissions?.[0] as PermissionLevel) || 'Staff'
        }));

        const traineeEntries: UserPermissionEntry[] = trainees.map(trainee => ({
            id: trainee.idNumber,
            name: trainee.name,
            type: 'Trainee' as const,
            currentRole: trainee.course,
            permissionLevel: (trainee.permissions?.[0] as PermissionLevel) || 'Trainee'
        }));

        return [...instructorEntries, ...traineeEntries].sort((a, b) => a.name.localeCompare(b.name));
    }, [instructors, trainees]);

    // Filter users based on search and filters
    const filteredUsers = useMemo(() => {
        return allUsers.filter(user => {
            const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                user.currentRole?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesPermission = filterPermission === 'All' || user.permissionLevel === filterPermission;
            const matchesType = filterType === 'All' || user.type === filterType;
            return matchesSearch && matchesPermission && matchesType;
        });
    }, [allUsers, searchTerm, filterPermission, filterType]);

    const handleEdit = () => {
        // Initialize temp permissions with current values
        const tempMap = new Map<string, PermissionLevel>();
        allUsers.forEach(user => {
            tempMap.set(`${user.type}-${user.id}`, user.permissionLevel);
        });
        setTempPermissions(tempMap);
        setIsEditing(true);
    };

    const handleSave = () => {
        // Apply all permission changes
        tempPermissions.forEach((permissionLevel, key) => {
            const [type, idStr] = key.split('-');
            const id = parseInt(idStr);
            
            if (type === 'Instructor') {
                const instructor = instructors.find(i => i.idNumber === id);
                if (instructor && instructor.permissions?.[0] !== permissionLevel) {
                    onUpdateInstructorPermission(id, permissionLevel);
                }
            } else if (type === 'Trainee') {
                const trainee = trainees.find(t => t.idNumber === id);
                if (trainee && trainee.permissions?.[0] !== permissionLevel) {
                    onUpdateTraineePermission(id, permissionLevel);
                }
            }
        });
        
        setIsEditing(false);
        onShowSuccess('User permissions updated successfully');
    };

    const handleCancel = () => {
        setIsEditing(false);
        setTempPermissions(new Map());
    };

    const handlePermissionChange = (user: UserPermissionEntry, newPermission: PermissionLevel) => {
        const key = `${user.type}-${user.id}`;
        setTempPermissions(prev => {
            const newMap = new Map(prev);
            newMap.set(key, newPermission);
            return newMap;
        });
    };

    const getTempPermission = (user: UserPermissionEntry): PermissionLevel => {
        const key = `${user.type}-${user.id}`;
        return tempPermissions.get(key) || user.permissionLevel;
    };

    const getPermissionColor = (permission: PermissionLevel): string => {
        const colors: Record<PermissionLevel, string> = {
            'Super Admin': 'bg-purple-600',
            'Admin': 'bg-red-600',
            'Staff': 'bg-blue-600',
            'Trainee': 'bg-green-600',
            'Ops': 'bg-yellow-600',
            'Scheduler': 'bg-orange-600',
            'Course Supervisor': 'bg-pink-600'
        };
        return colors[permission];
    };

    const permissionLevels: PermissionLevel[] = [
        'Super Admin',
        'Admin',
        'Staff',
        'Trainee',
        'Ops',
        'Scheduler',
        'Course Supervisor'
    ];

    // Count users by permission level
    const permissionCounts = useMemo(() => {
        const counts: Record<PermissionLevel, number> = {
            'Super Admin': 0,
            'Admin': 0,
            'Staff': 0,
            'Trainee': 0,
            'Ops': 0,
            'Scheduler': 0,
            'Course Supervisor': 0
        };
        allUsers.forEach(user => {
            counts[user.permissionLevel]++;
        });
        return counts;
    }, [allUsers]);

    if (!isSuperAdmin) {
        return (
            <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-full max-w-6xl h-fit">
                <div className="p-4 border-b border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-200">Permissions Manager</h2>
                    <p className="text-xs text-gray-400 mt-1">Manage user access permissions</p>
                </div>
                <div className="p-8 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500 mb-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                    </svg>
                    <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
                    <p className="text-gray-400">Only Super Admin users can manage permissions.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-full max-w-6xl h-fit">
            <div className="p-4 flex justify-between items-center border-b border-gray-700">
                <div>
                    <h2 className="text-lg font-semibold text-gray-200">Permissions Manager</h2>
                    <p className="text-xs text-gray-400 mt-1">Assign permission levels to individual users</p>
                </div>
                {isEditing ? (
                    <div className="flex space-x-2">
                        <button
                            onClick={handleSave}
                            className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-xs font-semibold"
                        >
                            Save Changes
                        </button>
                        <button
                            onClick={handleCancel}
                            className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-semibold"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleEdit}
                        className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs font-semibold"
                    >
                        Edit Permissions
                    </button>
                )}
            </div>

            <div className="p-4 space-y-4">
                {/* Filters */}
                <div className="flex space-x-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Search by name or role/course..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500"
                        />
                    </div>
                    <div>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as 'All' | 'Instructor' | 'Trainee')}
                            className="bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500"
                        >
                            <option value="All">All Users</option>
                            <option value="Instructor">Instructors Only</option>
                            <option value="Trainee">Trainees Only</option>
                        </select>
                    </div>
                    <div>
                        <select
                            value={filterPermission}
                            onChange={(e) => setFilterPermission(e.target.value as PermissionLevel | 'All')}
                            className="bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500"
                        >
                            <option value="All">All Permissions</option>
                            {permissionLevels.map(level => (
                                <option key={level} value={level}>{level}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Permission Level Summary */}
                <div className="flex flex-wrap gap-2 p-3 bg-gray-700/50 rounded-lg">
                    <span className="text-xs text-gray-400 mr-2">Permission Summary:</span>
                    {permissionLevels.map(level => (
                        <span key={level} className="flex items-center space-x-1">
                            <span className={`w-3 h-3 rounded ${getPermissionColor(level)}`}></span>
                            <span className="text-xs text-gray-300">{level}: {permissionCounts[level]}</span>
                        </span>
                    ))}
                </div>

                {/* Users Table */}
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-gray-800 z-10">
                            <tr className="border-b border-gray-700">
                                <th className="font-medium text-gray-400 px-4 py-3">Name</th>
                                <th className="font-medium text-gray-400 px-4 py-3">Type</th>
                                <th className="font-medium text-gray-400 px-4 py-3">Role/Course</th>
                                <th className="font-medium text-gray-400 px-4 py-3">Permission Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user, idx) => {
                                const displayPermission = isEditing ? getTempPermission(user) : user.permissionLevel;
                                return (
                                    <tr key={`${user.type}-${user.id}`} className={`border-b border-gray-700 ${idx % 2 === 0 ? 'bg-gray-800/50' : 'bg-gray-800/30'}`}>
                                        <td className="py-3 px-4 text-gray-200 font-medium">{user.name}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                user.type === 'Instructor' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
                                            }`}>
                                                {user.type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-gray-300">{user.currentRole}</td>
                                        <td className="py-3 px-4">
                                            {isEditing ? (
                                                <select
                                                    value={displayPermission}
                                                    onChange={(e) => handlePermissionChange(user, e.target.value as PermissionLevel)}
                                                    className={`${getPermissionColor(displayPermission)} text-white rounded-md py-1 px-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500`}
                                                >
                                                    {permissionLevels.map(level => (
                                                        <option key={level} value={level}>{level}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className={`${getPermissionColor(displayPermission)} text-white px-3 py-1 rounded text-xs font-semibold inline-block`}>
                                                    {displayPermission}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredUsers.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                        No users found matching your filters.
                    </div>
                )}

                {/* Summary */}
                <div className="p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-400">
                        Showing {filteredUsers.length} of {allUsers.length} users
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PermissionsManagerWindow;