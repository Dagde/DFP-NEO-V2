import { Role } from '@prisma/client';

// In-memory session storage (for production, use Redis or database)
const sessions = new Map<string, { userId: string; user: any; expiresAt: number }>();

export interface SessionData {
  userId: string;
  user: {
    id: string;
    userId: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    role: Role;
    isActive: boolean;
  };
  expiresAt: number;
}

/**
 * Get session by token
 */
export function getSession(token: string): SessionData | undefined {
  return sessions.get(token);
}

/**
 * Set session
 */
export function setSession(token: string, sessionData: SessionData): void {
  sessions.set(token, sessionData);
}

/**
 * Delete session
 */
export function deleteSession(token: string): void {
  sessions.delete(token);
}

/**
 * Check if session is expired
 */
export function isSessionExpired(session: SessionData): boolean {
  return Date.now() > session.expiresAt;
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}

// Clean up expired sessions every hour
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
}

export { sessions };