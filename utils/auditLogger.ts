// Audit logging utility

import { AuditLog, AuditAction } from '../types/audit';

const AUDIT_STORAGE_KEY = 'dfp_audit_logs';

// Current user - set by the application
let currentUser: string = 'Unknown User';

export const setCurrentUser = (user: string) => {
    currentUser = user;
};

// Set current user (called by App.tsx on initialization)
export const setCurrentUser = (user: string): void => {
  currentUser = user;
};

// Get current user
const getCurrentUser = (): string => {
  return currentUser;
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
    log.timestamp.toLocaleDateString(),
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