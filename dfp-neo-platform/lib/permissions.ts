import { PrismaClient, Role } from '@prisma/client';
import { auth } from './auth';

const prisma = new PrismaClient();

// Role-based capability mapping
const ROLE_CAPABILITIES: Record<Role, string[]> = {
  SUPER_ADMIN: [
    'launch:access',
    'admin:access_panel',
    'users:manage',
    'audit:read',
    'training:manage',
    'maintenance:edit',
    'developer:tools_access',
    'schedule:create',
    'schedule:edit',
    'schedule:delete',
    'personnel:manage',
    'aircraft:manage',
  ],
  ADMIN: [
    'launch:access',
    'admin:access_panel',
    'users:manage',
    'audit:read',
    'training:manage',
    'schedule:create',
    'schedule:edit',
    'schedule:delete',
    'personnel:manage',
    'aircraft:manage',
  ],
  PILOT: [
    'launch:access',
    'schedule:create',
    'schedule:edit',
    'schedule:delete',
  ],
  INSTRUCTOR: [
    'launch:access',
    'training:manage',
    'schedule:create',
    'schedule:edit',
    'personnel:manage',
  ],
  USER: [
    'launch:access',
  ],
};

/**
 * Get all capabilities for a user
 */
export async function getUserCapabilities(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return [];
  }

  return ROLE_CAPABILITIES[user.role] || [];
}

/**
 * Check if a user has a specific capability
 */
export async function hasCapability(userId: string, capabilityKey: string): Promise<boolean> {
  const capabilities = await getUserCapabilities(userId);
  return capabilities.includes(capabilityKey);
}

/**
 * Check if a user has any of the specified capabilities
 */
export async function hasAnyCapability(userId: string, capabilityKeys: string[]): Promise<boolean> {
  const capabilities = await getUserCapabilities(userId);
  return capabilityKeys.some((key) => capabilities.includes(key));
}

/**
 * Check if a user has all of the specified capabilities
 */
export async function hasAllCapabilities(userId: string, capabilityKeys: string[]): Promise<boolean> {
  const capabilities = await getUserCapabilities(userId);
  return capabilityKeys.every((key) => capabilities.includes(key));
}

/**
 * Get the current session user's capabilities
 */
export async function getCurrentUserCapabilities(): Promise<string[]> {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }
  return getUserCapabilities(session.user.id);
}

/**
 * Check if the current session user has a specific capability
 */
export async function currentUserHasCapability(capabilityKey: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) {
    return false;
  }
  return hasCapability(session.user.id, capabilityKey);
}

/**
 * Require a capability or throw an error
 */
export async function requireCapability(capabilityKey: string): Promise<void> {
  const hasPermission = await currentUserHasCapability(capabilityKey);
  if (!hasPermission) {
    throw new Error(`Missing required capability: ${capabilityKey}`);
  }
}

/**
 * Get user's role name
 */
export async function getUserRole(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  return user?.role || null;
}

/**
 * Check if user is an administrator
 */
export async function isAdministrator(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

/**
 * Check if current user is an administrator
 */
export async function currentUserIsAdministrator(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) {
    return false;
  }
  return isAdministrator(session.user.id);
}