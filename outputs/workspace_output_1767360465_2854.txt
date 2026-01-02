import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Backup database client
const backupGlobal = globalThis as unknown as {
  backupPrisma: PrismaClient | undefined;
};

export const backupPrisma = backupGlobal.backupPrisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.BACKUP_DATABASE_URL,
    },
  },
});

if (process.env.NODE_ENV !== 'production') backupGlobal.backupPrisma = backupPrisma;