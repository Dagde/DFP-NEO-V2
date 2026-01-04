import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import { UsersList } from './UsersList';

const prisma = new PrismaClient();

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { search?: string; role?: string; status?: string };
}) {
  const search = searchParams.search || '';
  const roleFilter = searchParams.role || '';
  const statusFilter = searchParams.status || '';

  // Build where clause
  const where: any = {};

  if (search) {
    where.OR = [
      { userId: { contains: search, mode: 'insensitive' } },
      { displayName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (roleFilter) {
    where.permissionsRole = { name: roleFilter };
  }

  if (statusFilter) {
    where.status = statusFilter;
  }

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        permissionsRole: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.permissionsRole.findMany({
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Users</h2>
          <p className="text-gray-400">Manage user accounts and permissions</p>
        </div>
        <Link
          href="/admin/users/create"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Create User</span>
        </Link>
      </div>

      <UsersList 
        users={users} 
        roles={roles}
        initialSearch={search}
        initialRole={roleFilter}
        initialStatus={statusFilter}
      />
    </div>
  );
}
