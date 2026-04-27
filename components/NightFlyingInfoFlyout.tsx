import React from 'react';

interface NightFlyingInfoFlyoutProps {
  traineeCount: number;
}

const NightFlyingInfoFlyout: React.FC<NightFlyingInfoFlyoutProps> = ({ traineeCount }) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center animate-fade-in">
            <div className="bg-gray-800 rounded-lg shadow-xl border border-sky-500 p-8">
                <div className="flex flex-col items-center space-y-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    <p className="text-xl font-semibold text-white">Preparing Night Flying Program</p>
                    <p className="text-2xl font-bold text-sky-300">{traineeCount}</p>
                    <p className="text-sm text-gray-400">Trainees ready for night flying.</p>
                </div>
            </div>
        </div>
    );
};

export default NightFlyingInfoFlyout;
