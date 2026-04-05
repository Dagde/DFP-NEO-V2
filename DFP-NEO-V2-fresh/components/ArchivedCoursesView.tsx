import React, { useMemo } from 'react';
import { showDarkConfirm } from './DarkMessageModal';

interface ArchivedCoursesViewProps {
    archivedCourses: { [key: string]: string };
    onUnarchiveCourse: (courseName: string) => void;
    onDeleteCourse: (courseName: string) => void;
    onNavigateBack: () => void;
}

const ArchivedCoursesView: React.FC<ArchivedCoursesViewProps> = ({
    archivedCourses,
    onUnarchiveCourse,
    onDeleteCourse,
    onNavigateBack
}) => {
    // Group archived courses by type
    const groupedArchivedCourses = useMemo(() => {
        const groups: { [key: string]: string[] } = {
            'ADF': [],
            'FIC': [],
            'WSO': [],
            'IFIC': [],
            'OFI': [],
            'Pilot Conversion': [],
            'Other': []
        };

        Object.keys(archivedCourses).forEach(courseName => {
            if (courseName.startsWith('ADF')) {
                groups['ADF'].push(courseName);
            } else if (courseName.startsWith('FIC')) {
                groups['FIC'].push(courseName);
            } else if (courseName.startsWith('WSO')) {
                groups['WSO'].push(courseName);
            } else if (courseName.startsWith('IFIC')) {
                groups['IFIC'].push(courseName);
            } else if (courseName.startsWith('OFI')) {
                groups['OFI'].push(courseName);
            } else if (courseName.toLowerCase().includes('conversion')) {
                groups['Pilot Conversion'].push(courseName);
            } else {
                groups['Other'].push(courseName);
            }
        });

        // Remove empty groups
        Object.keys(groups).forEach(key => {
            if (groups[key].length === 0) {
                delete groups[key];
            }
        });

        // Sort courses within each group
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => a.localeCompare(b));
        });

        return groups;
    }, [archivedCourses]);

    const handleUnarchive = async (courseName: string) => {
        const confirmed = await showDarkConfirm(
            'Unarchive Course',
            `Are you sure you want to unarchive "${courseName}"? This will make it active again.`,
            'info',
            'Unarchive',
            'Cancel'
        );

        if (confirmed) {
            onUnarchiveCourse(courseName);
        }
    };

    const handleDelete = async (courseName: string) => {
        const confirmed = await showDarkConfirm(
            'Delete Archived Course',
            `Are you sure you want to permanently delete "${courseName}"? This action cannot be undone.`,
            'warning',
            'Delete',
            'Cancel'
        );

        if (confirmed) {
            onDeleteCourse(courseName);
        }
    };

    const ArchivedCourseCard: React.FC<{ courseName: string; color: string }> = ({ courseName, color }) => {
        return (
            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded ${color}`}></div>
                        <h3 className="text-lg font-semibold text-gray-300">
                            {courseName}
                        </h3>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleUnarchive(courseName)}
                            className="text-sky-400 hover:text-sky-300 transition-colors p-1"
                            title="Unarchive Course"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                        </button>
                        <button
                            onClick={() => handleDelete(courseName)}
                            className="text-red-400 hover:text-red-300 transition-colors p-1"
                            title="Delete Permanently"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div className="text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-600 text-gray-300">
                            Archived
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gray-800 p-4 border-b border-gray-700">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onNavigateBack}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Archived Courses</h2>
                            <p className="text-sm text-gray-400">Manage archived courses</p>
                        </div>
                    </div>
                    <div className="text-sm text-gray-400">
                        {Object.keys(archivedCourses).length} archived course{Object.keys(archivedCourses).length !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                {Object.keys(archivedCourses).length === 0 ? (
                    <div className="bg-gray-800 rounded-lg p-8 text-center">
                        <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="text-gray-400 text-lg mb-4">No archived courses</p>
                        <button
                            onClick={onNavigateBack}
                            className="px-6 py-3 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors"
                        >
                            Back to Courses Management
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(groupedArchivedCourses).map(([type, coursesInGroup]) => (
                            <div key={type}>
                                <h3 className="text-xl font-semibold text-gray-300 mb-4 flex items-center gap-2">
                                    <span className="text-gray-500">{type}</span>
                                    <span className="text-sm text-gray-500">({coursesInGroup.length})</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {coursesInGroup.map(courseName => (
                                        <ArchivedCourseCard 
                                            key={courseName} 
                                            courseName={courseName} 
                                            color={archivedCourses[courseName]} 
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ArchivedCoursesView;