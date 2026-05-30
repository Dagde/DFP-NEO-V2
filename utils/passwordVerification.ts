export const verifyCurrentUserPassword = async (password: string): Promise<boolean> => {
  const sessionToken = localStorage.getItem('dfp_session_token') || '';
  const response = await fetch('/api/auth/verify-password', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify({ password }),
  });

  const data = await response.json().catch(() => ({}));
  return response.ok && data.valid === true;
};
