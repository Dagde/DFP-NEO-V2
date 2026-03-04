'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Image from 'next/image';

const apps = [
  {
    id: 'flight-school',
    name: 'DFP-NEO',
    subtitle: 'Flight School Edition',
    description: 'Comprehensive Flight Training Scheduling and Training Management System (TMS)',
    image: '/images/trainer-aircraft.jpg',
    status: 'active',
    href: '/flight-school',
  },
  {
    id: 'reconnaissance',
    name: 'DFP-NEO', 
    subtitle: 'Reconnaissance Edition',
    description: 'Advanced reconnaissance mission planning and execution',
    image: '/images/p8-aircraft.jpg',
    status: 'active',
    href: 'https://dfp-neo-v2-production.up.railway.app',
  },
  {
    id: 'air-movements',
    name: 'DFP-NEO',
    subtitle: 'Air Movements Edition', 
    description: 'Strategic air transport and logistics management',
    image: '/images/c17-aircraft.jpg',
    status: 'coming-soon',
    href: '#',
  },
  {
    id: 'hybrid',
    name: 'DFP-NEO',
    subtitle: 'Hybrid Edition',
    description: 'Multi-role aviation operations platform',
    image: '/images/b300-aircraft.jpg', 
    status: 'coming-soon',
    href: '#',
  },
];

export default function SelectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-neutral-300 text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black overflow-hidden flex flex-col">
      {/* Header with Logo and User Info */}
      <div className="flex items-center justify-between p-8 relative z-10">
        <div className="flex items-center gap-4">
          <Image
            src="/images/logo.png"
            alt="DFP-NEO"
            width={400}
            height={160}
            unoptimized
            className="h-24 w-auto"
          />
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-neutral-400 text-sm">Welcome back,</p>
            <p className="text-neutral-200 font-semibold">{session?.user?.firstName && session?.user?.lastName ? `${session.user.firstName} ${session.user.lastName}` : session?.user?.userId}</p>
          </div>
          {session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'ADMIN' ? (
            <button
              onClick={() => router.push('/admin')}
              className="bg-gray-800/80 border border-gray-600 text-neutral-200 px-4 py-2 rounded text-sm hover:bg-gray-700/80 transition"
            >
              Admin Panel
            </button>
          ) : null}
          <button
            onClick={() => router.push('/api/auth/signout')}
            className="text-neutral-400 hover:text-neutral-200 transition-colors text-sm"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content - 2x2 Grid */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
          {apps.map((app, index) => (
            <button
              key={app.id}
              onClick={() => {
                if (app.status === 'active') {
                  router.push(app.href);
                }
              }}
              disabled={app.status !== 'active'}
              className={`relative group transition-all duration-300 ${
                app.status === 'active' 
                  ? 'hover:scale-105 cursor-pointer' 
                  : 'opacity-60 cursor-not-allowed'
              }`}
            >
              {/* Metal Plate Background */}
              <div className="relative bg-gradient-to-br from-gray-700 via-gray-600 to-gray-700 rounded-lg border-2 border-gray-500 shadow-xl p-5 h-full min-h-[280px] overflow-hidden"
                   style={{
                     backgroundImage: `
                       repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.03) 1px, rgba(255,255,255,0.03) 2px),
                       repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.1) 1px, rgba(0,0,0,0.1) 2px),
                       linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 25%, #2a2a2a 50%, #3a3a3a 75%, #4a4a4a 100%)
                     `,
                     backgroundSize: '200px 200px, 200px 200px, 100% 100%',
                     backgroundPosition: '0 0, 0 0, 0 0'
                   }}
              >
                {/* Corner Screws */}
                <div className="absolute top-3 left-3 w-4 h-4 rounded-full border-2 border-gray-400 shadow-inner"
                     style={{
                       background: 'radial-gradient(circle at 30% 30%, #8a8a8a, #4a4a4a, #2a2a2a)',
                       boxShadow: 'inset -1px -1px 2px rgba(0,0,0,0.5), 1px 1px 2px rgba(255,255,255,0.2)'
                     }}>
                  <div className="absolute inset-1 bg-gray-600 rounded-full" 
                       style={{
                         background: 'radial-gradient(circle at 40% 40%, #6a6a6a, #3a3a3a)'
                       }}>
                  </div>
                </div>
                <div className="absolute top-3 right-3 w-4 h-4 rounded-full border-2 border-gray-400 shadow-inner"
                     style={{
                       background: 'radial-gradient(circle at 30% 30%, #8a8a8a, #4a4a4a, #2a2a2a)',
                       boxShadow: 'inset -1px -1px 2px rgba(0,0,0,0.5), 1px 1px 2px rgba(255,255,255,0.2)'
                     }}>
                  <div className="absolute inset-1 bg-gray-600 rounded-full" 
                       style={{
                         background: 'radial-gradient(circle at 40% 40%, #6a6a6a, #3a3a3a)'
                       }}>
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 w-4 h-4 rounded-full border-2 border-gray-400 shadow-inner"
                     style={{
                       background: 'radial-gradient(circle at 30% 30%, #8a8a8a, #4a4a4a, #2a2a2a)',
                       boxShadow: 'inset -1px -1px 2px rgba(0,0,0,0.5), 1px 1px 2px rgba(255,255,255,0.2)'
                     }}>
                  <div className="absolute inset-1 bg-gray-600 rounded-full" 
                       style={{
                         background: 'radial-gradient(circle at 40% 40%, #6a6a6a, #3a3a3a)'
                       }}>
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full border-2 border-gray-400 shadow-inner"
                     style={{
                       background: 'radial-gradient(circle at 30% 30%, #8a8a8a, #4a4a4a, #2a2a2a)',
                       boxShadow: 'inset -1px -1px 2px rgba(0,0,0,0.5), 1px 1px 2px rgba(255,255,255,0.2)'
                     }}>
                  <div className="absolute inset-1 bg-gray-600 rounded-full" 
                       style={{
                         background: 'radial-gradient(circle at 40% 40%, #6a6a6a, #3a3a3a)'
                       }}>
                  </div>
                </div>

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col">
                  {/* Aircraft Image */}
                  <div className="relative h-36 mb-3 rounded overflow-hidden bg-gray-900/50">
                    <Image
                      src={app.image}
                      alt={app.subtitle}
                      fill
                      className="object-cover"
                      unoptimized
                      onError={(e) => {
                        // Fallback to placeholder if image not found
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjMWExYTFiIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iNTUiIGZpbGw9IiNjMGMwYzAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCI+QWlyY3JhZnQgSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=';
                      }}
                    />
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/20 to-transparent"></div>
                  </div>

                  {/* Text Content */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {/* DFP-NEO Title */}
                      <h3 className="text-2xl font-bold text-neutral-200 mb-1 tracking-wider">
                        {app.name}
                      </h3>
                      {/* Subtitle */}
                      <p className="text-lg text-neutral-400 mb-3 font-medium">
                        {app.subtitle}
                      </p>
                      {/* Description */}
                      <p className="text-neutral-500 text-xs mb-4 leading-tight">
                        {app.description}
                      </p>
                    </div>

                    {/* Status and Launch */}
                    <div className="flex items-center justify-between">
                      {app.status === 'active' ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-600">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-400 border border-yellow-600">
                          Coming Soon
                        </span>
                      )}
                      {app.status === 'active' && (
                        <span className="text-neutral-400 text-sm group-hover:text-neutral-300 transition-colors">
                          Click to launch →
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hover Effect */}
                {app.status === 'active' && (
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      
    </div>
  );
}