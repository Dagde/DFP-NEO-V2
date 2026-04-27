import React, { useEffect } from 'react';

interface SuccessNotificationProps {
  message: string;
  onClose: () => void;
}

const SuccessNotification: React.FC<SuccessNotificationProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 1500);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-xl border border-green-500 p-8">
        <div className="flex items-center space-x-4">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
          <p className="text-xl font-semibold text-white">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default SuccessNotification;