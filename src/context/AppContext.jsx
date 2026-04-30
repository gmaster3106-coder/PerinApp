import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { getItem, setItem } from '../utils/storage.js';
import { WORKER_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/constants.js';

const AppContext = createContext(null);

const DEFAULT_PROFILE = {
  name: '', native: 'English', avatar: '🧑', xp: 0, sessions: 0,
  streak: 0, lastDate: '', badges: [], streakFreezes: 0,
  motivation: '', milestones: [],
};

function todayStr() {
  return new Date().toDateString();
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, currentUser: action.payload };
    case 'SET_SUBSCRIPTION':
      return { ...state, subscription: action.payload };
    case 'SET_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.payload } };
    case 'SET_LANGUAGES':
      return { ...state, languages: action.payload };
    case 'SET_ACTIVE_LANG':
      return { ...state, activeLang: action.payload };
    case 'SET_VOCAB':
      return { ...state, vocab: action.payload };
    case 'ADD_VOCAB_WORD':
      return { ...state, vocab: [...state.vocab, action.payload] };
    case 'REMOVE_VOCAB_WORD':
      return { ...state, vocab: state.vocab.filter((_, i) => i !== action.index) };
    case 'SET_HISTORY':
      return { ...state, history: action.payload };
    case 'ADD_SESSION':
      return { ...state, history: [action.payload, ...state.history].slice(0, 50) };
    case 'SET_DARK':
      return { ...state, dark: action.payload };
    case 'SET_LUMA_HISTORY':
      return { ...state, lumaHistory: action.payload };

    case 'AWARD_XP': {
      const amount = action.payload || 0;
      const prev = state.profile.xp || 0;
      return {
        ...state,
        profile: { ...state.profile, xp: prev + amount },
      };
    }

    case 'CHECK_STREAK': {
      const today = todayStr();
      const last = state.profile.lastDate || '';
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      if (last === today) {
        // Already counted today — no change
        return state;
      }

      let newStreak;
      if (last === yesterday) {
        // Consecutive day — increment
        newStreak = (state.profile.streak || 0) + 1;
      } else if (!last) {
        // First ever session
        newStreak = 1;
      } else {
        // Streak broken — reset
        newStreak = 1;
      }

      return {
        ...state,
        profile: {
          ...state.profile,
          streak: newStreak,
          lastDate: today,
          sessions: (state.profile.sessions || 0) + 1,
        },
      };
    }

    case 'SHOW_AUTH_MODAL':
      // handled by AuthModal via its own event — just a signal
      return state;

    case 'RESET_PROGRESS':
      return {
        ...state,
        profile: { ...DEFAULT_PROFILE, name: state.profile.name, native: state.profile.native, avatar: state.profile.avatar },
        history: [],
        languages: state.languages.map(l => ({ ...l, xp: 0, sessions: 0, history: [] })),
      };
    case 'CLEAR_VOCAB':
      return { ...state, vocab: [] };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, {
    currentUser: null,
    subscription: { status: 'free', conversations_used: 0 },
    profile: getItem('perin_profile', DEFAULT_PROFILE),
    languages: getItem('perin_languages', []),
    activeLang: {},
    vocab: getItem('perin_vocab', []),
    history: getItem('perin_history', []),
    dark: localStorage.getItem('perin_dark') === '1',
    lumaHistory: getItem('perin_luma_history', []),
  });

  const syncTimeoutRef = useRef(null);

  // Persist profile changes
  useEffect(() => { setItem('perin_profile', state.profile); }, [state.profile]);
  useEffect(() => { setItem('perin_languages', state.languages); }, [state.languages]);
  useEffect(() => { setItem('perin_vocab', state.vocab); }, [state.vocab]);
  useEffect(() => { setItem('perin_history', state.history); }, [state.history]);
  useEffect(() => { setItem('perin_luma_history', state.lumaHistory); }, [state.lumaHistory]);

  // Dark mode
  useEffect(() => {
    document.body.classList.toggle('dark', state.dark);
    localStorage.setItem('perin_dark', state.dark ? '1' : '0');
  }, [state.dark]);

  // Cloud sync (debounced)
  const syncToCloud = () => {
    if (!state.currentUser?.access_token) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const completed = getItem('perin_completed', {});
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${state.currentUser.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${state.currentUser.access_token}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            vocab_data: state.vocab,
            profile_data: state.profile,
            languages_data: state.languages,
            completed_data: completed,
            history_data: state.history.slice(0, 50),
            luma_data: state.lumaHistory.slice(0, 20),
            synced_at: new Date().toISOString(),
          }),
        });
      } catch { /* silent fail */ }
    }, 3000);
  };

  // Auth init
  useEffect(() => {
    const savedAuth = getItem('perin_auth');
    if (!savedAuth?.access_token) return;
    dispatch({ type: 'SET_USER', payload: savedAuth });
    fetchSubscription(savedAuth);
    if (savedAuth.refresh_token) {
      try {
        const payload = JSON.parse(atob(savedAuth.access_token.split('.')[1]));
        const expiresAt = payload.exp * 1000;
        if (expiresAt - Date.now() < 10 * 60 * 1000) {
          fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
            body: JSON.stringify({ refresh_token: savedAuth.refresh_token }),
          }).then(r => r.ok ? r.json() : null).then(data => {
            if (data?.access_token) {
              const updated = { ...savedAuth, access_token: data.access_token, refresh_token: data.refresh_token || savedAuth.refresh_token };
              localStorage.setItem('perin_auth', JSON.stringify(updated));
              dispatch({ type: 'SET_USER', payload: updated });
            }
          }).catch(() => {});
        }
      } catch { /* ignore */ }
    }
  }, []);

  async function fetchSubscription(user) {
    if (!user?.access_token) return;
    try {
      const res = await fetch(`${WORKER_URL}/api/subscription`, {
        headers: { 'Authorization': `Bearer ${user.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: 'SET_SUBSCRIPTION', payload: data });
      }
    } catch { /* silent */ }
  }

  const isPro = () => state.subscription?.status === 'pro';
  const value = { state, dispatch, syncToCloud, fetchSubscription, isPro };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
