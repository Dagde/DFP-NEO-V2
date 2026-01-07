import { PrismaClient } from '@prisma/client';
import { auth } from './auth';

const prisma = new PrismaClient();

/**
 * Get all capabilities for a user
 */
export async function getUserCapabilities(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      permissionsRole: {
        include: {
          capabilities: {
            include: {
              capability: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return [];
  }

  return user.permissionsRole.capabilities.map((rc) => rc.capability.key);
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
    include: {
      permissionsRole: true,
    },
  });

  return user?.permissionsRole.name || null;
}

/**
 * Check if user is an administrator
 */
export async function isAdministrator(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === 'Administrator';
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