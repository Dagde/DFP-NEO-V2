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
    _dataSource?: 'mockdata' | 'database'; // Added by dataService.ts
}

const StaffCombinedDataTable: React.FC<StaffCombinedDataTableProps> = ({ instructorsData }) => {
    const [combinedData, setCombinedData] = useState<CombinedStaffRecord[]>([]);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        // Use instructorsData which already has _dataSource field from dataService.ts
        // This respects the Data Sources settings (mockdata on/off)
        const allStaff = new Map<number, CombinedStaffRecord>();
        
        // Add staff from instructorsData (which is already merged and tagged)
        instructorsData.forEach(instructor => {
            if (!deletedIds.has(instructor.idNumber)) {
                // Use _dataSource field if present, otherwise default to 'mockdata'
                const dataSource = (instructor as any)._dataSource || 'mockdata';
                allStaff.set(instructor.idNumber, {
                    ...instructor,
                    dataSource: dataSource
                });
            }
        });
        
        // Convert to array and sort by name
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
                // Delete from real database
                const response = await fetch(`/api/personnel/${staff.idNumber}`, {
                    method: 'DELETE',
                    credentials: 'include',
                });
                
                if (response.ok) {
                    console.log(`✓ Deleted ${staff.name} from database`);
                    // Add to deletedIds to remove from view
                    setDeletedIds(prev => new Set(prev).add(staff.idNumber));
                } else {
                    const error = await response.json();
                    console.error(`✗ Failed to delete ${staff.name} from database:`, error);
                    alert(`Failed to delete ${staff.name} from database: ${error.error || 'Unknown error'}`);
                }
            } else {
                // Delete from mockdata - add to deletedIds to permanently remove from view
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
            <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
                <div className="p-4 bg-gray-800/80 border-b border-gray-700">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-green-400">Staff Combined Data</h3>
                        <div className="flex items-center space-x-4">
                            <span className="text-xs font-mono bg-sky-900/50 text-sky-300 px-3 py-1 rounded-full">
                                Mockdata: {mockdataCount}
                            </span>
                            <span className="text-xs font-mono bg-purple-900/50 text-purple-300 px-3 py-1 rounded-full">
                                Database: {databaseCount}
                            </span>
                            <span className="text-xs font-mono bg-green-700 text-green-300 px-3 py-1 rounded-full">
                                Total: {combinedData.length}
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                        Combined view of staff from both mockdata and database (database takes precedence)
                    </p>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-700 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    PMKEYS
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Name
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Rank
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Unit
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Category
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Flight
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    QFI
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    OFI
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Source
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {combinedData.map((staff) => (
                                <tr key={staff.idNumber} className="hover:bg-gray-700/50">
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300 font-mono text-xs">
                                        {staff.idNumber}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-white font-medium">
                                        {staff.name}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                                        {staff.rank}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                                            staff.role === 'QFI' ? 'bg-sky-900/50 text-sky-300' :
                                            staff.role === 'OFI' ? 'bg-purple-900/50 text-purple-300' :
                                            staff.role === 'SIM IP' ? 'bg-teal-900/50 text-teal-300' :
                                            'bg-gray-700 text-gray-300'
                                        }`}>
                                            {staff.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                                        {staff.unit}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                                        {staff.category}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                                        {staff.flight || '-'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                        {staff.isQFI ? (
                                            <span className="text-sky-400">✓</span>
                                        ) : (
                                            <span className="text-gray-600">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                        {staff.isOFI ? (
                                            <span className="text-purple-400">✓</span>
                                        ) : (
                                            <span className="text-gray-600">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                                            staff.dataSource === 'database' 
                                                ? 'bg-purple-900/50 text-purple-300' 
                                                : 'bg-sky-900/50 text-sky-300'
                                        }`}>
                                            {staff.dataSource === 'database' ? 'Database' : 'Mockdata'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <button
                                            onClick={async () => {
                                                const confirmed = await showDarkConfirm(
                                                    `Are you sure you want to delete ${staff.name} (${staff.dataSource === 'database' ? 'from database' : 'from display'})?`,
                                                    'Confirm Deletion',
                                                    'warning'
                                                );
                                                if (confirmed) {
                                                    handleDelete(staff);
                                                }
                                            }}
                                            disabled={deletingId === staff.idNumber}
                                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                                deletingId === staff.idNumber
                                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                    : 'bg-red-700 text-white hover:bg-red-600'
                                            }`}
                                        >
                                            {deletingId === staff.idNumber ? 'Deleting...' : 'Delete'}
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
};

export default StaffCombinedDataTable;