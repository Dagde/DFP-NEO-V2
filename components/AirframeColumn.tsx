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
}

// Helper to determine resource category
const getCategory = (res: string) => {
    if (!res || typeof res !== 'string') return 'Other';
    if (res.startsWith('PC-21') || res.startsWith('Deployed')) return 'PC-21';
    if (res.startsWith('STBY')) return 'STBY';
    if (res === 'Duty Sup') return 'Duty Sup';
    if (res.startsWith('FTD')) return 'FTD';
    if (res.startsWith('CPT')) return 'CPT';
    if (res.startsWith('Ground')) return 'Ground';
    return 'Other';
};

const AirframeColumn: React.FC<AirframeColumnProps> = ({ resources, onReorder, rowHeight, airframeCount, standbyCount, ftdCount, cptCount, events = [] }) => {
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

  // Build the resource list with fixed sections
  const displayResources: string[] = [];
  
  // 1. Always add PC-21 1-24 (FIXED - 24 lines)
  for (let i = 1; i <= 24; i++) {
    displayResources.push(`PC-21 ${i}`);
  }
  
  // 2. Always add Duty Sup (FIXED - 1 line)
  displayResources.push('Duty Sup');
  
  // 3. Add STBY lines with minimum of 4 lines (VARIABLE with minimum 4)
  let stbyLineCount = 4; // Always show minimum of 4 STBY lines
  if (events.length > 0) {
    const stbyEvents = events.filter(event => 
      event?.resourceId && (event.resourceId.startsWith('STBY') || event.resourceId.startsWith('BNF-STBY'))
    );
    const uniqueStbyLines = new Set(stbyEvents.map(e => e.resourceId));
    stbyLineCount = Math.max(uniqueStbyLines.size, 4); // Minimum 4 lines
  }
  
  for (let i = 0; i < stbyLineCount; i++) {
    displayResources.push('STBY');
  }
  
  // 4. Always add 5 FTD lines (FIXED - 5 lines, regardless of availability or events)
  for (let i = 0; i < 5; i++) {
    displayResources.push('FTD');
  }
  
  // 5. Always add 4 CPT lines (FIXED - 4 lines, regardless of availability or events)
  for (let i = 0; i < 4; i++) {
    displayResources.push('CPT');
  }
  
  // 6. Add Ground lines based on actual Ground events (VARIABLE)
  if (events.length > 0) {
    const groundEvents = events.filter(event => 
      event?.resourceId && event.resourceId.startsWith('Ground')
    );
    const uniqueGroundLines = new Set(groundEvents.map(e => e.resourceId));
    uniqueGroundLines.forEach(() => displayResources.push('Ground'));
  }

  return (
    <div className="w-36 bg-gray-800 flex-shrink-0 h-full">
      <ul>
        {displayResources.map((resource, index) => {
            // Resource is already the display text (PC-21 1-24, Duty Sup, STBY, FTD, CPT, Ground)
            let resourceText: string = resource;
            let textColorClass = 'text-gray-400';
            let isDraggable = true;

            // Set colors and draggability based on resource type
            if (resource === 'Duty Sup') {
                textColorClass = 'text-amber-300 font-semibold';
                isDraggable = false;
            } else if (resource.startsWith('Deployed')) {
                textColorClass = 'text-purple-300 font-semibold';
                isDraggable = false;
            } else if (resource.startsWith('PC-21')) {
                textColorClass = 'text-gray-400';
                isDraggable = true;
            } else if (resource === 'STBY') {
                textColorClass = 'text-gray-400';
                isDraggable = false;
            } else if (resource === 'FTD') {
                textColorClass = 'text-indigo-300';
                isDraggable = true;
            } else if (resource === 'CPT') {
                textColorClass = 'text-cyan-300';
                isDraggable = false;
            } else if (resource === 'Ground') {
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
                  <div className="relative w-full text-center">
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                          {resource.match(/\d+$/)?.[0] || ''}
                      </span>
                      <span>PC-21</span>
                  </div>
              ) : (
                  <div className="w-full text-center">
                      <span>{resourceText}</span>
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