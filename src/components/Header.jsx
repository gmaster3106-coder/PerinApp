import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useLocation } from 'react-router-dom';
import { showAuthModal } from './AuthModal.jsx';
import { useAuth } from '../hooks/useAuth.js';

const NO_HEADER = new Set(['/welcome', '/profile', '/onboarding', '/intro', '/chat', '/pressure', '/wordprep']);
const SHOW_BACK = new Set(['/scenarios', '/journey', '/scenes', '/connections', '/friends', '/memory', '/srs', '/fib', '/sentence-builder', '/listening', '/reading', '/vocab-quiz', '/dialect-decoder', '/settings']);

export default function Header() {
  const { state } = useApp();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const path = '/' + location.pathname.split('/').filter(p => p && p !== 'PerinApp').join('/');

  if (NO_HEADER.has(path)) return null;

  const xp = state.profile?.xp || 0;
  const level = Math.floor(xp / 100) + 1;
  const xpPct = xp % 100;
  const isLoggedIn = !!state.currentUser;
  const showBack = SHOW_BACK.has(path);
  const freeUsed = state.subscription?.conversations_used || 0;
  const freeLabel = isLoggedIn ? `${freeUsed}/5 free` : '0/5 free';

  return (
    <>
      <header>
        <div style={{ width: '100%', maxWidth: '960px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div className="header-left" style={{ flex: 1 }}>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
              <div className="logo">Pe<span>rin</span></div>
              <div className="tagline">Immersive Language Tutor</div>
            </div>
          </div>
          <div className="header-right">
            <div className="xp-bar-wrap">
              <span className="level-chip">Lv {level}</span>
              <div className="xp-track"><div className="xp-fill" style={{ width: `${xpPct}%` }}></div></div>
              <span className="xp-label">{xp} XP</span>
            </div>
            <button
              onClick={() => isLoggedIn ? navigate('/settings') : showAuthModal()}
              style={{ background: 'rgba(255,255,255,.15)', border: '1.5px solid rgba(255,255,255,.4)', borderRadius: '8px', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '.78rem', fontWeight: '700', cursor: 'pointer', padding: '5px 13px', whiteSpace: 'nowrap' }}
            >
              {isLoggedIn ? freeLabel : 'Sign In'}
            </button>
            <button className="dark-btn" onClick={() => navigate('/settings')} title="Settings">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
        </div>
      </header>
      {showBack && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, textAlign: 'left' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: '.9rem', fontWeight: '600', color: 'var(--accent)', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Back
          </button>
        </div>
      )}
    </>
  );
}
