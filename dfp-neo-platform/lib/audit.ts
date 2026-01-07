import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditLogData {
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(data: AuditLogData) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType || 'system',
        entityId: data.entityId || null,
        changes: data.changes ? data.changes : undefined,
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
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (options.userId) {
    where.userId = options.userId;
  }

  if (options.action) {
    where.action = options.action;
  }

  if (options.entityType) {
    where.entityType = options.entityType;
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
        User: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
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