'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function FlightSchoolPage() {
  const router = useRouter();
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Log when component mounts
  useEffect(() => {
    console.log('[V2 SSO] FlightSchoolPage component mounted');
    console.log('[V2 SSO] Window location:', window.location.href);
  }, []);

  useEffect(() => {
    const validateUser = () => {
      console.log('[V2 SSO] FlightSchool page loaded');
      console.log('[V2 SSO] Current URL:', window.location.href);

      // First check URL params (direct SSO)
      const urlParams = new URLSearchParams(window.location.search);
      const urlUserId = urlParams.get('userId');
      const urlUsername = urlParams.get('username');

      // Then check localStorage (set by sso.html)
      const storedUser = localStorage.getItem('authUser');

      console.log('[V2 SSO] URL userId:', urlUserId);
      console.log('[V2 SSO] localStorage authUser:', storedUser);

      if (urlUserId && urlUsername) {
        // URL params present - store and proceed
        console.log('[V2 SSO] Using URL parameters');
        const userData = {
          userId: urlUserId,
          username: urlUsername,
          firstName: urlParams.get('firstName'),
          lastName: urlParams.get('lastName'),
          email: urlParams.get('email'),
          role: urlParams.get('role'),
          isActive: urlParams.get('isActive') === 'true'
        };
        localStorage.setItem('authUser', JSON.stringify(userData));
        setIsValid(true);
        setIsLoading(false);
      } else if (storedUser) {
        // localStorage has user data (set by sso.html)
        console.log('[V2 SSO] Using localStorage user data');
        try {
          const userData = JSON.parse(storedUser);
          if (userData.userId && userData.username) {
            console.log('[V2 SSO] Valid user found in localStorage:', userData.userId);
            setIsValid(true);
            setIsLoading(false);
          } else {
            console.error('[V2 SSO] Invalid user data in localStorage');
            window.location.href = 'https://dfp-neo.com/login';
          }
        } catch (e) {
          console.error('[V2 SSO] Failed to parse localStorage user data');
          window.location.href = 'https://dfp-neo.com/login';
        }
      } else {
        console.error('[V2 SSO] No user data found - redirecting to login');
        window.location.href = 'https://dfp-neo.com/login';
      }
    };

    validateUser();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-neutral-300 text-xl">Authenticating...</div>
      </div>
    );
  }

  if (!isValid) {
    return null; // Will redirect automatically
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