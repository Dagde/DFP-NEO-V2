import { prisma, backupPrisma } from './prisma';

export class BackupSystem {
  private static instance: BackupSystem;
  private isBackupMode = false;

  private constructor() {}

  static getInstance(): BackupSystem {
    if (!BackupSystem.instance) {
      BackupSystem.instance = new BackupSystem();
    }
    return BackupSystem.instance;
  }

  // Check if primary database is available
  async checkPrimaryHealth(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Primary database health check failed:', error);
      return false;
    }
  }

  // Check if backup database is available
  async checkBackupHealth(): Promise<boolean> {
    try {
      await backupPrisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Backup database health check failed:', error);
      return false;
    }
  }

  // Get active database client
  async getActiveClient() {
    const primaryHealthy = await this.checkPrimaryHealth();
    
    if (primaryHealthy) {
      this.isBackupMode = false;
      return prisma;
    }

    const backupHealthy = await this.checkBackupHealth();
    if (backupHealthy) {
      this.isBackupMode = true;
      console.warn('Using backup database - primary is unavailable');
      return backupPrisma;
    }

    throw new Error('Both primary and backup databases are unavailable');
  }

  // Sync data from primary to backup
  async syncToBackup() {
    try {
      // Get all users
      const users = await prisma.user.findMany();
      const schedules = await prisma.schedule.findMany();
      const settings = await prisma.userSettings.findMany();

      // Sync to backup
      for (const user of users) {
        await backupPrisma.user.upsert({
          where: { id: user.id },
          update: user,
          create: user,
        });
      }

      for (const schedule of schedules) {
        await backupPrisma.schedule.upsert({
          where: { id: schedule.id },
          update: {
            userId: schedule.userId,
            date: schedule.date,
            data: schedule.data as any,
            version: schedule.version,
            updatedAt: schedule.updatedAt,
          },
          create: schedule as any,
        });
      }

      for (const setting of settings) {
        await backupPrisma.userSettings.upsert({
          where: { id: setting.id },
          update: setting as any,
          create: setting as any,
        });
      }

      console.log('Backup sync completed successfully');
      return true;
    } catch (error) {
      console.error('Backup sync failed:', error);
      return false;
    }
  }

  // Create a point-in-time backup
  async createBackupSnapshot(userId?: string) {
    try {
      const data = {
        users: await prisma.user.findMany(),
        schedules: userId 
          ? await prisma.schedule.findMany({ where: { userId } })
          : await prisma.schedule.findMany(),
        settings: userId
          ? await prisma.userSettings.findMany({ where: { userId } })
          : await prisma.userSettings.findMany(),
      };

      await prisma.dataBackup.create({
        data: {
          type: 'full',
          data: data as any,
          userId,
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to create backup snapshot:', error);
      return false;
    }
  }

  isUsingBackup(): boolean {
    return this.isBackupMode;
  }
}

export const backupSystem = BackupSystem.getInstance();