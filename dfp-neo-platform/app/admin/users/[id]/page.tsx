import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';
import { EditUserForm } from './EditUserForm';

const prisma = new PrismaClient();

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const [user, roles] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.id },
      include: {
        permissionsRole: true,
      },
    }),
    prisma.permissionsRole.findMany({
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!user) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Edit User</h2>
        <p className="text-gray-400">Manage user account and permissions</p>
      </div>

      <EditUserForm user={user} roles={roles} />
    </div>
  );
}
