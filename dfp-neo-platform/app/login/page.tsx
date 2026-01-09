"use client";

import { useState } from "react";
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        userId,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid User ID or password');
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
    <form onSubmit={handleSubmit} className="h-screen w-screen bg-black overflow-hidden flex flex-col items-center justify-center relative">
      {/* LOGO */}
      <div className="absolute top-[80px]">
        <Image
          src="/images/logo.png"
          alt="DFP NEO"
          width={600}
          height={200}
          unoptimized
          className="w-[600px] max-w-[90vw] h-auto"
        />
      </div>

      {/* LOGIN AREA */}
      <div className="relative mt-[260px]">
        {/* USERNAME ROW */}
        <div className="flex items-center mb-[20px] relative top-[55px]">
          {/* Username label */}
          <Image
            src="/images/username.png"
            alt="Username"
            width={160}
            height={60}
            unoptimized
            className="w-[160px] mr-[20px] mt-[10px]"
          />

          {/* Plate + input (RIGHT 5px, UP 5px) */}
          <div className="relative w-[340px] h-[60px] left-[5px] -top-[5px]">
            {/* Plate image (still offset left 30px as before) */}
            <Image
              src="/images/plate.png"
              alt="Plate"
              width={340}
              height={60}
              unoptimized
              className="absolute inset-0 w-full h-full object-fill relative -left-[30px]"
            />

            {/* Invisible input */}
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="absolute inset-0 bg-transparent px-6 text-neutral-300 outline-none"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {/* PASSWORD ROW */}
        <div className="flex items-center">
          {/* Password label */}
          <Image
            src="/images/password.png"
            alt="Password"
            width={160}
            height={60}
            unoptimized
            className="w-[160px] mr-[20px] mt-[10px]"
          />

          {/* Plate + input (RIGHT 5px, UP 5px) */}
          <div className="relative w-[340px] h-[60px] left-[5px] -top-[5px]">
            {/* Plate image (still offset left 30px as before) */}
            <Image
              src="/images/plate.png"
              alt="Plate"
              width={340}
              height={60}
              unoptimized
              className="absolute inset-0 w-full h-full object-fill relative -left-[30px]"
            />

            {/* Invisible input */}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="absolute inset-0 bg-transparent px-6 text-neutral-300 outline-none tracking-wider"
              required
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute bottom-[100px] bg-red-900/30 border border-red-500 text-red-200 px-6 py-3 rounded-lg text-sm text-center max-w-xl mx-auto">
          {error}
        </div>
      )}

      {/* LOGIN BUTTON */}
      <div className="absolute bottom-[30px] scale-150">
        <button 
          type="submit"
          disabled={isLoading}
          className="w-[260px] h-[56px] rounded-full border border-white/20 text-white/70 tracking-[0.3em] uppercase text-sm hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Authenticating...' : 'Login'}
        </button>
      </div>
    </form>
  );
}