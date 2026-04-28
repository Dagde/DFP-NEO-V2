import React, { useState, useEffect } from 'react';

interface DataLoadingMonitorProps {
    isStaffLoaded: boolean;
    isTraineeLoaded: boolean;
    isCoursesLoaded: boolean;
}

const DataLoadingMonitor: React.FC<DataLoadingMonitorProps> = ({
    isStaffLoaded,
    isTraineeLoaded,
    isCoursesLoaded
}) => {
    const [isVisible, setIsVisible] = useState(true);
    const allLoaded = isStaffLoaded && isTraineeLoaded && isCoursesLoaded;

    useEffect(() => {
        if (allLoaded) {
            // Wait 1 second before hiding the message
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [allLoaded]);

    if (!isVisible || allLoaded) {
        return null;
    }

    return (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-800 border border-gray-600 rounded-lg px-6 py-4 shadow-lg z-50">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <svg 
                        className="w-8 h-8 animate-spin" 
                        fill="none" 
                        viewBox="0 0 24 24"
                        style={{color: "#fb923c"}}
                    >
                        <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" 
                        />
                    </svg>
                    <span className="text-white font-medium">
                        Please wait while the engine warms up
                    </span>
                </div>
                
                {/* Data loading status indicators */}
                <div className="flex items-center gap-3 text-xs">
                    <div className={`flex items-center gap-1 ${isStaffLoaded ? 'text-green-400' : 'text-gray-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${isStaffLoaded ? 'bg-green-400' : 'bg-gray-400 animate-pulse'}`}></div>
                        <span>Staff</span>
                    </div>
                    <div className={`flex items-center gap-1 ${isTraineeLoaded ? 'text-green-400' : 'text-gray-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${isTraineeLoaded ? 'bg-green-400' : 'bg-gray-400 animate-pulse'}`}></div>
                        <span>Trainees</span>
                    </div>
                    <div className={`flex items-center gap-1 ${isCoursesLoaded ? 'text-green-400' : 'text-gray-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${isCoursesLoaded ? 'bg-green-400' : 'bg-gray-400 animate-pulse'}`}></div>
                        <span>Courses</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataLoadingMonitor;