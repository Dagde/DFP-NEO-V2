// Audit Flyout Window Component

import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  AUDIT_RECORDING_ACTIONS,
  getAuditLogs,
  getAuditRecordingSettingsForPage,
  normaliseAuditAction,
  saveAuditRecordingSettingsForPage,
} from '../utils/auditLogger';
import { AuditLog } from '../types/audit';
import { getAppApiBase } from '../utils/externalDataControls';

interface AuditFlyoutProps {
  pageName: string;
  onClose: () => void;
}

type AuditSortField = 'timestamp' | 'user' | 'action' | 'page' | 'entityType';
type AuditDatePreset = 'all' | 'today' | '7d' | '30d' | 'custom';
type AuditLogWithMeta = AuditLog & {
  rawAction?: string;
  entityType?: string;
  entityId?: string;
  affectedLabel?: string;
  dfpDate?: string;
  unit?: string;
  location?: string;
  operationalModel?: string;
};

const AuditFlyout: React.FC<AuditFlyoutProps> = ({ 
  pageName, 
  onClose
}) => {
  const [logs, setLogs] = useState<AuditLogWithMeta[]>([]);
  const [sortField, setSortField] = useState<AuditSortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<AuditDatePreset>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pageFilter, setPageFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dfpDateFilter, setDfpDateFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [showRecordingSettings, setShowRecordingSettings] = useState(false);
  const [recordingSettings, setRecordingSettings] = useState<Record<AuditLog['action'], boolean>>(() => (
    getAuditRecordingSettingsForPage(pageName)
  ));

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

  const humaniseEntityType = (entityType: string): string => {
    const labels: Record<string, string> = {
      currency: 'Currency',
      CommercialOrganisation: 'Organisation',
      CommercialLocation: 'Location',
      CommercialUnit: 'Unit',
      CommercialAircraftType: 'Aircraft Type',
      CommercialResourcePool: 'DFP Resource Rows',
      CommercialUnitModule: 'Unit Module',
      CommercialLicense: 'Licence',
      CommercialSchedulingRuleSet: 'Scheduling Rule Set',
      CommercialUserAccess: 'User Access Scope',
      SecurityMonitoring: 'Security Event',
      ProgramSchedule: 'Program Schedule',
    };
    if (labels[entityType]) return labels[entityType];
    return String(entityType || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\b\w/g, char => char.toUpperCase());
  };

  const getCurrencyNamesFromChanges = (changes: any): string[] => {
    const details = Array.isArray(changes.details) ? changes.details : [];
    return Array.from(new Set(details
      .map((detail: any) => detail?.currencyName || detail?.name || detail?.code)
      .filter(Boolean)
      .map(String)));
  };

  const getAffectedLabel = (entry: any, changes: any): string => {
    const entityType = String(entry.entityType || '');
    const personName = String(changes.personName || changes.traineeName || changes.staffName || '').trim();
    const currencyNames = getCurrencyNamesFromChanges(changes);

    if (entityType === 'currency') {
      if (personName && currencyNames.length === 1) return `${personName} - ${currencyNames[0]}`;
      if (personName && currencyNames.length > 1) return `${personName} - ${currencyNames.length} currency items`;
      if (personName) return personName;
      if (currencyNames.length === 1) return currencyNames[0];
    }

    if (changes.label) return String(changes.label);
    if (changes.context?.displayName) return String(changes.context.displayName);
    if (changes.eventName || changes.eventCode) return [changes.eventName, changes.eventCode].filter(Boolean).join(' - ');
    if (changes.flightNumber) return String(changes.flightNumber);
    if (changes.dfpDate || changes.scheduleDate || changes.date) {
      return `DFP ${changes.dfpDate || changes.scheduleDate || changes.date}`;
    }
    return humaniseEntityType(entityType) || 'Record';
  };

  const getAuditDescription = (entry: any, changes: any, affectedLabel: string): string => {
    if (changes.description) return changes.description;
    if (entry.entityType === 'currency') return `Updated currency for ${affectedLabel}`;
    if (changes.label) return `${humaniseEntityType(entry.entityType || 'Record')}: ${changes.label}`;
    return `${humaniseEntityType(entry.entityType || 'Record')} ${String(entry.action || 'updated').toLowerCase()}`;
  };

  const splitLocalAuditDescription = (entry: AuditLog): { affectedLabel: string; description: string } => {
    const description = String(entry.description || '').trim();
    const page = String(entry.page || '').trim();
    const patterns: Array<{ regex: RegExp; description: string }> = [
      { regex: /^Viewed staff profile for\s+(.+)$/i, description: 'Viewed staff profile' },
      { regex: /^Viewed trainee profile for\s+(.+)$/i, description: 'Viewed trainee profile' },
      { regex: /^Edited staff profile for\s+(.+)$/i, description: 'Edited staff profile' },
      { regex: /^Edited trainee profile for\s+(.+)$/i, description: 'Edited trainee profile' },
      { regex: /^Added new staff\s+(.+)$/i, description: 'Added staff profile' },
      { regex: /^Added new trainee\s+(.+)$/i, description: 'Added trainee profile' },
      { regex: /^Deleted staff\s+(.+)$/i, description: 'Deleted staff profile' },
      { regex: /^Deleted trainee\s+(.+)$/i, description: 'Deleted trainee profile' },
      { regex: /^Added unavailability for\s+(.+)$/i, description: 'Added staff unavailability' },
      { regex: /^Generated .+ for\s+(.+?)\s+- Event:/i, description: description.replace(/\s+for\s+.+$/i, '') || 'Generated report' },
      { regex: /^Opened embedded .+ for\s+(.+?)\s+- Event:/i, description: description.replace(/\s+for\s+.+$/i, '') || 'Opened embedded report' },
      { regex: /^Updated .+ for\s+(.+?)\s+- Event:/i, description: description.replace(/\s+for\s+.+$/i, '') || 'Updated report' },
      { regex: /^Modified .+ for\s+(.+?)\s+- Event:/i, description: description.replace(/\s+for\s+.+$/i, '') || 'Modified report' },
      { regex: /^Deleted .+ for\s+(.+?)\s+- Event:/i, description: description.replace(/\s+for\s+.+$/i, '') || 'Deleted report' },
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern.regex);
      if (match?.[1]) {
        return {
          affectedLabel: match[1].trim(),
          description: pattern.description,
        };
      }
    }

    return {
      affectedLabel: page || 'Record',
      description: description || `${page || 'Record'} ${normaliseAuditAction(entry.action).toLowerCase()}`,
    };
  };

  const mapDatabaseAuditLog = (entry: any): AuditLogWithMeta => {
    const changes = entry.changes || {};
    const changedFields = Array.isArray(changes.changedFields) ? changes.changedFields : [];
    const hasFriendlyFields = changedFields.some((field: any) => (
      field.label || field.displayBefore !== undefined || field.displayAfter !== undefined
    ));
    const changesText = changedFields.length && hasFriendlyFields
      ? changedFields.map(formatChangedField).join('; ')
      : changes.summary || '';
    const affectedLabel = getAffectedLabel(entry, changes);

    return {
      id: `db-${entry.id}`,
      user: entry.userName || 'Unknown User',
      action: normaliseAuditAction(entry.action || ''),
      description: getAuditDescription(entry, changes, affectedLabel),
      changes: changesText || '',
      timestamp: new Date(entry.createdAt),
      page: changes.source || entry.entityType || 'Database Audit',
      rawAction: entry.action || '',
      entityType: entry.entityType || '',
      entityId: entry.entityId || '',
      affectedLabel,
      dfpDate: changes.dfpDate || changes.date || changes.scheduleDate || '',
      unit: changes.unit || changes.unitId || changes.unitContext || changes.combinedUnit || '',
      location: changes.location || changes.locationId || changes.base || '',
      operationalModel: changes.operationalModel || changes.model || '',
    };
  };

  const mapLocalAuditLog = (entry: AuditLog): AuditLogWithMeta => {
    const localLabels = splitLocalAuditDescription(entry);
    return {
      ...entry,
      action: normaliseAuditAction(entry.action || ''),
      description: localLabels.description,
      affectedLabel: localLabels.affectedLabel,
    };
  };

  useEffect(() => {
    let cancelled = false;

    const loadLogs = async () => {
      const pageLogs = getAuditLogs(pageName).map(mapLocalAuditLog);
      setLogs(pageLogs);

      try {
        const sessionToken = localStorage.getItem('dfp_session_token');
        const res = await fetch(`${getApiBase()}/audit/logs?limit=500`, {
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

  useEffect(() => {
    setRecordingSettings(getAuditRecordingSettingsForPage(pageName));
  }, [pageName]);

  const handleSort = (field: AuditSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getDateOnlyTime = (date: Date): number => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  };

  const datePresetRange = useMemo(() => {
    if (datePreset === 'all' || datePreset === 'custom') return { from: '', to: '' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = new Date(today);
    if (datePreset === '7d') from.setDate(from.getDate() - 6);
    if (datePreset === '30d') from.setDate(from.getDate() - 29);
    const formatInputDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return { from: formatInputDate(from), to: formatInputDate(today) };
  }, [datePreset]);

  const activeDateFrom = datePreset === 'custom' ? dateFrom : datePresetRange.from;
  const activeDateTo = datePreset === 'custom' ? dateTo : datePresetRange.to;

  const matchesText = (value: string | undefined, filter: string): boolean => (
    !filter || String(value || '').toLowerCase().includes(filter.trim().toLowerCase())
  );

  const filteredLogs = useMemo(() => logs.filter(log => {
    const logDateTime = getDateOnlyTime(log.timestamp);
    if (activeDateFrom) {
      const fromTime = new Date(`${activeDateFrom}T00:00:00`).getTime();
      if (logDateTime < fromTime) return false;
    }
    if (activeDateTo) {
      const toTime = new Date(`${activeDateTo}T00:00:00`).getTime();
      if (logDateTime > toTime) return false;
    }
    if (pageFilter && log.page !== pageFilter) return false;
    if (actionFilter && log.action !== actionFilter) return false;
    if (!matchesText(log.user, userFilter)) return false;
    if (!matchesText(log.unit, unitFilter)) return false;
    if (!matchesText(log.location, locationFilter)) return false;
    if (!matchesText(log.operationalModel, modelFilter)) return false;
    if (!matchesText(log.affectedLabel, entityFilter) && !matchesText(log.entityType, entityFilter) && !matchesText(log.entityId, entityFilter)) return false;
    if (dfpDateFilter && log.dfpDate !== dfpDateFilter) return false;

    if (searchFilter.trim()) {
      const haystack = [
        log.user,
        log.action,
        log.rawAction,
        log.page,
        log.affectedLabel,
        log.entityType,
        log.entityId,
        log.description,
        log.changes,
        log.dfpDate,
        log.unit,
        log.location,
        log.operationalModel,
      ].join(' ').toLowerCase();
      if (!haystack.includes(searchFilter.trim().toLowerCase())) return false;
    }

    return true;
  }), [activeDateFrom, activeDateTo, actionFilter, dfpDateFilter, entityFilter, locationFilter, logs, modelFilter, pageFilter, searchFilter, unitFilter, userFilter]);

  const sortedLogs = useMemo(() => [...filteredLogs].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === 'timestamp') {
      comparison = a.timestamp.getTime() - b.timestamp.getTime();
    } else if (sortField === 'user') {
      comparison = a.user.localeCompare(b.user);
    } else if (sortField === 'action') {
      comparison = a.action.localeCompare(b.action);
    } else if (sortField === 'page') {
      comparison = a.page.localeCompare(b.page);
    } else if (sortField === 'entityType') {
      comparison = (a.affectedLabel || a.entityType || '').localeCompare(b.affectedLabel || b.entityType || '');
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  }), [filteredLogs, sortDirection, sortField]);

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
    action === 'Publish' ? 'bg-emerald-900/50 text-emerald-300' :
    action === 'Build' ? 'bg-orange-900/50 text-orange-300' :
    action === 'Move' ? 'bg-indigo-900/50 text-indigo-300' :
    action === 'Submit' ? 'bg-teal-900/50 text-teal-300' :
    action === 'Cancel' ? 'bg-rose-900/50 text-rose-300' :
    action === 'Generate' ? 'bg-violet-900/50 text-violet-300' :
    action === 'Save' ? 'bg-lime-900/50 text-lime-300' :
    action === 'Sync' ? 'bg-sky-900/50 text-sky-300' :
    action === 'Ignore' ? 'bg-slate-900/50 text-slate-300' :
    action === 'Override' ? 'bg-amber-900/50 text-amber-300' :
    'bg-gray-900/50 text-gray-300'
  );

  const uniqueOptions = (values: Array<string | undefined>) => (
    Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  );

  const pageOptions = useMemo(() => uniqueOptions([pageName, ...logs.map(log => log.page)]), [logs, pageName]);
  const actionOptions = useMemo(() => uniqueOptions(logs.map(log => log.action)), [logs]);
  const recordingActionOptions = useMemo(() => {
    const pageKey = pageName.toLowerCase();
    const baseActions = new Set<AuditLog['action']>(['View', 'Add', 'Edit', 'Delete', 'Archive', 'Restore']);
    if (pageKey.includes('dfp') || pageKey.includes('schedule') || pageKey.includes('program') || pageKey.includes('neo')) {
      baseActions.add('Move');
      baseActions.add('Publish');
      baseActions.add('Build');
    }
    if (pageKey.includes('login') || pageKey.includes('security') || pageKey.includes('access')) {
      baseActions.add('Sign');
    }
    actionOptions.forEach(action => {
      if (AUDIT_RECORDING_ACTIONS.includes(action as AuditLog['action'])) {
        baseActions.add(action as AuditLog['action']);
      }
    });
    return AUDIT_RECORDING_ACTIONS.filter(action => baseActions.has(action));
  }, [actionOptions, pageName]);

  const resetFilters = () => {
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setPageFilter('');
    setActionFilter('');
    setUserFilter('');
    setUnitFilter('');
    setLocationFilter('');
    setModelFilter('');
    setEntityFilter('');
    setDfpDateFilter('');
    setSearchFilter('');
  };

  const setRecordingAction = (action: AuditLog['action'], enabled: boolean) => {
    const nextSettings = { ...recordingSettings, [action]: enabled };
    setRecordingSettings(nextSettings);
    saveAuditRecordingSettingsForPage(pageName, nextSettings);
  };

  const setAllRecordingActions = (enabled: boolean) => {
    const nextSettings = recordingActionOptions.reduce((settings, action) => {
      settings[action] = enabled;
      return settings;
    }, { ...recordingSettings } as Record<AuditLog['action'], boolean>);
    setRecordingSettings(nextSettings);
    saveAuditRecordingSettingsForPage(pageName, nextSettings);
  };

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, AuditLogWithMeta[]>();
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
              <th>Page</th>
              <th>Affected</th>
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
                <td>${log.page || '-'}</td>
                <td>${log.affectedLabel || humaniseEntityType(log.entityType || '') || '-'}</td>
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
    const headers = ['Date', 'Time', 'User', 'Action', 'Page', 'Affected', 'Record Type', 'Record ID', 'DFP Date', 'Unit', 'Location', 'Model', 'Description', 'Changes'];
    const escapeCsv = (value: string) => `"${String(value || '').replaceAll('"', '""')}"`;
    const rows = sortedLogs.map(log => [
      log.timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }),
      log.timestamp.toLocaleTimeString(),
      log.user,
      log.action,
      log.page,
      log.affectedLabel || humaniseEntityType(log.entityType || '') || '',
      humaniseEntityType(log.entityType || ''),
      log.entityId || '',
      log.dfpDate || '',
      log.unit || '',
      log.location || '',
      log.operationalModel || '',
      log.description,
      log.changes || ''
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
          <div className="flex items-center gap-px">
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
              onClick={() => setShowRecordingSettings(!showRecordingSettings)}
              className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-black"
              title="Audit Log Recording Settings"
              aria-label="Audit Log Recording Settings"
            >
              Settings
            </button>
            <button
              onClick={onClose}
              className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-lg btn-aluminium-brushed text-black"
            >
              Close
            </button>
          </div>
        </div>

        {showRecordingSettings && (
          <div className="mx-4 mt-3 rounded-md border border-cyan-500/70 bg-cyan-950/15 px-4 py-3 shadow-[0_0_0_1px_rgba(8,145,178,0.18)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-300">Audit Recording Settings</div>
                <div className="text-[11px] text-gray-500">Applies to this page or tab: {pageName}</div>
              </div>
              <div className="flex items-center gap-px">
                <button
                  type="button"
                  onClick={() => setAllRecordingActions(true)}
                  className="rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-700"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setAllRecordingActions(false)}
                  className="rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-700"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {recordingActionOptions.map(action => (
                <label
                  key={action}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-700 bg-gray-800/70 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={recordingSettings[action] !== false}
                    onChange={(event) => setRecordingAction(action, event.target.checked)}
                    className="h-4 w-4 accent-sky-500"
                  />
                  {action}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              These choices control future audit entries only. Existing audit history is retained unchanged.
            </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4 rounded-md border border-gray-700 bg-gray-900/60 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-300">Investigation Filters</div>
                <div className="text-[11px] text-gray-500">Showing {sortedLogs.length} of {logs.length} audit entries</div>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-700"
              >
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Date Range
                <select
                  value={datePreset}
                  onChange={(event) => setDatePreset(event.target.value as AuditDatePreset)}
                  className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs normal-case tracking-normal text-white"
                >
                  <option value="all">ALL</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="custom">Custom</option>
                </select>
              </label>

              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Page / Module
                <select
                  value={pageFilter}
                  onChange={(event) => setPageFilter(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs normal-case tracking-normal text-white"
                >
                  <option value="">All pages</option>
                  {pageOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>

              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Action
                <select
                  value={actionFilter}
                  onChange={(event) => setActionFilter(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs normal-case tracking-normal text-white"
                >
                  <option value="">All actions</option>
                  {actionOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>

              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                User
                <input
                  value={userFilter}
                  onChange={(event) => setUserFilter(event.target.value)}
                  placeholder="Name or ID"
                  className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs normal-case tracking-normal text-white placeholder:text-gray-500"
                />
              </label>

              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Unit / Org
                <input
                  value={unitFilter}
                  onChange={(event) => setUnitFilter(event.target.value)}
                  placeholder="1FTS, CFS"
                  className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs normal-case tracking-normal text-white placeholder:text-gray-500"
                />
              </label>

              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Search
                <input
                  value={searchFilter}
                  onChange={(event) => setSearchFilter(event.target.value)}
                  placeholder="Anything"
                  className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs normal-case tracking-normal text-white placeholder:text-gray-500"
                />
              </label>
            </div>

            {datePreset === 'custom' && (
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-6">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  From
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs normal-case tracking-normal text-white"
                  />
                </label>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  To
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs normal-case tracking-normal text-white"
                  />
                </label>
              </div>
            )}

            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-gray-400">Advanced Filters</summary>
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Location
                  <input
                    value={locationFilter}
                    onChange={(event) => setLocationFilter(event.target.value)}
                    placeholder="YMES"
                    className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs normal-case tracking-normal text-white placeholder:text-gray-500"
                  />
                </label>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Model
                  <input
                    value={modelFilter}
                    onChange={(event) => setModelFilter(event.target.value)}
                    placeholder="Flight School"
                    className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs normal-case tracking-normal text-white placeholder:text-gray-500"
                  />
                </label>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  DFP Date
                  <input
                    type="date"
                    value={dfpDateFilter}
                    onChange={(event) => setDfpDateFilter(event.target.value)}
                    className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs normal-case tracking-normal text-white"
                  />
                </label>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Affected Record
                  <input
                    value={entityFilter}
                    onChange={(event) => setEntityFilter(event.target.value)}
                    placeholder="Person, tile, ID"
                    className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-xs normal-case tracking-normal text-white placeholder:text-gray-500"
                  />
                </label>
              </div>
            </details>
          </div>

          {sortedLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">{logs.length === 0 ? 'No audit logs found' : 'No audit logs match the current filters'}</p>
              <p className="text-sm mt-2">{logs.length === 0 ? 'Activity on this page will be recorded here' : 'Clear or broaden the filters to review more entries'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-700 bg-gray-900/60 px-3 py-2">
                <div className="text-xs font-medium uppercase tracking-wider text-gray-400">Sort Results By</div>
                <div className="flex gap-2">
                  {(['timestamp', 'user', 'action', 'page', 'entityType'] as const).map(field => (
                    <button
                      key={field}
                      onClick={() => handleSort(field)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold capitalize ${
                        sortField === field
                          ? 'border-sky-500 bg-sky-900/40 text-sky-200'
                          : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {field === 'timestamp' ? 'Time' : field === 'entityType' ? 'Affected' : field}
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
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">Page</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-300">Affected</th>
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
                                <td className="whitespace-nowrap px-4 py-3 text-gray-300">
                                  {log.page || '-'}
                                </td>
                                <td className="px-4 py-3 text-gray-300">
                                  <div>{log.affectedLabel || humaniseEntityType(log.entityType || '') || '-'}</div>
                                  {(log.dfpDate || log.unit || log.location || log.operationalModel) && (
                                    <div className="mt-1 text-[11px] text-gray-500">
                                      {[log.dfpDate, log.unit, log.location, log.operationalModel].filter(Boolean).join(' | ')}
                                    </div>
                                  )}
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
