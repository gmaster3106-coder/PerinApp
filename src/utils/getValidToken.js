import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/constants.js';

let refreshPromise = null;

function loadAuth() {
  try { return JSON.parse(localStorage.getItem('perin_auth') || 'null'); }
  catch { return null; }
}

function saveAuth(auth) {
  localStorage.setItem('perin_auth', JSON.stringify(auth));
}

export async function getValidToken() {
  const auth = loadAuth();
  if (!auth?.access_token) return null;

  // Check JWT expiry
  let isExpired = false;
  try {
    const payload = JSON.parse(atob(auth.access_token.split('.')[1]));
    isExpired = Date.now() > (payload.exp * 1000) - 60000;
  } catch {
    return auth.access_token; // can't decode — return as-is
  }

  if (!isExpired) return auth.access_token;
  if (!auth.refresh_token) return auth.access_token; // expired but no refresh — return old, worker will 401

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
        console.warn('Token refresh failed:', res.status);
        return auth.access_token;
      }

      const data = await res.json();
      if (!data.access_token) return auth.access_token;

      const updated = {
        ...auth,
        access_token: data.access_token,
        refresh_token: data.refresh_token || auth.refresh_token,
      };
      saveAuth(updated);
      return data.access_token;

    } catch (e) {
      console.warn('Token refresh error:', e);
      return auth.access_token; // network issue — return old token, don't throw
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
