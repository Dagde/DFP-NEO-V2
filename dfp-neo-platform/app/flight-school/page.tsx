'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function FlightSchoolContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthentication = async () => {
      // Check for token in URL parameters (from launch page)
      const token = searchParams.get('token');
      const userId = searchParams.get('userId');

      if (token && userId) {
        // Store session from launch page
        localStorage.setItem('dfp_session', JSON.stringify({
          token,
          user: { userId },
        }));

        // Validate session with backend
        try {
          const response = await fetch('/api/auth/direct-session', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            // Store full user data
            localStorage.setItem('dfp_session', JSON.stringify({
              token,
              user: data.user,
            }));
            setIsAuthenticated(true);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error('Session validation failed:', error);
        }
      }

      // Check for existing session in localStorage
      const sessionData = localStorage.getItem('dfp_session');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        try {
          const response = await fetch('/api/auth/direct-session', {
            headers: {
              'Authorization': `Bearer ${session.token}`,
            },
          });

          if (response.ok) {
            setIsAuthenticated(true);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error('Session validation failed:', error);
        }
      }

      // No valid session - redirect to login
      setIsLoading(false);
      router.push('/login');
    };

    checkAuthentication();
  }, [searchParams, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Authentication required. Redirecting...</div>
      </div>
    );
  }

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

export default function FlightSchoolPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <FlightSchoolContent />
    </Suspense>
  );
}