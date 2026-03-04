import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function PermissionsPage() {
  const roles = await prisma.permissionsRole.findMany({
    include: {
      capabilities: {
        include: {
          capability: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Permissions</h2>
        <p className="text-gray-400">View roles and their capabilities</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {roles.map((role) => (
          <div key={role.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">{role.name}</h3>
              <span className="px-3 py-1 text-xs font-medium rounded-md bg-purple-900/30 text-purple-400 border border-purple-700">
                {role.capabilities.length} capabilities
              </span>
            </div>

            {role.description && (
              <p className="text-sm text-gray-400 mb-4">{role.description}</p>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Capabilities:</h4>
              <div className="space-y-1">
                {role.capabilities.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No capabilities assigned</p>
                ) : (
                  role.capabilities.map((rc) => (
                    <div
                      key={rc.id}
                      className="flex items-center justify-between p-2 bg-gray-700/50 rounded"
                    >
                      <span className="text-sm text-white font-mono">
                        {rc.capability.key}
                      </span>
                      {rc.capability.description && (
                        <span className="text-xs text-gray-400 ml-2">
                          {rc.capability.description}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* All Capabilities Reference */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">All Capabilities Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from(
            new Set(
              roles.flatMap((r) => r.capabilities.map((c) => c.capability))
            )
          ).map((capability: any) => (
            <div
              key={capability.id}
              className="p-3 bg-gray-700/50 rounded"
            >
              <div className="font-mono text-sm text-blue-400 mb-1">
                {capability.key}
              </div>
              {capability.description && (
                <div className="text-xs text-gray-400">
                  {capability.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
