import React, { useState, useEffect } from 'react';
import CancellationCodesTable from './CancellationCodesTable';
import ACHistoryAnalytics from './ACHistoryAnalytics';
import { CancellationCode, CancellationRecord } from '../types';
import { initialCancellationCodes } from '../data/cancellationCodes';

interface ACHistoryPageProps {
  currentUserRole: string;
  cancellationRecords: CancellationRecord[];
}

const ACHistoryPage: React.FC<ACHistoryPageProps> = ({
  currentUserRole,
  cancellationRecords,
}) => {
  const [cancellationCodes, setCancellationCodes] = useState<CancellationCode[]>([]);
  const [usedCodes, setUsedCodes] = useState<Set<string>>(new Set());

  // Check if user has edit permissions (Admin or Super Admin)
  const canEdit = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';

  // Load cancellation codes from localStorage or use initial data
  useEffect(() => {
    const storedCodes = localStorage.getItem('cancellationCodes');
    if (storedCodes) {
      try {
        setCancellationCodes(JSON.parse(storedCodes));
      } catch (error) {
        console.error('Error loading cancellation codes:', error);
        setCancellationCodes(initialCancellationCodes);
      }
    } else {
      setCancellationCodes(initialCancellationCodes);
      localStorage.setItem('cancellationCodes', JSON.stringify(initialCancellationCodes));
    }
  }, []);

  // Calculate which codes have been used in cancellations
  useEffect(() => {
    const used = new Set<string>();
    cancellationRecords.forEach(record => {
      used.add(record.cancellationCode);
      if (record.manualCodeEntry) {
        used.add(record.manualCodeEntry);
      }
    });
    setUsedCodes(used);
  }, [cancellationRecords]);

  // Save codes to localStorage whenever they change
  const saveCodes = (codes: CancellationCode[]) => {
    setCancellationCodes(codes);
    localStorage.setItem('cancellationCodes', JSON.stringify(codes));
  };

  const handleAddCode = (newCode: CancellationCode) => {
    // Check if code already exists
    if (cancellationCodes.some(c => c.code === newCode.code)) {
      alert('A code with this identifier already exists.');
      return;
    }

    const updatedCodes = [...cancellationCodes, newCode];
    saveCodes(updatedCodes);
  };

  const handleEditCode = (oldCode: string, newCode: CancellationCode) => {
    const updatedCodes = cancellationCodes.map(c => 
      c.code === oldCode ? newCode : c
    );
    saveCodes(updatedCodes);
  };

  const handleToggleActive = (code: string) => {
    const updatedCodes = cancellationCodes.map(c => 
      c.code === code 
        ? { ...c, isActive: !c.isActive, updatedAt: new Date().toISOString() }
        : c
    );
    saveCodes(updatedCodes);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">AC History</h1>
        <p className="text-gray-400">
          Manage cancellation codes and view cancellation analytics and trends.
        </p>
      </div>

      {/* Cancellation Codes Master Table */}
      <CancellationCodesTable
        codes={cancellationCodes}
        onAddCode={handleAddCode}
        onEditCode={handleEditCode}
        onToggleActive={handleToggleActive}
        canEdit={canEdit}
        usedCodes={usedCodes}
      />

      {/* AC History Analytics */}
      <ACHistoryAnalytics
        cancellationRecords={cancellationRecords}
        cancellationCodes={cancellationCodes}
      />
    </div>
  );
};

export default ACHistoryPage;