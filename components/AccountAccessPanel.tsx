import React, { useEffect, useMemo, useState } from 'react';

type PersonType = 'staff' | 'trainee';

interface LinkedUser {
  id: string;
  userId: string;
  email: string | null;
  role: string;
  displayName: string;
  isActive: boolean | number;
  mustChangePassword: boolean | number;
  activationStatus?: string;
  activationExpiresAt?: string | null;
  activationSentAt?: string | null;
  activationUsedAt?: string | null;
  lastLoginAt?: string | null;
}

interface AccountPayload {
  personType: PersonType;
  person: {
    id: string;
    idNumber: number | string;
    name: string;
    rank?: string;
    unit?: string;
    course?: string;
    email?: string;
    userId?: string | null;
  };
  user: LinkedUser | null;
}

interface AccountAccessPanelProps {
  personType: PersonType;
  personId?: string | number | null;
  idNumber?: string | number | null;
  name: string;
  email?: string | null;
  canManage: boolean;
  activationDisabledReason?: string;
}

const statusBadgeClass = (status: string): string => {
  const clean = String(status || '').toUpperCase();
  if (clean === 'PENDING') return 'border-amber-500/40 bg-amber-900/30 text-amber-200';
  if (clean === 'USED') return 'border-green-500/40 bg-green-900/30 text-green-200';
  if (clean === 'EXPIRED') return 'border-red-500/40 bg-red-900/30 text-red-200';
  return 'border-gray-600/50 bg-gray-800/70 text-gray-300';
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = await response.json();
    return data?.message || data?.details || data?.error || fallback;
  } catch {
    return fallback;
  }
};

const AccountAccessPanel: React.FC<AccountAccessPanelProps> = ({
  personType,
  personId,
  idNumber,
  name,
  email,
  canManage,
  activationDisabledReason = '',
}) => {
  const [payload, setPayload] = useState<AccountPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const lookupId = useMemo(() => {
    const dbId = String(personId || '').trim();
    if (dbId) return dbId;
    return String(idNumber || '').trim();
  }, [personId, idNumber]);
  const hasSavedPerson = Boolean(lookupId) && Number(idNumber || 0) > 0;
  const hasEmail = Boolean(String(email || payload?.person?.email || '').trim());
  const sessionToken = typeof window !== 'undefined' ? window.localStorage.getItem('dfp_session_token') || '' : '';

  const loadAccount = async () => {
    if (!canManage || !hasSavedPerson || !sessionToken) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ personType, personId: lookupId });
      const response = await fetch(`/api/admin/direct-person-account?${params.toString()}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) throw new Error(await readErrorMessage(response, 'Failed to load account access details'));
      setPayload(await response.json());
    } catch (err: any) {
      setError(err?.message || 'Failed to load account access details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccount();
  }, [canManage, hasSavedPerson, lookupId, personType, sessionToken]);

  if (!canManage) return null;

  const createOrLinkAccount = async (): Promise<AccountPayload> => {
    const response = await fetch('/api/admin/direct-person-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ personType, personId: lookupId }),
    });
    if (!response.ok) throw new Error(await readErrorMessage(response, 'Failed to create or link login account'));
    const data = await response.json();
    setPayload(data);
    return data;
  };

  const handleCreateOrLink = async () => {
    setWorking(true);
    setMessage('');
    setError('');
    try {
      await createOrLinkAccount();
      setMessage('Login account is linked to this profile.');
    } catch (err: any) {
      setError(err?.message || 'Failed to create or link login account');
    } finally {
      setWorking(false);
    }
  };

  const handleSendActivation = async () => {
    if (activationDisabledReason) {
      setMessage('');
      setError(activationDisabledReason);
      return;
    }
    setWorking(true);
    setMessage('');
    setError('');
    try {
      const account = await createOrLinkAccount();
      const targetUserId = account.user?.userId;
      const personnelId = account.person?.idNumber || idNumber || '';
      if (!targetUserId) throw new Error('No linked login account is available for activation.');
      const response = await fetch('/api/admin/direct-issue-activation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ targetUserId, personnelId }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response, 'Failed to send activation email'));
      const data = await response.json();
      setPayload((current) => current ? { ...current, user: data.user } : current);
      setMessage(`Activation email sent to ${data.delivery?.email || account.user?.email || email}.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to send activation email');
    } finally {
      setWorking(false);
    }
  };

  const user = payload?.user || null;
  const activationStatus = String(user?.activationStatus || 'NONE').toUpperCase();

  return (
    <section className="rounded-lg border border-sky-700/40 bg-sky-950/20 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-white">Account Access</h4>
          <p className="mt-0.5 text-xs text-sky-200/70">Login and activation status for {name || 'this profile'}.</p>
        </div>
        {user && (
          <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(activationStatus)}`}>
            {activationStatus}
          </span>
        )}
      </div>

      {!hasSavedPerson ? (
        <p className="rounded border border-amber-600/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          Save this profile with a Personnel ID before creating a login.
        </p>
      ) : !hasEmail ? (
        <p className="rounded border border-amber-600/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          Add an email address and save the profile before issuing account access.
        </p>
      ) : loading ? (
        <p className="text-xs text-gray-400">Loading account access...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-gray-900/50 px-2 py-1.5">
              <span className="block text-gray-500">User ID</span>
              <span className="font-semibold text-white">{user?.userId || 'Not linked'}</span>
            </div>
            <div className="rounded bg-gray-900/50 px-2 py-1.5">
              <span className="block text-gray-500">Email</span>
              <span className="font-semibold text-white">{user?.email || payload?.person?.email || email}</span>
            </div>
            <div className="rounded bg-gray-900/50 px-2 py-1.5">
              <span className="block text-gray-500">Role</span>
              <span className="font-semibold text-white">{user?.role || 'N/A'}</span>
            </div>
            <div className="rounded bg-gray-900/50 px-2 py-1.5">
              <span className="block text-gray-500">Last Login</span>
              <span className="font-semibold text-white">{formatDateTime(user?.lastLoginAt)}</span>
            </div>
          </div>
          {user?.activationSentAt && (
            <p className="text-xs text-gray-400">
              Activation sent {formatDateTime(user.activationSentAt)}
              {user.activationExpiresAt ? `; expires ${formatDateTime(user.activationExpiresAt)}` : ''}.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCreateOrLink}
              disabled={working || Boolean(user)}
              className="rounded border border-sky-500/50 bg-sky-900/40 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-800/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {user ? 'Login Linked' : working ? 'Working...' : 'Create/Link Login'}
            </button>
            <button
              type="button"
              onClick={handleSendActivation}
              disabled={working || Boolean(activationDisabledReason)}
              title={activationDisabledReason || 'Send activation email'}
              className="rounded border border-green-500/50 bg-green-900/40 px-3 py-1.5 text-xs font-semibold text-green-100 hover:bg-green-800/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? 'Working...' : 'Send Activation Email'}
            </button>
            <button
              type="button"
              onClick={() => void loadAccount()}
              disabled={working || loading}
              className="rounded border border-gray-600 bg-gray-800/60 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-700/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </>
      )}

      {message && <p className="rounded border border-green-600/40 bg-green-950/30 px-3 py-2 text-xs text-green-200">{message}</p>}
      {error && <p className="rounded border border-red-600/40 bg-red-950/30 px-3 py-2 text-xs text-red-200">{error}</p>}
    </section>
  );
};

export default AccountAccessPanel;
