import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { createAuditLog } from './audit';

const prisma = new PrismaClient();

// Common weak passwords to block
const COMMON_PASSWORDS = [
  'password', 'Password123', '12345678', 'qwerty', 'abc123',
  'password1', 'Password1', '123456789', 'letmein', 'welcome',
];

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  if (COMMON_PASSWORDS.includes(password)) {
    errors.push('Password is too common, please choose a stronger password');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a secure random token
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token for storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create an invite token for a user
 */
export async function createInviteToken(userId: string, expiresInHours: number = 72): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  await prisma.inviteToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  await createAuditLog({
    actionType: 'invite_token_created',
    targetUserId: userId,
    metadata: {
      expiresAt: expiresAt.toISOString(),
    },
  });

  return token;
}

/**
 * Validate and use an invite token
 */
export async function validateInviteToken(token: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const tokenHash = hashToken(token);

  const inviteToken = await prisma.inviteToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!inviteToken) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  if (inviteToken.usedAt) {
    return { valid: false, error: 'Token has already been used' };
  }

  if (inviteToken.expiresAt < new Date()) {
    return { valid: false, error: 'Token has expired' };
  }

  return { valid: true, userId: inviteToken.userId };
}

/**
 * Mark an invite token as used
 */
export async function markInviteTokenUsed(token: string): Promise<void> {
  const tokenHash = hashToken(token);

  await prisma.inviteToken.update({
    where: { tokenHash },
    data: { usedAt: new Date() },
  });
}

/**
 * Create a password reset token
 */
export async function createPasswordResetToken(userId: string, expiresInMinutes: number = 30): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  await createAuditLog({
    actionType: 'password_reset_token_created',
    targetUserId: userId,
    metadata: {
      expiresAt: expiresAt.toISOString(),
    },
  });

  return token;
}

/**
 * Validate and use a password reset token
 */
export async function validatePasswordResetToken(token: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const tokenHash = hashToken(token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetToken) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  if (resetToken.usedAt) {
    return { valid: false, error: 'Token has already been used' };
  }

  if (resetToken.expiresAt < new Date()) {
    return { valid: false, error: 'Token has expired' };
  }

  return { valid: true, userId: resetToken.userId };
}

/**
 * Mark a password reset token as used
 */
export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  const tokenHash = hashToken(token);

  await prisma.passwordResetToken.update({
    where: { tokenHash },
    data: { usedAt: new Date() },
  });
}

/**
 * Change a user's password
 */
export async function changeUserPassword(
  userId: string,
  newPassword: string,
  actorUserId?: string
): Promise<{ success: boolean; errors?: string[] }> {
  // Validate password
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  // Hash password
  const passwordHash = await hashPassword(newPassword);

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordSetAt: new Date(),
      mustChangePassword: false,
    },
  });

  // Revoke all existing sessions for this user
  await prisma.session.deleteMany({
    where: { userId },
  });

  // Log the password change
  await createAuditLog({
    actionType: 'password_changed',
    actorUserId: actorUserId || userId,
    targetUserId: userId,
    metadata: {
      selfChange: actorUserId === userId || !actorUserId,
    },
  });

  return { success: true };
}

/**
 * Set a temporary password for a user
 */
export async function setTemporaryPassword(
  userId: string,
  temporaryPassword: string,
  actorUserId: string
): Promise<{ success: boolean; errors?: string[] }> {
  // Validate password
  const validation = validatePassword(temporaryPassword);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  // Hash password
  const passwordHash = await hashPassword(temporaryPassword);

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordSetAt: new Date(),
      mustChangePassword: true, // Force change on next login
    },
  });

  // Log the action
  await createAuditLog({
    actionType: 'temporary_password_set',
    actorUserId,
    targetUserId: userId,
  });

  return { success: true };
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllUserSessions(userId: string, actorUserId?: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });

  await createAuditLog({
    actionType: 'sessions_revoked',
    actorUserId: actorUserId || userId,
    targetUserId: userId,
  });
}