import { useCallback } from 'react';
import { WORKER_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/constants.js';
import { useApp } from '../context/AppContext.jsx';

function storeAuth(data, email) {
  const token     = data.access_token  || data.token || '';
  const refresh   = data.refresh_token || '';
  const id        = data.user?.id      || data.id    || '';
  const userEmail = data.user?.email   || data.email || email || '';
  const obj = { id, email: userEmail, access_token: token, refresh_token: refresh };
  localStorage.setItem('perin_auth', JSON.stringify(obj));
  return obj;
}

// Pull saved profile/languages/vocab from Supabase after login
async function pullCloudData(user, dispatch) {
  if (!user?.access_token || !user?.id) return;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=profile_data,languages_data,vocab_data,completed_data`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${user.access_token}`,
        },
      }
    );
    if (!res.ok) return;
    const rows = await res.json();
    const row = rows?.[0];
    if (!row) return;

    if (row.profile_data && typeof row.profile_data === 'object') {
      dispatch({ type: 'SET_PROFILE', payload: row.profile_data });
    }
    if (Array.isArray(row.languages_data) && row.languages_data.length > 0) {
      dispatch({ type: 'SET_LANGUAGES', payload: row.languages_data });
      dispatch({ type: 'SET_ACTIVE_LANG', payload: row.languages_data[0] });
    }
    if (Array.isArray(row.vocab_data) && row.vocab_data.length > 0) {
      dispatch({ type: 'SET_VOCAB', payload: row.vocab_data });
      localStorage.setItem('perin_vocab', JSON.stringify(row.vocab_data));
    }
    if (row.completed_data && typeof row.completed_data === 'object') {
      localStorage.setItem('perin_completed', JSON.stringify(row.completed_data));
    }
  } catch { /* silent — cloud pull is best-effort */ }
}

export function useAuth() {
  const { dispatch, fetchSubscription } = useApp();

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${WORKER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.msg || 'Login failed');
    if (!data.access_token) throw new Error('No access token received');
    const user = storeAuth(data, email);
    dispatch({ type: 'SET_USER', payload: user });
    fetchSubscription(user);
    await pullCloudData(user, dispatch);
    return user;
  }, [dispatch, fetchSubscription]);

  const signup = useCallback(async (email, password) => {
    const res = await fetch(`${WORKER_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.msg || 'Signup failed');
    if (!data.access_token) {
      if (data.user || data.id) throw new Error('CONFIRM_EMAIL');
      throw new Error('Signup failed — please try again.');
    }
    const user = storeAuth(data, email);
    dispatch({ type: 'SET_USER', payload: user });
    fetchSubscription(user);
    return user;
  }, [dispatch, fetchSubscription]);

  const logout = useCallback(() => {
    localStorage.removeItem('perin_auth');
    dispatch({ type: 'SET_USER', payload: null });
    dispatch({ type: 'SET_SUBSCRIPTION', payload: { status: 'free', conversations_used: 0 } });
  }, [dispatch]);

  const refreshToken = useCallback(async (user) => {
    if (!user?.refresh_token) return null;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: user.refresh_token }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const updated = storeAuth(data, user.email);
      dispatch({ type: 'SET_USER', payload: updated });
      return updated;
    } catch { return null; }
  }, [dispatch]);

  const resetPassword = useCallback(async (email) => {
    const res = await fetch(`${WORKER_URL}/api/auth/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error('Reset failed');
  }, []);

  return { login, signup, logout, refreshToken, resetPassword };
}
