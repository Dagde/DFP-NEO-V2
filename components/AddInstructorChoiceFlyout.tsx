import React from 'react';

interface AddInstructorChoiceFlyoutProps {
  onClose: () => void;
  onIndividual: () => void;
  onBulk: () => void;
}

const AddInstructorChoiceFlyout: React.FC<AddInstructorChoiceFlyoutProps> = ({ onClose, onIndividual, onBulk }) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Add New Instructor(s)</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-6 text-center space-y-4">
                    <p className="text-gray-400">How would you like to add new instructors?</p>
                    <div className="flex flex-col space-y-3">
                        <button
                            onClick={onIndividual}
                            className="w-full px-4 py-3 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors font-semibold"
                        >
                            Add Individual
                        </button>
                        <button
                            onClick={onBulk}
                            className="w-full px-4 py-3 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors font-semibold"
                        >
                            Bulk Upload from File
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddInstructorChoiceFlyout;