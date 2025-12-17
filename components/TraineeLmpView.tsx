import React, { useState, useEffect, useMemo } from 'react';
import { Trainee, SyllabusItemDetail, Score } from '../types';
import AuditButton from './AuditButton';

interface TraineeLmpViewProps {
  trainee: Trainee;
  traineeLmp: SyllabusItemDetail[];
  scores: Score[];
  onBack: () => void;
}

const DetailCard: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div className={`bg-gray-700/50 p-3 rounded-lg ${className}`}>
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
        <p className="mt-1 text-md font-semibold text-white">{value}</p>
    </div>
);

const DetailList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
    <div>
        <h3 className="text-md font-semibold text-sky-400 mb-2">{title}</h3>
        <div className="bg-gray-700/50 p-3 rounded-lg text-sm text-gray-300">
            {items && items.length > 0 ? (
                <ul className="space-y-1 list-disc list-inside">
                    {items.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
            ) : (
                <p className="italic text-gray-500">None</p>
            )}
        </div>
    </div>
);

const getScoreColor = (score: number, type: 'text' | 'bg') => {
    const colors = {
        '2-5': { text: 'text-green-300', bg: 'bg-green-500/20' },
        '1': { text: 'text-amber-300', bg: 'bg-amber-500/20' },
        '0': { text: 'text-red-300', bg: 'bg-red-500/20' },
    };
    const key = score >= 2 ? '2-5' : score === 1 ? '1' : '0';
    return colors[key][type];
};

const getDisplayType = (syllabusItem: SyllabusItemDetail): 'Flight' | 'FTD' | 'CPT' | 'Ground' => {
    if (syllabusItem.type === 'Flight') return 'Flight';
    if (syllabusItem.type === 'FTD') return 'FTD';
    if (syllabusItem.type === 'Ground School') {
        if (syllabusItem.code.includes('CPT')) return 'CPT';
        return 'Ground';
    }
    return 'Flight'; // Fallback
};

const DetailView: React.FC<{ item: SyllabusItemDetail, score: Score | undefined }> = ({ item, score }) => (
    <div className="space-y-6">
        <div>
            <h2 className="text-3xl font-bold text-white">{item.code}</h2>
            <p className="text-lg text-gray-400 mt-1">{item.eventDescription}</p>
        </div>
        
        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Core Details</legend>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                <DetailCard label="Phase" value={item.phase} />
                <DetailCard label="Module" value={item.module} />
                <DetailCard label="Type" value={getDisplayType(item)} />
                <DetailCard label="Total Event Hours" value={<>{item.totalEventHours.toFixed(1)} <span className="text-sm font-normal">hrs</span></>} />
                <DetailCard label="Flight/Sim Hours" value={<>{item.flightOrSimHours.toFixed(1)} <span className="text-sm font-normal">hrs</span></>} />
            </div>
        </fieldset>

        {score && (
            <fieldset className="p-4 border border-sky-700 rounded-lg bg-sky-900/10">
                <legend className="px-2 text-sm font-semibold text-sky-300">Trainee's Score</legend>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <DetailCard 
                        label="Overall Score"
                        value={
                            item.type === 'Ground School' ? (
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                        -
                                    </div>
                                    <span className="text-green-300">Complete</span>
                                </div>
                            ) : (
                                <span className={`text-xl ${getScoreColor(score.score, 'text')}`}>{score.score}</span>
                            )
                        }
                    />
                     <DetailCard label="Date" value={score.date} />
                     <DetailCard label="Instructor" value={score.instructor} />
                </div>
                 <div className="mt-4">
                     <DetailCard label="Notes" value={<p className="whitespace-pre-wrap">{score.notes}</p>} />
                 </div>
            </fieldset>
        )}
        
        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Prerequisites</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <DetailList title="Ground School" items={item.prerequisitesGround} />
                <DetailList title="Sim/Flying" items={item.prerequisitesFlying} />
            </div>
        </fieldset>

        <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Event Breakdown</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <DetailList title="Methods of Delivery" items={item.methodOfDelivery} />
                <DetailList title="Methods of Assessment" items={item.methodOfAssessment} />
            </div>
        </fieldset>

         <fieldset className="p-4 border border-gray-700 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Resources</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <DetailList title="Physical Resources" items={item.resourcesPhysical} />
                <DetailList title="Human Resources" items={item.resourcesHuman} />
            </div>
        </fieldset>
    </div>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
);


const TraineeLmpView: React.FC<TraineeLmpViewProps> = ({ trainee, traineeLmp, scores, onBack }) => {
  const [selectedItem, setSelectedItem] = useState<SyllabusItemDetail | null>(null);

  const completedEventIds = useMemo(() => new Set(scores.map(s => s.event)), [scores]);

  useEffect(() => {
    setSelectedItem(null);
  }, [trainee.fullName]);

  return (
    <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-white">Individual LMP</h1>
          <p className="text-sm text-gray-400">{trainee.rank} {trainee.name} - {trainee.course}</p>
        </div>
           <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-md"
        >
          &larr; Back - Trainee Profile
        </button>
             <AuditButton pageName="Individual LMP" />
           </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Left Column: List */}
        <div className="w-1/4 border-r border-gray-700 overflow-y-auto">
          <ul className="p-2 space-y-1">
            {traineeLmp.map(item => {
              const isCompleted = completedEventIds.has(item.code);
              return (
                <li key={item.code}>
                  <button
                    onClick={() => setSelectedItem(item)}
                    className={`w-full text-left p-2 rounded-md transition-colors text-sm flex items-center space-x-2 ${selectedItem?.code === item.code ? 'bg-sky-700 text-white font-semibold' : 'text-gray-300 hover:bg-gray-700/50'}`}
                  >
                    {isCompleted ? <CheckIcon /> : <div className="w-4 h-4 flex-shrink-0"></div>}
                    <span>{item.code}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right Column: Detail View */}
        <div className="w-3/4 overflow-y-auto">
          <div className="p-6 max-w-5xl mx-auto">
            {selectedItem ? (
              <DetailView 
                  item={selectedItem}
                  score={scores.find(s => s.event === selectedItem.code)}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 italic">Select an item from the list to view its details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TraineeLmpView;