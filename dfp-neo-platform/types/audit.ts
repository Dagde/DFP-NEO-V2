// Audit-related TypeScript interfaces

export type AuditAction = 'View' | 'Edit' | 'Add' | 'Delete' | 'Archive' | 'Restore' | 'Sign';

export interface AuditLog {
  id: string;
  user: string;
  action: AuditAction;
  description: string;
  changes?: string;
  timestamp: Date;
  page: string;
}

export interface AuditLogEntry {
  id: string;
  user: string;
  action: AuditAction;
  description: string;
  changes?: string;
  date: string;
  time: string;
  page: string;
}