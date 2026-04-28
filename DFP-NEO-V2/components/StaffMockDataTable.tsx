import React, { useState } from 'react';
import { Instructor } from '../types';
import { showDarkConfirm } from './DarkMessageModal';

interface StaffMockDataTableProps {
    instructorsData: Instructor[];
    onDeleteFromMockdata?: (idNumber: number) => void;
}

const StaffMockDataTable: React.FC<StaffMockDataTableProps> = ({ instructorsData, onDeleteFromMockdata }) => {
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const handleDelete = async (instructor: Instructor) => {
        setDeletingId(instructor.idNumber);
        
        try {
            // For mockdata, we call the parent handler to remove it from the display
            if (onDeleteFromMockdata) {
                console.log(`✓ Removed ${instructor.name} from mockdata display`);
                onDeleteFromMockdata(instructor.idNumber);
            }
        } catch (error) {
            console.error('Error deleting staff:', error);
            alert(`Error deleting ${instructor.name}: ${error}`);
        } finally {
            setDeletingId(null);
        }
    };
    return (
        <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
                <div className="p-4 bg-gray-800/80 border-b border-gray-700">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-sky-400">Staff MockData</h3>
                        <span className="text-xs font-mono bg-gray-700 text-gray-300 px-3 py-1 rounded-full">
                            {instructorsData.length} Staff Members
                        </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                        All staff members from the mockdata configuration
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
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {instructorsData.map((instructor) => (
                                <tr key={instructor.idNumber} className="hover:bg-gray-700/50">
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300 font-mono text-xs">
                                        {instructor.idNumber}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-white font-medium">
                                        {instructor.name}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                                        {instructor.rank}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                                            instructor.role === 'QFI' ? 'bg-sky-900/50 text-sky-300' :
                                            instructor.role === 'OFI' ? 'bg-purple-900/50 text-purple-300' :
                                            instructor.role === 'SIM IP' ? 'bg-teal-900/50 text-teal-300' :
                                            'bg-gray-700 text-gray-300'
                                        }`}>
                                            {instructor.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                                        {instructor.unit}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                                        {instructor.category}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                                        {instructor.flight || '-'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                        {instructor.isQFI ? (
                                            <span className="text-sky-400">✓</span>
                                        ) : (
                                            <span className="text-gray-600">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                        {instructor.isOFI ? (
                                            <span className="text-purple-400">✓</span>
                                        ) : (
                                            <span className="text-gray-600">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <button
                                            onClick={async () => {
                                                const confirmed = await showDarkConfirm(
                                                    `Are you sure you want to remove ${instructor.name} from mockdata display? Note: This is temporary and will reset on refresh.`,
                                                    'Confirm Removal',
                                                    'warning'
                                                );
                                                if (confirmed) {
                                                    handleDelete(instructor);
                                                }
                                            }}
                                            disabled={deletingId === instructor.idNumber}
                                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                                deletingId === instructor.idNumber
                                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                    : 'bg-red-700 text-white hover:bg-red-600'
                                            }`}
                                        >
                                            {deletingId === instructor.idNumber ? 'Removing...' : 'Remove'}
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

export default StaffMockDataTable;