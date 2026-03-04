import React, { useState, useEffect } from 'react';
import { createDataValidationReport, performDataRepair } from '../utils/dataRepair';

interface DataValidationReportProps {
  traineesData: any[];
  onDataRepaired: (repairedData: any[]) => void;
}

const DataValidationReport: React.FC<DataValidationReportProps> = ({ 
  traineesData, 
  onDataRepaired 
}) => {
  const [report, setReport] = useState<any>(null);
  const [isRepairing, setIsRepairing] = useState(false);

  useEffect(() => {
    if (traineesData) {
      const validationReport = createDataValidationReport(traineesData);
      setReport(validationReport);
    }
  }, [traineesData]);

  const handleRepairData = async () => {
    setIsRepairing(true);
    try {
      const repairedData = performDataRepair();
      onDataRepaired(repairedData);
      
      // Update the report after repair
      const newReport = createDataValidationReport(repairedData);
      setReport(newReport);
    } catch (error) {
      console.error('Error repairing data:', error);
    } finally {
      setIsRepairing(false);
    }
  };

  if (!report) {
    return <div className="p-4">Analyzing data...</div>;
  }

  if (report.invalidRecords === 0) {
    return (
      <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
        <h3 className="text-green-400 font-semibold mb-2">✓ Data Validation Passed</h3>
        <p className="text-green-300 text-sm">
          All {report.totalRecords} trainee records are valid.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
      <h3 className="text-red-400 font-semibold mb-2">⚠ Data Validation Issues Found</h3>
      
      <div className="mb-4 text-sm">
        <p className="text-red-300">
          <strong>Total Records:</strong> {report.totalRecords}
        </p>
        <p className="text-red-300">
          <strong>Valid Records:</strong> {report.validRecords}
        </p>
        <p className="text-red-300">
          <strong>Invalid Records:</strong> {report.invalidRecords}
        </p>
      </div>

      {report.issues.length > 0 && (
        <div className="mb-4">
          <h4 className="text-red-400 font-medium mb-2">Issues Found:</h4>
          <div className="max-h-40 overflow-y-auto bg-black/30 p-2 rounded">
            {report.issues.slice(0, 10).map((issue: string, index: number) => (
              <p key={index} className="text-red-200 text-xs mb-1">
                • {issue}
              </p>
            ))}
            {report.issues.length > 10 && (
              <p className="text-red-300 text-xs italic">
                ... and {report.issues.length - 10} more issues
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleRepairData}
          disabled={isRepairing}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white rounded text-sm font-medium"
        >
          {isRepairing ? 'Repairing...' : 'Repair Data'}
        </button>
        
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm font-medium"
        >
          Reload Page
        </button>
      </div>

      <div className="mt-3 text-xs text-red-200">
        <p>These issues are typically caused by bulk upload operations with incomplete data.</p>
        <p>Click "Repair Data" to automatically fix common issues like missing names and courses.</p>
      </div>
    </div>
  );
};

export default DataValidationReport;