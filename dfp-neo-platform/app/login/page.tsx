'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid username or password');
        setIsLoading(false);
        return;
      }

      router.push('/select');
    } catch (error) {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-radial from-gray-900 via-black to-black opacity-50" />
      
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center mb-12 reflection-effect">
          <Image
            src="/images/logo.png"
            alt="DFP-NEO Logo"
            width={500}
            height={200}
            priority
            className="w-full max-w-lg"
          />
        </div>

        {/* Login Form */}
        <div className="metal-plate">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div className="space-y-3">
              <div className="flex justify-center">
                <Image
                  src="/images/username.png"
                  alt="Username"
                  width={400}
                  height={80}
                  className="w-full max-w-sm"
                />
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="metal-input w-full"
                  placeholder="Enter your username"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-3">
              <div className="flex justify-center">
                <Image
                  src="/images/password.png"
                  alt="Password"
                  width={400}
                  height={80}
                  className="w-full max-w-sm"
                />
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="metal-input w-full"
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="metal-button w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Authenticating...' : 'Access System'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>DFP-NEO Platform v1.0</p>
            <p className="mt-1">Secure Access Required</p>
          </div>
        </div>

        {/* Support Contact */}
        <div className="mt-6 text-center text-gray-600 text-sm">
          <p>Need assistance? Contact <a href="mailto:support@dfp-neo.com" className="text-neo-silver hover:text-white transition-colors">support@dfp-neo.com</a></p>
        </div>
      </div>
    </div>
  );
}