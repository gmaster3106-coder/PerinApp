import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { ACCENT_THEMES } from '../config/constants.js';
import { getAvatarColor, getAvatarInitials } from '../utils/avatarUtils.js';

export default function Settings() {
  const { state, dispatch } = useApp();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const profile = state.profile;
  const avatarColor = getAvatarColor(profile?.name || 'user');
  const initials = getAvatarInitials(profile?.name, state.currentUser?.email);
  const vocabCount = state.vocab?.length || 0;
  const historyCount = state.history?.length || 0;
  const isLoggedIn = !!state.currentUser?.access_token;

  function toggleDark() {
    dispatch({ type: 'SET_DARK', payload: !state.dark });
  }

  function confirmClearVocab() {
    if (!vocabCount) return;
    if (window.confirm(`Clear all ${vocabCount} saved words? This cannot be undone.`)) {
      dispatch({ type: 'CLEAR_VOCAB' });
    }
  }

  function confirmResetProgress() {
    if (window.confirm('Reset all progress? This will clear your XP, badges, streaks, and completed scenarios.')) {
      dispatch({ type: 'RESET_PROGRESS' });
    }
  }

  function handleSignOut() {
    if (window.confirm('Sign out of your account?')) {
      logout();
      navigate('/welcome');
    }
  }

  function pickAccent(theme) {
    const root = document.documentElement;
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--header-bg', theme.header);
    localStorage.setItem('perin_accent', theme.id);
  }

  return (
    <div className="screen active" id="screen-settings">
      <div className="settings-wrap">
        <h2>Settings</h2>
        <p className="sub">Customize your Perin experience.</p>

        {/* Account */}
        <div className="settings-section">
          <div className="settings-section-label">Account</div>
          <div className="settings-card">
            <div className="settings-row clickable" onClick={() => navigate('/profile')}>
              <div className="settings-row-left">
                <div className="settings-row-icon" style={{ overflow: 'hidden', borderRadius: '50%', width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: avatarColor.bg, color: avatarColor.fg, fontWeight: '700', fontSize: '.85rem' }}>
                  {initials}
                </div>
                <div className="settings-row-text"><strong>Profile</strong><span>{profile?.name || 'Set your name'}</span></div>
              </div>
              <div className="settings-row-right"><span className="settings-chevron">›</span></div>
            </div>

            {isLoggedIn && (
              <div className="settings-row clickable settings-danger" onClick={handleSignOut}>
                <div className="settings-row-left">
                  <div className="settings-row-icon">🚪</div>
                  <div className="settings-row-text">
                    <strong>Sign Out</strong>
                    <span>{state.currentUser?.email}</span>
                  </div>
                </div>
              </div>
            )}

            {!isLoggedIn && (
              <div className="settings-row clickable" onClick={() => dispatch({ type: 'SHOW_AUTH_MODAL' })}>
                <div className="settings-row-left">
                  <div className="settings-row-icon">🔑</div>
                  <div className="settings-row-text"><strong>Sign In</strong><span>Sync progress across devices</span></div>
                </div>
                <div className="settings-row-right"><span className="settings-chevron">›</span></div>
              </div>
            )}
          </div>
        </div>

        {/* Learning */}
        <div className="settings-section">
          <div className="settings-section-label">Learning</div>
          <div className="settings-card">
            <div className="settings-row clickable">
              <div className="settings-row-left">
                <div className="settings-row-icon">📊</div>
                <div className="settings-row-text"><strong>Progress Charts</strong><span>XP, levels, and session history</span></div>
              </div>
              <div className="settings-row-right"><span className="settings-chevron">›</span></div>
            </div>
            <div className="settings-row clickable">
              <div className="settings-row-left">
                <div className="settings-row-icon">📋</div>
                <div className="settings-row-text"><strong>Session History</strong><span>{historyCount > 0 ? `${historyCount} sessions` : 'No sessions yet'}</span></div>
              </div>
              <div className="settings-row-right"><span className="settings-chevron">›</span></div>
            </div>
            <div className="settings-row clickable" onClick={() => navigate('/srs')}>
              <div className="settings-row-left">
                <div className="settings-row-icon">💾</div>
                <div className="settings-row-text"><strong>Saved Vocabulary</strong><span>{vocabCount > 0 ? `${vocabCount} words saved` : 'No words saved yet'}</span></div>
              </div>
              <div className="settings-row-right"><span className="settings-chevron">›</span></div>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="settings-section">
          <div className="settings-section-label">Appearance</div>
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-left">
                <div className="settings-row-icon">🌙</div>
                <div className="settings-row-text"><strong>Dark Mode</strong><span>Easy on the eyes</span></div>
              </div>
              <div className="settings-row-right">
                <div className={`toggle-track${state.dark ? ' active' : ''}`} onClick={toggleDark}>
                  <div className="toggle-thumb"></div>
                </div>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-left" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="settings-row-icon">🎨</div>
                  <div className="settings-row-text"><strong>Accent Color</strong><span>Pick your theme color</span></div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingLeft: '44px' }}>
                  {ACCENT_THEMES.map(t => (
                    <button key={t.id} onClick={() => pickAccent(t)} title={t.label}
                      style={{ width: '28px', height: '28px', borderRadius: '50%', background: t.accent, border: '2px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data */}
        <div className="settings-section">
          <div className="settings-section-label">Data</div>
          <div className="settings-card">
            <div className="settings-row clickable settings-danger" onClick={confirmClearVocab}>
              <div className="settings-row-left">
                <div className="settings-row-icon">🗑️</div>
                <div className="settings-row-text"><strong>Clear Saved Vocabulary</strong><span>Remove all saved words</span></div>
              </div>
            </div>
            <div className="settings-row clickable settings-danger" onClick={confirmResetProgress}>
              <div className="settings-row-left">
                <div className="settings-row-icon">⚠️</div>
                <div className="settings-row-text"><strong>Reset All Progress</strong><span>Clears XP, badges, history</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="settings-section">
          <div className="settings-section-label">About</div>
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-left">
                <div className="settings-row-icon">ℹ️</div>
                <div className="settings-row-text"><strong>Version</strong><span>1.0.0</span></div>
              </div>
            </div>
            <div className="settings-row clickable" onClick={() => window.open('mailto:support@speakperin.com', '_blank')}>
              <div className="settings-row-left">
                <div className="settings-row-icon">✉️</div>
                <div className="settings-row-text"><strong>Contact and Feedback</strong><span>support@speakperin.com</span></div>
              </div>
              <div className="settings-row-right"><span className="settings-chevron">›</span></div>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '.75rem', color: 'var(--muted)', marginTop: '8px' }}>Perin · Built with love</p>
      </div>
    </div>
  );
}
