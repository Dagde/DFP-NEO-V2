import React, { useState } from 'react';
import { SyllabusItemDetail } from '../types';
import SyllabusDetailFlyout from './SyllabusDetailFlyout';

interface SyllabusListViewProps {
  onClose: () => void;
  syllabus: string[];
  syllabusDetails: SyllabusItemDetail[];
}

const SyllabusListView: React.FC<SyllabusListViewProps> = ({ onClose, syllabus, syllabusDetails }) => {
  const [hoveredItem, setHoveredItem] = useState<SyllabusItemDetail | null>(null);
  const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; left: number } | null>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLLIElement>, itemName: string) => {
    const detail = syllabusDetails.find(item => item.id === itemName);
    if (detail) {
      const rect = e.currentTarget.getBoundingClientRect();
      setHoveredItem(detail);
      setFlyoutPosition({ top: rect.top, left: rect.right + 10 });
    }
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
    setFlyoutPosition(null);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
        aria-modal="true"
        role="dialog"
        onClick={onClose}
      >
        <div
          className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg h-3/4 flex flex-col border border-gray-700 transform transition-all animate-fade-in"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-lg">
            <h2 id="syllabus-list-title" className="text-xl font-bold text-white">Syllabus</h2>
            <button onClick={onClose} className="text-white hover:text-gray-300" aria-label="Close syllabus list">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6 overflow-y-auto" aria-labelledby="syllabus-list-title">
            <ul className="space-y-2">
              {syllabus.map((item, index) => (
                <li 
                  key={index} 
                  className="p-3 bg-gray-700/50 rounded-md text-gray-300 hover:bg-sky-800 hover:text-white transition-colors cursor-default"
                  onMouseEnter={(e) => handleMouseEnter(e, item)}
                  onMouseLeave={handleMouseLeave}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      {hoveredItem && flyoutPosition && (
        <SyllabusDetailFlyout
          item={hoveredItem}
          position={flyoutPosition}
        />
      )}
    </>
  );
};

export default SyllabusListView;