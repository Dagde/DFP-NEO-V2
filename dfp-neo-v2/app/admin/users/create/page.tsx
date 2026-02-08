import { CreateUserForm } from './CreateUserForm';

const roles = ['SUPER_ADMIN', 'ADMIN', 'PILOT', 'INSTRUCTOR', 'USER'];

export default async function CreateUserPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Create User</h2>
        <p className="text-gray-400">Add a new user to the system</p>
      </div>

      <CreateUserForm roles={roles} />
    </div>
  );
}
