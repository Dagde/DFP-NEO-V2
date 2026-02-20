import React, { useState } from 'react';

// Auth server URL - use empty string to use relative URLs (proxied through Vite)
const AUTH_SERVER = '';

interface LoginModalProps {
  onLoginSuccess: (user: AuthUser, sessionToken: string) => void;
}

export interface AuthUser {
  id: string;
  userId: string;
  username: string;
  email: string | null;
  role: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  mustChangePassword: boolean;
  permissionsRoleId: string;
}

export async function checkSession(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${AUTH_SERVER}/api/auth/session`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

export async function loginUser(userId: string, password: string): Promise<{ user: AuthUser; sessionToken: string; mustChangePassword: boolean }> {
  const res = await fetch(`${AUTH_SERVER}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Login failed');
  return data;
}

export async function logoutUser(token: string): Promise<void> {
  try {
    await fetch(`${AUTH_SERVER}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  } catch {
    // Ignore errors on logout
  }
}

const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotUserId, setForgotUserId] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await loginUser(userId.trim(), password);
      // Store session token in localStorage
      localStorage.setItem('dfp_session_token', result.sessionToken);
      localStorage.setItem('dfp_session_expires', result.expires || '');
      onLoginSuccess(result.user, result.sessionToken);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage('');
    setForgotLoading(true);

    try {
      const res = await fetch(`${AUTH_SERVER}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: forgotUserId.trim() }),
      });
      const data = await res.json();
      setForgotMessage(data.message || 'If the account exists, a reset email has been sent.');
    } catch {
      setForgotMessage('An error occurred. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[400px] rounded-xl shadow-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3748 100%)' }}>
        
        {/* Header */}
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="flex items-center justify-center mb-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center mr-3">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">DFP-NEO</h1>
              <p className="text-xs text-gray-400">Daily Flying Program</p>
            </div>
          </div>
          <div className="border-t border-gray-600/50 mt-3 pt-3">
            <h2 className="text-sm font-semibold text-gray-300">
              {showForgotPassword ? 'Reset Password' : 'Sign In'}
            </h2>
          </div>
        </div>

        {/* Form */}
        <div className="px-8 pb-8">
          {!showForgotPassword ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                  User ID
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  placeholder="e.g. alexander.burns"
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-500 border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-500 border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/40 border border-red-700/50">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !userId || !password}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: loading ? '#3b82f6' : 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(true); setError(''); }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-xs text-gray-400 text-center">
                Enter your User ID and we'll send a reset link to your registered email.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                  User ID
                </label>
                <input
                  type="text"
                  value={forgotUserId}
                  onChange={e => setForgotUserId(e.target.value)}
                  placeholder="e.g. alexander.burns"
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-500 border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  autoFocus
                  disabled={forgotLoading}
                />
              </div>

              {forgotMessage && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-900/40 border border-green-700/50">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-green-300">{forgotMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={forgotLoading || !forgotUserId}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
              >
                {forgotLoading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(false); setForgotMessage(''); }}
                  className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-3 border-t border-gray-700/50 text-center">
          <p className="text-[10px] text-gray-600">DFP-NEO v2 • Authorised Users Only</p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;