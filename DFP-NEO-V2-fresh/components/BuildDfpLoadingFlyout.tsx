import React from 'react';

const BuildDfpLoadingFlyout: React.FC = () => {
    return (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center animate-fade-in">
            <div className="bg-gray-800 rounded-lg shadow-xl border border-sky-500 p-8">
                <div className="flex flex-col items-center space-y-4">
                    <div className="relative h-10 w-10">
                        <div className="absolute inset-0 rounded-full bg-sky-500 opacity-75 animate-ping"></div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="relative h-10 w-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a10 10 0 1 0 10 10" />
                            <path d="M12 2v2" />
                            <path d="M12 20v2" />
                            <path d="m4.93 4.93 1.41 1.41" />
                            <path d="m17.66 17.66 1.41 1.41" />
                            <path d="M2 12h2" />
                            <path d="M20 12h2" />
                            <path d="m6.34 17.66-1.41 1.41" />
                            <path d="m19.07 4.93-1.41 1.41" />
                        </svg>
                    </div>
                    <p className="text-xl font-semibold text-white">Building DFP...</p>
                    <p className="text-sm text-gray-400">The algorithm is building an optimal schedule.</p>
                </div>
            </div>
        </div>
    );
};

export default BuildDfpLoadingFlyout;
