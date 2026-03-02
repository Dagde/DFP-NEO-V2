// Reusable Audit Button Component

import React, { useState } from 'react';
import AuditFlyout from './AuditFlyout';

interface AuditButtonProps {
  pageName: string;
  className?: string;
}

const AuditButton: React.FC<AuditButtonProps> = ({ pageName, className = '' }) => {
  const [showFlyout, setShowFlyout] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowFlyout(true)}
        className={`inline-flex items-center px-2 py-1 text-xs font-medium text-gray-400 hover:text-gray-200 bg-gray-700/50 hover:bg-gray-600/50 rounded border border-gray-600 hover:border-gray-500 transition-colors ${className}`}
        title="View Audit Log"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-3.5 w-3.5 mr-1" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
          />
        </svg>
        Audit
      </button>
      
      {showFlyout && (
        <AuditFlyout 
          pageName={pageName}
          onClose={() => setShowFlyout(false)}
        />
      )}
    </>
  );
};

export default AuditButton;