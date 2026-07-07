import React, { useEffect, useRef } from 'react';

interface SuccessNotificationProps {
  message: string;
  onClose: () => void;
}

const SuccessNotification: React.FC<SuccessNotificationProps> = ({ message, onClose }) => {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, 2500);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [message]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center animate-fade-in" onClick={() => onCloseRef.current()}>
      <div className="bg-gray-800 rounded-lg shadow-xl border border-green-500 p-8" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center space-x-4">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
          <p className="text-xl font-semibold text-white">{message}</p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="rounded-md border border-green-400/50 bg-green-500/15 px-4 py-2 text-sm font-semibold text-green-100 hover:bg-green-500/25"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessNotification;
