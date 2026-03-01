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

  if (personnelList.length === 0 && !description) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 flex flex-col">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</h3>
        <p className="mt-2 text-4xl font-bold text-white">{value}</p>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
    );
  }

  return (
    <div 
      className="relative bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</h3>
      <p className="mt-2 text-4xl font-bold text-white">{value}</p>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}

      {isHovered && personnelList.length > 0 && (
        <div className="absolute z-10 top-full left-0 mt-2 w-64 bg-gray-900 border border-sky-500 rounded-lg shadow-2xl p-2 max-h-60 overflow-y-auto animate-fade-in">
          <ul className="space-y-1">
            {personnelList.map(name => (
              <li key={name}>
                <button 
                  onClick={() => onPersonClick(name)}
                  className="w-full text-left p-2 rounded text-gray-300 hover:bg-sky-800 hover:text-white transition-colors text-sm"
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