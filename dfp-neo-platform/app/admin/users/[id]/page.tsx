import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';
import { EditUserForm } from './EditUserForm';

const prisma = new PrismaClient();

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    notFound();
  }

  const roles = ['SUPER_ADMIN', 'ADMIN', 'PILOT', 'INSTRUCTOR', 'USER'];

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
