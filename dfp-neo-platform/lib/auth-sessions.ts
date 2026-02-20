/**
 * Shared in-memory session store for direct auth routes
 * Note: In serverless/multi-instance environments, sessions won't persist between instances
 * For production scalability, replace with Redis or database-backed sessions
 */

interface SessionData {
  userId: string;
  expires: string;
  user: {
    id: string;
    userId: string;
    username: string;
    email: string | null;
    role: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string;
    mustChangePassword: boolean;
    permissionsRoleId: string | null;
  };
}

// Global session store (persists within a single server instance)
const globalForSessions = globalThis as unknown as {
  authSessions: Map<string, SessionData> | undefined;
};

export const authSessions: Map<string, SessionData> =
  globalForSessions.authSessions ?? new Map<string, SessionData>();

if (process.env.NODE_ENV !== 'production') {
  globalForSessions.authSessions = authSessions;
}

export type { SessionData };