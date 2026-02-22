'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function FlightSchoolPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Log when component mounts
  useEffect(() => {
    console.log('[V2 SSO] FlightSchoolPage component mounted');
    console.log('[V2 SSO] Window location:', window.location.href);
  }, []);

  useEffect(() => {
    const validateUser = () => {
      console.log('[V2 SSO] Page loaded, starting validation');
      console.log('[V2 SSO] Current URL:', window.location.href);
      
      const userId = searchParams.get('userId');
      const username = searchParams.get('username');
      const firstName = searchParams.get('firstName');
      const lastName = searchParams.get('lastName');
      const email = searchParams.get('email');
      const role = searchParams.get('role');
      const isActive = searchParams.get('isActive');

      console.log('[V2 SSO] URL Parameters:', {
        userId,
        username,
        firstName,
        lastName,
        email,
        role,
        isActive
      });

      if (!userId || !username) {
        console.error('[V2 SSO] Missing required parameters - userId or username is null');
        console.error('[V2 SSO] Redirecting to login page');
        // No user data provided, redirect to website login
        window.location.href = 'https://dfp-neo.com/login';
        return;
      }

      try {
        console.log('[V2 SSO] User data validated, creating user object');
        // User data is provided, load the app
        const userData = {
          userId,
          username,
          firstName,
          lastName,
          email,
          role,
          isActive: isActive === 'true'
        };
        
        console.log('[V2 SSO] User object created:', userData);
        console.log('[V2 SSO] Storing in localStorage');
        
        setIsValid(true);
        // Store user data in localStorage for the iframe to access
        localStorage.setItem('authUser', JSON.stringify(userData));
        
        console.log('[V2 SSO] User data stored successfully, loading app');
      } catch (error) {
        console.error('[V2 SSO] Error processing user data:', error);
        console.error('[V2 SSO] Redirecting to login page due to error');
        window.location.href = 'https://dfp-neo.com/login';
      } finally {
        setIsLoading(false);
      }
    };

    validateUser();
  }, [searchParams]);

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