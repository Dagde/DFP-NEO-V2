import { getAppApiBase } from './externalDataControls';

export const LIVE_CHANGE_EVENT = 'neo-live-change';

const CLIENT_ID_KEY = 'neo_live_change_tab_client_id';
const FETCH_PATCH_FLAG = '__neoLiveChangeFetchPatched';

const getClientId = (): string => {
  try {
    const existing = window.sessionStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const next = `neo-client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(CLIENT_ID_KEY, next);
    return next;
  } catch {
    return `neo-client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
};

const isApiRequest = (input: RequestInfo | URL): boolean => {
  const value = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  return value.includes('/api/');
};

const patchFetchClientId = (clientId: string) => {
  const win = window as any;
  if (win[FETCH_PATCH_FLAG]) return;
  const originalFetch = window.fetch.bind(window);
  win[FETCH_PATCH_FLAG] = true;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!isMutation || !isApiRequest(input)) {
      return originalFetch(input, init);
    }
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('X-NEO-Client-Id', clientId);
    return originalFetch(input, { ...init, headers });
  };
};

export const initialiseLiveChangeBus = (): (() => void) => {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return () => {};
  const clientId = getClientId();
  patchFetchClientId(clientId);
  const source = new EventSource(`${getAppApiBase()}/live-changes?clientId=${encodeURIComponent(clientId)}`);
  source.onmessage = (event) => {
    try {
      const detail = JSON.parse(event.data);
      window.dispatchEvent(new CustomEvent(LIVE_CHANGE_EVENT, { detail }));
    } catch {
      // Ignore malformed live-change events.
    }
  };
  source.onerror = () => {
    // EventSource reconnects itself.
  };
  return () => source.close();
};
