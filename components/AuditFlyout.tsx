// Audit Flyout Window Component

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { getAuditLogs, exportAuditLogsCSV } from '../utils/auditLogger';
import { AuditLog } from '../types/audit';

interface AuditFlyoutProps {
  pageName: string;
  onClose: () => void;
}

const AuditFlyout: React.FC<AuditFlyoutProps> = ({ 
  pageName, 
  onClose
}) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [sortField, setSortField] = useState<'timestamp' | 'user' | 'action'>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const pageLogs = getAuditLogs(pageName);
    setLogs(pageLogs);
  }, [pageName]);

  const handleSort = (field: 'timestamp' | 'user' | 'action') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedLogs = [...logs].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === 'timestamp') {
      comparison = a.timestamp.getTime() - b.timestamp.getTime();
    } else if (sortField === 'user') {
      comparison = a.user.localeCompare(b.user);
    } else if (sortField === 'action') {
      comparison = a.action.localeCompare(b.action);
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Audit Log - ${pageName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .print-date { color: #666; font-size: 12px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <h1>Audit Log</h1>
        <p><strong>Page:</strong> ${pageName}</p>
        <p class="print-date">Printed: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Description</th>
              <th>Changes</th>
            </tr>
          </thead>
          <tbody>
            ${sortedLogs.map(log => `
              <tr>
                <td>${log.timestamp.toLocaleDateString()}</td>
                <td>${log.timestamp.toLocaleTimeString()}</td>
                <td>${log.user}</td>
                <td>${log.action}</td>
                <td>${log.description}</td>
                <td>${log.changes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExport = () => {
    const csv = exportAuditLogsCSV(pageName);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${page}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/60 z-[999999] flex items-center justify-center" style={{ zIndex: 999999 }} onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl border border-gray-700 flex flex-col max-h-[90vh] relative" style={{ zIndex: 999999 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900 rounded-t-lg">
          <div>
            <h2 className="text-xl font-bold text-white">Audit Log</h2>
            <p className="text-sm text-gray-400 mt-1">Page: {pageName}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExport}
              className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
              title="Export to CSV"
            >
              Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              title="Print Audit Log"
            >
              Print
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {sortedLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">No audit logs found</p>
              <p className="text-sm mt-2">Activity on this page will be recorded here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700 sticky top-0">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('timestamp')}
                    >
                      <div className="flex items-center">
                        Date/Time
                        {sortField === 'timestamp' && (
                          <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('user')}
                    >
                      <div className="flex items-center">
                        User
                        {sortField === 'user' && (
                          <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600"
                      onClick={() => handleSort('action')}
                    >
                      <div className="flex items-center">
                        Action
                        {sortField === 'action' && (
                          <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Changes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {sortedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                        <div>{log.timestamp.toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">{log.timestamp.toLocaleTimeString()}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                        {log.user}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          log.action === 'View' ? 'bg-blue-900/50 text-blue-300' :
                          log.action === 'Edit' ? 'bg-yellow-900/50 text-yellow-300' :
                          log.action === 'Add' ? 'bg-green-900/50 text-green-300' :
                          log.action === 'Delete' ? 'bg-red-900/50 text-red-300' :
                          log.action === 'Archive' ? 'bg-purple-900/50 text-purple-300' :
                          log.action === 'Restore' ? 'bg-cyan-900/50 text-cyan-300' :
                          'bg-gray-900/50 text-gray-300'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {log.description}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {log.changes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 bg-gray-900 rounded-b-lg flex justify-between items-center">
          <div className="text-sm text-gray-400">
            Total entries: <span className="font-medium text-white">{sortedLogs.length}</span>
          </div>
          <div className="text-xs text-gray-500">
            Last updated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>,
       document.body
     );
   };
   export default AuditFlyout;
