import React, { useState, useEffect } from 'react';
import { Instructor } from '../types';
import { showDarkConfirm } from './DarkMessageModal';

interface StaffCombinedDataTableProps {
    instructorsData: Instructor[];
}

interface CombinedStaffRecord {
    idNumber: number;
    name: string;
    rank: string;
    role: string;
    unit: string;
    category: string;
    flight: string;
    isQFI: boolean;
    isOFI: boolean;
    dataSource: 'mockdata' | 'database';
    _dataSource?: 'mockdata' | 'database';
}

const StaffCombinedDataTable: React.FC<StaffCombinedDataTableProps> = ({ instructorsData }) => {
    const [combinedData, setCombinedData] = useState<CombinedStaffRecord[]>([]);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        const allStaff = new Map<number, CombinedStaffRecord>();

        instructorsData.forEach(instructor => {
            if (!deletedIds.has(instructor.idNumber)) {
                const dataSource = (instructor as any)._dataSource || 'mockdata';
                allStaff.set(instructor.idNumber, {
                    ...instructor,
                    dataSource,
                });
            }
        });

        const combined = Array.from(allStaff.values())
            .sort((a, b) => a.name.localeCompare(b.name));

        setCombinedData(combined);
    }, [instructorsData, deletedIds]);

    const mockdataCount = combinedData.filter(s => s.dataSource === 'mockdata').length;
    const databaseCount = combinedData.filter(s => s.dataSource === 'database').length;

    const handleDelete = async (staff: CombinedStaffRecord) => {
        setDeletingId(staff.idNumber);

        try {
            if (staff.dataSource === 'database') {
                const response = await fetch(`/api/personnel/${staff.idNumber}`, {
                    method: 'DELETE',
                    credentials: 'include',
                });

                if (response.ok) {
                    console.log(`✓ Deleted ${staff.name} from database`);
                    setDeletedIds(prev => new Set(prev).add(staff.idNumber));
                } else {
                    const error = await response.json();
                    console.error(`✗ Failed to delete ${staff.name} from database:`, error);
                    alert(`Failed to delete ${staff.name} from database: ${error.error || 'Unknown error'}`);
                }
            } else {
                console.log(`✓ Removed ${staff.name} from mockdata`);
                setDeletedIds(prev => new Set(prev).add(staff.idNumber));
            }
        } catch (error) {
            console.error('Error deleting staff:', error);
            alert(`Error deleting ${staff.name}: ${error}`);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center space-x-4 text-xs text-gray-400">
                <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                    <span>Database: <span className="text-green-400 font-semibold">{databaseCount}</span></span>
                </span>
                <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                    <span>MockData: <span className="text-sky-400 font-semibold">{mockdataCount}</span></span>
                </span>
                <span className="text-gray-500">Total: {combinedData.length}</span>
            </div>

            {/* Table */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-700/60 text-gray-300 text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 text-left">Name</th>
                            <th className="px-4 py-3 text-left">Rank</th>
                            <th className="px-4 py-3 text-left">Role</th>
                            <th className="px-4 py-3 text-left">Unit</th>
                            <th className="px-4 py-3 text-left">Category</th>
                            <th className="px-4 py-3 text-left">Flight</th>
                            <th className="px-4 py-3 text-left">QFI</th>
                            <th className="px-4 py-3 text-left">Source</th>
                            <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {combinedData.map(staff => (
                            <tr key={staff.idNumber} className="hover:bg-gray-700/30 transition-colors">
                                <td className="px-4 py-3 text-white font-medium">{staff.name}</td>
                                <td className="px-4 py-3 text-gray-300">{staff.rank}</td>
                                <td className="px-4 py-3 text-gray-300">{staff.role}</td>
                                <td className="px-4 py-3 text-gray-300">{staff.unit || '—'}</td>
                                <td className="px-4 py-3 text-gray-300">{staff.category}</td>
                                <td className="px-4 py-3 text-gray-300">{staff.flight || '—'}</td>
                                <td className="px-4 py-3">
                                    {staff.isQFI
                                        ? <span className="text-green-400 font-semibold">✓</span>
                                        : <span className="text-gray-600">—</span>
                                    }
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        staff.dataSource === 'database'
                                            ? 'bg-green-900/50 text-green-400 border border-green-700/50'
                                            : 'bg-sky-900/50 text-sky-400 border border-sky-700/50'
                                    }`}>
                                        {staff.dataSource === 'database' ? 'Database' : 'Mockdata'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => showDarkConfirm(
                                            `Are you sure you want to delete ${staff.name} (${staff.dataSource === 'database' ? 'from database' : 'from display'})?`,
                                            () => handleDelete(staff)
                                        )}
                                        disabled={deletingId === staff.idNumber}
                                        className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded border border-red-800/50 hover:border-red-600/50 transition-colors disabled:opacity-50"
                                    >
                                        {deletingId === staff.idNumber ? 'Deleting...' : 'Delete'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {combinedData.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                                    No staff records found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StaffCombinedDataTable;