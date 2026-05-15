import React, { useState } from 'react';

interface InteractiveStatCardProps {
  title: string;
  value: string | number;
  description?: string;
  personnelList: string[];
  onPersonClick: (name: string) => void;
}

const InteractiveStatCard: React.FC<InteractiveStatCardProps> = ({ 
  title, 
  value, 
  description, 
  personnelList, 
  onPersonClick 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardClass = "relative flex flex-col rounded-lg border border-cyan-500/20 bg-slate-900/80 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.25)]";

  if (personnelList.length === 0 && !description) {
    return (
      <div className={cardClass}>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</h3>
        <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
    );
  }

  return (
    <div 
      className={`${cardClass} transition-all duration-200 hover:border-cyan-400/50 hover:bg-slate-900`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</h3>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}

      {isHovered && personnelList.length > 0 && (
        <div className="absolute left-0 top-full z-10 mt-2 max-h-60 w-64 overflow-y-auto rounded-lg border border-cyan-500/45 bg-slate-950 p-2 shadow-2xl animate-fade-in">
          <ul className="space-y-1">
            {personnelList.map(name => (
              <li key={name}>
                <button 
                  onClick={() => onPersonClick(name)}
                  className="w-full rounded p-2 text-left text-sm text-slate-300 transition-colors hover:bg-cyan-500/15 hover:text-white"
                >
                  {name.split(' – ')[0]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default InteractiveStatCard;
