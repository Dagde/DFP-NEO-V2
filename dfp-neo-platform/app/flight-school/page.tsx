'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function FlightSchoolPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    console.log('FlightSchool Page - Session status:', status);
    console.log('FlightSchool Page - Session data:', session);
    
    if (status === 'unauthenticated') {
      console.log('User is unauthenticated, redirecting to login');
      router.push('/login');
    }
  }, [status, router, session]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-neo-chrome text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    console.log('No session data available');
    return null;
  }

  console.log('User is authenticated, loading flight school app');
  
  return (
    <div className="min-h-screen bg-black">
      <iframe
        src="/flight-school-app/index-v2.html"
        className="w-full h-screen border-0"
        title="DFP-NEO Flight School"
      />
    </div>
  );
}