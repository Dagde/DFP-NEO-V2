import React from 'react';

interface LocalityChangeFlyoutProps {
  locality: string;
}

const LocalityChangeFlyout: React.FC<LocalityChangeFlyoutProps> = ({ locality }) => {
  return (
    <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center animate-fade-in pointer-events-none">
      <div className="bg-gray-800 rounded-lg shadow-xl border border-sky-500 p-12 max-w-2xl text-center">
        <div className="flex flex-col items-center space-y-4">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
           </svg>
           <div>
                <h2 className="text-3xl font-bold text-white">Locality Changed to {locality}</h2>
                <p className="mt-2 text-lg text-gray-300">
                    All subsequent scheduling and data modifications will now apply to the {locality} Daily Flying Program.
                </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LocalityChangeFlyout;