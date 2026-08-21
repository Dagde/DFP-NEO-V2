// Audit Flyout Window Component

import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { getAuditLogs } from '../utils/auditLogger';
import { AuditLog } from '../types/audit';
import { getAppApiBase } from '../utils/externalDataControls';

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
  const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);

  const getApiBase = (): string => getAppApiBase();

  const summariseValue = (value: any): string => {
    if (value === null || value === undefined || value === '') return 'blank';
    if (Array.isArray(value)) return value.join(', ') || 'blank';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const formatChangedField = (field: any): string => {
    const label = field.label || field.field || 'Field';
    const beforeValue = field.displayBefore ?? summariseValue(field.before);
    const afterValue = field.displayAfter ?? summariseValue(field.after);
    return `${label}: ${beforeValue} -> ${afterValue}`;
  };

  const mapDatabaseAction = (action: string): AuditLog['action'] => {
    if (action.includes('ADDED') || action === 'CREATE') return 'Add';
    if (action.includes('DELETE') || action.includes('REMOVED')) return 'Delete';
    if (action === 'LOGIN') return 'Sign';
    return 'Edit';
  };

  const mapDatabaseAuditLog = (entry: any): AuditLog => {
    const changes = entry.changes || {};
    const changedFields = Array.isArray(changes.changedFields) ? changes.changedFields : [];
    const hasFriendlyFields = changedFields.some((field: any) => (
      field.label || field.displayBefore !== undefined || field.displayAfter !== undefined
    ));
    const changesText = changedFields.length && hasFriendlyFields
      ? changedFields.map(formatChangedField).join('; ')
      : changes.summary || '';

    return {
      id: `db-${entry.id}`,
      user: entry.userName || 'Unknown User',
      action: mapDatabaseAction(entry.action || ''),
      description: changes.description
        || (changes.label
        ? `${entry.entityType}: ${changes.label}`
        : `${entry.entityType || 'Record'} ${entry.action || 'updated'}`),
      changes: changesText || '',
      timestamp: new Date(entry.createdAt),
      page: changes.source || entry.entityType || 'Database Audit',
    };
  };

  useEffect(() => {
    let cancelled = false;

    const loadLogs = async () => {
      const pageLogs = getAuditLogs(pageName);
      setLogs(pageLogs);

      try {
        const sessionToken = localStorage.getItem('dfp_session_token');
        const res = await fetch(`${getApiBase()}/audit/logs?limit=300`, {
          headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const databaseLogs = (data.auditEntries || []).map(mapDatabaseAuditLog);
        setLogs([...databaseLogs, ...pageLogs]);
      } catch (error) {
        console.warn('Failed to load database audit logs:', error);
      }
    };

    loadLogs();
    return () => { cancelled = true; };
  }, [pageName]);

  const handleSort = (field: 'timestamp' | 'user' | 'action') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedLogs = useMemo(() => [...logs].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === 'timestamp') {
      comparison = a.timestamp.getTime() - b.timestamp.getTime();
    } else if (sortField === 'user') {
      comparison = a.user.localeCompare(b.user);
    } else if (sortField === 'action') {
      comparison = a.action.localeCompare(b.action);
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  }), [logs, sortDirection, sortField]);

  const getDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDateKey = getDateKey(new Date());

  const formatDateHeading = (dateKey: string): string => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const label = date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
    return dateKey === todayDateKey ? `Today - ${label}` : label;
  };

  const actionClassName = (action: AuditLog['action']): string => (
    action === 'View' ? 'bg-blue-900/50 text-blue-300' :
    action === 'Edit' ? 'bg-yellow-900/50 text-yellow-300' :
    action === 'Add' ? 'bg-green-900/50 text-green-300' :
    action === 'Delete' ? 'bg-red-900/50 text-red-300' :
    action === 'Archive' ? 'bg-purple-900/50 text-purple-300' :
    action === 'Restore' ? 'bg-cyan-900/50 text-cyan-300' :
    'bg-gray-900/50 text-gray-300'
  );

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, AuditLog[]>();
    sortedLogs.forEach(log => {
      const key = getDateKey(log.timestamp);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(log);
    });
    return Array.from(groups.entries())
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([dateKey, entries]) => ({ dateKey, entries }));
  }, [sortedLogs]);

  useEffect(() => {
    if (logs.length === 0) {
      setExpandedDateKey(null);
      return;
    }
    if (logs.some(log => getDateKey(log.timestamp) === todayDateKey)) {
      setExpandedDateKey(todayDateKey);
    } else {
      setExpandedDateKey(null);
    }
  }, [logs.length, todayDateKey]);

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
                <td>${log.timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
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
    const headers = ['Date', 'Time', 'User', 'Action', 'Description', 'Changes', 'Page'];
    const escapeCsv = (value: string) => `"${String(value || '').replaceAll('"', '""')}"`;
    const rows = sortedLogs.map(log => [
      log.timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }),
      log.timestamp.toLocaleTimeString(),
      log.user,
      log.action,
      log.description,
      log.changes || '',
      log.page
    ]);
    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${pageName}-${new Date().toISOString().split('T')[0]}.csv`;
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
              className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-black"
              title="Export to CSV"
            >
              Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-black"
              title="Print Audit Log"
            >
              Print
            </button>
            <button
              onClick={onClose}
              className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-lg btn-aluminium-brushed text-black"
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
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-700 bg-gray-900/60 px-3 py-2">
                <div className="text-xs font-medium uppercase tracking-wider text-gray-400">Sort Open Date By</div>
                <div className="flex gap-2">
                  {(['timestamp', 'user', 'action'] as const).map(field => (
                    <button
                      key={field}
                      onClick={() => handleSort(field)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold capitalize ${
                        sortField === field
                          ? 'border-sky-500 bg-sky-900/40 text-sky-200'
                          : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {field === 'timestamp' ? 'Time' : field}
                      {sortField === field && <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {groupedLogs.map(group => {
                const isExpanded = expandedDateKey === group.dateKey;
                return (
                  <div key={group.dateKey} className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/30">
                    <button
                      type="button"
                      onClick={() => setExpandedDateKey(isExpanded ? null : group.dateKey)}
                      className={`flex w-full items-center justify-between px-4 py-3 text-left transition ${
                        isExpanded ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-200 hover:bg-gray-700/70'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold">{formatDateHeading(group.dateKey)}</div>
                        <div className="text-xs text-gray-400">{group.entries.length} recorded activit{group.entries.length === 1 ? 'y' : 'ies'}</div>
                      </div>
                      <div className="text-xl leading-none text-gray-300">{isExpanded ? '−' : '+'}</div>
                    </button>

                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-800">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">Time</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">User</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">Action</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">Description</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">Changes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700 bg-gray-800/70">
                            {group.entries.map((log) => (
                              <tr key={log.id} className="hover:bg-gray-700/50">
                                <td className="whitespace-nowrap px-4 py-3 text-gray-300">
                                  {log.timestamp.toLocaleTimeString()}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-gray-300">
                                  {log.user}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  <span className={`rounded px-2 py-1 text-xs font-medium ${actionClassName(log.action)}`}>
                                    {log.action}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-300">
                                  {log.description}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-400">
                                  {log.changes || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
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
