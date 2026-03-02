import React from 'react';
import { Trainee } from '../types';

interface NextFlightEventListFlyoutProps {
  onClose: () => void;
  rankedTrainees: { trainee: Trainee; nextEventId: string }[];
  rankedNextPlusOneTrainees: { trainee: Trainee; nextEventId: string }[];
  rankedCptPlusOne: { trainee: Trainee; nextEventId: string }[];
  rankedGroundPlusOne: { trainee: Trainee; nextEventId: string }[];
}

const NextFlightEventListFlyout: React.FC<NextFlightEventListFlyoutProps> = ({ onClose, rankedTrainees, rankedNextPlusOneTrainees, rankedCptPlusOne, rankedGroundPlusOne }) => {

  const ListColumn: React.FC<{ title: string; items: { trainee: Trainee; nextEventId: string }[]; emptyMessage: string }> = ({ title, items, emptyMessage }) => (
    <div className="flex flex-col">
      <h3 className="text-lg font-semibold text-sky-400 mb-3 pb-2 border-b border-gray-600">{title}</h3>
      {items.length > 0 ? (
        <ol className="space-y-2">
          {items.map(({ trainee, nextEventId }, index) => (
            <li
              key={trainee.fullName}
              className="p-3 bg-gray-700/50 rounded-md text-gray-300 flex items-center space-x-4 text-sm"
            >
              <span className="font-mono text-gray-500 w-8 text-right flex-shrink-0">{index + 1}.</span>
              <div className="flex-grow flex justify-between items-baseline">
                  <span className="font-semibold text-gray-200">{trainee.name}</span>
                  <span className="font-mono text-sky-400">{nextEventId}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
         <p className="text-gray-500 text-center italic py-8">{emptyMessage}</p>
      )}
    </div>
  );
  
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col border border-gray-700 transform transition-all animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-lg">
          <h2 id="next-flight-list-title" className="text-xl font-bold text-white">Next Event Lists</h2>
          <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close list">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8" aria-labelledby="next-flight-list-title">
            <ListColumn
                title="Next Event – Flight List"
                items={rankedTrainees}
                emptyMessage="No trainees are currently due for a flight event."
            />
            <ListColumn
                title="Next +1 – Flight List"
                items={rankedNextPlusOneTrainees}
                emptyMessage="No trainees are due for a flight after a ground school event."
            />
            <ListColumn
                title="Next +1 – CPT List"
                items={rankedCptPlusOne}
                emptyMessage="No trainees are due for a CPT after their current event."
            />
            <ListColumn
                title="Next +1 – Ground School List"
                items={rankedGroundPlusOne}
                emptyMessage="No trainees are due for another Ground School event."
            />
        </div>
      </div>
    </div>
  );
};

export default NextFlightEventListFlyout;