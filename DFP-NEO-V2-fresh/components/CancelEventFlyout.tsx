import React, { useState, useEffect } from 'react';
import PinEntryFlyout from './PinEntryFlyout';
import { CancellationCode } from '../types';

interface CancelEventFlyoutProps {
  eventId: string;
  eventType: 'flight' | 'ftd';
  onConfirm: (eventId: string, cancellationCode: string, manualCodeEntry?: string) => void;
  onClose: () => void;
  cancellationCodes: CancellationCode[];
}

const CancelEventFlyout: React.FC<CancelEventFlyoutProps> = ({
  eventId,
  eventType,
  onConfirm,
  onClose,
  cancellationCodes,
}) => {
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [error, setError] = useState<string>('');

  // Filter codes based on event type
  const availableCodes = cancellationCodes.filter(code => 
    code.isActive && (
      code.appliesTo === 'Both' || 
      (eventType === 'flight' && code.appliesTo === 'Flight') ||
      (eventType === 'ftd' && code.appliesTo === 'FTD')
    )
  );

  // Add UNKNOWN and OTHER options
  const codeOptions = [
    { code: '', label: '-- Select Cancellation Code --' },
    ...availableCodes.map(c => ({ code: c.code, label: `${c.code} - ${c.description}` })),
    { code: 'UNKNOWN', label: 'UNKNOWN' },
    { code: 'OTHER', label: 'OTHER (Manual Entry)' },
  ];

  const handleCodeChange = (code: string) => {
    setSelectedCode(code);
    setError('');
    if (code !== 'OTHER') {
      setManualCode('');
    }
  };

  const handleProceedToPin = () => {
    // Validate code selection
    if (!selectedCode) {
      setError('Please select a cancellation code.');
      return;
    }

    if (selectedCode === 'OTHER' && !manualCode.trim()) {
      setError('Please enter a manual code.');
      return;
    }

    if (selectedCode === 'OTHER' && manualCode.trim().length > 4) {
      setError('Manual code must be 4 characters or less.');
      return;
    }

    setShowPinEntry(true);
  };

  const handlePinConfirm = () => {
    const finalCode = selectedCode === 'OTHER' ? manualCode.toUpperCase().trim() : selectedCode;
    onConfirm(eventId, selectedCode, selectedCode === 'OTHER' ? finalCode : undefined);
  };

  const handlePinCancel = () => {
    setShowPinEntry(false);
  };

  const isPinEnabled = selectedCode && (selectedCode !== 'OTHER' || manualCode.trim());

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center animate-fade-in" onClick={onClose}>
        <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-red-500/50" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="p-4 border-b border-gray-700 bg-red-900/20 flex items-center space-x-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-bold text-red-400">Cancel Event</h2>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <p className="text-gray-300">
              You are about to cancel this {eventType === 'flight' ? 'Flight' : 'FTD'} event. 
              This action will move the event to the STBY line with a red cross.
            </p>

            {/* Cancellation Code Selection */}
            <div>
              <label htmlFor="cancellation-code" className="block text-sm font-medium text-gray-400 mb-2">
                Cancellation Code <span className="text-red-400">*</span>
              </label>
              <select
                id="cancellation-code"
                value={selectedCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-red-500 focus:border-red-500"
              >
                {codeOptions.map(option => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Manual Code Entry (shown when OTHER is selected) */}
            {selectedCode === 'OTHER' && (
              <div>
                <label htmlFor="manual-code" className="block text-sm font-medium text-gray-400 mb-2">
                  Enter Code <span className="text-red-400">*</span>
                </label>
                <input
                  id="manual-code"
                  type="text"
                  value={manualCode}
                  onChange={(e) => {
                    setManualCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  maxLength={4}
                  placeholder="Enter code (max 4 chars)"
                  className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-red-500 focus:border-red-500"
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-md p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-gray-700/30 border border-gray-600 rounded-md p-3">
              <p className="text-gray-400 text-sm">
                <strong className="text-white">Note:</strong> After selecting a cancellation code, 
                you will be prompted to enter your PIN to complete the cancellation.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end space-x-3">
            <button 
              onClick={onClose} 
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold"
            >
              Cancel
            </button>
            <button 
              onClick={handleProceedToPin}
              disabled={!isPinEnabled}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              Proceed to PIN
            </button>
          </div>
        </div>
      </div>

      {/* PIN Entry Modal */}
      {showPinEntry && (
        <PinEntryFlyout
          correctPin="1111"
          onConfirm={handlePinConfirm}
          onCancel={handlePinCancel}
          title="Confirm Cancellation"
          message="Enter your PIN to confirm event cancellation."
        />
      )}
    </>
  );
};

export default CancelEventFlyout;