import React from 'react';

interface UpdateSummaryFlyoutProps {
  summary: {
    type: string;
    added: number;
    updated: number;
    replaced: number;
    skipped: number;
    unaltered?: number;
  };
  onClose: () => void;
}

const UpdateSummaryFlyout: React.FC<UpdateSummaryFlyoutProps> = ({ summary, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-sky-500/50" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-sky-900/20 flex items-center space-x-3">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h2 className="text-xl font-bold text-sky-400">Update Complete</h2>
                </div>
                <div className="p-6 space-y-3">
                    <p className="text-gray-300">The <strong className="text-white">{summary.type} Update</strong> process has finished.</p>
                    <div className="bg-gray-700/50 p-3 rounded-md grid grid-cols-2 gap-2 text-sm">
                        {summary.type === 'Bulk' ? (
                             <div>
                                <span className="text-gray-400">Records Replaced:</span>
                                <span className="font-bold text-white float-right">{summary.replaced}</span>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <span className="text-gray-400">Records Updated:</span>
                                    <span className="font-bold text-white float-right">{summary.updated}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400">New Records Added:</span>
                                    <span className="font-bold text-green-400 float-right">{summary.added}</span>
                                </div>
                                {summary.unaltered !== undefined && (
                                    <div>
                                        <span className="text-gray-400">Records Unaltered:</span>
                                        <span className="font-bold text-blue-400 float-right">{summary.unaltered}</span>
                                    </div>
                                )}
                            </>
                        )}
                         <div>
                            <span className="text-gray-400">Rows Skipped:</span>
                            <span className="font-bold text-amber-400 float-right">{summary.skipped}</span>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold">
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdateSummaryFlyout;