import React, { useEffect } from 'react';

interface InfoNotificationProps {
  message: string;
  onClose: () => void;
}

const InfoNotification: React.FC<InfoNotificationProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // Automatically close after 3 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-sky-600 text-white px-6 py-3 rounded-lg shadow-lg z-[100] animate-fade-in">
      <p className="font-semibold">{message}</p>
    </div>
  );
};

export default InfoNotification;