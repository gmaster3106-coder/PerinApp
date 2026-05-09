import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/constants.js';

let refreshPromise = null;

function loadAuth() {
  try { return JSON.parse(localStorage.getItem('perin_auth') || 'null'); }
  catch { return null; }
}

function saveAuth(auth) {
  localStorage.setItem('perin_auth', JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem('perin_auth');
}

export async function getValidToken() {
  const auth = loadAuth();
  if (!auth?.access_token) return null;

  // Check JWT expiry — refresh if within 5 minutes of expiry
  let isExpired = false;
  try {
    const payload = JSON.parse(atob(auth.access_token.split('.')[1]));
    isExpired = Date.now() > (payload.exp * 1000) - (5 * 60 * 1000);
  } catch {
    return auth.access_token;
  }

  if (!isExpired) return auth.access_token;
  if (!auth.refresh_token) {
    clearAuth();
    return null;
  }

  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ refresh_token: auth.refresh_token }),
      });

      if (!res.ok) {
        // Server rejected the refresh token — session is dead, clear it
        if (res.status === 400 || res.status === 401) {
          clearAuth();
          return null;
        }
        // Other error (5xx) — return old token optimistically
        return auth.access_token;
      }

      const data = await res.json();
      if (!data.access_token) {
        clearAuth();
        return null;
      }

      const updated = {
        ...auth,
        access_token: data.access_token,
        refresh_token: data.refresh_token || auth.refresh_token,
      };
      saveAuth(updated);
      return data.access_token;

    } catch {
      // Network error — return old token, don't clear
      return auth.access_token;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
