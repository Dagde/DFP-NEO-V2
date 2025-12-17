import React from 'react';
import { SyllabusItemDetail } from '../types';

interface SyllabusDetailFlyoutProps {
  item: SyllabusItemDetail;
  position: { top: number; left: number };
}

const DetailRow: React.FC<{ label: string; value: string | number; unit?: string }> = ({ label, value, unit }) => (
    <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}:</span>
        <span className="font-semibold text-white">{value} {unit}</span>
    </div>
);

const SyllabusDetailFlyout: React.FC<SyllabusDetailFlyoutProps> = ({ item, position }) => {
  return (
    <div
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      className="fixed bg-gray-900 border border-sky-500 rounded-lg shadow-2xl z-[60] p-4 w-80 animate-fade-in"
      aria-live="polite"
    >
      <h3 className="text-lg font-bold text-sky-400 mb-3 border-b border-gray-700 pb-2">{item.code}</h3>
      
      <div className="space-y-2 mb-4">
        <p className="text-sm text-gray-300">{item.eventDescription}</p>
        <DetailRow label="Phase" value={item.phase} />
        <DetailRow label="Module" value={item.module}/>
        <DetailRow label="Total Time" value={item.totalEventHours} unit="hrs"/>
        <DetailRow label="Flight/Sim Time" value={item.flightOrSimHours} unit="hrs"/>
      </div>

      <div className="mb-4">
        <h4 className="font-semibold text-gray-300 text-sm mb-1">Prerequisites:</h4>
        <p className="text-xs text-gray-400 italic">
          {[...item.prerequisitesGround, ...item.prerequisitesFlying].length > 0 ? [...item.prerequisitesGround, ...item.prerequisitesFlying].join(', ') : 'None'}
        </p>
      </div>
      
    </div>
  );
};

export default SyllabusDetailFlyout;