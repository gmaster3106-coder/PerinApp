import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { WORKER_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/constants.js';

const AppContext = createContext(null);

const DEFAULT_PROFILE = {
  name: '', native: 'English', avatar: '🧑', xp: 0, sessions: 0,
  streak: 0, lastDate: '', badges: [], streakFreezes: 0,
  motivation: '', milestones: [],
};

const DEFAULT_SUBSCRIPTION = { status: 'free', conversations_used: 0 };

function lsGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota exceeded */ }
}

function todayStr() { return new Date().toDateString(); }

function getInitialDark() {
  const saved = localStorage.getItem('perin_dark');
  if (saved !== null) return saved === '1';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
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

    // ── GRAMMAR ERROR TRACKING ──
    case 'ADD_GRAMMAR_ERROR': {
      const { correction, original, explanation, lang } = action.payload;
      if (!correction || !original) return state;
      const key = `${correction.toLowerCase()}::${lang}`;
      const existing = state.grammarErrors.find(e =>
        `${e.correction.toLowerCase()}::${e.lang}` === key
      );
      if (existing) {
        return {
          ...state,
          grammarErrors: state.grammarErrors.map(e =>
            `${e.correction.toLowerCase()}::${e.lang}` === key
              ? { ...e, count: e.count + 1, lastSeen: Date.now() }
              : e
          ),
        };
      }
      return {
        ...state,
        grammarErrors: [
          { correction, original, explanation, lang, count: 1, firstSeen: Date.now(), lastSeen: Date.now() },
          ...state.grammarErrors,
        ].slice(0, 100),
      };
    }

    case 'AWARD_XP': {
      const amount = action.payload || 0;
      if (!amount) return state;
      return { ...state, profile: { ...state.profile, xp: (state.profile.xp || 0) + amount } };
    }

    case 'CHECK_STREAK': {
      const today = todayStr();
      const last = state.profile.lastDate || '';
      if (last === today) return state;
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const missedDay = last !== yesterday && last !== '';
      const hasFreeze = (state.profile.streakFreezes || 0) > 0;
      const newStreak = last === yesterday
        ? (state.profile.streak || 0) + 1
        : (missedDay && hasFreeze) ? (state.profile.streak || 0) : 1;
      const newSessions = (state.profile.sessions || 0) + 1;
      const usedFreeze = last !== yesterday && last !== '' && (state.profile.streakFreezes || 0) > 0;
      const newFreezes = newSessions % 7 === 0
        ? (state.profile.streakFreezes || 0) + 1
        : usedFreeze ? (state.profile.streakFreezes || 0) - 1
        : (state.profile.streakFreezes || 0);
      return {
        ...state,
        profile: {
          ...state.profile,
          streak: newStreak,
          lastDate: today,
          sessions: newSessions,
          streakFreezes: Math.max(0, newFreezes),
        },
      };
    }

    case 'SHOW_AUTH_MODAL':
      return state;

    case 'RESET_PROGRESS':
      return {
        ...state,
        profile: { ...DEFAULT_PROFILE, name: state.profile.name, native: state.profile.native, avatar: state.profile.avatar },
        history: [],
        languages: state.languages.map(l => ({ ...l, xp: 0, sessions: 0, history: [] })),
        grammarErrors: [],
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
    subscription: lsGet('perin_subscription', DEFAULT_SUBSCRIPTION),
    profile: lsGet('perin_profile', DEFAULT_PROFILE),
    languages: lsGet('perin_languages', []),
    activeLang: {},
    vocab: lsGet('perin_vocab', []),
    history: lsGet('perin_history', []),
    dark: getInitialDark(),
    lumaHistory: lsGet('perin_luma_history', []),
    grammarErrors: lsGet('perin_grammar_errors', []),
  });

  const syncTimeoutRef = useRef(null);
  const syncRetryRef = useRef(0);

  const isLoggedIn = !!state.currentUser?.access_token;

  useEffect(() => {
    if (isLoggedIn) lsSet('perin_profile', state.profile);
  }, [state.profile, isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) lsSet('perin_languages', state.languages);
  }, [state.languages, isLoggedIn]);
  useEffect(() => { lsSet('perin_vocab', state.vocab); }, [state.vocab]);
  useEffect(() => { lsSet('perin_history', state.history); }, [state.history]);
  useEffect(() => { lsSet('perin_luma_history', state.lumaHistory); }, [state.lumaHistory]);
  useEffect(() => { lsSet('perin_grammar_errors', state.grammarErrors); }, [state.grammarErrors]);

  useEffect(() => {
    if (state.subscription?.status === 'free') {
      lsSet('perin_subscription', state.subscription);
    }
  }, [state.subscription]);

  useEffect(() => {
    document.body.classList.toggle('dark', state.dark);
    localStorage.setItem('perin_dark', state.dark ? '1' : '0');
  }, [state.dark]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      if (localStorage.getItem('perin_dark') === null) {
        dispatch({ type: 'SET_DARK', payload: e.matches });
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const syncToCloud = () => {
    if (!state.currentUser?.access_token) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      let attempt = 0;
      const maxRetries = 3;
      async function attemptSync() {
        try {
          const completed = lsGet('perin_completed', {});
          const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${state.currentUser.id}`, {
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
          if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
          syncRetryRef.current = 0;
        } catch {
          attempt++;
          if (attempt < maxRetries) {
            const delay = 5000 * Math.pow(3, attempt - 1);
            setTimeout(attemptSync, delay);
          }
        }
      }
      attemptSync();
    }, 3000);
  };

  useEffect(() => {
    const raw = localStorage.getItem('perin_auth');
    if (!raw) return;
    let savedAuth;
    try { savedAuth = JSON.parse(raw); } catch { return; }
    if (!savedAuth?.access_token) return;
    dispatch({ type: 'SET_USER', payload: savedAuth });
    fetchSubscription(savedAuth);
    if (savedAuth.refresh_token) {
      try {
        const payload = JSON.parse(atob(savedAuth.access_token.split('.')[1]));
        if (payload.exp * 1000 - Date.now() < 10 * 60 * 1000) {
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
      if (res.ok) dispatch({ type: 'SET_SUBSCRIPTION', payload: await res.json() });
    } catch { /* silent */ }
  }

  const isPro = () => state.subscription?.status === 'pro';
  return (
    <AppContext.Provider value={{ state, dispatch, syncToCloud, fetchSubscription, isPro }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
