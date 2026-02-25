import React, { useState } from 'react';
import { PrioritiesView } from './PrioritiesView';
import AuditButton from './AuditButton';
import { Instructor, Trainee, ScheduleEvent, SctRequest, SyllabusItemDetail, Score, RemedialRequest } from '../types';

interface PrioritiesViewWithMenuProps {
  coursePriorities: string[];
  onUpdatePriorities: (newOrder: string[]) => void;
  coursePercentages: Map<string, number>;
  onUpdatePercentages: (newPercentages: Map<string, number>) => void;
  availableAircraftCount: number;
  onUpdateAircraftCount: (count: number) => void;
  availableFtdCount: number;
  onUpdateFtdCount: (count: number) => void;
  availableCptCount: number;
  onUpdateCptCount: (count: number) => void;
  flyingStartTime: number;
  onUpdateFlyingStartTime: (time: number) => void;
  flyingEndTime: number;
  onUpdateFlyingEndTime: (time: number) => void;
  ftdStartTime: number;
  onUpdateFtdStartTime: (time: number) => void;
  ftdEndTime: number;
  onUpdateFtdEndTime: (time: number) => void;
  allowNightFlying: boolean;
  onUpdateAllowNightFlying: (value: boolean) => void;
  commenceNightFlying: number;
  onUpdateCommenceNightFlying: (time: number) => void;
  ceaseNightFlying: number;
  onUpdateCeaseNightFlying: (time: number) => void;
  instructorsData: Instructor[];
  traineesData: Trainee[];
  buildDfpDate: string;
  highestPriorityEvents: ScheduleEvent[];
  onSelectEvent: (event: ScheduleEvent) => void;
  onUpdatePriorityEvent: (eventId: string, updates: Partial<ScheduleEvent>) => void;
  programWithPrimaries: boolean;
  onUpdateProgramWithPrimaries: (value: boolean) => void;
  sctFlights: SctRequest[];
  sctFtds: SctRequest[];
  onAddSctRequest: (type: 'flight' | 'ftd') => void;
  onRemoveSctRequest: (id: string, type: 'flight' | 'ftd') => void;
  onUpdateSctRequest: (id: string, field: keyof SctRequest, value: string, type: 'flight' | 'ftd') => void;
  syllabusDetails: SyllabusItemDetail[];
  scores?: Map<string, Score[]>;
  traineeLMPs?: Map<string, SyllabusItemDetail[]>;
  remedialRequests?: RemedialRequest[];
  onToggleRemedialRequest?: (traineeId: number, eventCode: string) => void;
  currencyNames: string[];
}

type PrioritiesSection = 'course-priority' | 'build-factors' | 'sct-requests' | 'highest-priority' | 'remedial-queue';

export const PrioritiesViewWithMenu: React.FC<PrioritiesViewWithMenuProps> = (props) => {
    const [activeSection, setActiveSection] = useState<PrioritiesSection>('course-priority');

    const menuItems = [
        { id: 'course-priority' as const, label: 'Course Priority', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
            </svg>
        )},
        { id: 'build-factors' as const, label: 'Build Factors', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
        )},
        { id: 'sct-requests' as const, label: 'SCT Requests', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
        )},
        { id: 'highest-priority' as const, label: 'Highest Priority', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
        )},
        { id: 'remedial-queue' as const, label: 'Remedial Queue', icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
        )},
    ];

    return (
        <div className="flex-1 flex overflow-hidden bg-gray-900">
            {/* Side Menu */}
            <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
                <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                    {/* Build Priorities Title at top of menu */}
                    <div className="px-4 py-3 mb-2">
                        <h1 className="text-2xl font-bold text-white">Build Priorities</h1>
                        <p className="text-sm text-gray-400 mt-1">Configuration</p>
                    </div>
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                            className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                                activeSection === item.id
                                    ? 'bg-sky-600 text-white shadow-lg'
                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`}
                        >
                            <div className="flex items-center space-x-3">
                                {item.icon}
                                <span className="font-medium">{item.label}</span>
                            </div>
                        </button>
                    ))}
                </nav>
                
                {/* Audit Button at Bottom */}
                <div className="p-4 border-t border-gray-700">
                    <AuditButton pageName="Priorities" />
                </div>
            </div>

            {/* Main Content - Render PrioritiesView with filtered content */}
            <div className="flex-1 overflow-y-auto bg-gray-900">
                <style>{`
                    .priorities-content > div:not(.section-${activeSection}) {
                        display: none !important;
                    }
                        display: ${activeSection === 'course-priority' || activeSection === 'build-factors' ? 'grid' : 'none'} !important;
                    }
                `}</style>
                <div className="p-6">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-white mb-3">
                            {activeSection === 'course-priority' && 'Course Priority'}
                            {activeSection === 'build-factors' && 'Build Factors'}
                            {activeSection === 'sct-requests' && 'SCT Requests'}
                            {activeSection === 'highest-priority' && 'Highest Priority Events'}
                            {activeSection === 'remedial-queue' && 'Remedial Priority Queue'}
                        </h2>
                    </div>
                    <div className="priorities-content"> 
                        <PrioritiesView {...props} activeSection={activeSection} />
                    </div>
                </div>
            </div>
        </div>
    );
};