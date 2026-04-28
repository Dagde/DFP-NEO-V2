'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function FlightSchoolContent() {
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthentication = () => {
      // Check for user data in URL parameters (from website launch page)
      const userId = searchParams.get('userId');
      const username = searchParams.get('username');
      const firstName = searchParams.get('firstName');
      const lastName = searchParams.get('lastName');
      const email = searchParams.get('email');
      const role = searchParams.get('role');
      const isActive = searchParams.get('isActive');
      const token = searchParams.get('token');

      if (userId && username) {
        // Trust URL params from authenticated website session
        console.log('[SSO] Using URL params for authentication:', userId);

        const userData = {
          id: userId,
          userId: userId,
          username: username,
          firstName: firstName || '',
          lastName: lastName || '',
          displayName: (firstName && lastName) ? `${lastName}, ${firstName}` : username,
          email: email || null,
          role: role || 'USER',
          isActive: isActive !== 'false',
          mustChangePassword: false,
          permissionsRoleId: ''
        };

        // Store user data for the Vite app inside the iframe
        localStorage.setItem('dfp_sso_user', JSON.stringify(userData));
        localStorage.setItem('authUser', JSON.stringify(userData));
        if (token) {
          localStorage.setItem('dfp_session_token', token);
          localStorage.setItem('dfp_session_expires', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
        }

        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // Check for existing SSO user in localStorage
      const ssoUser = localStorage.getItem('dfp_sso_user');
      if (ssoUser) {
        try {
          const userData = JSON.parse(ssoUser);
          if (userData.userId) {
            console.log('[SSO] Using existing SSO user from localStorage:', userData.userId);
            setIsAuthenticated(true);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error('[SSO] Failed to parse SSO user:', e);
        }
      }

      // Check for existing authUser in localStorage
      const authUser = localStorage.getItem('authUser');
      if (authUser) {
        try {
          const userData = JSON.parse(authUser);
          if (userData.userId && userData.username) {
            console.log('[SSO] Using existing authUser from localStorage:', userData.userId);
            setIsAuthenticated(true);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error('[SSO] Failed to parse authUser:', e);
        }
      }

      // No valid session - redirect to website login
      console.log('[SSO] No valid session found, redirecting to login');
      setIsLoading(false);
      window.location.href = 'https://dfp-neo.com/login';
    };

    checkAuthentication();
  }, [searchParams]);

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