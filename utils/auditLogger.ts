// Audit logging utility

import { AuditLog, AuditAction } from '../types/audit';

const AUDIT_STORAGE_KEY = 'dfp_audit_logs';
const AUDIT_RECORDING_SETTINGS_KEY = 'dfp_audit_recording_settings';
export const AUDIT_RECORDING_ACTIONS: AuditAction[] = [
  'View',
  'Add',
  'Edit',
  'Move',
  'Delete',
  'Archive',
  'Restore',
  'Sign',
  'Publish',
  'Build',
  'Submit',
  'Cancel',
  'Generate',
  'Save',
  'Sync',
  'Ignore',
  'Override',
];

export type AuditRecordingSettings = Record<string, Partial<Record<AuditAction, boolean>>>;

// Current user - set by the application
let currentUser: string = 'Unknown User';

// Set current user (called by App.tsx on initialization)
export const setCurrentUser = (user: string): void => {
  currentUser = user;
};

// Get current user
const getCurrentUser = (): string => {
  return currentUser;
};

const getDefaultPageRecordingSettings = (): Record<AuditAction, boolean> => (
  AUDIT_RECORDING_ACTIONS.reduce((settings, action) => {
    settings[action] = true;
    return settings;
  }, {} as Record<AuditAction, boolean>)
);

export const getAuditRecordingSettings = (): AuditRecordingSettings => {
  try {
    const raw = localStorage.getItem(AUDIT_RECORDING_SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error reading audit recording settings:', error);
    return {};
  }
};

export const getAuditRecordingSettingsForPage = (page: string): Record<AuditAction, boolean> => {
  const defaults = getDefaultPageRecordingSettings();
  const allSettings = getAuditRecordingSettings();
  return {
    ...defaults,
    ...(allSettings[page] || {}),
  };
};

export const saveAuditRecordingSettingsForPage = (page: string, settings: Partial<Record<AuditAction, boolean>>): void => {
  try {
    const allSettings = getAuditRecordingSettings();
    allSettings[page] = {
      ...getDefaultPageRecordingSettings(),
      ...settings,
    };
    localStorage.setItem(AUDIT_RECORDING_SETTINGS_KEY, JSON.stringify(allSettings));
  } catch (error) {
    console.error('Error saving audit recording settings:', error);
  }
};

export const shouldRecordAuditAction = (page: string, action: AuditAction): boolean => (
  getAuditRecordingSettingsForPage(page)[action] !== false
);

export const normaliseAuditAction = (action: string | AuditAction): AuditAction => {
  const cleanAction = String(action || '').trim().toUpperCase();
  if (cleanAction === 'VIEW' || cleanAction.includes('VIEW')) return 'View';
  if (cleanAction === 'ADD' || cleanAction === 'CREATE' || cleanAction === 'CREATED' || cleanAction.includes('ADDED')) return 'Add';
  if (cleanAction === 'EDIT' || cleanAction === 'UPDATE' || cleanAction === 'UPDATED' || cleanAction.includes('CHANGED')) return 'Edit';
  if (cleanAction === 'MOVE' || cleanAction === 'MOVED' || cleanAction.includes('MOVE')) return 'Move';
  if (cleanAction === 'DELETE' || cleanAction === 'DELETED' || cleanAction.includes('REMOVED')) return 'Delete';
  if (cleanAction === 'ARCHIVE' || cleanAction === 'ARCHIVED') return 'Archive';
  if (cleanAction === 'RESTORE' || cleanAction === 'RESTORED') return 'Restore';
  if (cleanAction === 'SIGN' || cleanAction === 'LOGIN' || cleanAction === 'SIGNED') return 'Sign';
  if (cleanAction === 'PUBLISH' || cleanAction === 'PUBLISHED') return 'Publish';
  if (cleanAction === 'BUILD' || cleanAction === 'BUILT') return 'Build';
  if (cleanAction === 'SUBMIT' || cleanAction === 'SUBMITTED') return 'Submit';
  if (cleanAction === 'CANCEL' || cleanAction === 'CANCELLED' || cleanAction === 'CANCELED') return 'Cancel';
  if (cleanAction === 'GENERATE' || cleanAction === 'GENERATED') return 'Generate';
  if (cleanAction === 'SAVE' || cleanAction === 'SAVED') return 'Save';
  if (cleanAction === 'SYNC' || cleanAction === 'SYNCED' || cleanAction === 'SYNCHRONISE' || cleanAction === 'SYNCHRONIZE') return 'Sync';
  if (cleanAction === 'IGNORE' || cleanAction === 'IGNORED') return 'Ignore';
  if (cleanAction === 'OVERRIDE' || cleanAction === 'OVERRIDDEN') return 'Override';
  return 'Edit';
};

// Get all audit logs from localStorage
export const getAuditLogs = (page?: string): AuditLog[] => {
  try {
    const logs = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!logs) return [];
    
    const allLogs: AuditLog[] = JSON.parse(logs).map((log: any) => ({
      ...log,
      timestamp: new Date(log.timestamp)
    }));
    
    if (page) {
      return allLogs.filter(log => log.page.startsWith(page));
    }
    
    return allLogs;
  } catch (error) {
    console.error('Error reading audit logs:', error);
    return [];
  }
};

// Add a new audit log entry - supports both object and positional parameters
export function logAudit(params: {
  page: string;
  action: AuditAction;
  description: string;
  changes?: string;
}): void;
export function logAudit(
  page: string,
  action: AuditAction,
  description: string,
  changes?: string
): void;
export function logAudit(
  pageOrParams: string | { page: string; action: AuditAction; description: string; changes?: string },
  action?: AuditAction,
  description?: string,
  changes?: string
): void {
  try {
    const logs = getAuditLogs();
    
    // Handle both object and positional parameter syntax
    let page: string;
    let auditAction: AuditAction;
    let auditDescription: string;
    let auditChanges: string | undefined;
    
    if (typeof pageOrParams === 'object') {
      // Object syntax
      page = pageOrParams.page;
      auditAction = pageOrParams.action;
      auditDescription = pageOrParams.description;
      auditChanges = pageOrParams.changes;
    } else {
      // Positional parameters
      page = pageOrParams;
      auditAction = action!;
      auditDescription = description!;
      auditChanges = changes;
    }

    auditAction = normaliseAuditAction(auditAction);

    if (!shouldRecordAuditAction(page, auditAction)) {
      return;
    }
    
    const newLog: AuditLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user: getCurrentUser(),
      action: auditAction,
      description: auditDescription,
      changes: auditChanges,
      timestamp: new Date(),
      page
    };
    
    logs.push(newLog);
    
    // Keep only last 1000 logs to prevent storage overflow
    const trimmedLogs = logs.slice(-1000);
    
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(trimmedLogs));
  } catch (error) {
    console.error('Error logging audit entry:', error);
  }
}

// Clear all audit logs (admin function)
export const clearAuditLogs = (): void => {
  try {
    localStorage.removeItem(AUDIT_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing audit logs:', error);
  }
};

// Export audit logs as CSV
export const exportAuditLogsCSV = (page?: string): string => {
  const logs = getAuditLogs(page);
  
  const headers = ['Date', 'Time', 'User', 'Action', 'Description', 'Changes', 'Page'];
  const rows = logs.map(log => [
    log.timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }),
    log.timestamp.toLocaleTimeString(),
    log.user,
    log.action,
    log.description,
    log.changes || '',
    log.page
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
};
