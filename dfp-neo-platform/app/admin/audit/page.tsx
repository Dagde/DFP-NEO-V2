import { PrismaClient } from '@prisma/client';
import { AuditLogsList } from './AuditLogsList';

const prisma = new PrismaClient();

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    actionType?: string; 
    userId?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const actionTypeFilter = params.actionType || '';
  const userIdFilter = params.userId || '';
  const page = parseInt(params.page || '1');
  const pageSize = 50;

  const where: any = {};

  if (actionTypeFilter) {
    where.actionType = actionTypeFilter;
  }

  if (userIdFilter) {
    where.OR = [
      { actor: { userId: { contains: userIdFilter } } },
      { target: { userId: { contains: userIdFilter } } },
    ];
  }

  const [logs, total, actionTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { userId: true, displayName: true } },
        target: { select: { userId: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      select: { actionType: true },
      distinct: ['actionType'],
      orderBy: { actionType: 'asc' },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Audit Logs</h2>
        <p className="text-gray-400">Review system activity and security events</p>
      </div>

      <AuditLogsList
        logs={logs}
        actionTypes={actionTypes.map(at => at.actionType)}
        total={total}
        currentPage={page}
        totalPages={totalPages}
        initialActionType={actionTypeFilter}
        initialUserId={userIdFilter}
      />
    </div>
  );
}
