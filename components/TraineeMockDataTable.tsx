import React, { useState } from 'react';
import { Trainee } from '../types';
import { showDarkConfirm } from './DarkMessageModal';

interface TraineeMockDataTableProps {
    traineesData: Trainee[];
    onDeleteFromMockdata?: (idNumber: number) => void;
}

const TraineeMockDataTable: React.FC<TraineeMockDataTableProps> = ({ traineesData, onDeleteFromMockdata }) => {
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const handleDelete = async (trainee: Trainee) => {
        setDeletingId(trainee.idNumber);

        try {
            if (onDeleteFromMockdata) {
                console.log(`✓ Removed ${trainee.name} from mockdata display`);
                onDeleteFromMockdata(trainee.idNumber);
            }
        } catch (error) {
            console.error('Error deleting trainee:', error);
            alert(`Error deleting ${trainee.name}: ${error}`);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
                <div className="p-4 bg-gray-800/80 border-b border-gray-700">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-sky-400">Trainee MockData</h3>
                        <span className="text-xs font-mono bg-gray-700 text-gray-300 px-3 py-1 rounded-full">
                            {traineesData.length} Trainees
                        </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                        All trainees from the mockdata configuration
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
                                    Course
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Unit
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Flight
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Service
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Callsign
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Primary Instr
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Secondary Instr
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Paused
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {traineesData.map((trainee) => (
                                <tr key={trainee.idNumber} className="hover:bg-gray-700/50">
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300 font-mono text-xs">
                                        {trainee.idNumber}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-white font-medium">
                                        {trainee.name}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                                        {trainee.rank}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="px-2 py-1 text-xs font-medium rounded bg-indigo-900/50 text-indigo-300">
                                            {trainee.course}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                                        {trainee.unit}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                                        {trainee.flight || '-'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                                        {trainee.service || '-'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300 font-mono text-xs">
                                        {trainee.traineeCallsign || '-'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-xs">
                                        {trainee.primaryInstructor || <span className="text-gray-600">-</span>}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300 text-xs">
                                        {trainee.secondaryInstructor || <span className="text-gray-600">-</span>}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                        {trainee.isPaused ? (
                                            <span className="text-amber-400">⏸</span>
                                        ) : (
                                            <span className="text-gray-600">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <button
                                            onClick={async () => {
                                                const confirmed = await showDarkConfirm(
                                                    `Are you sure you want to remove ${trainee.name} from mockdata display? Note: This is temporary and will reset on refresh.`,
                                                    'Confirm Removal',
                                                    'warning'
                                                );
                                                if (confirmed) {
                                                    handleDelete(trainee);
                                                }
                                            }}
                                            disabled={deletingId === trainee.idNumber}
                                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                                deletingId === trainee.idNumber
                                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                    : 'bg-red-700 text-white hover:bg-red-600'
                                            }`}
                                        >
                                            {deletingId === trainee.idNumber ? 'Removing...' : 'Remove'}
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

export default TraineeMockDataTable;