import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditLogData {
  actorUserId?: string;
  actionType: string;
  targetUserId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(data: AuditLogData) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: data.actorUserId || null,
        actionType: data.actionType,
        targetUserId: data.targetUserId || null,
        metadata: data.metadata ? data.metadata : undefined,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the application
  }
}

export async function getAuditLogs(options: {
  actorUserId?: string;
  targetUserId?: string;
  actionType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (options.actorUserId) {
    where.actorUserId = options.actorUserId;
  }

  if (options.targetUserId) {
    where.targetUserId = options.targetUserId;
  }

  if (options.actionType) {
    where.actionType = options.actionType;
  }

  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      where.createdAt.gte = options.startDate;
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            userId: true,
            displayName: true,
          },
        },
        target: {
          select: {
            userId: true,
            displayName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options.limit || 50,
      skip: options.offset || 0,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}