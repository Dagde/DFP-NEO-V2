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
        className={`w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed ${className}`}
        title="View Audit Log"
      >
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