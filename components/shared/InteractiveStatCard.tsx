import React, { useState } from 'react';

export interface InteractiveStatCardPersonDetail {
  name: string;
  detail?: string;
  total?: number;
  breakdown?: Array<{
    label: string;
    value: number;
    events: string[];
  }>;
}

interface InteractiveStatCardProps {
  title: string;
  value: string | number;
  description?: string;
  personnelList: string[];
  personnelDetails?: InteractiveStatCardPersonDetail[];
  onPersonClick: (name: string) => void;
}

const InteractiveStatCard: React.FC<InteractiveStatCardProps> = ({ 
  title, 
  value, 
  description, 
  personnelList, 
  personnelDetails,
  onPersonClick 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardClass = "relative flex flex-col rounded-lg border border-cyan-500/20 bg-slate-900/80 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.25)]";
  const hoverItems = personnelDetails && personnelDetails.length > 0
    ? personnelDetails
    : personnelList.map(name => ({ name }));

  if (hoverItems.length === 0 && !description) {
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

      {isHovered && hoverItems.length > 0 && (
        <div className="absolute left-0 top-full z-10 mt-2 max-h-80 w-[24rem] overflow-y-auto rounded-lg border border-cyan-500/45 bg-slate-950 p-2 shadow-2xl animate-fade-in">
          <ul className="space-y-2">
            {hoverItems.map(person => (
              <li key={`${person.name}-${person.detail || ''}`}>
                <button 
                  onClick={() => onPersonClick(person.name)}
                  className="w-full rounded-md p-3 text-left text-sm text-slate-300 transition-colors hover:bg-cyan-500/15 hover:text-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-100">{person.name.split(' – ')[0]}</div>
                      {person.detail && <div className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-slate-500">{person.detail}</div>}
                    </div>
                    {typeof person.total === 'number' && (
                      <div className="rounded border border-cyan-500/30 px-2 py-1 font-mono text-xs font-semibold text-cyan-100">
                        {person.total}
                      </div>
                    )}
                  </div>
                  {person.breakdown && person.breakdown.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {person.breakdown.map(group => (
                        <div key={group.label} className="grid grid-cols-[4.5rem_1fr] gap-2">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {group.label} {group.value}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {group.events.length > 0 ? group.events.map(eventCode => (
                              <span key={`${group.label}-${eventCode}`} className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
                                {eventCode}
                              </span>
                            )) : (
                              <span className="font-mono text-[11px] text-slate-600">-</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
