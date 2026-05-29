/**
 * User Preferences Service
 * Saves and loads per-user UI preferences to/from the database via /api/user-preferences.
 * This ensures layout preferences persist across all devices, sessions, and restarts.
 */

const getApiBase = (): string => {
  return '/api';
};

/**
 * Load all preferences for a user.
 * Returns an empty object if no preferences are stored yet.
 */
export const loadUserPreferences = async (userId: string): Promise<Record<string, any>> => {
  if (!userId) return {};
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/user-preferences?userId=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      console.warn('[UserPrefs] Failed to load preferences:', res.status);
      return {};
    }
    const json = await res.json();
    return json.preferences ?? {};
  } catch (err) {
    console.warn('[UserPrefs] Error loading preferences:', err);
    return {};
  }
};

/**
 * Save a single preference key/value for a user.
 * The value is stored under `key` in the user's preferences JSON blob.
 */
export const saveUserPreference = async (
  userId: string,
  key: string,
  value: any
): Promise<boolean> => {
  if (!userId || !key) return false;
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/user-preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, key, value }),
    });
    if (!res.ok) {
      console.warn('[UserPrefs] Failed to save preference:', res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[UserPrefs] Error saving preference:', err);
    return false;
  }
};
