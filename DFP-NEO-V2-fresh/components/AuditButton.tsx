// Reusable Audit Button Component

import React, { useState, CSSProperties } from 'react';
import AuditFlyout from './AuditFlyout';

interface AuditButtonProps {
  pageName: string;
  className?: string;
  style?: CSSProperties;
}

const AuditButton: React.FC<AuditButtonProps> = ({ pageName, className = '', style }) => {
  const [showFlyout, setShowFlyout] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowFlyout(true)}
        className={`w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md ${className}`}
        style={style}
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