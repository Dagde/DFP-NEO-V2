import React, { useEffect, useState } from 'react';
import { getAppApiBase } from '../utils/externalDataControls';

type EmailActivationSettingsState = {
  mode: 'customer_smtp' | 'no_email' | 'environment';
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpRequireTls: boolean;
  smtpRejectUnauthorized: boolean;
  smtpUsername: string;
  smtpPassword: string;
  smtpFrom: string;
  appUrl: string;
  activationExpiryHours: number;
  passwordConfigured: boolean;
};

const defaultSettings: EmailActivationSettingsState = {
  mode: 'customer_smtp',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpRequireTls: false,
  smtpRejectUnauthorized: true,
  smtpUsername: '',
  smtpPassword: '',
  smtpFrom: '',
  appUrl: 'https://app.dfp-neo.com',
  activationExpiryHours: 24,
  passwordConfigured: false,
};

const normaliseSettings = (settings: any): EmailActivationSettingsState => ({
  ...defaultSettings,
  ...settings,
  smtpPassword: '',
  smtpPort: Number(settings?.smtpPort || defaultSettings.smtpPort),
  activationExpiryHours: Number(settings?.activationExpiryHours || defaultSettings.activationExpiryHours),
  passwordConfigured: Boolean(settings?.passwordConfigured),
});

const authHeaders = () => {
  const sessionToken = localStorage.getItem('dfp_session_token') || '';
  return {
    'Content-Type': 'application/json',
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  };
};

interface EmailActivationSettingsProps {
  currentUserPermission: string;
  onShowSuccess?: (message: string) => void;
}

const EmailActivationSettings: React.FC<EmailActivationSettingsProps> = ({ currentUserPermission, onShowSuccess }) => {
  const [settings, setSettings] = useState<EmailActivationSettingsState>(defaultSettings);
  const [runtime, setRuntime] = useState<{ configured?: boolean; missing?: string[]; source?: string; mode?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [testRecipient, setTestRecipient] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const canEdit = ['Super Admin', 'Admin'].includes(currentUserPermission);

  const updateSetting = <K extends keyof EmailActivationSettingsState>(key: K, value: EmailActivationSettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setStatus('');
    setError('');
  };

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${getAppApiBase()}/admin/email-activation-settings`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Email settings could not be loaded.');
      setSettings(normaliseSettings(payload.settings || {}));
      setRuntime(payload.runtime || {});
      if (!testRecipient && payload.settings?.smtpFrom) {
        const match = String(payload.settings.smtpFrom).match(/<([^>]+)>/);
        setTestRecipient(match?.[1] || String(payload.settings.smtpFrom));
      }
    } catch (loadError) {
      setError((loadError as Error).message || 'Email settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const response = await fetch(`${getAppApiBase()}/admin/email-activation-settings`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({
          ...settings,
          smtpPassword: settings.smtpPassword,
          clearSmtpPassword: clearPassword,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Email settings could not be saved.');
      setSettings(normaliseSettings(payload.settings || settings));
      setRuntime(payload.runtime || {});
      setClearPassword(false);
      setStatus('Email and activation settings saved.');
      onShowSuccess?.('Email and activation settings saved.');
    } catch (saveError) {
      setError((saveError as Error).message || 'Email settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError('');
    setStatus('');
    try {
      const response = await fetch(`${getAppApiBase()}/admin/email-activation-settings/test`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ recipient: testRecipient }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'The test email could not be sent.');
      setStatus(`Test email sent to ${payload.recipient}.`);
      onShowSuccess?.(`Test email sent to ${payload.recipient}.`);
    } catch (testError) {
      setError((testError as Error).message || 'The test email could not be sent.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="rounded-lg border border-gray-700 bg-gray-800 p-5 text-sm text-gray-300">Loading email settings...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-cyan-500/30 bg-gray-800 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Email & Account Activation</h3>
            <p className="mt-1 text-sm text-gray-400">Connect DFP NEO to the customer-approved mail server used for account activation emails.</p>
          </div>
          <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${runtime.configured ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-200' : 'border-amber-500/50 bg-amber-950/30 text-amber-200'}`}>
            {runtime.configured ? 'Email Ready' : 'Email Not Ready'}
          </div>
        </div>
        {!runtime.configured && runtime.missing && runtime.missing.length > 0 && (
          <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
            Missing: {runtime.missing.join(', ')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <label className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <span className="block text-sm font-semibold text-gray-300">Activation Mode</span>
          <select
            value={settings.mode}
            disabled={!canEdit}
            onChange={event => updateSetting('mode', event.target.value as EmailActivationSettingsState['mode'])}
            className="mt-2 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-white"
          >
            <option value="customer_smtp">Customer SMTP</option>
            <option value="no_email">No Email</option>
            <option value="environment">Railway Environment Variables</option>
          </select>
        </label>
        <label className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <span className="block text-sm font-semibold text-gray-300">Activation Expiry</span>
          <input
            type="number"
            min={1}
            max={168}
            value={settings.activationExpiryHours}
            disabled={!canEdit}
            onChange={event => updateSetting('activationExpiryHours', Number(event.target.value))}
            className="mt-2 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-white"
          />
          <span className="mt-1 block text-xs text-gray-500">Hours before an activation code expires.</span>
        </label>
        <label className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <span className="block text-sm font-semibold text-gray-300">App Sign-in URL</span>
          <input
            value={settings.appUrl}
            disabled={!canEdit}
            onChange={event => updateSetting('appUrl', event.target.value)}
            className="mt-2 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-white"
          />
        </label>
      </div>

      {settings.mode === 'customer_smtp' && (
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-5">
          <h4 className="text-sm font-bold uppercase text-cyan-200">Customer SMTP Server</h4>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label>
              <span className="block text-sm font-semibold text-gray-300">SMTP Host</span>
              <input value={settings.smtpHost} disabled={!canEdit} onChange={event => updateSetting('smtpHost', event.target.value)} className="mt-2 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-white" />
            </label>
            <label>
              <span className="block text-sm font-semibold text-gray-300">From Address</span>
              <input value={settings.smtpFrom} disabled={!canEdit} onChange={event => updateSetting('smtpFrom', event.target.value)} placeholder="DFP NEO <no-reply@example.mil>" className="mt-2 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-white" />
            </label>
            <label>
              <span className="block text-sm font-semibold text-gray-300">Port</span>
              <input type="number" value={settings.smtpPort} disabled={!canEdit} onChange={event => updateSetting('smtpPort', Number(event.target.value))} className="mt-2 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-white" />
            </label>
            <label>
              <span className="block text-sm font-semibold text-gray-300">Username</span>
              <input value={settings.smtpUsername} disabled={!canEdit} onChange={event => updateSetting('smtpUsername', event.target.value)} className="mt-2 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-white" />
            </label>
            <label>
              <span className="block text-sm font-semibold text-gray-300">Password</span>
              <input type="password" value={settings.smtpPassword} disabled={!canEdit} onChange={event => updateSetting('smtpPassword', event.target.value)} placeholder={settings.passwordConfigured ? 'Saved password is configured' : 'SMTP password'} className="mt-2 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-white" />
            </label>
            <div className="grid grid-cols-1 gap-3 rounded-md border border-gray-700 bg-gray-900 p-3 text-sm text-gray-300">
              <label className="flex items-center gap-2"><input type="checkbox" checked={settings.smtpSecure} disabled={!canEdit} onChange={event => updateSetting('smtpSecure', event.target.checked)} /> Use SSL/TLS</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={settings.smtpRequireTls} disabled={!canEdit} onChange={event => updateSetting('smtpRequireTls', event.target.checked)} /> Require TLS</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={settings.smtpRejectUnauthorized} disabled={!canEdit} onChange={event => updateSetting('smtpRejectUnauthorized', event.target.checked)} /> Verify server certificate</label>
              {settings.passwordConfigured && (
                <label className="flex items-center gap-2 text-amber-200"><input type="checkbox" checked={clearPassword} disabled={!canEdit} onChange={event => setClearPassword(event.target.checked)} /> Clear saved password on Save</label>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-700 bg-gray-800 p-5">
        <h4 className="text-sm font-bold uppercase text-cyan-200">Test Email</h4>
        <div className="mt-3 flex flex-wrap gap-3">
          <input value={testRecipient} disabled={!canEdit} onChange={event => setTestRecipient(event.target.value)} placeholder="test.recipient@example.mil" className="min-w-[260px] flex-1 rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-white" />
          <button type="button" disabled={!canEdit || testing || !testRecipient.trim()} onClick={handleTest} className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-gray-600">
            {testing ? 'Sending...' : 'Send Test Email'}
          </button>
        </div>
      </div>

      {(status || error) && (
        <div className={`rounded-md border px-4 py-3 text-sm ${error ? 'border-red-500/50 bg-red-950/30 text-red-100' : 'border-emerald-500/50 bg-emerald-950/30 text-emerald-100'}`}>
          {error || status}
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" disabled={!canEdit || saving} onClick={handleSave} className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-600">
          {saving ? 'Saving...' : 'Save Email Settings'}
        </button>
      </div>
    </div>
  );
};

export default EmailActivationSettings;
