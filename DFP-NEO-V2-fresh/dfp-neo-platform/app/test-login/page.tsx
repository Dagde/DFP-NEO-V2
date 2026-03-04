"use client";

import { useState } from "react";
import { signIn } from 'next-auth/react';

export default function TestLoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [result, setResult] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult("Processing...");

    try {
      console.log("Sending login request with:", { username, password });
      
      const signInResult = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      console.log("Sign in result:", signInResult);
      
      if (signInResult?.error) {
        setResult(`Error: ${signInResult.error}`);
      } else if (signInResult?.ok) {
        setResult("Success! Login worked.");
        // Redirect after successful login
        window.location.href = '/select';
      } else {
        setResult("Unknown result");
      }
    } catch (error) {
      console.error("Login error:", error);
      setResult(`Exception: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl mb-8">Test Login Page</h1>
      
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block mb-2">Username:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-2 text-black rounded"
            placeholder="admin"
          />
        </div>
        
        <div>
          <label className="block mb-2">Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 text-black rounded"
            placeholder="admin123"
          />
        </div>
        
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
        >
          Test Login
        </button>
        
        {result && (
          <div className="mt-4 p-4 bg-gray-800 rounded">
            <strong>Result:</strong> {result}
          </div>
        )}
      </form>
      
      <div className="mt-8 text-sm text-gray-400">
        <p>Test credentials:</p>
        <p>Username: admin</p>
        <p>Password: admin123</p>
      </div>
    </div>
  );
}