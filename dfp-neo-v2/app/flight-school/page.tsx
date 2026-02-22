'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function FlightSchoolPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateUser = () => {
      const userId = searchParams.get('userId');
      const username = searchParams.get('username');
      const firstName = searchParams.get('firstName');
      const lastName = searchParams.get('lastName');
      const email = searchParams.get('email');
      const role = searchParams.get('role');
      const isActive = searchParams.get('isActive');

      if (!userId || !username) {
        // No user data provided, redirect to website login
        window.location.href = 'https://dfp-neo.com/login';
        return;
      }

      try {
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
        
        setIsValid(true);
        // Store user data in localStorage for the iframe to access
        localStorage.setItem('authUser', JSON.stringify(userData));
      } catch (error) {
        console.error('Error processing user data:', error);
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