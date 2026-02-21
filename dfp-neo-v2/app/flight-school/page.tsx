'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function FlightSchoolPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const authToken = searchParams.get('authToken');
      const userId = searchParams.get('userId');

      if (!authToken || !userId) {
        // No token provided, redirect to website login
        window.location.href = 'https://dfp-neo.com/login';
        return;
      }

      try {
        const response = await fetch(`/api/auth/validate-token?authToken=${encodeURIComponent(authToken)}&userId=${encodeURIComponent(userId)}`);
        const data = await response.json();

        if (data.valid) {
          // Token is valid, load the app
          setIsValid(true);
          // Store user data in localStorage for the iframe to access
          localStorage.setItem('authUser', JSON.stringify(data.user));
        } else {
          // Token is invalid, redirect to website login
          window.location.href = 'https://dfp-neo.com/login';
        }
      } catch (error) {
        console.error('Error validating token:', error);
        window.location.href = 'https://dfp-neo.com/login';
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
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