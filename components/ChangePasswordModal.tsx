import React, { useState } from 'react';

const AUTH_SERVER = 'http://localhost:3001';

interface ChangePasswordModalProps {
  sessionToken: string;
  userId: string;
  isMandatory?: boolean; // true = user must change password before accessing app
  onSuccess: () => void;
  onCancel?: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  sessionToken,
  userId,
  isMandatory = false,
  onSuccess,
  onCancel,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(pwd)) errors.push('At least one uppercase letter');
    if (!/[a-z]/.test(pwd)) errors.push('At least one lowercase letter');
    if (!/[0-9]/.test(pwd)) errors.push('At least one number');
    return errors;
  };

  const passwordErrors = newPassword ? validatePassword(newPassword) : [];
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const errors = validatePassword(newPassword);
    if (errors.length > 0) {
      setError('Password does not meet requirements');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${AUTH_SERVER}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to change password');

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[420px] rounded-xl shadow-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1f2e 0%, #2d3748 100%)' }}>
        
        {/* Header */}
        <div className="px-8 pt-6 pb-4 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-600/20 border border-amber-600/40 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Change Password</h2>
              <p className="text-xs text-gray-400">{userId}</p>
            </div>
          </div>
          {isMandatory && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-amber-900/30 border border-amber-700/40">
              <p className="text-xs text-amber-300">
                ⚠️ You must change your password before accessing the application.
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="px-8 py-6">
          {success ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-600/20 border border-green-600/40 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-green-300 font-medium">Password changed successfully!</p>
              <p className="text-xs text-gray-400 mt-1">Redirecting...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-500 border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-500 border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  autoComplete="new-password"
                  disabled={loading}
                />
                {/* Password requirements */}
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    {[
                      { check: newPassword.length >= 8, label: 'At least 8 characters' },
                      { check: /[A-Z]/.test(newPassword), label: 'Uppercase letter' },
                      { check: /[a-z]/.test(newPassword), label: 'Lowercase letter' },
                      { check: /[0-9]/.test(newPassword), label: 'Number' },
                    ].map(({ check, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <svg className={`w-3 h-3 ${check ? 'text-green-400' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
                          {check ? (
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          ) : (
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          )}
                        </svg>
                        <span className={`text-[10px] ${check ? 'text-green-400' : 'text-gray-500'}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className={`w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-500 border focus:outline-none focus:ring-1 ${
                    confirmPassword && !passwordsMatch 
                      ? 'border-red-600 focus:border-red-500 focus:ring-red-500' 
                      : confirmPassword && passwordsMatch
                      ? 'border-green-600 focus:border-green-500 focus:ring-green-500'
                      : 'border-gray-600 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  autoComplete="new-password"
                  disabled={loading}
                />
                {confirmPassword && !passwordsMatch && (
                  <p className="text-[10px] text-red-400 mt-1">Passwords do not match</p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/40 border border-red-700/50">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {!isMandatory && onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-300 border border-gray-600 hover:border-gray-500 hover:text-white transition-colors"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || !currentPassword || !newPassword || !confirmPassword || !passwordsMatch || passwordErrors.length > 0}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                >
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;