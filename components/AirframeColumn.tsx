import React, { useState } from 'react';

interface AirframeColumnProps {
  resources: string[];
  onReorder: (reorderedResources: string[]) => void;
  rowHeight: number;
  airframeCount: number;
  standbyCount: number;
  ftdCount: number;
  cptCount: number;
  events?: any[]; // Add events prop to filter resources
  formatResourceLabel?: (resourceId: string) => string;
  aircraftConfigLabelsByResource?: Record<string, string>;
}

// Helper to determine resource category
const getCategory = (res: string) => {
    if (!res || typeof res !== 'string') return 'Other';
    if (res.startsWith('PC-21') || res.startsWith('Deployed')) return 'PC-21';
    if (res.startsWith('STBY') || res.startsWith('BNF-STBY')) return 'STBY';
    if (res === 'Duty Sup') return 'Duty Sup';
    if (res === 'TWR DI') return 'TWR DI';
    if (res.startsWith('FTD')) return 'FTD';
    if (res.startsWith('CPT')) return 'CPT';
    if (res.startsWith('Ground')) return 'Ground';
    return 'Other';
};

const AirframeColumn: React.FC<AirframeColumnProps> = ({ resources, onReorder, rowHeight, airframeCount, standbyCount, ftdCount, cptCount, events = [], formatResourceLabel, aircraftConfigLabelsByResource = {} }) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }
    
    const reorderedResources = [...resources];
    const draggedItemContent = reorderedResources.splice(draggedIndex, 1)[0];
    reorderedResources.splice(dropIndex, 0, draggedItemContent);

    onReorder(reorderedResources);
    setDraggedIndex(null);
  };

  // The resource column must render exactly the same rows as the schedule grid.
  // Resource counts are now configurable through Platform Configuration, so
  // hard-coded row construction here will desynchronise the left column.
  const displayResources: string[] = resources;

  return (
    <div className="w-full min-w-0 bg-gray-800 flex-shrink-0 h-full">
      <ul className="w-full">
        {displayResources.map((resource, index) => {
            // Resource is already the display text (PC-21 1-24, Duty Sup, STBY, FTD, CPT, Ground)
            let resourceText: string = resource;
            const displayText = formatResourceLabel ? formatResourceLabel(resourceText) : resourceText;
            const configLabel = aircraftConfigLabelsByResource[resource];
            const compactConfigLabel = configLabel?.replace(/^CONFIG\s*(\d+)$/i, 'C $1').replace(/^Config\s+(\d+)$/i, 'C $1');
            let textColorClass = 'text-gray-400';
            let isDraggable = true;

            // Set colors and draggability based on resource type
            if (resource === 'Duty Sup') {
                textColorClass = 'text-amber-300 font-semibold';
                isDraggable = false;
               } else if (resource === 'TWR DI') {
                   textColorClass = 'text-green-300 font-semibold';
                   isDraggable = false;
            } else if (resource.startsWith('Deployed')) {
                textColorClass = 'text-purple-300 font-semibold';
                isDraggable = false;
            } else if (resource.startsWith('PC-21')) {
                textColorClass = 'text-gray-400';
                isDraggable = true;
            } else if (resource.startsWith('STBY') || resource.startsWith('BNF-STBY')) {
                textColorClass = 'text-gray-400';
                isDraggable = false;
            } else if (resource.startsWith('FTD')) {
                textColorClass = 'text-indigo-300';
                isDraggable = true;
            } else if (resource.startsWith('CPT')) {
                textColorClass = 'text-cyan-300';
                isDraggable = false;
            } else if (resource.startsWith('Ground')) {
                textColorClass = 'text-gray-400';
                isDraggable = false;
            }

            const currentCategory = getCategory(resource);
            const prevCategory = index > 0 ? getCategory(displayResources[index - 1]) : currentCategory;
            const isCategoryStart = index > 0 && currentCategory !== prevCategory;

            const baseClasses = "flex items-center justify-center text-xs font-mono transition-all duration-150";
            const cursorClass = isDraggable ? 'cursor-move' : '';
            
            // Apply a top border for category starts to align with timeline separators
            const borderClass = isCategoryStart 
                ? 'border-t-2 border-t-gray-500 border-b border-b-gray-700/50' 
                : 'border-b border-gray-700/50';
                
            const hoverClass = isDraggable ? 'hover:bg-gray-700' : '';
            const dragClass = draggedIndex === index ? 'opacity-50 bg-sky-900' : '';
          
          return (
            <li
              key={`${resource}-${index}`}
              draggable={isDraggable}
              onDragStart={() => isDraggable && handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => isDraggable && handleDrop(index)}
              onDragEnd={() => setDraggedIndex(null)}
              className={`${baseClasses} ${textColorClass} ${cursorClass} ${borderClass} ${hoverClass} ${dragClass}`}
              style={{ height: rowHeight }}
            >
              {resource.startsWith('PC-21') ? (
                  <div className="relative flex h-full w-full min-w-0 items-center text-center">
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-blue-300">
                          {resource.match(/\d+$/)?.[0] || ''}
                      </span>
                      <span className="absolute left-7 top-1/2 -translate-y-1/2">{formatResourceLabel ? formatResourceLabel('PC-21') : 'PC-21'}</span>
                      {configLabel && (
                          <span className="absolute bottom-0.5 right-0.5 max-w-[28px] truncate text-right text-[10px] font-semibold leading-none text-gray-500">
                              {compactConfigLabel}
                          </span>
                      )}
                  </div>
              ) : resource.startsWith('Deployed') ? (
                  <div className="w-full text-left pl-1 pr-1 overflow-hidden">
                      <span className="block truncate">{displayText.replace(/\s+\d+$/, '')}</span>
                  </div>
              ) : (
                  <div className="w-full text-center">
                      <span>{displayText.replace(/\s+\d+$/, '')}</span>
                  </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  );
};

export default AirframeColumn;
